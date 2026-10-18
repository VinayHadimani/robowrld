'use client'

/**
 * Nema17Stepper — an exact procedural replica of the NEMA 17 bipolar
 * stepper (42STH47-1684 class) at 1 unit = 10 mm.
 *
 * Real anatomy: 42.3 × 42.3 mm black laminated stack with visible
 * silicon-steel lamination lines, cast aluminium front plate with four
 * phillips cap screws + the raised pilot boss, 5 mm steel shaft with
 * the ground flat, black rear cap with the cable gland where the
 * 4-wire lead exits (black / green / red / blue), and the printed
 * nameplate on the stack.
 *
 * When powered and running it STEPS — the shaft advances in visible
 * 1.8° increments, exactly like a real chopper-driven stepper.
 */

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { M, PhillipsScrew, makeLabelTexture, seeded, wireTube } from './kit'

export interface Nema17StepperProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** True while stepping (powered + running). */
  running?: boolean
  scale?: number
}

/** NEMA 17: 42.3 × 42.3 face, 47 mm body. */
export const STEPPER_DIMS = { w: 4.23, h: 4.7 }
/** Ø5 mm shaft, 24 mm long, with flat. */
export const STEPPER_SHAFT = { d: 0.5, len: 2.4 }

/** Where the 4-wire lead exits the rear (local). */
export const STEPPER_CABLE_EXIT: [number, number, number] = [-1.3, 1.1, 0]

/** Lamination texture for the four stack faces. */
function drawLaminations(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#1d1e22'
  ctx.fillRect(0, 0, w, h)
  // horizontal lamination lines every ~0.5 mm
  const lineGap = Math.max(2, Math.round(h / 94))
  ctx.fillStyle = 'rgba(70,72,78,0.9)'
  for (let y = 0; y < h; y += lineGap) ctx.fillRect(0, y, w, Math.max(1, lineGap / 2))
  // occasional rust freckle
  const rnd = seeded(4242)
  ctx.fillStyle = 'rgba(94,66,44,0.25)'
  for (let i = 0; i < 26; i++) ctx.fillRect(rnd() * w, rnd() * h, 2, 2)
}

function drawNameplate(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#d7d9dc'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#5a5d63'
  ctx.lineWidth = 3
  ctx.strokeRect(6, 6, w - 12, h - 12)
  ctx.fillStyle = '#17181c'
  ctx.textAlign = 'center'
  ctx.font = `700 ${Math.round(h * 0.26)}px Arial`
  ctx.fillText('42STH47', w / 2, h * 0.4)
  ctx.font = `600 ${Math.round(h * 0.22)}px Arial`
  ctx.fillText('1684AI', w / 2, h * 0.68)
  ctx.font = `500 ${Math.round(h * 0.15)}px Arial`
  ctx.fillText('1.8°/STEP', w / 2, h * 0.9)
}

