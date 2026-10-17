'use client'

/**
 * Battery9V — a self-contained, reusable 3D replica of a PP3 / 6LR61
 * 9-volt battery, modeled entirely from procedural Three.js geometry
 * (no external model files), at the same 1 unit = 10 mm scale as the
 * servo.
 *
 * Anatomy replicated from the real part:
 *  - Rectangular cell body with a vinyl wrap (upper color band)
 *  - Two brass snap terminals on the top face — one round (−) and one
 *    hexagonal-collared (+) — exactly the connectors real 9V clips grab
 *  - A small status LED on the band that lights up while the battery is
 *    powering something in the playground
 *
 * Reusability:
 *  <Battery9V ledOn />            // powered, LED lit
 *  <Battery9V position={[0, 0.03, 0]} />
 */

import { RoundedBox } from '@react-three/drei'

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface Battery9VProps {
  /** World position of the battery's base center. */
  position?: [number, number, number]
  /** True while the battery is connected and running — lights the LED. */
  ledOn?: boolean
  /** Wrap color of the upper band. */
  bandColor?: string
  /** Body (cell) color. */
  bodyColor?: string
  scale?: number
}

/** Default palette — classic gold-band zinc-carbon look. */
const DEFAULT_BODY = '#26262b'
const DEFAULT_BAND = '#b08d2f'
const BRASS = '#c9a227'

/* ------------------------------------------------------------------ */
/* Dimensions (1 unit = 10 mm — PP3: 26.5 × 17.5 × 48.5 mm)            */
/* ------------------------------------------------------------------ */

export const BATTERY_SIZE = { w: 2.65, d: 1.75, h: 4.85 }

/**
 * Snap-terminal positions (local, relative to the battery's base center).
 * The playground uses these as the anchor points its power wires clip on to.
 */
export const BATTERY_TERMINALS: {
  minus: [number, number, number]
  plus: [number, number, number]
} = {
  minus: [-0.55, BATTERY_SIZE.h + 0.03 + 0.09, 0],
  plus: [0.55, BATTERY_SIZE.h + 0.03 + 0.1, 0],
}

/* ------------------------------------------------------------------ */
/* The battery                                                         */
/* ------------------------------------------------------------------ */

export function Battery9V({
  position = [0, 0, 0],
  ledOn = false,
  bandColor = DEFAULT_BAND,
  bodyColor = DEFAULT_BODY,
  scale = 1,
}: Battery9VProps) {
  const baseY = 0.03
  const bodyCenterY = baseY + BATTERY_SIZE.h / 2
  const topY = baseY + BATTERY_SIZE.h

  return (
    <group position={position} scale={scale}>
      {/* Cell body — the wrapped rectangular cell */}
      <RoundedBox
        args={[BATTERY_SIZE.w, BATTERY_SIZE.h, BATTERY_SIZE.d]}
        radius={0.06}
        smoothness={4}
        position={[0, bodyCenterY, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={bodyColor} roughness={0.45} metalness={0.06} />
      </RoundedBox>

      {/* Upper wrap band (the colored jacket near the terminals) */}
      <RoundedBox
        args={[BATTERY_SIZE.w + 0.035, 1.15, BATTERY_SIZE.d + 0.035]}
        radius={0.055}
        smoothness={4}
        position={[0, topY - 0.75, 0]}
        castShadow
      >
        <meshStandardMaterial color={bandColor} roughness={0.5} metalness={0.18} />
      </RoundedBox>

      {/* Negative terminal — the plain round snap post */}
      <mesh position={[BATTERY_TERMINALS.minus[0], topY + 0.09, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.16, 0.18, 24]} />
        <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.9} />
      </mesh>

      {/* Positive terminal — hex collar + center post (the "big" snap) */}
      <mesh position={[BATTERY_TERMINALS.plus[0], topY + 0.07, 0]} castShadow>
        <cylinderGeometry args={[0.23, 0.23, 0.14, 6]} />
        <meshStandardMaterial color={BRASS} roughness={0.32} metalness={0.9} />
      </mesh>
      <mesh position={[BATTERY_TERMINALS.plus[0], topY + 0.19, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.14, 0.14, 24]} />
        <meshStandardMaterial color={BRASS} roughness={0.28} metalness={0.9} />
      </mesh>

      {/* Status LED on the band — dark glass when idle, lit while powering */}
      <mesh position={[0, topY - 0.72, BATTERY_SIZE.d / 2 + 0.015]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 20]} />
        <meshStandardMaterial
          color={ledOn ? '#4ade80' : '#3a4a42'}
          emissive="#22c55e"
          emissiveIntensity={ledOn ? 2.4 : 0}
          roughness={0.35}
        />
      </mesh>

      {/* Subtle seam line where the wrap meets the body (visual only) */}
      <mesh position={[0, topY - 1.33, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[BATTERY_SIZE.w + 0.045, BATTERY_SIZE.d + 0.045]} />
        <meshStandardMaterial color="#1d1e22" roughness={0.6} metalness={0.05} />
      </mesh>
    </group>
  )
}

/** Convenient re-export so stages can share the material constants. */
export const BATTERY_MATERIALS = { brass: BRASS, body: DEFAULT_BODY, band: DEFAULT_BAND }

export default Battery9V
