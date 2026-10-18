#!/usr/bin/env bash
# real-e2e.sh — end-to-end playground verification for the exact-replica
# components: seeded components, real mouse drags, dialogs, wiring, run.
#
# Drag-direction rule: the camera sits at (+12, +10, +14), so the object
# with the HIGHER x+z has the clear line of sight. We always GRAB the
# more camera-facing object of a pair and drop it next to the other —
# connectBetween() assigns the power PROVIDER as parent regardless of
# which side moved, so the wiring outcome is identical.
set -u
cd /home/z/my-project

shot() { agent-browser screenshot "scripts/real-e2e-$1.png" >/dev/null 2>&1; }
log() { echo "[$(date +%H:%M:%S)] $*"; }

# ---- 0. fresh playground with a full component spread ----
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 2
agent-browser eval "localStorage.setItem('playground.v1', JSON.stringify([
  {id:'a1',slug:'9v-battery',name:'9V Battery',kind:'battery',modelUrl:null,x:0,z:0,parentId:null,parentPort:null,childPort:null},
  {id:'a2',slug:'dc-motor',name:'DC Gear Motor',kind:'dcmotor',modelUrl:null,x:-4.5,z:-3.5,parentId:null,parentPort:null,childPort:null},
  {id:'a3',slug:'lipo-battery',name:'LiPo Battery Pack',kind:'lipo',modelUrl:null,x:6.5,z:5.5,parentId:null,parentPort:null,childPort:null},
  {id:'a4',slug:'esc',name:'Speed Controller',kind:'esc',modelUrl:null,x:2.0,z:5.0,parentId:null,parentPort:null,childPort:null},
  {id:'a5',slug:'stepper-motor',name:'Stepper Motor',kind:'stepper',modelUrl:null,x:-6.0,z:3.0,parentId:null,parentPort:null,childPort:null},
  {id:'a6',slug:'servo-motor',name:'Servo Motor',kind:'servo',modelUrl:null,x:0.0,z:-5.5,parentId:null,parentPort:null,childPort:null},
  {id:'a7',slug:'arduino-uno',name:'Arduino Uno',kind:'controller',modelUrl:null,x:4.5,z:-3.0,parentId:null,parentPort:null,childPort:null},
  {id:'a8',slug:'ultrasonic-sensor',name:'Ultrasonic Sensor',kind:'ultrasonic',modelUrl:null,x:-8.0,z:-0.5,parentId:null,parentPort:null,childPort:null},
  {id:'a9',slug:'ir-sensor',name:'IR Proximity Sensor',kind:'irsensor',modelUrl:null,x:-3.0,z:6.5,parentId:null,parentPort:null,childPort:null}
])); 'seeded'" 2>&1 | tail -1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 3

# ---- 1. open the playground ----
agent-browser find role button click --name "Playground" >/dev/null 2>&1
sleep 6
shot 01-spread
log "spread screenshotted"

# canvas rect for the drag math (space-separated to survive shell quoting)
RECT=$(agent-browser eval "const r=document.querySelector('canvas').getBoundingClientRect(); Math.round(r.x)+' '+Math.round(r.y)+' '+Math.round(r.width)+' '+Math.round(r.height)" 2>/dev/null | tail -1 | tr -d '"\\')
log "canvas rect: $RECT"
read -r OXraw OYraw Wraw Hraw <<< "$RECT"
export W=${Wraw:-1280} H=${Hraw:-480} OX=${OXraw:-0} OY=${OYraw:-97}
log "geometry W=$W H=$H OX=$OX OY=$OY"

INST='[
 {"id":"a1","slug":"9v-battery","name":"9V Battery","kind":"battery","x":0,"z":0},
 {"id":"a2","slug":"dc-motor","name":"DC Gear Motor","kind":"dcmotor","x":-4.5,"z":-3.5},
 {"id":"a3","slug":"lipo-battery","name":"LiPo Battery Pack","kind":"lipo","x":6.5,"z":5.5},
 {"id":"a4","slug":"esc","name":"Speed Controller","kind":"esc","x":2.0,"z":5.0},
 {"id":"a5","slug":"stepper-motor","name":"Stepper Motor","kind":"stepper","x":-6.0,"z":3.0},
 {"id":"a6","slug":"servo-motor","name":"Servo Motor","kind":"servo","x":0.0,"z":-5.5},
 {"id":"a7","slug":"arduino-uno","name":"Arduino Uno","kind":"controller","x":4.5,"z":-3.0},
 {"id":"a8","slug":"ultrasonic-sensor","name":"Ultrasonic Sensor","kind":"ultrasonic","x":-8.0,"z":-0.5},
 {"id":"a9","slug":"ir-sensor","name":"IR Proximity Sensor","kind":"irsensor","x":-3.0,"z":6.5}
]'

