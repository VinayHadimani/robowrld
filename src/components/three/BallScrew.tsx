'use client'

/**
 * BallScrew — an exact procedural replica of an SFU1204-class rolled
 * ball screw (Ø12 shaft, 4 mm lead) at 1 unit = 10 mm.
 *
 * Real anatomy: a chrome-plated shaft with the polished HELICAL BALL
 * GROOVES (the bright spiral), two aluminium bearing blocks (BK/BF
 * style) with bolt-on end caps, a driven journal with a brass lock nut
 * at one end, and the BALL NUT riding the shaft — a steel cylinder with
 * a flanged bolt face and the little return tube that recirculates the
 * balls. Balls roll instead of slide, so a ball screw converts rotation
 * to linear travel at ~90 % efficiency — the reason CNC machines and
 * the notes' "efficient linear transmission" love them.
 *
 * Physics on the playground: couple a motor's shaft onto the journal;
 * the shaft spins and the nut glides along at RPM × 4 mm per turn.
 */

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { M, PhillipsScrew } from './kit'

export interface BallScrewProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** True while rotation arrives on the journal. */
  driven?: boolean
  /** Rotation arriving at the journal (RPM). */
  inputRpm?: number
  scale?: number
}

/** Ø12 mm shaft × 160 mm between blocks; 4 mm lead (1 unit = 10 mm). */
export const BALLSCREW_DIMS = { shaftD: 1.2, lead: 4, travel: 5.8 }
/** The nut's linear speed from arriving RPM: mm per second. */
export const nutMmS = (rpm: number) => (rpm * BALLSCREW_DIMS.lead) / 60

/** Where the couplers clip (local coordinates). */
export const BALLSCREW_ANCHORS = {
  /** The driven journal tip. */
  journal: [6.85, 1.4, 0] as [number, number, number],
  /** The ball nut's flange (moves with the nut). */
  nut: [-1.8, 3.15, 0] as [number, number, number],
  mountA: [-4.9, 2.25, 0] as [number, number, number],
  mountB: [4.9, 2.25, 0] as [number, number, number],
}

/** Bright helical groove winding around the shaft. */
function helixGeometry(len: number, turns: number, radius: number, tube: number) {
  const pts: THREE.Vector3[] = []
  const N = 320
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const a = t * turns * Math.PI * 2
    pts.push(new THREE.Vector3(-len / 2 + t * len, Math.cos(a) * radius, Math.sin(a) * radius))
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  return new THREE.TubeGeometry(curve, 380, tube, 6, false)
}

export function BallScrew({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  driven = false,
  inputRpm = 0,
  scale = 1,
}: BallScrewProps) {
  const shaft = useRef<THREE.Group>(null)
  const nut = useRef<THREE.Group>(null)
  const travel = useRef(0.0) // 0..1 position along the stroke
  const dir = useRef(1)
  const cy = 1.4 // centerline height

  const groove = useMemo(() => helixGeometry(7.8, 15, 0.63, 0.075), [])
  const grooveDark = useMemo(() => helixGeometry(7.8, 15, 0.6, 0.055), [])

  useFrame((_, dt) => {
    const w = driven && inputRpm > 0 ? Math.min((inputRpm / 60) * Math.PI * 2, 12) : 0
    if (shaft.current && w > 0) shaft.current.rotation.x += w * dt
    if (nut.current) {
      if (w > 0) {
        // Nut travel at the honest linear speed (units = mm / 10).
        const speed = nutMmS(inputRpm) / 10
        travel.current += (dir.current * speed * dt) / BALLSCREW_DIMS.travel
        if (travel.current >= 1) {
          travel.current = 1
          dir.current = -1
        } else if (travel.current <= 0) {
          travel.current = 0
          dir.current = 1
        }
        nut.current.position.x = -3.1 + travel.current * BALLSCREW_DIMS.travel
      } else {
        // coast to a stop where it is — a real nut stays put.
      }
    }
  })

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ---- the two aluminium bearing blocks ---- */}
      {[-4.9, 4.9].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, cy, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.3, 2.8, 2.3]} />
            <meshStandardMaterial {...M.alu} />
          </mesh>
          <mesh position={[Math.sign(x) * 0.75, cy, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.78, 0.78, 0.24, 28]} />
            <meshStandardMaterial {...M.aluRaw} />
          </mesh>
          {[
            [0.85, 0.85],
            [0.85, -0.85],
            [-0.85, 0.85],
            [-0.85, -0.85],
          ].map(([dy, dz], i) => (
            <PhillipsScrew
              key={i}
              position={[Math.sign(x) * 0.68, cy + dy, dz]}
              rotation={[0, 0, Math.PI / 2]}
              r={0.13}
            />
          ))}
        </group>
      ))}

      {/* ---- the chrome shaft with its ball grooves (ROTATES) ---- */}
      <group ref={shaft} position={[0, cy, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 11.8, 32]} />
          <meshStandardMaterial {...M.chrome} roughness={0.08} />
        </mesh>
        <mesh geometry={groove}>
          <meshStandardMaterial {...M.chrome} roughness={0.05} />
        </mesh>
        <mesh geometry={grooveDark}>
          <meshStandardMaterial color="#5f656e" metalness={0.85} roughness={0.25} />
        </mesh>
      </group>

      {/* ---- driven journal + brass lock nut ---- */}
      <mesh position={[6.25, cy, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 0.9, 24]} />
        <meshStandardMaterial {...M.chrome} />
      </mesh>
      <mesh position={[6.05, cy, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.55, 0.34, 6]} />
        <meshStandardMaterial {...M.brass} />
      </mesh>

      {/* ---- the ball nut riding the shaft (TRANSLATES) ---- */}
      <group ref={nut} position={[-3.1, cy, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[1.02, 1.02, 1.5, 36]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
        {/* flanged bolt face on the far end */}
        <mesh position={[-0.93, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[1.5, 1.5, 0.34, 36]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
        {[
          [0.95, 0.95],
          [0.95, -0.95],
          [-0.95, 0.95],
          [-0.95, -0.95],
        ].map(([dy, dz], i) => (
          <mesh key={i} position={[-0.93, dy, dz]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.15, 0.15, 0.38, 14]} />
            <meshStandardMaterial {...M.hole} />
          </mesh>
        ))}
        {/* the ball return tube over the top */}
        <mesh position={[0, 0.92, 0]}>
          <tubeGeometry
            args={[
              new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.55, 0.28, 0),
                new THREE.Vector3(-0.3, 0.62, 0),
                new THREE.Vector3(0, 0.72, 0),
                new THREE.Vector3(0.3, 0.62, 0),
                new THREE.Vector3(0.55, 0.28, 0),
              ]),
              32,
              0.13,
              10,
              false,
            ]}
          />
          <meshStandardMaterial {...M.steel} roughness={0.28} />
        </mesh>
        {/* wrench flats on the nut body */}
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, s * 0.98, 0]}>
            <boxGeometry args={[1.3, 0.16, 1.6]} />
            <meshStandardMaterial color="#9aa0a8" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default BallScrew
