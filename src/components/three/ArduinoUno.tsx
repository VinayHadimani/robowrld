'use client'

/**
 * ArduinoUno — a self-contained, reusable 3D replica of the Arduino Uno
 * R3 board, modeled entirely from procedural Three.js geometry (no
 * external model files), at the same 1 unit = 10 mm scale as the servo
 * and the battery.
 *
 * Anatomy replicated from the real part:
 *  - Teal PCB (68.6 × 53.4 mm) with mounting eyelets
 *  - Two black header strips with gold pins (digital + power/analog)
 *  - USB-B connector and 2.1 mm barrel jack on the same edge
 *  - ATmega328P DIP-28 chip + 16 MHz crystal + reset button
 *  - A green ON LED that lights while the board is powered
 *
 * In the playground this board is the real-life bridge: the 9V battery
 * wires into its VIN jack (7–12 V), and its 5 V pin header feeds servos
 * and small motors through a 3-wire signal ribbon.
 */

import { RoundedBox } from '@react-three/drei'

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface ArduinoUnoProps {
  /** World position of the board's base center. */
  position?: [number, number, number]
  /** True while the board receives power — lights the ON LED. */
  ledOn?: boolean
  scale?: number
}

/** Default palette — the classic Uno look. */
const PCB = '#0b7f8b'
const HEADER = '#17181c'
const GOLD = '#d4a72c'
const METAL = '#b9bec7'
const CHIP = '#141519'

/* ------------------------------------------------------------------ */
/* Dimensions (1 unit = 10 mm — Uno R3: 68.6 × 53.4 mm)                */
/* ------------------------------------------------------------------ */

export const ARDUINO_SIZE = { w: 6.86, d: 5.34 }

/**
 * Electrical anchor points (local, relative to the board's base center)
 * — where the playground's wires clip on:
 *  - vin: the barrel jack on the left edge (red = +, black = −)
 *  - header: the 5 V pin header along the top edge (servo ribbon)
 */
export const ARDUINO_ANCHORS: {
  vin: { plus: [number, number, number]; minus: [number, number, number] }
  header: [number, number, number]
} = {
  vin: {
    plus: [-3.55, 0.66, 1.15],
    minus: [-3.55, 0.66, 1.55],
  },
  header: [1.5, 0.62, 2.62],
}

/* ------------------------------------------------------------------ */
/* The board                                                           */
/* ------------------------------------------------------------------ */

/** One black header strip with gold pins along its length. */
function HeaderStrip({
  position,
  length,
  pins,
  rotationY = 0,
}: {
  position: [number, number, number]
  length: number
  pins: number
  rotationY?: number
}) {
  const pinXs = Array.from({ length: pins }, (_, i) => -length / 2 + 0.35 + (i * (length - 0.7)) / Math.max(pins - 1, 1))
  return (
    <group position={position} rotation-y={rotationY}>
      <RoundedBox args={[length, 0.42, 0.58]} radius={0.05} smoothness={3} castShadow>
        <meshStandardMaterial color={HEADER} roughness={0.55} metalness={0.15} />
      </RoundedBox>
      {pinXs.map((x, i) => (
        <mesh key={i} position={[x, 0.26, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.16, 8]} />
          <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

export function ArduinoUno({
  position = [0, 0, 0],
  ledOn = false,
  scale = 1,
}: ArduinoUnoProps) {
  const baseY = 0.03
  const boardY = baseY + 0.08

  return (
    <group position={position} scale={scale}>
      {/* PCB */}
      <RoundedBox
        args={[ARDUINO_SIZE.w, 0.16, ARDUINO_SIZE.d]}
        radius={0.06}
        smoothness={3}
        position={[0, boardY, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={PCB} roughness={0.6} metalness={0.05} />
      </RoundedBox>

      {/* Mounting eyelets */}
      {(
        [
          [-3.08, -2.22],
          [3.08, -2.22],
          [3.08, 2.22],
          [-1.55, 2.22],
        ] as Array<[number, number]>
      ).map(([x, z], i) => (
        <mesh key={i} position={[x, boardY + 0.09, z]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.19, 0.19, 0.03, 20]} />
          <meshStandardMaterial color={METAL} roughness={0.35} metalness={0.8} />
        </mesh>
      ))}

      {/* Digital header (top edge) + power/analog header (bottom edge) */}
      <HeaderStrip position={[0.4, boardY + 0.21, 2.25]} length={5.1} pins={10} />
      <HeaderStrip position={[-0.2, boardY + 0.21, -2.25]} length={5.0} pins={8} />

      {/* USB-B connector — left edge, upper */}
      <RoundedBox
        args={[1.3, 1.05, 1.25]}
        radius={0.1}
        smoothness={3}
        position={[-3.05, boardY + 0.53, -1.45]}
        castShadow
      >
        <meshStandardMaterial color={METAL} roughness={0.32} metalness={0.85} />
      </RoundedBox>

      {/* 2.1 mm barrel jack — left edge, lower (the VIN anchor) */}
      <RoundedBox
        args={[1.35, 1.0, 1.3]}
        radius={0.1}
        smoothness={3}
        position={[-3.0, boardY + 0.5, 1.35]}
        castShadow
      >
        <meshStandardMaterial color="#22242a" roughness={0.45} metalness={0.35} />
      </RoundedBox>
      <mesh position={[-3.68, boardY + 0.5, 1.35]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.3, 0.3, 0.08, 20]} />
        <meshStandardMaterial color="#0d0e11" roughness={0.6} metalness={0.2} />
      </mesh>

      {/* ATmega328P DIP-28 */}
      <RoundedBox
        args={[2.7, 0.3, 0.95]}
        radius={0.05}
        smoothness={3}
        position={[1.0, boardY + 0.23, 0.5]}
        castShadow
      >
        <meshStandardMaterial color={CHIP} roughness={0.55} metalness={0.1} />
      </RoundedBox>

      {/* 16 MHz crystal */}
      <RoundedBox
        args={[1.05, 0.24, 0.5]}
        radius={0.1}
        smoothness={3}
        position={[-0.95, boardY + 0.2, -0.85]}
        castShadow
      >
        <meshStandardMaterial color={METAL} roughness={0.28} metalness={0.85} />
      </RoundedBox>

      {/* Reset button */}
      <RoundedBox
        args={[0.55, 0.28, 0.55]}
        radius={0.06}
        smoothness={3}
        position={[-2.35, boardY + 0.22, -1.95]}
        castShadow
      >
        <meshStandardMaterial color="#2e6df2" roughness={0.4} metalness={0.2} />
      </RoundedBox>

      {/* ON LED — dark until the board is powered */}
      <mesh position={[-2.5, boardY + 0.11, 0.55]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.11, 0.11, 0.06, 16]} />
        <meshStandardMaterial
          color={ledOn ? '#4ade80' : '#31513c'}
          emissive="#22c55e"
          emissiveIntensity={ledOn ? 2.4 : 0}
          roughness={0.35}
        />
      </mesh>

      {/* A couple of electrolytic caps near the power section */}
      <mesh position={[-2.0, boardY + 0.35, 1.9]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.55, 20]} />
        <meshStandardMaterial color="#1d3a8f" roughness={0.45} metalness={0.15} />
      </mesh>
      <mesh position={[2.9, boardY + 0.3, 1.5]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 0.45, 20]} />
        <meshStandardMaterial color="#1d3a8f" roughness={0.45} metalness={0.15} />
      </mesh>
    </group>
  )
}

export default ArduinoUno
