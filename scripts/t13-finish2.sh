#!/usr/bin/env bash
# t13-finish2.sh — relocate the pump group + capacitor to clear ground via
# localStorage (the cluster around the battery blocks grab rays), then wire
# pump→battery and capacitor→battery with clean approach directions.
set -u
cd /home/z/my-project

shot() { agent-browser screenshot "t13-$1.png" >/dev/null 2>&1; }
log() { echo "[$(date +%H:%M:%S)] $*"; }

# ---- 0. move pump group (+children) and capacitor to clear spots ----
agent-browser eval "(() => {
  const insts = JSON.parse(localStorage.getItem('playground.v1'));
  const dx = 7 - 1.29, dz = -4 - (-0.10);
  for (const i of insts) {
    if (i.id === 'b4' || i.parentId === 'b4') { i.x += dx; i.z += dz; }
    if (i.id === 'b6') { i.x = -1.5; i.z = 5.5; }
  }
  localStorage.setItem('playground.v1', JSON.stringify(insts));
  return 'relocated';
})()" 2>&1 | tail -1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 3
agent-browser find role button click --name "Playground" >/dev/null 2>&1
sleep 6

RECT=$(agent-browser eval "const r=document.querySelector('canvas').getBoundingClientRect(); Math.round(r.x)+' '+Math.round(r.y)+' '+Math.round(r.width)+' '+Math.round(r.height)" 2>/dev/null | tail -1 | tr -d '"\\')
read -r OXraw OYraw Wraw Hraw <<< "$RECT"
export W=${Wraw:-1280} H=${Hraw:-480} OX=${OXraw:-0} OY=${OYraw:-97}

state() {
  agent-browser eval "localStorage.getItem('playground.v1')" 2>/dev/null | tail -1 | tr -d '\\' | python3 -c "
import sys, json
raw = sys.stdin.read().strip().strip('\"')
try:
    insts = json.loads(raw)
except Exception:
    print('STATE-UNREADABLE'); raise SystemExit
for i in insts:
    print(f\"   {i['name']:24s} parent={i.get('parentId')} ports={i.get('parentPort')}>{i.get('childPort')}\")
"
}

dialog_title() {
  agent-browser eval "document.querySelector('[role=alertdialog] h2')?.textContent ?? 'NO-DIALOG'" 2>/dev/null | tail -1
}

drag_to() { # grabName targetName tag offX offZ
  local FRESH
  FRESH=$(agent-browser eval "localStorage.getItem('playground.v1')" 2>/dev/null | tail -1 | tr -d '\\' | python3 -c "
import sys, json
raw = sys.stdin.read().strip().strip('\"')
try:
    insts = json.loads(raw)
except Exception:
    print('[]'); raise SystemExit
print(json.dumps([{k: i[k] for k in ('id','slug','name','kind','x','z')} for i in insts]))
")
  local PTS
  PTS=$(node scripts/wire-drag-live.mjs "$FRESH" "$1" "$2" "${4:-1.4}" "${5:-0.9}")
  if ! echo "$PTS" | rg -q '"grab"'; then
    log "GRAB BLOCKED: $1 — skipping"
    return
  fi
  local GX GY M1X M1Y M2X M2Y DX DY
  GX=$(echo "$PTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['grab']['x'])")
  GY=$(echo "$PTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['grab']['y'])")
  M1X=$(echo "$PTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['mid1']['x'])")
  M1Y=$(echo "$PTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['mid1']['y'])")
  M2X=$(echo "$PTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['mid2']['x'])")
  M2Y=$(echo "$PTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['mid2']['y'])")
  DX=$(echo "$PTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['drop']['x'])")
  DY=$(echo "$PTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['drop']['y'])")
  agent-browser mouse move "$GX" "$GY" >/dev/null 2>&1
  sleep 0.4
  agent-browser mouse down left >/dev/null 2>&1
  sleep 0.4
  agent-browser mouse move "$M1X" "$M1Y" --duration 350 >/dev/null 2>&1
  sleep 0.2
  agent-browser mouse move "$M2X" "$M2Y" --duration 350 >/dev/null 2>&1
  agent-browser mouse move "$DX" "$DY" --duration 350 >/dev/null 2>&1
  sleep 0.6
  agent-browser mouse up left >/dev/null 2>&1
  sleep 1.4
}

confirm() {
  sleep 0.9
  log "  dialog: $(dialog_title)"
  agent-browser find text "Connect" click --exact >/dev/null 2>&1
  sleep 1.2
}

log "drag pump -> battery (approach -x/-z)"
drag_to "Mini Air Pump" "9V Battery" "11-pump-battery" -1.4 -0.9
confirm
state

log "drag capacitor -> battery (approach -z)"
drag_to "Capacitor" "9V Battery" "12-cap-battery" -0.4 -1.7
confirm
state

sleep 2
shot 13-final-wired
log "final scene captured"
