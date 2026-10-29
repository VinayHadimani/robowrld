'use client'

/**
 * PlanetaryGear — an exact procedural replica of an open 5:1 planetary
 * gear stage (the kind robot joints and bench gear kits actually show)
 * at 1 unit = 10 mm.
 *
 * Real anatomy:
 *  - A steel RING GEAR with internal teeth, standing on an aluminium
 *    base plate on four legs.
 *  - A brass SUN gear in the center on the input shaft (chrome, entering
 *    from below the plate).
 *  - Three brass PLANETS on carrier pins — the load is shared between
 *    them, which is why planetary stages take torque so well.
 *  - A steel CARRIER plate on top, pinned to the planets, carrying the
 *    output shaft.
 *
 * Physics on the playground: sun spins at input speed, the carrier (and
 * output shaft) crawls at exactly input ÷ 5, each planet counter-rotates
 * on its pin. One-stage planetaries stay modest ratios on purpose —
 * pushing a high ratio in a single stage needs tiny, weaker teeth.
 */

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { M, makeLabelTexture } from './kit'

export interface PlanetaryGearProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** True while rotation arrives on the sun shaft. */
  driven?: boolean
  /** Rotation arriving at the sun (RPM). */
  inputRpm?: number
  scale?: number
}

/** Ring gear Ø43.5 mm, 35 mm tall on its stand (1 unit = 10 mm). */
export const PLANETARY_DIMS = { od: 4.35, height: 3.55 }
/** Nominal reduction of this stage. */
export const PLANETARY_RATIO = 5

/** Where the couplers clip (local coordinates). */
export const PLANETARY_ANCHORS = {
  /** Bottom tip of the sun input shaft. */
  input: [0, 0.28, 0] as [number, number, number],
  /** Top tip of the carrier output shaft. */
  output: [0, 3.56, 0] as [number, number, number],
  /** A base-plate leg foot. */
  mount: [1.85, 0.1, 1.85] as [number, number, number],
}

/* Gear geometry: sun pitch Ø1.15, planets Ø1.5 at center distance 1.32,
 * ring internal pitch Ø4.19 → teeth engage visually like the real train. */
const SUN_TEETH = 12
const PLANET_TEETH = 16
const RING_TEETH = 48
const PLANET_ORBIT_R = 1.32

function drawPlate(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#9aa0a8'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#23262b'
  ctx.textAlign = 'center'
  ctx.font = '700 60px Arial'
  ctx.fillText('PG-5', w / 2, h * 0.46)
  ctx.font = '600 42px Arial'
  ctx.fillText('5:1', w / 2, h * 0.78)
}

