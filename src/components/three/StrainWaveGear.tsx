'use client'

/**
 * StrainWaveGear — an exact procedural replica of a compact strain wave
 * gear (harmonic drive, CSF/SHG-20 class) at 1 unit = 10 mm.
 *
 * Real anatomy, bottom to top:
 *  - Flexspline: a thin, polished steel CUP with external teeth at its
 *    rim — the OUTPUT. Its bottom flange carries the bolt circle.
 *  - Circular spline: a black-oxide steel RING with two more teeth than
 *    the flexspline, bolted to the housing — the fixed member.
 *  - Wave generator: a chrome ELLIPSOID (ball-bearing assembly) that
 *    flexes the cup's rim elliptically at two points — the INPUT.
 *
 * Physics on the playground: the input shaft spins fast; the flexspline
 * (cup + flange) rotates at exactly input ÷ 100 — visible, honest
 * 100:1 reduction. That flexing steel is also why real harmonic drives
 * wear: abrasion of the flexspline is their known lifetime limit.
 */

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { M, PhillipsScrew, makeLabelTexture } from './kit'

export interface StrainWaveGearProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** True while rotation arrives on the input shaft. */
  driven?: boolean
  /** Rotation arriving at the wave generator (RPM). */
  inputRpm?: number
  scale?: number
}

/** Circular spline Ø44 mm, 34 mm tall overall (1 unit = 10 mm). */
export const STRAINWAVE_DIMS = { od: 4.4, height: 3.6 }
/** Nominal reduction of this stage. */
export const STRAINWAVE_RATIO = 100

/** Where the couplers/tubing clip (local coordinates). */
export const STRAINWAVE_ANCHORS = {
  /** Tip of the wave-generator input shaft. */
  input: [0, 3.62, 0] as [number, number, number],
  /** Edge of the rotating flexspline output flange. */
  output: [1.7, 0.62, 0] as [number, number, number],
  /** A circular-spline mounting bolt. */
  mount: [1.95, 2.9, 0] as [number, number, number],
}

function drawSpec(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#3f4247')
  grad.addColorStop(0.5, '#575b62')
  grad.addColorStop(1, '#3f4247')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#d8dce2'
  ctx.textAlign = 'center'
  ctx.font = '700 64px Arial'
  ctx.fillText('SWG-20', w / 2, h * 0.42)
  ctx.font = '600 44px Arial'
  ctx.fillText('100:1', w / 2, h * 0.72)
  ctx.font = '500 28px Arial'
  ctx.fillStyle = '#aeb4bc'
  ctx.fillText('8 N·m', w / 2, h * 0.92)
}

