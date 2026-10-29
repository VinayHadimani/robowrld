import * as THREE from 'three'

// One-off: drag the strain wave gear by its CUP BODY (the ring is hollow
// above — a proxy-box grab point at y≈3.4 passes through empty space).
// Grabs the real cup at y≈1.5 center, drops it next to the DC motor so
// the motor's shaft couples into the wave-generator input.

const W = Number(process.env.W ?? 1280)
const H = Number(process.env.H ?? 480)
const OX = Number(process.env.OX ?? 0)
const OY = Number(process.env.OY ?? 97)

const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 1000)
camera.position.set(12, 10, 14)
camera.lookAt(0, 0.8, 0)
camera.updateMatrixWorld()

function project(x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(camera)
  return { x: Math.round(OX + ((v.x + 1) / 2) * W), y: Math.round(OY + ((1 - v.y) / 2) * H) }
}

const instances = JSON.parse(process.argv[2])
const sw = instances.find((i) => i.name === 'Strain Wave Gear')
const motor = instances.find((i) => i.name === 'DC Gear Motor')
if (!sw || !motor) {
  console.error('missing instance')
  process.exit(1)
}

// Grab the cup body: aim at the model center at cup height — the ring,
// cup wall and teeth all intersect rays near this line.
const grabWorld = { x: sw.x, y: 1.5, z: sw.z }
const grabScreen = project(grabWorld.x, grabWorld.y, grabWorld.z)

// Drop 2.0 units from the motor, toward the camera-left (-x) so the
// strainwave lands nearest the motor (battery sits on the +x side).
const dir = { x: -0.35, z: -0.94 }
const drop = { x: motor.x + dir.x * 2.0, z: motor.z + dir.z * 2.0 }

// meshHit ≈ the cup surface along the ray ≈ the grab world point (small
// offset toward the camera along the ray's ground projection).
const off = { x: 0, z: 0 }
const dropScreen = project(drop.x + off.x, 0.01, drop.z + off.z)
const mid = (t) => ({
  x: Math.round(grabScreen.x + (dropScreen.x - grabScreen.x) * t),
  y: Math.round(grabScreen.y + (dropScreen.y - grabScreen.y) * t),
})
console.log(
  JSON.stringify(
    {
      grab: grabScreen,
      mid1: mid(0.35),
      mid2: mid(0.7),
      drop: dropScreen,
      dropWorld: drop,
    },
    null,
    1
  )
)
