#!/usr/bin/env node
/**
 * Generates small, valid 3D test assets for the Supabase upload pipeline:
 *
 *   scripts/test-assets/box.glb       — glTF 2.0 binary cube (24 verts, no indices)
 *   scripts/test-assets/cube.stl      — ASCII STL cube (12 facets)
 *   scripts/test-assets/n20-motor.stl — ASCII STL "N20 motor" replica
 *                                       (body cylinder + shaft, 24 segments)
 *
 * Everything is hand-rolled (no three.js needed): the GLB is assembled from
 * the spec — 12-byte header, JSON chunk (space-padded to 4 bytes), BIN
 * chunk (zero-padded).
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, 'test-assets')
mkdirSync(outDir, { recursive: true })

/* ------------------------------------------------------------------ */
/* Shared cube geometry (half-size S, CCW from outside)                */
/* ------------------------------------------------------------------ */

const S = 1
const cubeQuads = [
  { n: [0, 0, 1], v: [[-S, -S, S], [S, -S, S], [S, S, S], [-S, S, S]] }, // +Z
  { n: [0, 0, -1], v: [[S, -S, -S], [-S, -S, -S], [-S, S, -S], [S, S, -S]] }, // -Z
  { n: [1, 0, 0], v: [[S, -S, S], [S, -S, -S], [S, S, -S], [S, S, S]] }, // +X
  { n: [-1, 0, 0], v: [[-S, -S, -S], [-S, -S, S], [-S, S, S], [-S, S, -S]] }, // -X
  { n: [0, 1, 0], v: [[-S, S, S], [S, S, S], [S, S, -S], [-S, S, -S]] }, // +Y
  { n: [0, -1, 0], v: [[-S, -S, -S], [S, -S, -S], [S, -S, S], [-S, -S, S]] }, // -Y
]

/* ------------------------------------------------------------------ */
/* 1. box.glb                                                          */
/* ------------------------------------------------------------------ */

const verts = []
// Emit per-triangle vertices (36 = 12 tris × 3) — non-indexed drawArrays
// tessellates sequentially, so vertices must be grouped by triangle.
for (const q of cubeQuads) {
  verts.push(q.v[0], q.v[1], q.v[2])
  verts.push(q.v[0], q.v[2], q.v[3])
}
const pos = new Float32Array(verts.flat())

const json = {
  asset: { version: '2.0', generator: 'mechalib-test-asset' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'Box' }],
  meshes: [{ name: 'Box', primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
  materials: [
    {
      name: 'AmberPlastic',
      pbrMetallicRoughness: {
        baseColorFactor: [0.86, 0.58, 0.18, 1],
        metallicFactor: 0.25,
        roughnessFactor: 0.45,
      },
    },
  ],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126, // FLOAT
      count: 36,
      type: 'VEC3',
      max: [S, S, S],
      min: [-S, -S, -S],
    },
  ],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength, target: 34962 }],
  buffers: [{ byteLength: pos.byteLength }],
}

let jsonText = JSON.stringify(json)
const jsonPad = (4 - (jsonText.length % 4)) % 4
jsonText += ' '.repeat(jsonPad)
const jsonBytes = Buffer.from(jsonText, 'utf8')

const binPad = (4 - (pos.byteLength % 4)) % 4
const binBytes = Buffer.concat([Buffer.from(pos.buffer), Buffer.alloc(binPad)])

const total = 12 + 8 + jsonBytes.length + 8 + binBytes.length
const glb = Buffer.alloc(total)
glb.writeUInt32LE(0x46546c67, 0) // 'glTF'
glb.writeUInt32LE(2, 4) // version
glb.writeUInt32LE(total, 8)
glb.writeUInt32LE(jsonBytes.length, 12)
glb.writeUInt32LE(0x4e4f534a, 16) // 'JSON'
jsonBytes.copy(glb, 20)
const binHeader = 20 + jsonBytes.length
glb.writeUInt32LE(binBytes.length, binHeader)
glb.writeUInt32LE(0x004e4942, binHeader + 4) // 'BIN\0'
binBytes.copy(glb, binHeader + 8)

writeFileSync(join(outDir, 'box.glb'), glb)
console.log(`box.glb        ${glb.length} bytes (36 verts, 12 tris)`)

/* ------------------------------------------------------------------ */
/* 2. ASCII STL helpers                                                */
/* ------------------------------------------------------------------ */

const f = (n) => n.toFixed(6)
const tri = (n, a, b, c) =>
  `  facet normal ${n.map(f).join(' ')}\n    outer loop\n      vertex ${a.map(f).join(' ')}\n      vertex ${b.map(f).join(' ')}\n      vertex ${c.map(f).join(' ')}\n    endloop\n  endfacet\n`

function quadToTris(q) {
  return tri(q.n, q.v[0], q.v[1], q.v[2]) + tri(q.n, q.v[0], q.v[2], q.v[3])
}

function writeStl(name, facets) {
  let stl = `solid ${name}\n`
  for (const t of facets) stl += t
  stl += `endsolid ${name}\n`
  const p = join(outDir, `${name}.stl`)
  writeFileSync(p, stl)
  console.log(`${name}.stl  ${stl.length} bytes (${facets.length} facets)`)
}

/* cube.stl */
writeStl(
  'cube',
  cubeQuads.map(quadToTris)
)

/* n20-motor.stl — body cylinder + output shaft, N20-ish proportions */
function cylinderFacets(r, y0, y1, segs) {
  const facets = []
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2
    const a1 = ((i + 1) / segs) * Math.PI * 2
    const p = (ang, y) => [Math.cos(ang) * r, y, Math.sin(ang) * r]
    // side quad (outward normal)
    const nx = Math.cos((a0 + a1) / 2)
    const nz = Math.sin((a0 + a1) / 2)
    facets.push(tri([nx, 0, nz], p(a0, y0), p(a1, y0), p(a1, y1)))
    facets.push(tri([nx, 0, nz], p(a0, y0), p(a1, y1), p(a0, y1)))
  }
  // caps (triangle fans around the axis)
  for (const y of [y0, y1]) {
    const n = [0, y === y1 ? 1 : -1, 0]
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2
      const a1 = ((i + 1) / segs) * Math.PI * 2
      const p = (ang) => [Math.cos(ang) * r, y, Math.sin(ang) * r]
      const c = [0, y, 0]
      facets.push(y === y1 ? tri(n, c, p(a0), p(a1)) : tri(n, c, p(a1), p(a0)))
    }
  }
  return facets
}

const n20 = [...cylinderFacets(1, -1, 1, 24), ...cylinderFacets(0.28, 1, 2.4, 16)]
writeStl('n20-motor', n20)

console.log('\nAll test assets written to', outDir)
