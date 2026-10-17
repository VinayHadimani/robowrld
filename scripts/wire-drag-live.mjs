import * as THREE from 'three'

// Reproduce the PlaygroundStage camera.
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

const raycaster = new THREE.Raycaster()
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
function groundHit(px, py) {
  const ndc = new THREE.Vector2(((px - OX) / W) * 2 - 1, -(((py - OY) / H) * 2 - 1))
  raycaster.setFromCamera(ndc, camera)
  const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3())
  return { x: hit.x, z: hit.z }
}

/**
 * Usage: node wire-drag-live.mjs '<instances-json>' <grabName> <targetName> [offsetX offsetZ]
 * Prints the mouse sequence that drags grabName and drops it near targetName.
 */
const instances = JSON.parse(process.argv[2])
const grabName = process.argv[3]
const targetName = process.argv[4]
const offX = Number(process.argv[5] ?? 1.4)
const offZ = Number(process.argv[6] ?? 0.9)

const grab = instances.find((i) => i.name === grabName)
const target = instances.find((i) => i.name === targetName)
if (!grab || !target) {
  console.error('instance not found', grabName, targetName)
  process.exit(1)
}

// Drop spot: next to the target, offset toward the camera side (+x/+z).
const len = Math.hypot(offX, offZ) || 1
const drop = {
  x: target.x + (offX / len) * 2.0,
  z: target.z + (offZ / len) * 2.0,
}

const grabY = grab.name === 'Servo Motor' ? 1.5 : grab.name === 'Arduino Uno' ? 0.5 : 1.2
const grabScreen = project(grab.x, grabY, grab.z)
const hit = groundHit(grabScreen.x, grabScreen.y)
const dX = hit.x - grab.x
const dZ = hit.z - grab.z
const dropScreen = project(drop.x + dX, 0.01, drop.z + dZ)
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
      dropWorld: { x: Math.round(drop.x * 100) / 100, z: Math.round(drop.z * 100) / 100 },
    },
    null,
    1
  )
)
