'use client'

/**
 * Capacitor — an exact procedural replica of a 470 µF / 25 V aluminum
 * electrolytic capacitor (Ø16 × 25 mm class) at 1 unit = 10 mm.
 *
 * Real anatomy: an aluminum can wrapped in a dark blue insulating
 * sleeve, printed with capacitance/voltage and the MINUS STRIPE that
 * marks the negative lead (reverse polarity vents these violently —
 * hence the scored K on the top, a designed weak point). Two tinned
 * steel legs at 7.5 mm pitch stand it off any board.
 *
 * Physics on the playground: clip it across a battery's terminals and
 * it smooths that rail — charging on voltage spikes, discharging into
 * sags — exactly the decoupling lesson. It passes no power of its own.
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import { M, makeLabelTexture } from './kit'

export interface CapacitorProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** True while it sits on a live rail (visual: nothing moves — like real). */
  charged?: boolean
  scale?: number
}

/** Ø16 × 25 mm can on 6 mm legs (1 unit = 10 mm). */
export const CAPACITOR_DIMS = { od: 1.6, height: 2.5, legs: 0.6 }

/** Where the wires clip (local coordinates). */
export const CAPACITOR_ANCHORS = {
  plus: [0.4, 0.05, 0] as [number, number, number],
  minus: [-0.4, 0.05, 0] as [number, number, number],
}

/**
 * The sleeve print. The canvas wraps the can's circumference: the minus
 * stripe band lands on the negative-lead side, and the vertical rating
 * text (drawn rotated) reads top-to-bottom like the real wrap.
 */
function drawSleeve(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // deep navy sleeve with a slight sheen gradient
  const grad = ctx.createLinearGradient(0, 0, w, 0)
  grad.addColorStop(0, '#111a3a')
  grad.addColorStop(0.5, '#1d2f6e')
  grad.addColorStop(1, '#111a3a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // the minus stripe: a light band marking the NEGATIVE lead
  ctx.fillStyle = '#d9dee6'
  ctx.fillRect(w * 0.62, 0, w * 0.16, h)
  ctx.fillStyle = '#8f96a1'
  for (let y = 0; y < h; y += 26) ctx.fillRect(w * 0.62, y, w * 0.16, 10)

  // vertical rating text (runs along the can axis, like real parts)
  const vtext = (text: string, x: number, size: number, col: string, weight = '700') => {
    ctx.save()
    ctx.translate(x, h - 14)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = col
    ctx.font = `${weight} ${size}px Arial`
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }
  vtext('470µF', w * 0.08, 46, '#e8ebf0')
  vtext('25V', w * 0.3, 40, '#c9d2e0')
  vtext('105°C', w * 0.45, 26, '#aab4c4', '500')
  vtext('RW', w * 0.87, 30, '#d9dee6')
}

export function Capacitor({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  charged = false,
  scale = 1,
}: CapacitorProps) {
  const sleeveTex = useMemo(() => makeLabelTexture(512, 256, drawSleeve), [])
  const r = CAPACITOR_DIMS.od / 2
  const canBottom = CAPACITOR_DIMS.legs - 0.05
  const canH = CAPACITOR_DIMS.height

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ---- the two legs (tinned steel, minus slightly shorter) ---- */}
      {[
        { x: CAPACITOR_ANCHORS.plus[0], h: 0.62, key: 'p' },
        { x: CAPACITOR_ANCHORS.minus[0], h: 0.56, key: 'm' },
      ].map((leg) => (
        <mesh key={leg.key} position={[leg.x, leg.h / 2, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, leg.h, 10]} />
          <meshStandardMaterial
            {...M.steel}
            emissive={charged ? '#1a2f6e' : '#000000'}
            emissiveIntensity={charged ? 0.12 : 0}
          />
        </mesh>
      ))}

      {/* ---- the can with its printed sleeve ---- */}
      <mesh position={[0, canBottom + canH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, canH * 0.94, 40, 1, true]} />
        <meshStandardMaterial map={sleeveTex} roughness={0.42} metalness={0.15} />
      </mesh>

      {/* aluminum top with the K-vent score */}
      <mesh position={[0, canBottom + canH, 0]} castShadow>
        <cylinderGeometry args={[r, r * 0.985, 0.14, 40]} />
        <meshStandardMaterial color="#c6cdd8" metalness={0.75} roughness={0.3} />
      </mesh>
      {[-0.55, 0.55].map((k) => (
        <mesh key={k} position={[k * r * 0.55, canBottom + canH + 0.075, k * r * 0.4]}>
          <boxGeometry args={[r * 1.1, 0.03, 0.07]} />
          <meshStandardMaterial color="#6f7681" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}

      {/* bottom crimp + dark seat disc */}
      <mesh position={[0, canBottom + 0.05, 0]}>
        <torusGeometry args={[r * 0.99, 0.05, 10, 40]} />
        <meshStandardMaterial color="#8b929c" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, canBottom + 0.02, 0]}>
        <cylinderGeometry args={[r * 0.94, r * 0.94, 0.1, 32]} />
        <meshStandardMaterial color="#22242a" roughness={0.6} />
      </mesh>

      {/* the faint can seam where the sleeve wrap starts */}
      <mesh position={[0, canBottom + canH / 2, 0]}>
        <cylinderGeometry args={[r + 0.012, r + 0.012, canH * 0.94, 40, 1, true, 0, 0.12]} />
        <meshStandardMaterial color="#0d1428" roughness={0.5} />
      </mesh>
    </group>
  )
}

export default Capacitor