export function PlanetaryGear({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  driven = false,
  inputRpm = 0,
  scale = 1,
}: PlanetaryGearProps) {
  const sun = useRef<THREE.Group>(null) // sun gear + input shaft
  const carrier = useRef<THREE.Group>(null) // carrier + pins + output shaft
  const planets = useRef<Array<THREE.Group | null>>([])

  const plateTex = useMemo(() => makeLabelTexture(300, 130, drawPlate), [])

  const toothGeo = useMemo(() => new THREE.BoxGeometry(0.12, 0.5, 0.17), [])
  const brassMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#caa64e', metalness: 0.9, roughness: 0.32 }),
    []
  )
  const steelMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#b9bec6', metalness: 0.9, roughness: 0.34 }),
    []
  )

  const sunTeeth = useMemo(
    () => Array.from({ length: SUN_TEETH }, (_, i) => ({ a: (i / SUN_TEETH) * Math.PI * 2 })),
    []
  )
  const planetTeeth = useMemo(
    () => Array.from({ length: PLANET_TEETH }, (_, i) => ({ a: (i / PLANET_TEETH) * Math.PI * 2 })),
    []
  )
  const ringTeeth = useMemo(
    () => Array.from({ length: RING_TEETH }, (_, i) => ({ a: (i / RING_TEETH) * Math.PI * 2 })),
    []
  )
  const planetAngles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]

  useFrame((_, dt) => {
    if (!driven || inputRpm <= 0) return
    const wIn = Math.min((inputRpm / 60) * Math.PI * 2, 12)
    const wCarrier = wIn / PLANETARY_RATIO
    if (sun.current) sun.current.rotation.y += wIn * dt
    if (carrier.current) carrier.current.rotation.y += wCarrier * dt
    // Each planet counter-rotates on its pin as it orbits.
    for (const p of planets.current) {
      if (p) p.rotation.y -= (wIn * SUN_TEETH * 0.062) * dt * 3.2
    }
  })

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ---- stand: four legs + labelled base plate ---- */}
      {[
        [1.85, 1.85],
        [1.85, -1.85],
        [-1.85, 1.85],
        [-1.85, -1.85],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.5, z]} castShadow>
          <cylinderGeometry args={[0.18, 0.2, 1.0, 16]} />
          <meshStandardMaterial {...M.alu} />
        </mesh>
      ))}
      <mesh position={[0, 1.13, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 0.28, 4.6]} />
        <meshStandardMaterial {...M.alu} />
      </mesh>
      <mesh position={[0, 1.28, 2.31]}>
        <planeGeometry args={[1.6, 0.7]} />
        <meshStandardMaterial map={plateTex} roughness={0.4} metalness={0.3} />
      </mesh>

      {/* ---- ring gear: steel ring with 48 internal teeth ---- */}
      <mesh position={[0, 1.85, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.18, 2.18, 0.9, 56, 1, false]} />
        <meshStandardMaterial color="#4a4e55" metalness={0.85} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.85, 0]}>
        <cylinderGeometry args={[1.68, 1.68, 0.92, 56]} />
        <meshStandardMaterial color="#1c1e23" metalness={0.6} roughness={0.6} />
      </mesh>
      {ringTeeth.map(({ a }, i) => (
        <mesh
          key={`rg-${i}`}
          geometry={toothGeo}
          material={steelMat}
          position={[Math.cos(a) * 1.72, 1.85, Math.sin(a) * 1.72]}
          rotation={[0, Math.PI / 2 - a, 0]}
        />
      ))}

      {/* ---- sun gear + input shaft (INPUT) ---- */}
      <group ref={sun}>
        <mesh position={[0, 1.85, 0]} castShadow>
          <cylinderGeometry args={[0.58, 0.58, 0.62, 32]} />
          <meshStandardMaterial {...brassMat as object} />
        </mesh>
        {sunTeeth.map(({ a }, i) => (
          <mesh
            key={`sn-${i}`}
            geometry={toothGeo}
            material={brassMat}
            position={[Math.cos(a) * 0.62, 1.85, Math.sin(a) * 0.62]}
            rotation={[0, Math.PI / 2 - a, 0]}
            castShadow
          />
        ))}
        {/* input shaft down through the plate */}
        <mesh position={[0, 0.78, 0]} castShadow>
          <cylinderGeometry args={[0.25, 0.25, 1.9, 24]} />
          <meshStandardMaterial {...M.chrome} />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.38, 0.38, 0.3, 24]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
      </group>

      {/* ---- carrier + planets + output shaft (OUTPUT) ---- */}
      <group ref={carrier}>
        {/* the three planets, pinned to the carrier */}
        {planetAngles.map((base, idx) => (
          <group
            key={`pl-${idx}`}
            position={[Math.cos(base) * PLANET_ORBIT_R, 1.85, Math.sin(base) * PLANET_ORBIT_R]}
          >
            <group
              ref={(el) => {
                planets.current[idx] = el
              }}
            >
              <mesh castShadow>
                <cylinderGeometry args={[0.68, 0.68, 0.6, 32]} />
                <meshStandardMaterial {...brassMat as object} />
              </mesh>
              {planetTeeth.map(({ a }, i) => (
                <mesh
                  key={i}
                  geometry={toothGeo}
                  material={brassMat}
                  position={[Math.cos(a) * 0.74, 0, Math.sin(a) * 0.74]}
                  rotation={[0, Math.PI / 2 - a, 0]}
                  castShadow
                />
              ))}
            </group>
          </group>
        ))}
        {/* carrier plate over the planets, pinned at each planet */}
        <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.45, 1.45, 0.22, 48]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
        {planetAngles.map((base, idx) => (
          <group key={`pin-${idx}`}>
            <mesh position={[Math.cos(base) * PLANET_ORBIT_R, 2.22, Math.sin(base) * PLANET_ORBIT_R]} castShadow>
              <cylinderGeometry args={[0.14, 0.14, 0.6, 16]} />
              <meshStandardMaterial {...M.chrome} />
            </mesh>
            <mesh position={[Math.cos(base) * PLANET_ORBIT_R, 2.66, Math.sin(base) * PLANET_ORBIT_R]} castShadow>
              <cylinderGeometry args={[0.21, 0.21, 0.16, 20]} />
              <meshStandardMaterial color="#8d6f2c" metalness={0.9} roughness={0.35} />
            </mesh>
          </group>
        ))}
        {/* output shaft up top */}
        <mesh position={[0, 3.1, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.95, 24]} />
          <meshStandardMaterial {...M.chrome} />
        </mesh>
        <mesh position={[0.21, 3.4, 0]}>
          <boxGeometry args={[0.13, 0.42, 0.36]} />
          <meshStandardMaterial {...M.chrome} />
        </mesh>
      </group>
    </group>
  )
}

export default PlanetaryGear
