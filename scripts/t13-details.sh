#!/bin/bash
# Task 13: detail-page verification for the 10 new exact-replica components.
cd /home/z/my-project/scripts

check() {
  local name="$1" file="$2" prompt="$3"
  agent-browser eval "document.querySelector('nav button').click(); 'ok'" >/dev/null 2>&1
  sleep 0.7
  local found
  found=$(agent-browser eval "const els=[...document.querySelectorAll('ul.divide-y li button')]; const el=els.find(b=>b.querySelector('span')?.textContent==='$name'); if(el){el.scrollIntoView({block:'center'}); el.click(); 'ok'} else 'missing'" 2>&1 | tail -1)
  sleep 3
  agent-browser screenshot "$file" >/dev/null 2>&1
  echo "=== $name ($found) ==="
  node vlm-check.mjs "$file" "$prompt" 2>&1 | tail -6
  echo
}

check "Planetary Gear" t13-detail-planetary.png "3D part on a pedestal. Is this a planetary gear stage (ring gear with internal teeth, brass sun + 3 planets, carrier, input/output shafts)? Describe key visible details. Anything broken (black blobs, missing geometry, floating parts)? Rate realism 1-10. Answer in 4 lines max."

check "Ball Screw" t13-detail-ballscrew.png "3D part on a pedestal. Is this a ball screw (long chrome shaft with helical groove, ball nut with flange, two bearing blocks)? Describe key visible details. Anything broken? Rate realism 1-10. Answer in 4 lines max."

check "M3 Socket Screw" t13-detail-screw.png "3D part on a pedestal. Is this a small socket-head cap screw (cylindrical head with dark hex socket, threaded shank)? Is a helical thread visible? Anything broken? Rate realism 1-10. Answer in 4 lines max."

check "Pneumatic Muscle" t13-detail-muscle.png "3D part on a pedestal. Is this a pneumatic artificial muscle (braided mesh sleeve, metal crimp collars at ends, brass air fitting)? Describe the braid appearance. Anything broken? Rate realism 1-10. Answer in 4 lines max."

check "Vane Rotary Actuator" t13-detail-vane.png "3D part on a pedestal. Is this a pneumatic vane rotary actuator (aluminium barrel between end caps, chrome shaft on top, brass air fittings on the side)? Anything broken? Rate realism 1-10. Answer in 4 lines max."

check "Mini Air Pump" t13-detail-airpump.png "3D part on a pedestal. Is this a mini air pump (black plastic case with label, brass nozzles on top, silver motor can at back, red/black wires, rubber feet)? Anything broken? Rate realism 1-10. Answer in 4 lines max."

check "Capacitor" t13-detail-capacitor.png "3D part on a pedestal. Is this an electrolytic capacitor (cylindrical can, blue sleeve with printed text and a light minus stripe band, aluminum top, two thin legs)? Is the printed label readable? Anything broken? Rate realism 1-10. Answer in 4 lines max."

check "Rotary Actuator" t13-detail-rotaryact.png "3D part on a pedestal. Is this an industrial rotary actuator (dark cylindrical body with fins, square flange plate with bolts, chrome output shaft with key, wires at back)? Anything broken? Rate realism 1-10. Answer in 4 lines max."

check "Linear Actuator" t13-detail-linact.png "3D part on a pedestal. Is this a linear actuator (long black profile body, front bearing block, chrome rod extending to a clevis fork, motor can at rear with wires)? Anything broken? Rate realism 1-10. Answer in 4 lines max."
