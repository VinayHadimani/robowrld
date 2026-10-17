import * as THREE from 'three'

// PlaygroundStage camera; canvas rect x=0 y=97 w=1440 h=803 (1440x900 viewport)
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

// 1) Servo (currently at 1.77,-4.46) → drag around to the LEFT side of the
//    battery: drop near (-4.5, 0), snapping to (-4.8, 0).
console.log('servo grab:', JSON.stringify(project(1.77, 1.5, -4.46)))
console.log('servo drop near (-4.2,0):', JSON.stringify(project(-4.2, 1.5, 0)))

// 2) N20 spawns at nextSpot(2) ≈ (0.42, -4.78); grab it and drop it next to
//    the servo at (-4.8, 0): drop target ≈ (-9.0, 0) region — within snap
//    reach of the servo (reach = 2.15+2.35+1.35 = 5.85 from servo center).
console.log('n20 grab:', JSON.stringify(project(0.42, 1.0, -4.78)))
console.log('n20 drop near (-8.6,0):', JSON.stringify(project(-8.6, 1.0, 0)))

// 3) Battery grab point (for group-drag test): project (0, 2.5, 0)
console.log('battery grab:', JSON.stringify(project(0, 2.5, 0)))
// Group drag target: move everything by (+3, 0, +3) → battery to (3, 3)
console.log('group drop:', JSON.stringify(project(3, 2.5, 3)))