export function StrainWaveGear({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  driven = false,
  inputRpm = 0,
  scale = 1,
}: StrainWaveGearProps) {
  const waveGen = useRef<THREE.Group>(null) // input: ellipsoid + shaft
  const flex = useRef<THREE.Group>(null) // output: cup + flange + its teeth

  const specTex = useMemo(() => makeLabelTexture(320, 140, drawSpec), [])

  const teethGeo = useMemo(() => new THREE.BoxGeometry(0.11, 0.5, 0.16), [])
  const teethMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#b9bec6', metalness: 0.9, roughness: 0.34 }),
    []
  )
  const flexTeeth = useMemo(() => {
    // 70 teeth on the flexspline rim (the circular spline has 72 — the
    // two-tooth difference IS the strain wave principle).
    return Array.from({ length: 70 }, (_, i) => {
      const a = (i / 70) * Math.PI * 2
      return { a, key: i }
    })
  }, [])
  const splineTeeth = useMemo(() => {
    return Array.from({ length: 72 }, (_, i) => {
      const a = (i / 72) * Math.PI * 2 + Math.PI / 72
      return { a, key: i }
    })
  }, [])

  useFrame((_, dt) => {
    if (!driven || inputRpm <= 0) return
    // The wave generator spins at input speed; the flexspline crawls at
    // exactly input ÷ 100. Visual clamp keeps blur readable.
    const wIn = Math.min((inputRpm / 60) * Math.PI * 2, 12)
    const wOut = wIn / STRAINWAVE_RATIO
    if (waveGen.current) waveGen.current.rotation.y += wIn * dt
    if (flex.current) flex.current.rotation.y += wOut * dt
  })

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ---- circular spline: black-oxide fixed ring with bolts ---- */}
      <mesh position={[0, 2.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.2, 2.2, 1.1, 56, 1, false]} />
        <meshStandardMaterial color="#3d4148" metalness={0.82} roughness={0.42} />
      </mesh>
      {/* inner bore of the ring (dark) */}
      <mesh position={[0, 2.3, 0]}>
        <cylinderGeometry args={[1.86, 1.86, 1.12, 56]} />
        <meshStandardMaterial color="#1c1e23" metalness={0.6} roughness={0.6} />
      </mesh>
      {/* spec band on the ring */}
      <mesh position={[0, 2.3, 0]}>
        <cylinderGeometry args={[2.21, 2.21, 0.62, 56, 1, true]} />
        <meshStandardMaterial map={specTex} roughness={0.4} metalness={0.35} />
      </mesh>
      {/* 6 mounting bolts on the ring's top face */}
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <PhillipsScrew
            key={i}
            position={[Math.cos(a) * 1.92, 2.86, Math.sin(a) * 1.92]}
            rotation={[Math.PI / 2, 0, 0]}
            r={0.16}
            color="#c2c7ce"
          />
        )
      })}
      {/* internal teeth of the circular spline (72) */}
      {splineTeeth.map(({ a, key }) => (
        <mesh
          key={`sp-${key}`}
          geometry={teethGeo}
          material={teethMat}
          position={[Math.cos(a) * 1.72, 2.42, Math.sin(a) * 1.72]}
          rotation={[0, Math.PI / 2 - a, 0]}
        />
      ))}

      {/* ---- flexspline (OUTPUT): thin polished cup + flange ---- */}
      <group ref={flex}>
        {/* cup wall — thin steel, open at the top */}
        <mesh position={[0, 1.62, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.8, 1.78, 2.05, 56, 1, true]} />
          <meshStandardMaterial {...M.steel} side={THREE.DoubleSide} />
        </mesh>
        {/* cup floor */}
        <mesh position={[0, 0.62, 0]} castShadow>
          <cylinderGeometry args={[1.8, 1.8, 0.1, 56]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
        {/* output flange with its bolt circle */}
        <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[2.1, 2.1, 0.3, 56]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2 + Math.PI / 6
          return (
            <mesh key={`fl-${i}`} position={[Math.cos(a) * 1.78, 0.42, Math.sin(a) * 1.78]}>
              <cylinderGeometry args={[0.16, 0.16, 0.34, 14]} />
              <meshStandardMaterial {...M.hole} />
            </mesh>
          )
        })}
        {/* external teeth on the cup rim (70 — two fewer than the ring) */}
        {flexTeeth.map(({ a, key }) => (
          <mesh
            key={`fx-${key}`}
            geometry={teethGeo}
            material={teethMat}
            position={[Math.cos(a) * 1.83, 2.42, Math.sin(a) * 1.83]}
            rotation={[0, Math.PI / 2 - a, 0]}
          />
        ))}
      </group>

      {/* ---- wave generator (INPUT): chrome ellipsoid + shaft ---- */}
      <group ref={waveGen}>
        {/* the elliptical bearing assembly that flexes the cup — visibly
            elliptical: major axis along X touches the cup at two points */}
        <mesh position={[0, 2.32, 0]} scale={[1.0, 0.55, 0.86]} castShadow>
          <sphereGeometry args={[1.76, 40, 28]} />
          <meshStandardMaterial {...M.chrome} />
        </mesh>
        {/* equatorial bearing race */}
        <mesh position={[0, 2.32, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.7, 0.09, 12, 48]} />
          <meshStandardMaterial color="#9aa0a8" metalness={0.9} roughness={0.3} />
        </mesh>
        {/* input shaft with its ground flat */}
        <mesh position={[0, 3.05, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 1.55, 24]} />
          <meshStandardMaterial {...M.chrome} />
        </mesh>
        <mesh position={[0.21, 3.45, 0]}>
          <boxGeometry args={[0.14, 0.6, 0.4]} />
          <meshStandardMaterial {...M.chrome} />
        </mesh>
      </group>
    </group>
  )
}

export default StrainWaveGear
