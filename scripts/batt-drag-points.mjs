import * as THREE from 'three'

// Reproduce the PlaygroundStage camera (see PlaygroundStage.tsx)
// Canvas rect measured in the 1440x900 viewport: x=0, y=97, w=1440, h=803
const W = 1440
const H = 803
const OX = 0
const OY = 97

const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 1000)
camera.position.set(12, 10, 14)
camera.lookAt(0, 0.8, 0)
camera.updateMatrixWorld()

function project(x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(camera)
  return {
    x: Math.round(OX + ((v.x + 1) / 2) * W),
    y: Math.round(OY + ((1 - v.y) / 2) * H),
  }
}

// Servo (mid-height grab point) and the drop point next to the battery.
const grab = project(-2.88, 1.5, 2.63)
const drop = project(4.5, 1.5, 0)
// A couple of mid waypoints for a smooth drag path.
const mid1 = project(1.2, 1.0, 2.2)
const mid2 = project(3.4, 1.0, 0.9)

console.log(JSON.stringify({ grab, mid1, mid2, drop }, null, 2))
