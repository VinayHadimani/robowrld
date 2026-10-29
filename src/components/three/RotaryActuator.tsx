'use client'

/**
 * RotaryActuator — an exact procedural replica of a compact industrial
 * electric rotary actuator (RA-30 class) at 1 unit = 10 mm.
 *
 * Real anatomy: a black-anodized aluminium barrel, a square front
 * FLANGE with four M3 holes and a pilot boss, a Ø8 mm chrome output
 * shaft with a MACHINE KEY (the steel strip that transmits torque to
 * whatever is bolted on), a rear cap with a brass cable gland, and red/
 * black power leads.
 *
 * A rotary actuator is the general class the notes describe: it turns
 * energy into REVOLVING motion — not a straight line. Wire it to the
 * battery (6–12 V) and the keyed shaft turns continuously at 30 RPM.
 */

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { M, PhillipsScrew, makeLabelTexture, wireTube } from './kit'

export interface RotaryActuatorProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** True while powered + running — the shaft turns. */
  running?: boolean
  scale?: number
}

/** Ø30 mm body, 66 mm end-to-end (1 unit = 10 mm). */
export const ROTARY_DIMS = { od: 3.0, length: 6.6 }
/** Shaft speed while running. */
export const ROTARY_RPM = 30

/** Where the wires/couplers clip (local coordinates). */
export const ROTARY_ANCHORS = {
  shaft: [3.35, 1.5, 0] as [number, number, number],
  plus: [-3.55, 0.85, 0.4] as [number, number, number],
  minus: [-3.55, 0.85, -0.4] as [number, number, number],
  mount: [1.9, 3.3, 0] as [number, number, number],
}

function drawLabel(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#26282e'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#cfd4da'
  ctx.textAlign = 'center'
  ctx.font = '800 58px Arial'
  ctx.fillText('RA-30', w / 2, h * 0.4)
  ctx.font = '600 34px Arial'
  ctx.fillStyle = '#9aa1aa'
  ctx.fillText('30 RPM · 1.5 N·m', w / 2, h * 0.66)
  ctx.font = '500 30px Arial'
  ctx.fillText('6–12 V DC', w / 2, h * 0.9)
}

export function RotaryActuator({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  running = false,
  scale = 1,
}: RotaryActuatorProps) {
  const shaft = useRef<THREE.Group>(null)
  const cy = 1.5 // centerline height

  const labelTex = useMemo(() => makeLabelTexture(360, 150, drawLabel), [])

  const geo = useMemo(
    () => ({
      wireRed: wireTube(
        [
          [-2.95, cy, 0.4],
          [-3.4, cy - 0.3, 0.55],
          [-3.75, 0.6, 0.55],
        ],
        0.13,
        24
      ),
      wireBlack: wireTube(
        [
          [-2.95, cy, -0.4],
          [-3.4, cy - 0.3, -0.55],
          [-3.75, 0.6, -0.55],
        ],
        0.13,
        24
      ),
    }),
    []
  )

  useFrame((_, dt) => {
    if (running && shaft.current) {
      shaft.current.rotation.x += (ROTARY_RPM / 60) * Math.PI * 2 * dt
    }
  })

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ---- anodized barrel ---- */}
      <mesh position={[0, cy, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.5, 3.4, 44]} />
        <meshStandardMaterial color="#2b2d33" metalness={0.78} roughness={0.4} />
      </mesh>
      <mesh position={[0, cy, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.51, 1.51, 1.5, 44, 1, true]} />
        <meshStandardMaterial map={labelTex} roughness={0.42} metalness={0.3} />
      </mesh>
      {/* cooling fins */}
      {[-1.1, -0.7, 0.7, 1.1].map((x) => (
        <mesh key={x} position={[x, cy, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[1.56, 1.56, 0.14, 44]} />
          <meshStandardMaterial color="#22242a" metalness={0.75} roughness={0.42} />
        </mesh>
      ))}

      {/* ---- front flange: square plate + 4 bolts + pilot boss ---- */}
      <mesh position={[1.9, cy, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.35, 3.7, 3.7]} />
        <meshStandardMaterial {...M.alu} />
      </mesh>
      {[
        [1.32, 1.32],
        [1.32, -1.32],
        [-1.32, 1.32],
        [-1.32, -1.32],
      ].map(([dy, dz], i) => (
        <PhillipsScrew key={i} position={[2.1, cy + dy, dz]} rotation={[0, 0, Math.PI / 2]} r={0.15} />
      ))}
      <mesh position={[2.12, cy, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.62, 0.62, 0.12, 32]} />
        <meshStandardMaterial {...M.aluRaw} />
      </mesh>

      {/* ---- keyed output shaft (turns while running) ---- */}
      <group ref={shaft}>
        <mesh position={[2.85, cy, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.4, 0.4, 1.35, 28]} />
          <meshStandardMaterial {...M.chrome} />
        </mesh>
        {/* the machine key transmitting the torque */}
        <mesh position={[2.85, cy + 0.34, 0]}>
          <boxGeometry args={[1.0, 0.16, 0.22]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
        {/* flat on the opposite side, like every keyed shaft */}
        <mesh position={[2.85, cy - 0.42, 0]}>
          <boxGeometry args={[0.9, 0.08, 0.5]} />
          <meshStandardMaterial {...M.chrome} />
        </mesh>
      </group>

      {/* ---- rear cap with cable gland + leads ---- */}
      <mesh position={[-1.95, cy, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.52, 1.46, 0.5, 44]} />
        <meshStandardMaterial {...M.pbt} />
      </mesh>
      <mesh position={[-2.3, cy, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.34, 0.38, 0.3, 6]} />
        <meshStandardMaterial {...M.brass} />
      </mesh>
      <mesh position={[-2.55, cy, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.35, 12]} />
        <meshStandardMaterial color="#141518" roughness={0.55} />
      </mesh>
      <mesh geometry={geo.wireRed} castShadow>
        <meshStandardMaterial {...M.pvcRed} />
      </mesh>
      <mesh geometry={geo.wireBlack} castShadow>
        <meshStandardMaterial {...M.pvcBlack} />
      </mesh>
      {/* tinned tips */}
      {[0.55, -0.55].map((z) => (
        <mesh key={z} position={[-3.75, 0.6, z]}>
          <cylinderGeometry args={[0.065, 0.065, 0.15, 10]} />
          <meshStandardMaterial {...M.brass} />
        </mesh>
      ))}
    </group>
  )
}

export default RotaryActuator