export function Nema17Stepper({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  running = false,
  scale = 1,
}: Nema17StepperProps) {
  const rotor = useRef<THREE.Group>(null)
  // step accumulator — advances in 1.8° increments like a real driver
  const stepRef = useRef(0)

  const texs = useMemo(() => {
    const face = makeLabelTexture(256, 300, drawLaminations)
    const plate = makeLabelTexture(420, 300, drawNameplate)
    return { face, plate }
  }, [])

  const geo = useMemo(
    () => ({
      wires: (
        [
          [M.pvcBlack, -0.21],
          [M.pvcGreen, -0.07],
          [M.pvcRed, 0.07],
          [M.pvcBlue, 0.21],
        ] as Array<[Record<string, unknown>, number]>
      ).map(([mat, z]) => ({
        tube: wireTube(
          [
            [-2.05, 1.1, z],
            [-2.5, 0.75, z * 1.4],
            [-2.95, 0.28, z * 1.6],
          ],
          0.09,
          20
        ),
        mat,
      })),
    }),
    []
  )

  useFrame((_, dt) => {
    if (!running || !rotor.current) return
    // 1.8° per step at ~110 full steps/s — visibly discrete, like real
    stepRef.current += dt * 110
    const steps = Math.floor(stepRef.current)
    rotor.current.rotation.y = -steps * THREE.MathUtils.degToRad(1.8)
  })

  const half = STEPPER_DIMS.w / 2

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ---- laminated steel stack (4 textured faces) ---- */}
      {/* +x face */}
      <mesh position={[half + 0.001, STEPPER_DIMS.h / 2 - 0.45, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
        <planeGeometry args={[STEPPER_DIMS.w, STEPPER_DIMS.h - 0.9]} />
        <meshStandardMaterial map={texs.face} roughness={0.6} metalness={0.22} />
      </mesh>
      <mesh position={[-half - 0.001, STEPPER_DIMS.h / 2 - 0.45, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow>
        <planeGeometry args={[STEPPER_DIMS.w, STEPPER_DIMS.h - 0.9]} />
        <meshStandardMaterial map={texs.face} roughness={0.6} metalness={0.22} />
      </mesh>
      <mesh position={[0, STEPPER_DIMS.h / 2 - 0.45, half + 0.001]} castShadow receiveShadow>
        <planeGeometry args={[STEPPER_DIMS.w, STEPPER_DIMS.h - 0.9]} />
        <meshStandardMaterial map={texs.face} roughness={0.6} metalness={0.22} />
      </mesh>
      <mesh position={[0, STEPPER_DIMS.h / 2 - 0.45, -half - 0.001]} rotation={[0, Math.PI, 0]} castShadow receiveShadow>
        <planeGeometry args={[STEPPER_DIMS.w, STEPPER_DIMS.h - 0.9]} />
        <meshStandardMaterial map={texs.face} roughness={0.6} metalness={0.22} />
      </mesh>
      {/* stack core (fills the box) */}
      <RoundedBox args={[STEPPER_DIMS.w, STEPPER_DIMS.h - 0.9, STEPPER_DIMS.w]} radius={0.03} smoothness={2} position={[0, STEPPER_DIMS.h / 2 - 0.45, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...M.abs} />
      </RoundedBox>

      {/* nameplate on the +z face */}
      <mesh position={[0.6, STEPPER_DIMS.h / 2 - 0.45, half + 0.02]}>
        <planeGeometry args={[2.1, 1.5]} />
        <meshStandardMaterial map={texs.plate} roughness={0.4} metalness={0.1} />
      </mesh>

      {/* ---- front plate: aluminium, on top ---- */}
      <group position={[0, STEPPER_DIMS.h - 0.42, 0]}>
        <RoundedBox args={[STEPPER_DIMS.w, 0.42, STEPPER_DIMS.w]} radius={0.04} smoothness={3} castShadow receiveShadow>
          <meshStandardMaterial {...M.alu} />
        </RoundedBox>
        {/* pilot boss */}
        <mesh position={[0, 0.24, 0]} castShadow>
          <cylinderGeometry args={[1.1, 1.16, 0.12, 36]} />
          <meshStandardMaterial {...M.alu} />
        </mesh>
        {/* 4 corner cap screws */}
        {[
          [half - 0.35, half - 0.35],
          [half - 0.35, -(half - 0.35)],
          [-(half - 0.35), half - 0.35],
          [-(half - 0.35), -(half - 0.35)],
        ].map(([x, z], i) => (
          <PhillipsScrew key={i} position={[x, 0.22, z]} r={0.17} />
        ))}
      </group>

      {/* ---- the stepping shaft ---- */}
      <group ref={rotor} position={[0, STEPPER_DIMS.h - 0.3, 0]}>
        <mesh position={[0, STEPPER_SHAFT.len / 2, 0]} castShadow>
          <cylinderGeometry args={[STEPPER_SHAFT.d / 2, STEPPER_SHAFT.d / 2, STEPPER_SHAFT.len, 24]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
        <mesh position={[0.22, STEPPER_SHAFT.len - 0.25, 0]}>
          <boxGeometry args={[0.06, 0.9, 0.34]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
      </group>

      {/* ---- rear cap + cable gland ---- */}
      <group position={[0, 0.22, 0]}>
        <RoundedBox args={[STEPPER_DIMS.w, 0.44, STEPPER_DIMS.w]} radius={0.04} smoothness={3} castShadow receiveShadow>
          <meshStandardMaterial {...M.abs} />
        </RoundedBox>
        <RoundedBox args={[1.15, 0.5, 0.9]} radius={0.1} smoothness={3} position={[-1.3, 0.28, 0]} castShadow>
          <meshStandardMaterial {...M.abs} />
        </RoundedBox>
      </group>

      {/* ---- 4-wire lead ---- */}
      {geo.wires.map(({ tube, mat }, i) => (
        <mesh key={i} geometry={tube} castShadow>
          <meshStandardMaterial {...(mat as object)} />
        </mesh>
      ))}
    </group>
  )
}

export default Nema17Stepper
