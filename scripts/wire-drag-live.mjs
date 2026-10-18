import * as THREE from 'three'

// Reproduce the PlaygroundStage camera. Geometry overridable via env:
//   W H OX OY  — canvas rect (px) on the page
const W = Number(process.env.W ?? 1440)
const H = Number(process.env.H ?? 803)
const OX = Number(process.env.OX ?? 0)
const OY = Number(process.env.OY ?? 97)

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

/** Camera ray through a screen pixel. */
const raycaster = new THREE.Raycaster()
function rayAt(px, py) {
  const ndc = new THREE.Vector2(((px - OX) / W) * 2 - 1, -(((py - OY) / H) * 2 - 1))
  raycaster.setFromCamera(ndc, camera)
  return raycaster.ray
}
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
function groundHit(px, py) {
  const hit = rayAt(px, py).intersectPlane(groundPlane, new THREE.Vector3())
  return { x: hit.x, z: hit.z }
}

/** Mid-body grab height + proxy box per kind (mirrors the real meshes). */
const KIND_PROXY = {
  battery: { box: [2.65, 4.9, 1.75], grabY: 2.4 },
  servo: { box: [4.07, 4.6, 1.97], grabY: 1.8 },
  controller: { box: [6.86, 0.9, 5.34], grabY: 0.5 },
  dcmotor: { box: [6.4, 3.7, 3.7], grabY: 1.8 },
  stepper: { box: [4.23, 4.7, 4.23], grabY: 2.0 },
  ultrasonic: { box: [4.5, 1.5, 2.0], grabY: 0.6 },
  irsensor: { box: [3.8, 0.9, 1.0], grabY: 0.4 },
  esc: { box: [5.5, 1.0, 2.8], grabY: 0.5 },
  lipo: { box: [10.5, 2.4, 3.3], grabY: 1.2 },
}

/**
 * Usage: node wire-drag-live.mjs '<instances-json>' <grabName> <targetName> [offX offZ]
 *
 * Computes the exact mouse sequence that drags grabName and drops it at
 * `target + 2.0 world units toward the camera` — the same way the stage
 * itself tracks the drag: the pointerdown raycast hits the object's mesh
 * and records the offset (meshHit − group position); the pointerup's
 * GROUND-plane hit must then land at drop + offset.
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

// Proxy meshes for every instance (to reproduce the raycast picking).
const proxies = instances.map((inst) => {
  const p = KIND_PROXY[inst.kind] ?? { box: [4, 3, 4], grabY: 1.5 }
  const geo = new THREE.BoxGeometry(...p.box)
  const mesh = new THREE.Mesh(geo)
  mesh.position.set(inst.x, p.box[1] / 2, inst.z)
  return { inst, mesh, grabY: p.grabY }
})
const grabProxy = proxies.find((p) => p.inst.name === grabName) || proxies[0]

// Drop spot: next to the target, offset toward the camera side (+x/+z).
const len = Math.hypot(offX, offZ) || 1
const drop = {
  x: target.x + (offX / len) * 2.0,
  z: target.z + (offZ / len) * 2.0,
}

// ---- choose a grab screen point whose ray REALLY hits the grabbed object ----
const tryGrabPoints = [
  // near face (toward the camera) at grab height
  { x: grab.x + (12 / Math.hypot(12, 14)) * 1.0, z: grab.z + (14 / Math.hypot(12, 14)) * 1.0, top: false },
  // center at grab height
  { x: grab.x, z: grab.z, top: false },
  // top center
  { x: grab.x, z: grab.z, top: true },
]
let grabScreen = null
let meshHit = null
for (let i = 0; i < tryGrabPoints.length; i++) {
  const pt = tryGrabPoints[i]
  const y = pt.top ? KIND_PROXY[grab.kind].box[1] * 0.95 : grabProxy.grabY
  const s = project(pt.x, y, pt.z)
  const ray = rayAt(s.x, s.y)
  // nearest proxy intersection along the ray
  let nearest = null
  for (const p of proxies) {
    const hit = ray.intersectBox(
      new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z),
        new THREE.Vector3(...(KIND_PROXY[p.inst.kind] ?? { box: [4, 3, 4] }).box)
      ),
      new THREE.Vector3()
    )
    if (hit) {
      const dist = hit.distanceTo(ray.origin)
      if (!nearest || dist < nearest.dist) nearest = { name: p.inst.name, dist, point: hit.clone() }
    }
  }
  if (nearest && nearest.name === grabName) {
    grabScreen = s
    meshHit = nearest.point
    break
  }
}
if (!meshHit || !grabScreen) {
  console.error('GRAB BLOCKED: no clear camera line to ' + grabName)
  process.exit(2)
}

// The stage's drag offset: mesh-hit horizontal offset from the group origin.
const off = { x: meshHit.x - grab.x, z: meshHit.z - grab.z }

// The pointerup position whose GROUND hit puts the component at `drop`.
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
      dropWorld: { x: Math.round(drop.x * 100) / 100, z: Math.round(drop.z * 100) / 100 },
      meshOffset: { x: Math.round(off.x * 100) / 100, z: Math.round(off.z * 100) / 100 },
    },
    null,
    1
  )
)
