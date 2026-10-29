'use client'

/**
 * VaneActuator — an exact procedural replica of a pneumatic rotary vane
 * actuator (RV-50 class) at 1 unit = 10 mm.
 *
 * Real anatomy: a clear-anodized aluminium barrel sandwiched between
 * two end caps (four socket screws each), a keyed chrome shaft rising
 * out of the top, two brass M5 air fittings on the side — one drives
 * the vane clockwise, the other counter-clockwise — plus external stop
 * screws that set the travel angle. Inside (hidden, like the real
 * thing) a vane fixed to the shaft separates two pressure chambers.
 *
 * The notes' "vane rotary": pressure enters, pushes on the vane, and
 * the shaft swings through a LIMITED arc — not continuous rotation.
 * Feed it air from the pump and the shaft sweeps its 270° stroke and
 * holds against the stop, exactly like the real actuator.
 */

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { M, PhillipsScrew } from './kit'

export interface VaneActuatorProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** True while live air arrives — the shaft sweeps its arc. */
  pressurized?: boolean
  scale?: number
}

/** Ø42 mm body, 39 mm tall; 270° working rotation (1 unit = 10 mm). */
export const VANE_DIMS = { od: 4.2, height: 3.9, sweepDeg: 270 }

/** Where the tubing/couplers clip (local coordinates). */
export const VANE_ANCHORS = {
  /** The drive-side air fitting stub. */
  port: [2.95, 1.25, 0.75] as [number, number, number],
  mount: [1.6, 0.15, 1.6] as [number, number, number],
  shaft: [0, 3.95, 0] as [number, number, number],
}

export function VaneActuator({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  pressurized = false,
  scale = 1,
}: VaneActuatorProps) {
  const shaft = useRef<THREE.Group>(null)
  const angle = useRef(0)

  useFrame((_, dt) => {
    // Sweep smoothly to the 270° stop while pressurized, return to 0
    // when the air is gone — limited rotation, like the real vane.
    const target = pressurized ? (VANE_DIMS.sweepDeg * Math.PI) / 180 : 0
    angle.current += THREE.MathUtils.clamp(target - angle.current, -dt * 1.6, dt * 1.6)
    if (shaft.current) shaft.current.rotation.y = angle.current
  })

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ---- aluminium barrel ---- */}
      <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.1, 2.1, 1.7, 48]} />
        <meshStandardMaterial {...M.alu} />
      </mesh>
      {/* body seam line */}
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[2.11, 2.11, 0.08, 48, 1, true]} />
        <meshStandardMaterial color="#7f858d" metalness={0.85} roughness={0.4} />
      </mesh>

      {/* ---- end caps with their socket screws ---- */}
      {[0.2, 2.3].map((y) => (
        <group key={y} position={[0, y, 0]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[2.22, 2.22, 0.4, 48]} />
            <meshStandardMaterial color="#a7adb5" metalness={0.85} roughness={0.38} />
          </mesh>
          {Array.from({ length: 4 }, (_, i) => {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4
            return (
              <PhillipsScrew
                key={i}
                position={[Math.cos(a) * 1.85, y > 1 ? 0.21 : -0.21, Math.sin(a) * 1.85]}
                rotation={y > 1 ? [Math.PI / 2, 0, 0] : [-Math.PI / 2, 0, 0]}
                r={0.15}
              />
            )
          })}
        </group>
      ))}

      {/* ---- the two brass M5 air fittings ---- */}
      {[0.75, -0.75].map((z) => (
        <group key={z} position={[2.12, 1.25, z]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.26, 0.26, 0.5, 6]} />
            <meshStandardMaterial {...M.brass} />
          </mesh>
          <mesh position={[0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.32, 0.32, 0.2, 20]} />
            <meshStandardMaterial color="#1f4fa8" roughness={0.45} metalness={0.05} />
          </mesh>
          <mesh position={[0.68, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.11, 0.11, 0.5, 14]} />
            <meshStandardMaterial {...M.brass} />
          </mesh>
        </group>
      ))}

      {/* ---- external stop screws on the rim ---- */}
      {[0.9, -0.9].map((z) => (
        <PhillipsScrew
          key={z}
          position={[-2.05, 1.25 + z * 0.3, z]}
          rotation={[0, 0, Math.PI / 2]}
          r={0.13}
          color="#8d9299"
        />
      ))}

      {/* ---- keyed output shaft (sweeps the arc) ---- */}
      <group ref={shaft}>
        <mesh position={[0, 3.3, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.45, 1.3, 28]} />
          <meshStandardMaterial {...M.chrome} />
        </mesh>
        {/* the keyway + key */}
        <mesh position={[0, 3.3, 0.42]}>
          <boxGeometry args={[0.18, 1.05, 0.16]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
        {/* red position indicator disc — shows the angle at a glance */}
        <mesh position={[0, 3.98, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.09, 20]} />
          <meshStandardMaterial color="#c22a26" roughness={0.4} />
        </mesh>
        <mesh position={[0.34, 3.98, 0]}>
          <boxGeometry args={[0.26, 0.1, 0.07]} />
          <meshStandardMaterial color="#c22a26" roughness={0.4} />
        </mesh>
      </group>
    </group>
  )
}

export default VaneActuator
