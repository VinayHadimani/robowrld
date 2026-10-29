'use client'

/**
 * AirPump — an exact procedural replica of a 9 V mini diaphragm air
 * pump (the kind that runs pneumatic demos and fish-tank aerators) at
 * 1 unit = 10 mm.
 *
 * Real anatomy: a black ABS case on four rubber anti-vibration feet,
 * the silver motor can sticking out the back with red/black leads, a
 * brass OUTLET nozzle (and a capped inlet) on top, and the printed
 * rating label. Inside: a motor rocking a rubber diaphragm — which is
 * why the whole body trembles faintly while it runs.
 *
 * This is the pneumatic SOURCE of the playground: wire it to the 9 V
 * battery (6–9 V) and its nozzle feeds 0.4 bar of air through tubing
 * into muscles and vane motors — energy turning into motion, the
 * pneumatic way.
 */

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { M, makeLabelTexture, wireTube } from './kit'

export interface AirPumpProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** True while powered + running — the pump trembles faintly. */
  running?: boolean
  scale?: number
}

/** 42 × 30 × 27 mm case on feet; 0.4 bar outlet (1 unit = 10 mm). */
export const AIRPUMP_DIMS = { w: 4.2, h: 2.7, d: 3.0, bar: 0.4 }

/** Where the wires/tubing clip (local coordinates). */
export const AIRPUMP_ANCHORS = {
  plus: [-3.75, 0.9, 0.4] as [number, number, number],
  minus: [-3.75, 0.9, -0.4] as [number, number, number],
  /** The brass outlet nozzle tip. */
  air: [1.05, 3.35, 0.6] as [number, number, number],
}

function drawLabel(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#1d1e23'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#3a3d44'
  ctx.lineWidth = 6
  ctx.strokeRect(10, 10, w - 20, h - 20)
  ctx.fillStyle = '#d4d9df'
  ctx.textAlign = 'center'
  ctx.font = '800 54px Arial'
  ctx.fillText('AIR PUMP', w / 2, h * 0.38)
  ctx.font = '600 36px Arial'
  ctx.fillStyle = '#9aa1aa'
  ctx.fillText('9 V DC · 0.04 MPa', w / 2, h * 0.62)
  ctx.font = '500 30px Arial'
  ctx.fillText('150 L/h · diaphragm', w / 2, h * 0.86)
}

export function AirPump({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  running = false,
  scale = 1,
}: AirPumpProps) {
  const body = useRef<THREE.Group>(null)

  const labelTex = useMemo(() => makeLabelTexture(400, 200, drawLabel), [])

  const geo = useMemo(
    () => ({
      wireRed: wireTube(
        [
          [-3.55, 1.4, 0.4],
          [-4.05, 1.1, 0.55],
          [-4.35, 0.55, 0.55],
        ],
        0.13,
        24
      ),
      wireBlack: wireTube(
        [
          [-3.55, 1.4, -0.4],
          [-4.05, 1.1, -0.55],
          [-4.35, 0.55, -0.55],
        ],
        0.13,
        24
      ),
    }),
    []
  )

  useFrame(({ clock }) => {
    if (body.current) {
      // the diaphragm's 30 Hz tremble, scaled down to "just noticeable"
      body.current.position.y = running ? Math.sin(clock.elapsedTime * 28) * 0.012 : 0
    }
  })

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* rubber feet (fixed to the bench, not trembling) */}
      {[
        [1.7, 1.1],
        [1.7, -1.1],
        [-1.7, 1.1],
        [-1.7, -1.1],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.09, z]}>
          <cylinderGeometry args={[0.17, 0.19, 0.18, 14]} />
          <meshStandardMaterial color="#111214" roughness={0.85} />
        </mesh>
      ))}

      <group ref={body} position={[0, 0, 0]}>
        {/* ---- the case ---- */}
        <RoundedBox args={[4.2, 2.7, 3.0]} radius={0.16} smoothness={4} position={[0, 1.65, 0]} castShadow receiveShadow>
          <meshStandardMaterial {...M.abs} roughness={0.5} />
        </RoundedBox>
        {/* molded parting seam around the case */}
        <mesh position={[0, 1.65, 0]}>
          <boxGeometry args={[4.24, 0.05, 3.04]} />
          <meshStandardMaterial color="#141519" roughness={0.6} />
        </mesh>
        {/* rating label on the front face */}
        <mesh position={[0, 1.7, 1.51]}>
          <planeGeometry args={[2.9, 1.45]} />
          <meshStandardMaterial map={labelTex} roughness={0.45} metalness={0.05} />
        </mesh>
        {/* vent slots on the far face */}
        {[0.55, 0.95, 1.35].map((y) => (
          <mesh key={y} position={[0, y, -1.51]}>
            <boxGeometry args={[2.6, 0.14, 0.04]} />
            <meshStandardMaterial color="#0d0e11" roughness={0.7} />
          </mesh>
        ))}

        {/* ---- outlets on top: brass OUTLET + capped inlet ---- */}
        <group position={[1.05, 3.05, 0.6]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.14, 0.14, 0.6, 16]} />
            <meshStandardMaterial {...M.brass} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.14, 18]} />
            <meshStandardMaterial color="#1f4fa8" roughness={0.45} metalness={0.05} />
          </mesh>
        </group>
        <group position={[-1.05, 3.05, 0.6]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.14, 0.14, 0.45, 16]} />
            <meshStandardMaterial {...M.brass} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.22, 18]} />
            <meshStandardMaterial color="#3c3f45" roughness={0.55} />
          </mesh>
        </group>

        {/* ---- the motor can out the back ---- */}
        <mesh position={[-2.65, 1.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.85, 0.85, 1.4, 36]} />
          <meshStandardMaterial {...M.nickel} />
        </mesh>
        <mesh position={[-2.0, 1.4, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.87, 0.87, 0.16, 36]} />
          <meshStandardMaterial color="#82868c" metalness={0.85} roughness={0.4} />
        </mesh>
      </group>

      {/* ---- power leads with tinned tips ---- */}
      <mesh geometry={geo.wireRed} castShadow>
        <meshStandardMaterial {...M.pvcRed} />
      </mesh>
      <mesh geometry={geo.wireBlack} castShadow>
        <meshStandardMaterial {...M.pvcBlack} />
      </mesh>
      {[0.55, -0.55].map((z) => (
        <mesh key={z} position={[-4.35, 0.55, z]}>
          <cylinderGeometry args={[0.065, 0.065, 0.15, 10]} />
          <meshStandardMaterial {...M.brass} />
        </mesh>
      ))}
    </group>
  )
}

export default AirPump
