import * as THREE from 'three'

// Reproduce the AssemblyStage camera
const camera = new THREE.PerspectiveCamera(30, 832 / 600, 0.1, 200)
camera.position.set(11.5, 8.5, 14.5)
camera.lookAt(0.8, 4.2, 3.0)
camera.updateMatrixWorld()

const canvas = { w: 832, h: 600, ox: 112, oy: 210 } // canvas offset in the 1440x900 screenshot

const candidates = {
  'tab-bolt head L': [-3.12, 2.89, 0],
  'tab-bolt shank L': [-3.12, 2.42, 0],
  'tab-bolt nut L': [-3.12, 2.02, 0],
  'tab-bolt nut R': [3.12, 2.02, 0],
  'leg-bolt head L1': [-5.17, 2.63, 1.9],
  'leg-bolt head L2': [-5.17, 2.63, 3.1],
  'leg-bolt head R1': [6.37, 2.63, 1.9],
  'flange bolt A': [-1.0, 2.9, 6.4],
  'flange bolt B': [0.2, 2.9, 6.4],
  'rocker pin boss': [-2.11, 5.97, 7.43],
  'rod ball P': [0, 6.0, 1.4],
  'rod ball Q': [-2.11, 6.0, 7.43],
  'leg top L': [-5.17, 2.16, 2.5],
}

const target = { x: 359, y: 659 } // flagged stray location in screenshot coords

console.log(`target screen: (${target.x}, ${target.y})`)
for (const [name, pos] of Object.entries(candidates)) {
  const v = new THREE.Vector3(...pos).project(camera)
  const sx = Math.round(canvas.ox + ((v.x + 1) / 2) * canvas.w)
  const sy = Math.round(canvas.oy + ((1 - v.y) / 2) * canvas.h)
  const dist = Math.hypot(sx - target.x, sy - target.y)
  console.log(`${name.padEnd(20)} screen (${sx}, ${sy})  dist ${Math.round(dist)}`)
}
// extra: crank positions
for (const [name, pos] of Object.entries({
  'crank hub': [0, 5.35, 0],
  'crank mid (90deg)': [0, 5.5, 2.0],
  'crank tip (90deg)': [0, 5.5, 3.9],
})) {
  const v = new THREE.Vector3(...pos).project(camera)
  const sx = Math.round(canvas.ox + ((v.x + 1) / 2) * canvas.w)
  const sy = Math.round(canvas.oy + ((1 - v.y) / 2) * canvas.h)
  console.log(name.padEnd(22), 'screen (' + sx + ', ' + sy + ')')
}
