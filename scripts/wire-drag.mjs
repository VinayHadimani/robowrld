import * as THREE from 'three'

// Reproduce the PlaygroundStage camera (PlaygroundStage.tsx)
const W = 1440
const H = 803
const OX = 0
const OY = 97

const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 1000)
camera.position.set(12, 10, 14)
camera.lookAt(0, 0.8, 0)
camera.updateMatrixWorld()

/** World point → screen pixel. */
function project(x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(camera)
  return {
    x: Math.round(OX + ((v.x + 1) / 2) * W),
    y: Math.round(OY + ((1 - v.y) / 2) * H),
  }
}

/** Screen pixel → world point on the y=0 ground plane (the drag surface). */
const raycaster = new THREE.Raycaster()
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
function groundHit(px, py) {
  const ndc = new THREE.Vector2(((px - OX) / W) * 2 - 1, -(((py - OY) / H) * 2 - 1))
  raycaster.setFromCamera(ndc, camera)
  const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3())
  if (!hit) throw new Error('ray missed ground')
  return { x: hit.x, z: hit.z }
}

/**
 * Compute a full drag: grab a component at `grabWorld` (mid-body height
 * `grabY`), drag it along the ground, drop it so it lands at
 * `dropWorld` (accounting for the grab offset the stage keeps).
 */
function drag(grabWorld, grabY, dropWorld) {
  const grabScreen = project(grabWorld.x, grabY, grabWorld.z)
  const hit = groundHit(grabScreen.x, grabScreen.y)
  const offX = hit.x - grabWorld.x
  const offZ = hit.z - grabWorld.z
  // Pointer position whose ground hit puts the component at dropWorld.
  const dropScreen = project(dropWorld.x + offX, 0.01, dropWorld.z + offZ)
  // Two mid waypoints between the pointer start and end.
  const mid = (t) => ({
    x: Math.round(grabScreen.x + (dropScreen.x - grabScreen.x) * t),
    y: Math.round(grabScreen.y + (dropScreen.y - grabScreen.y) * t),
  })
  return { grab: grabScreen, mid1: mid(0.35), mid2: mid(0.7), drop: dropScreen }
}

// Current instances (localStorage):
//   battery (0,0) · N20 (-3.03,-3.9) · servo (0.42,-4.78) · Arduino (3.47,4.52)
// Test A: drag N20 to a spot near the battery (snap reach is generous).
const out = {
  dragN20ToBattery: drag({ x: -3.03, z: -3.9 }, 1.2, { x: 2.0, z: 0.8 }),
  // Test B: drag servo toward the battery (expect REFUSAL - red ring).
  dragServoToBattery: drag({ x: 0.42, z: -4.78 }, 1.5, { x: 1.6, z: -0.8 }),
  // Test C: drag Arduino to near the battery (VIN connect).
  dragArduinoToBattery: drag({ x: 3.47, z: 4.52 }, 0.5, { x: -0.6, z: 1.6 }),
  // Screen position of the battery terminals (wire visibility checks).
  batteryTerminalPlus: project(0.55, 5.05, 0),
  batteryTerminalMinus: project(-0.55, 5.05, 0),
}
console.log(JSON.stringify(out, null, 2))
