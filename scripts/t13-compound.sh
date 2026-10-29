#!/usr/bin/env bash
set -u
cd /home/z/my-project
log() { echo "[$(date +%H:%M:%S)] $*"; }
RECT=$(agent-browser eval "const r=document.querySelector('canvas').getBoundingClientRect(); Math.round(r.x)+' '+Math.round(r.y)+' '+Math.round(r.width)+' '+Math.round(r.height)" 2>/dev/null | tail -1 | tr -d '"\\')
read -r OXraw OYraw Wraw Hraw <<< "$RECT"
export W=${Wraw:-1280} H=${Hraw:-480} OX=${OXraw:-0} OY=${OYraw:-97}

fresh() {
  agent-browser eval "localStorage.getItem('playground.v1')" 2>/dev/null | tail -1 | tr -d '\\' | python3 -c "
import sys, json
raw = sys.stdin.read().strip().strip('\"')
try:
    insts = json.loads(raw)
except Exception:
    print('[]'); raise SystemExit
print(json.dumps([{k: i[k] for k in ('id','slug','name','kind','x','z')} for i in insts]))
"
}
grab() { node scripts/wire-drag-live.mjs "$(fresh)" "$1" "$2" "${3:-1.4}" "${4:-0.9}"; }

# strainwave -> motor (couple onto the motor shaft as well)
PTS=$(grab "Strain Wave Gear" "DC Gear Motor" -0.6 -1.6)
if echo "$PTS" | rg -q '"grab"'; then
  GX=$(echo "$PTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['grab']['x'])")
  GY=$(echo "$PTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['grab']['y'])")
  M1X=$(echo "$PTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['mid1']['x'])")
  M1Y=$(echo "$PTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['mid1']['y'])")
  M2X=$(echo "$PTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['mid2']['x'])")
  M2Y=$(echo "$PTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['mid2']['y'])")
  DX=$(echo "$PTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['drop']['x'])")
  DY=$(echo "$PTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['drop']['y'])")
  agent-browser mouse move "$GX" "$GY" >/dev/null 2>&1; sleep 0.4
  agent-browser mouse down left >/dev/null 2>&1; sleep 0.4
  agent-browser mouse move "$M1X" "$M1Y" --duration 350 >/dev/null 2>&1; sleep 0.2
  agent-browser mouse move "$M2X" "$M2Y" --duration 350 >/dev/null 2>&1
  agent-browser mouse move "$DX" "$DY" --duration 350 >/dev/null 2>&1; sleep 0.6
  agent-browser mouse up left >/dev/null 2>&1; sleep 1.4
  sleep 0.9
  log "dialog: $(agent-browser eval "document.querySelector('[role=alertdialog] h2')?.textContent ?? 'NO-DIALOG'" 2>/dev/null | tail -1)"
  agent-browser find text "Connect" click --exact >/dev/null 2>&1
  sleep 1.4
else
  log "GRAB BLOCKED strainwave"
fi

state() {
  agent-browser eval "localStorage.getItem('playground.v1')" 2>/dev/null | tail -1 | tr -d '\\' | python3 -c "
import sys, json
raw = sys.stdin.read().strip().strip('\"')
insts = json.loads(raw)
for i in insts:
    print(f\"   {i['name']:24s} parent={i.get('parentId')} ports={i.get('parentPort')}>{i.get('childPort')}\")
"
}
state

# click the strainwave (now adjacent to the motor, clear area) for its chip
sleep 1
PTS2=$(grab "Strain Wave Gear" "Strain Wave Gear")
if echo "$PTS2" | rg -q '"grab"'; then
  X=$(echo "$PTS2" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['grab']['x'])")
  Y=$(echo "$PTS2" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['grab']['y'])")
  agent-browser mouse move "$X" "$Y" >/dev/null 2>&1; sleep 0.3
  agent-browser mouse down left >/dev/null 2>&1; sleep 0.15
  agent-browser mouse up left >/dev/null 2>&1; sleep 0.9
  log "strainwave chip: $(agent-browser eval "document.querySelector('.absolute.bottom-4 span.rounded-full')?.textContent ?? 'no-chip'" 2>/dev/null | tail -1)"
else
  log "strainwave click blocked"
fi
agent-browser screenshot scripts/t13-14-compound.png >/dev/null 2>&1
