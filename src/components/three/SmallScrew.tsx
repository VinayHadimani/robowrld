'use client'

/**
 * SmallScrew — an exact procedural replica of an M3 × 10 DIN 912 socket
 * head cap screw in A2 stainless at 1 unit = 10 mm.
 *
 * Real anatomy: a Ø5.5 × 3 mm cylindrical head with a 2.5 mm HEX SOCKET
 * (dark, with the six flats catching light), a Ø3 mm shank, and a 0.5 mm
 * pitch helical thread modeled as a true spiral tube — the inclined
 * plane wrapped around a cylinder that turns rotation into clamping
 * force. This is the fastener that holds literally every robot together:
 * cheap, precise, and fast to install with one hex key.
 *
 * On the playground it lies on the bench like a real dropped screw;
 * drag it to any M3 hole (board, tabs, flanges, bearing blocks) and it
 * threads in — the component that "fastens" the structure.
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import { M } from './kit'

export interface SmallScrewProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

/** M3 × 10 DIN 912: head Ø5.5 × 3 mm, shank Ø3 × 10 mm (1 unit = 10 mm). */
export const SCREW_DIMS = { headD: 0.55, headH: 0.3, shankD: 0.3, length: 1.0 }
export const SCREW_SPEC = 'M3 × 10 · DIN 912 · A2 stainless'

/** Where the "coupling" clip sits: the threaded tip. */
export const SCREW_ANCHORS = {
  thread: [0.62, 0.28, 0] as [number, number, number],
}

/** Helical thread as a tube wound around the shank. */
function threadGeometry(len: number, turns: number, radius: number, tube: number) {
  const pts: THREE.Vector3[] = []
  const N = 220
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const a = t * turns * Math.PI * 2
    pts.push(new THREE.Vector3(-len / 2 + t * len, Math.cos(a) * radius, Math.sin(a) * radius))
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  return new THREE.TubeGeometry(curve, 260, tube, 6, false)
}

export function SmallScrew({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}: SmallScrewProps) {
  const thread = useMemo(
    () => threadGeometry(0.86, 9, 0.13, 0.045),
    []
  )

  const y = 0.28 // resting axis height (head Ø5.5 touches the bench)

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ---- head: Ø5.5 cylinder with chamfer ---- */}
      <mesh position={[-0.5, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.275, 0.255, 0.3, 28]} />
        <meshStandardMaterial {...M.steel} roughness={0.24} />
      </mesh>
      {/* hex socket: dark six-flated recess in the head's end face */}
      <mesh position={[-0.655, y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.125, 0.125, 0.08, 6]} />
        <meshStandardMaterial color="#14161a" roughness={0.55} metalness={0.4} />
      </mesh>
      {/* socket bevel ring */}
      <mesh position={[-0.645, y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.15, 0.022, 8, 24]} />
        <meshStandardMaterial color="#9aa0a8" metalness={0.9} roughness={0.3} />
      </mesh>

      {/* ---- shank + the helical thread ---- */}
      <mesh position={[0.0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.78, 20]} />
        <meshStandardMaterial {...M.steel} roughness={0.28} />
      </mesh>
      <mesh geometry={thread} position={[0.0, y, 0]} castShadow>
        <meshStandardMaterial {...M.steel} roughness={0.22} />
      </mesh>

      {/* ---- pointed start (roll-pressed tip) ---- */}
      <mesh position={[0.45, y, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.15, 0.17, 18]} />
        <meshStandardMaterial {...M.steel} roughness={0.28} />
      </mesh>
    </group>
  )
}

export default SmallScrew