check_moved() { # name
  agent-browser eval "localStorage.getItem('playground.v1')" 2>/dev/null | tail -1 | tr -d '\\' | python3 -c "
import sys, json
raw = sys.stdin.read().strip().strip('\"')
try:
    insts = json.loads(raw)
except Exception:
    print('STATE-UNREADABLE'); raise SystemExit
tgt = [i for i in insts if i['name'] == '$1']
if not tgt: print('MISSING $1'); raise SystemExit
i = tgt[0]
print('   -> $1 x', round(i['x'],1), 'z', round(i['z'],1), 'parent', i.get('parentId'))
"
}

drag_to() { # grabName targetName tag
  # Fresh instance state from the live page (positions change as we drag).
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
  if [ -z "$FRESH" ] || [ "$FRESH" = "[]" ]; then FRESH="$INST"; fi
  local PTS
  PTS=$(node scripts/wire-drag-live.mjs "$FRESH" "$1" "$2")
  if ! echo "$PTS" | rg -q '"grab"'; then
    log "GRAB BLOCKED: $1 — retrying reversed ($2 onto $1)"
    PTS=$(node scripts/wire-drag-live.mjs "$FRESH" "$2" "$1")
    if ! echo "$PTS" | rg -q '"grab"'; then
      log "GRAB BLOCKED both ways: $1 <-> $2 — skipping"
      return
    fi
    local SWAP="$1"; set -- "$2" "$1" "$3"
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
  sleep 1.6
  shot "$3-drop"
  check_moved "$1"
}

# ---- 2. battery onto the DC gear motor (battery is camera-clear) ----
drag_to "9V Battery" "DC Gear Motor" "02-battery-dcmotor"
shot 03-after-dialog
agent-browser find role button click --name "Connect" --exact >/dev/null 2>&1 && log "OK: dialog accepted (battery->DC motor)" || log "FAIL: no dialog for battery->DC motor"
check_moved "DC Gear Motor"

# ---- 3. battery onto the stepper (expect REFUSAL, no dialog) ----
drag_to "9V Battery" "Stepper Motor" "04-battery-stepper"
if agent-browser find role button click --name "Connect" --exact >/dev/null 2>&1; then
  log "FAIL: stepper dialog appeared (should be refused)"
else
  log "OK: stepper refused (no dialog)"
fi

# ---- 4. ESC onto the LiPo (both camera-side; ESC is the mover) ----
drag_to "Speed Controller" "LiPo Battery Pack" "05-esc-lipo"
agent-browser find role button click --name "Connect" --exact >/dev/null 2>&1 && log "OK: dialog accepted (ESC->LiPo)" || log "FAIL: no dialog for ESC->LiPo"
check_moved "Speed Controller"

# ---- 5. ESC (now part of the LiPo group) onto the IR sensor ----
drag_to "Speed Controller" "IR Proximity Sensor" "06-esc-ir"
agent-browser find role button click --name "Connect" --exact >/dev/null 2>&1 && log "OK: dialog accepted (ESC->IR)" || log "FAIL: no dialog for ESC->IR"
check_moved "IR Proximity Sensor"

# ---- 6. Arduino onto the servo (Arduino is camera-clear) ----
drag_to "Arduino Uno" "Servo Motor" "07-arduino-servo"
agent-browser find role button click --name "Connect" --exact >/dev/null 2>&1 && log "OK: dialog accepted (servo->Arduino)" || log "FAIL: no dialog for Arduino->servo"
check_moved "Servo Motor"

# ---- 7. Arduino (+servo group) onto the ultrasonic ----
drag_to "Arduino Uno" "Ultrasonic Sensor" "08-arduino-us"
agent-browser find role button click --name "Connect" --exact >/dev/null 2>&1 && log "OK: dialog accepted (ultrasonic->Arduino)" || log "FAIL: no dialog for Arduino->ultrasonic"
check_moved "Ultrasonic Sensor"

# ---- 8. Run everything ----
shot 10-all-wired
agent-browser find role button click --name "Run" >/dev/null 2>&1 && log "RUN pressed"
sleep 3
shot 11-running
sleep 3
shot 12-running2

# ---- 9. reload → persistence ----
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 2
agent-browser find role button click --name "Playground" >/dev/null 2>&1
sleep 5
shot 13-reloaded
agent-browser eval "localStorage.getItem('playground.v1')" 2>/dev/null | tail -1 | tr -d '\\' | python3 -c "
import sys, json
raw = sys.stdin.read().strip().strip('\"')
insts = json.loads(raw)
print('FINAL STATE:')
for i in insts:
    print('  ', i['name'], '| parent:', i.get('parentId'), '| ports:', i.get('parentPort'), '->', i.get('childPort'))
"

log "E2E complete"
