#!/usr/bin/env bash
# t13-e2e.sh — end-to-end verification of the multi-domain connection
# system: electrical wiring, mechanical couplings, pneumatic tubing.
#
# Chain under test:
#   DC Gear Motor ──coupling──> Planetary Gear      (mechanical, done FIRST
#   9V Battery ──wires──> DC Gear Motor              so nothing occludes)
#   9V Battery ──wires──> Mini Air Pump ──tubing──> Pneumatic Muscle
#   Mini Air Pump ──tubing──> Vane Rotary Actuator
#   9V Battery ──wires──> Capacitor (rail smoothing)
#   Strain Wave Gear ──✗──> 9V Battery (refused: needs rotation, not volts)
set -u
cd /home/z/my-project
SHOTS=/home/z/my-project/scripts

shot() { agent-browser screenshot "t13-$1.png" >/dev/null 2>&1; }
log() { echo "[$(date +%H:%M:%S)] $*"; }

# ---- 0. fresh playground with the multi-domain spread ----
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 2
agent-browser eval "localStorage.setItem('playground.v1', JSON.stringify([
  {id:'b1',slug:'9v-battery',name:'9V Battery',kind:'battery',modelUrl:null,x:0,z:0,parentId:null,parentPort:null,childPort:null},
  {id:'b2',slug:'dc-motor',name:'DC Gear Motor',kind:'dcmotor',modelUrl:null,x:-4.5,z:-3.5,parentId:null,parentPort:null,childPort:null},
  {id:'b3',slug:'planetary-gear',name:'Planetary Gear',kind:'planetary',modelUrl:null,x:-9.0,z:-1.0,parentId:null,parentPort:null,childPort:null},
  {id:'b4',slug:'mini-air-pump',name:'Mini Air Pump',kind:'airpump',modelUrl:null,x:5.0,z:-4.0,parentId:null,parentPort:null,childPort:null},
  {id:'b5',slug:'pneumatic-muscle',name:'Pneumatic Muscle',kind:'muscle',modelUrl:null,x:9.5,z:-1.5,parentId:null,parentPort:null,childPort:null},
  {id:'b6',slug:'electrolytic-capacitor',name:'Capacitor',kind:'capacitor',modelUrl:null,x:-1.5,z:5.5,parentId:null,parentPort:null,childPort:null},
  {id:'b7',slug:'vane-actuator',name:'Vane Rotary Actuator',kind:'vaneact',modelUrl:null,x:4.0,z:6.5,parentId:null,parentPort:null,childPort:null},
  {id:'b8',slug:'strain-wave-gear',name:'Strain Wave Gear',kind:'strainwave',modelUrl:null,x:-9.0,z:4.0,parentId:null,parentPort:null,childPort:null}
])); 'seeded'" 2>&1 | tail -1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 3
agent-browser find role button click --name "Playground" >/dev/null 2>&1
sleep 6
shot 01-spread
log "spread screenshotted"

# canvas rect for the drag math
RECT=$(agent-browser eval "const r=document.querySelector('canvas').getBoundingClientRect(); Math.round(r.x)+' '+Math.round(r.y)+' '+Math.round(r.width)+' '+Math.round(r.height)" 2>/dev/null | tail -1 | tr -d '"\\')
read -r OXraw OYraw Wraw Hraw <<< "$RECT"
export W=${Wraw:-1280} H=${Hraw:-480} OX=${OXraw:-0} OY=${OYraw:-97}
log "canvas rect W=$W H=$H OX=$OX OY=$OY"

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

drag_to() { # grabName targetName tag
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
  PTS=$(node scripts/wire-drag-live.mjs "$FRESH" "$1" "$2")
  if ! echo "$PTS" | rg -q '"grab"'; then
    log "GRAB BLOCKED: $1 — retrying reversed"
    PTS=$(node scripts/wire-drag-live.mjs "$FRESH" "$2" "$1")
    if ! echo "$PTS" | rg -q '"grab"'; then
      log "GRAB BLOCKED both ways: $1 <-> $2 — skipping"
      return
    fi
    set -- "$2" "$1" "$3"
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
  shot "$3-mid"
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

# ---- 1. MECHANICAL: motor onto the planetary gear (coupling) ----
log "drag motor -> planetary (mechanical coupling)"
drag_to "DC Gear Motor" "Planetary Gear" "02-motor-planetary"
confirm
state

# ---- 2. electrical: battery onto the DC gear motor ----
log "drag battery -> motor (electrical)"
drag_to "9V Battery" "DC Gear Motor" "03-batt-motor"
confirm
state

# ---- 3. electrical: pump onto the battery ----
log "drag pump -> battery (electrical)"
drag_to "Mini Air Pump" "9V Battery" "04-pump-battery"
confirm
state

# ---- 4. pneumatic: muscle onto the pump (tubing) ----
log "drag muscle -> pump (pneumatic tubing)"
drag_to "Pneumatic Muscle" "Mini Air Pump" "05-muscle-pump"
confirm
state

# ---- 5. pneumatic: vane onto the pump ----
log "drag vane -> pump (pneumatic tubing)"
drag_to "Vane Rotary Actuator" "Mini Air Pump" "06-vane-pump"
confirm
state

# ---- 6. electrical: capacitor across the battery ----
log "drag capacitor -> battery (smoothing)"
drag_to "Capacitor" "9V Battery" "07-cap-battery"
confirm
state

# ---- 7. refusal: strain wave gear onto the battery ----
log "drag strainwave -> battery (must be refused: needs rotation)"
drag_to "Strain Wave Gear" "9V Battery" "08-strainwave-battery"
sleep 1.4
log "  dialog after refusal: $(dialog_title) (expect NO-DIALOG)"
HINT=$(agent-browser eval "[...document.querySelectorAll('span')].map(s=>s.textContent).find(t=>t.includes('needs rotation')||t.includes('couple a motor')) ?? 'no-hint'" 2>/dev/null | tail -1)
log "  refusal hint: $HINT"

sleep 2
shot 09-final-wired
log "final state screenshotted"
state
