#!/usr/bin/env bash
# t13-chips.sh — click components and read the live status chip per domain.
set -u
cd /home/z/my-project

RECT=$(agent-browser eval "const r=document.querySelector('canvas').getBoundingClientRect(); Math.round(r.x)+' '+Math.round(r.y)+' '+Math.round(r.width)+' '+Math.round(r.height)" 2>/dev/null | tail -1 | tr -d '"\\')
read -r OXraw OYraw Wraw Hraw <<< "$RECT"
export W=${Wraw:-1280} H=${Hraw:-480} OX=${OXraw:-0} OY=${OYraw:-97}

grab_point() { # name -> prints "x y"
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
  node scripts/wire-drag-live.mjs "$FRESH" "$1" "$1" 2>/dev/null | python3 -c "
import json,sys
try:
    d = json.load(sys.stdin)
    print(d['grab']['x'], d['grab']['y'])
except Exception:
    print('BLOCKED')
"
}

click_comp() { # name
  local PT
  PT=$(grab_point "$1")
  if [ "$PT" = "BLOCKED" ]; then
    echo "  $1: GRAB BLOCKED"
    return
  fi
  local X Y
  read -r X Y <<< "$PT"
  agent-browser mouse move "$X" "$Y" >/dev/null 2>&1
  sleep 0.3
  agent-browser mouse down left >/dev/null 2>&1
  sleep 0.15
  agent-browser mouse up left >/dev/null 2>&1
  sleep 0.8
  local CHIP
  CHIP=$(agent-browser eval "document.querySelector('.absolute.bottom-4 span.rounded-full')?.textContent ?? 'no-chip'" 2>/dev/null | tail -1)
  echo "  $1 -> $CHIP"
}

click_comp "Pneumatic Muscle"
click_comp "Vane Rotary Actuator"
click_comp "Planetary Gear"
click_comp "Capacitor"
click_comp "Mini Air Pump"
click_comp "9V Battery"
click_comp "Strain Wave Gear"
