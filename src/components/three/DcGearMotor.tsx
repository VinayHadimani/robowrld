'use client'

/**
 * DcGearMotor — an exact procedural replica of the 37 mm brushed DC
 * gear motor (37D-19:1 class) at 1 unit = 10 mm.
 *
 * Real anatomy: Ø37 mm silver planetary gearbox in front (with the
 * four M3 threaded face holes and the 6 mm steel output shaft with its
 * ground flat), a longer black nickel-plated motor can behind, a
 * plastic rear cap carrying the solder tabs the red/black power leads
 * exit from, and the printed nameplate on the gearbox barrel.
 *
 * When powered and running, the OUTPUT SHAFT SPINS — continuous
 * rotation, unlike a servo.
 */

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Cylinder } from '@react-three/drei'
import { M, makeLabelTexture, wireTube } from './kit'

export interface DcGearMotorProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** True while spinning (powered + running). */
  running?: boolean
  scale?: number
}

/** Ø37 mm barrel, 56 mm end-to-end (1 unit = 10 mm). */
export const DC_MOTOR_DIMS = { d: 3.7, len: 5.6 }
/** Ø6 mm output shaft tip. */
export const DC_MOTOR_SHAFT = { d: 0.6, len: 1.65 }

/** Where the power leads exit the rear cap (local). */
export const DC_MOTOR_LEADS: { plus: [number, number, number]; minus: [number, number, number] } = {
  plus: [-2.85, 1.0, 0.35],
  minus: [-2.85, 1.0, -0.35],
}

function drawNameplate(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, w, 0)
  grad.addColorStop(0, '#a6abb3')
  grad.addColorStop(0.5, '#c7ccd3')
  grad.addColorStop(1, '#a6abb3')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#1c1e23'
  ctx.textAlign = 'center'
  ctx.font = `800 ${Math.round(h * 0.34)}px Arial`
  ctx.fillText('37D', w / 2, h * 0.44)
  ctx.font = `700 ${Math.round(h * 0.24)}px Arial`
  ctx.fillText('19:1', w / 2, h * 0.78)
}

export function DcGearMotor({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  running = false,
  scale = 1,
}: DcGearMotorProps) {
  const rotor = useRef<THREE.Group>(null)

  const geo = useMemo(
    () => ({
      wireRed: wireTube(
        [
          [-2.8, 1.0, 0.35],
          [-3.35, 0.85, 0.5],
          [-3.85, 0.45, 0.5],
        ],
        0.14,
        24
      ),
      wireBlack: wireTube(
        [
          [-2.8, 1.0, -0.35],
          [-3.35, 0.85, -0.5],
          [-3.85, 0.45, -0.5],
        ],
        0.14,
        24
      ),
    }),
    []
  )

  const plateTex = useMemo(() => makeLabelTexture(360, 160, drawNameplate), [])

  useFrame((_, dt) => {
    if (running && rotor.current) rotor.current.rotation.x += dt * 9
  })

  const cy = DC_MOTOR_DIMS.d / 2 // barrel centerline height

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ---- gearbox barrel (silver, front) ---- */}
      <mesh position={[1.4, cy, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[DC_MOTOR_DIMS.d / 2, DC_MOTOR_DIMS.d / 2, 2.9, 44]} />
        <meshStandardMaterial {...M.alu} />
      </mesh>
      {/* gearbox nameplate band */}
      <mesh position={[1.4, cy, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[DC_MOTOR_DIMS.d / 2 + 0.015, DC_MOTOR_DIMS.d / 2 + 0.015, 1.3, 44, 1, true]} />
        <meshStandardMaterial map={plateTex} roughness={0.32} metalness={0.3} />
      </mesh>
      {/* chamfer ring at the front face */}
      <mesh position={[2.82, cy, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[DC_MOTOR_DIMS.d / 2 - 0.12, DC_MOTOR_DIMS.d / 2, 0.18, 44]} />
        <meshStandardMaterial {...M.alu} />
      </mesh>

      {/* front face: 4 M3 threaded holes + boss */}
      <mesh position={[2.92, cy, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.85, 0.85, 0.08, 32]} />
        <meshStandardMaterial {...M.aluRaw} />
      </mesh>
      {[
        [1.42, 0],
        [-1.42, 0],
        [0, 1.42],
        [0, -1.42],
      ].map(([dz, dx], i) => (
        <mesh key={i} position={[2.97, cy + dz, dx]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.14, 0.14, 0.05, 14]} />
          <meshStandardMaterial {...M.hole} />
        </mesh>
      ))}

      {/* ---- the spinning output shaft (6 mm, with flat) ---- */}
      <group ref={rotor}>
        <mesh position={[3.4, cy, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[DC_MOTOR_SHAFT.d / 2, DC_MOTOR_SHAFT.d / 2, DC_MOTOR_SHAFT.len, 24]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
        {/* the ground flat on one side */}
        <mesh position={[3.62, cy - DC_MOTOR_SHAFT.d / 2 - 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.7, 0.06, DC_MOTOR_SHAFT.d * 0.8]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
      </group>

      {/* ---- motor can (black, behind) ---- */}
      <mesh position={[-0.95, cy, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[DC_MOTOR_DIMS.d / 2, DC_MOTOR_DIMS.d / 2, 2.55, 44]} />
        <meshStandardMaterial {...M.nickel} />
      </mesh>
      {/* crimp ring where the can meets the cap */}
      <mesh position={[-2.1, cy, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[DC_MOTOR_DIMS.d / 2 + 0.03, DC_MOTOR_DIMS.d / 2 + 0.03, 0.22, 44]} />
        <meshStandardMaterial color="#82868c" metalness={0.85} roughness={0.4} />
      </mesh>

      {/* ---- rear cap with solder tabs + leads ---- */}
      <mesh position={[-2.72, cy, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[DC_MOTOR_DIMS.d / 2 - 0.06, DC_MOTOR_DIMS.d / 2 - 0.02, 0.5, 40]} />
        <meshStandardMaterial {...M.abs} />
      </mesh>
      {DC_MOTOR_LEADS.plus[2] !== 0 &&
        (
          [
            [DC_MOTOR_LEADS.plus[2], M.pvcRed],
            [DC_MOTOR_LEADS.minus[2], M.pvcBlack],
          ] as Array<[number, Record<string, unknown>]>
        ).map(([z, mat], i) => (
          <mesh key={i} position={[-2.95, cy, z]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.3, 0.34, 0.5]} />
            <meshStandardMaterial {...(mat as object)} />
          </mesh>
        ))}
      <mesh geometry={geo.wireRed} castShadow>
        <meshStandardMaterial {...M.pvcRed} />
      </mesh>
      <mesh geometry={geo.wireBlack} castShadow>
        <meshStandardMaterial {...M.pvcBlack} />
      </mesh>
      {/* tinned wire tips */}
      {(
        [
          [-3.85, 0.45, 0.5],
          [-3.85, 0.45, -0.5],
        ] as Array<[number, number, number]>
      ).map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.07, 0.07, 0.16, 10]} />
          <meshStandardMaterial {...M.brass} />
        </mesh>
      ))}
    </group>
  )
}

export default DcGearMotor
