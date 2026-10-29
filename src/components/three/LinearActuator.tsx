'use client'

/**
 * LinearActuator — an exact procedural replica of a mini track-style
 * linear actuator (LA-40 class, the 9–12 V kind used on student robots)
 * at 1 unit = 10 mm.
 *
 * Real anatomy: a black-anodized extruded aluminium BODY with the two
 * T-slot grooves down each side, a front BEARING BLOCK with its wiper
 * seal, a bright chrome PLATIN ROD sliding out of it to a steel CLEVIS
 * (the U-shaped rod end), and a rear MOTOR CAN with red/black leads.
 *
 * The notes' "linear actuator": it converts the motor's rotation into
 * straight-line push/pull — the transmission that moves things FORWARD.
 * Wire it to the battery (6–12 V) and the rod extends and retracts at a
 * realistic 12 mm/s.
 */

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { M, PhillipsScrew, makeLabelTexture, wireTube } from './kit'

export interface LinearActuatorProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** True while powered + running — the rod cycles. */
  running?: boolean
  scale?: number
}

/** 16 mm profile × 150 mm body, 40 mm stroke (1 unit = 10 mm). */
export const LINACT_DIMS = { body: 15.0, stroke: 4.0 }
/** Rod speed while running (mm/s) — honest mini-actuator pace. */
export const LINACT_SPEED_MM = 12

/** Where the wires/couplers clip (local coordinates). */
export const LINACT_ANCHORS = {
  plus: [-9.05, 0.75, 0.4] as [number, number, number],
  minus: [-9.05, 0.75, -0.4] as [number, number, number],
  mount: [-2.2, 2.0, 0] as [number, number, number],
  /** The clevis the rod pushes/pulls with. */
  rod: [7.2, 1.1, 0] as [number, number, number],
}

function drawLabel(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#26282e'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#cfd4da'
  ctx.textAlign = 'center'
  ctx.font = '800 56px Arial'
  ctx.fillText('LA-40', w / 2, h * 0.4)
  ctx.font = '600 32px Arial'
  ctx.fillStyle = '#9aa1aa'
  ctx.fillText('40 mm · 30 N', w / 2, h * 0.66)
  ctx.font = '500 28px Arial'
  ctx.fillText('12 mm/s · 6–12 V', w / 2, h * 0.9)
}

export function LinearActuator({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  running = false,
  scale = 1,
}: LinearActuatorProps) {
  const rod = useRef<THREE.Group>(null)
  const t = useRef(0)
  const cy = 1.1 // centerline height

  const labelTex = useMemo(() => makeLabelTexture(420, 140, drawLabel), [])

  const geo = useMemo(
    () => ({
      wireRed: wireTube(
        [
          [-8.85, cy, 0.4],
          [-9.35, cy - 0.35, 0.55],
          [-9.7, 0.55, 0.55],
        ],
        0.13,
        24
      ),
      wireBlack: wireTube(
        [
          [-8.85, cy, -0.4],
          [-9.35, cy - 0.35, -0.55],
          [-9.7, 0.55, -0.55],
        ],
        0.13,
        24
      ),
    }),
    []
  )

  useFrame((_, dt) => {
    if (!rod.current) return
    if (running) {
      // 12 mm/s over the 40 mm stroke, dwelling briefly at each end.
      t.current = (t.current + dt) % 8.5
      const p = THREE.MathUtils.clamp((t.current - 0.7) / 7.1, 0, 1)
      const eased = p < 0.5 ? p * p * 2 : 1 - (1 - p) * (1 - p) * 2
      rod.current.position.x = eased * LINACT_DIMS.stroke
    } else {
      rod.current.position.x = THREE.MathUtils.lerp(rod.current.position.x, 0, dt * 2.5)
    }
  })

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ---- extruded body with T-slot grooves ---- */}
      <mesh position={[-2.2, cy, 0]} castShadow receiveShadow>
        <boxGeometry args={[8.0, 1.7, 1.7]} />
        <meshStandardMaterial color="#2b2d33" metalness={0.72} roughness={0.42} />
      </mesh>
      {/* label band on top */}
      <mesh position={[-2.2, cy + 0.86, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.4, 1.1]} />
        <meshStandardMaterial map={labelTex} roughness={0.42} metalness={0.3} />
      </mesh>
      {/* the two slot grooves per side */}
      {[0.45, -0.45].map((dy) =>
        [0.86, -0.86].map((dz) => (
          <mesh key={`${dy}-${dz}`} position={[-2.2, cy + dy, dz]}>
            <boxGeometry args={[7.6, 0.28, 0.1]} />
            <meshStandardMaterial color="#17181c" roughness={0.6} metalness={0.3} />
          </mesh>
        ))
      )}

      {/* ---- front bearing block + wiper ---- */}
      <mesh position={[2.35, cy, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 1.95, 1.95]} />
        <meshStandardMaterial {...M.alu} />
      </mesh>
      {[
        [0.62, 0.62],
        [0.62, -0.62],
        [-0.62, 0.62],
        [-0.62, -0.62],
      ].map(([dy, dz], i) => (
        <PhillipsScrew
          key={i}
          position={[2.92, cy + dy, dz]}
          rotation={[0, 0, Math.PI / 2]}
          r={0.13}
        />
      ))}
      <mesh position={[2.98, cy, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.48, 0.48, 0.22, 24]} />
        <meshStandardMaterial color="#111216" roughness={0.55} />
      </mesh>

      {/* ---- the chrome rod + clevis (TRANSLATES) ---- */}
      <group ref={rod}>
        <mesh position={[5.0, cy, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.275, 0.275, 4.2, 24]} />
          <meshStandardMaterial {...M.chrome} roughness={0.06} />
        </mesh>
        {/* clevis: the U-fork rod end */}
        <mesh position={[7.15, cy, 0]} castShadow>
          <boxGeometry args={[0.6, 0.75, 1.15]} />
          <meshStandardMaterial color="#8d9299" metalness={0.85} roughness={0.35} />
        </mesh>
        {[0.3, -0.3].map((dz) => (
          <mesh key={dz} position={[7.6, cy, dz]} castShadow>
            <boxGeometry args={[0.3, 0.95, 0.22]} />
            <meshStandardMaterial color="#8d9299" metalness={0.85} roughness={0.35} />
          </mesh>
        ))}
        {/* the clevis cross-hole */}
        <mesh position={[7.6, cy, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 1.1, 20]} />
          <meshStandardMaterial {...M.hole} />
        </mesh>
      </group>

      {/* ---- rear motor can + leads ---- */}
      <mesh position={[-7.4, cy, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.95, 0.95, 2.4, 36]} />
        <meshStandardMaterial color="#26282e" metalness={0.72} roughness={0.42} />
      </mesh>
      {[-6.6, -7.0, -7.8, -8.2].map((x) => (
        <mesh key={x} position={[x, cy, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.99, 0.99, 0.12, 36]} />
          <meshStandardMaterial color="#1e2026" metalness={0.7} roughness={0.45} />
        </mesh>
      ))}
      <mesh geometry={geo.wireRed} castShadow>
        <meshStandardMaterial {...M.pvcRed} />
      </mesh>
      <mesh geometry={geo.wireBlack} castShadow>
        <meshStandardMaterial {...M.pvcBlack} />
      </mesh>
      {[0.55, -0.55].map((z) => (
        <mesh key={z} position={[-9.7, 0.55, z]}>
          <cylinderGeometry args={[0.065, 0.065, 0.15, 10]} />
          <meshStandardMaterial {...M.brass} />
        </mesh>
      ))}
    </group>
  )
}

export default LinearActuator
