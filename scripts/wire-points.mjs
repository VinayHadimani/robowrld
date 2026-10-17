import * as THREE from 'three'

// Reproduce the PlaygroundStage camera (see PlaygroundStage.tsx)
// Canvas rect measured at runtime: x=0, y=97, w=1440, h=803
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

// Placed instances (from localStorage dump):
//   battery (0,0) · N20 (-2.9,2.6) · servo (0.4,-4.8) · Arduino (3.5,4.5)
const out = {
  // grab points (mid-height of each body)
  n20: project(-2.9, 1.2, 2.6),
  servo: project(0.4, 1.5, -4.8),
  arduino: project(3.5, 0.5, 4.5),
  batteryTop: project(0, 4.5, 0),
  // drop targets: the component being dropped ONTO (screen position)
  batteryDrop: project(0, 2.5, 0),
  arduinoDrop: project(3.5, 0.5, 4.5),
}
console.log(JSON.stringify(out, null, 2))
