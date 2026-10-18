'use client'

/**
 * LipoPack — an exact procedural replica of a 3S 2200 mAh lithium
 * polymer pack (Orange OX-3S class) at 1 unit = 10 mm
 * (105 × 33 × 24 mm).
 *
 * Real anatomy: the flat soft pouch with three subtly bulging cell
 * segments under a PRINTED heat-shrink wrap (canvas texture: "3S
 * 11.1V 2200mAh", discharge rating, warnings), the thick silicone
 * main leads (red + black, 12 AWG) exiting one end into the iconic
 * YELLOW XT60 connector, and the white balance lead with its four
 * thin wires into the JST-XH plug.
 */

import { useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import { M, XT60, makeLabelTexture } from './kit'

export interface LipoPackProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

/** 105 × 33 × 24 mm pouch. */
export const LIPO_DIMS = { l: 10.5, w: 3.3, h: 2.4 }

/** XT60 lead exit point (local) — where the playground wires clip. */
export const LIPO_XT60: { plus: [number, number, number]; minus: [number, number, number] } = {
  plus: [5.9, 0.9, 0.35],
  minus: [5.9, 0.9, -0.35],
}

function drawWrap(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // dark blue heat-shrink
  ctx.fillStyle = '#15295c'
  ctx.fillRect(0, 0, w, h)
  // subtle shrink wrinkles
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#000000'
  for (let y = 0; y < h; y += 9) ctx.fillRect(0, y, w, 3)
  ctx.globalAlpha = 1

  // big identity block
  ctx.fillStyle = '#f0f3f7'
  ctx.textAlign = 'center'
  ctx.font = `900 ${Math.round(h * 0.2)}px Arial`
  ctx.fillText('3S 11.1V', w / 2, h * 0.3)
  ctx.font = `800 ${Math.round(h * 0.14)}px Arial`
  ctx.fillText('2200mAh 25C', w / 2, h * 0.45)
  // brand
  ctx.font = `italic 800 ${Math.round(h * 0.11)}px Arial`
  ctx.fillStyle = '#f5b73d'
  ctx.fillText('ROBOWRLD POWER', w / 2, h * 0.6)

  // warning box
  ctx.strokeStyle = '#f0f3f7'
  ctx.lineWidth = Math.max(2, h * 0.012)
  const bw = w * 0.5
  ctx.strokeRect((w - bw) / 2, h * 0.66, bw, h * 0.26)
  ctx.fillStyle = '#f0f3f7'
  ctx.font = `700 ${Math.round(h * 0.062)}px Arial`
  ctx.fillText('WARNING · LIPO BATTERY', w / 2, h * 0.73)
  ctx.fillText('NEVER DRAIN BELOW 3.3V/CELL', w / 2, h * 0.79)
  ctx.fillText('USE FIRE-SAFE CHARGING ONLY', w / 2, h * 0.85)

  // spec table strip
  ctx.font = `600 ${Math.round(h * 0.055)}px Arial`
  ctx.fillStyle = '#c7cedd'
  ctx.fillText('Max 55A · 12.6V full · storage 11.4V', w / 2, h * 0.94)
}

export function LipoPack({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}: LipoPackProps) {
  const wrapTex = useMemo(() => makeLabelTexture(1600, 520, drawWrap), [])

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ---- three cell segments, softly pillowed ---- */}
      {[-1.05, 0, 1.05].map((x, i) => (
        <RoundedBox
          key={i}
          args={[3.3, LIPO_DIMS.h - 0.04, LIPO_DIMS.w - 0.03]}
          radius={0.3}
          smoothness={5}
          position={[x, LIPO_DIMS.h / 2, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial map={i === 1 ? wrapTex : null} color={i === 1 ? '#ffffff' : '#15295c'} roughness={0.42} metalness={0.06} />
        </RoundedBox>
      ))}

      {/* end caps: wire exit side (right) + closed side (left) */}
      <RoundedBox args={[0.7, LIPO_DIMS.h - 0.1, LIPO_DIMS.w - 0.1]} radius={0.16} smoothness={3} position={[-5.1, LIPO_DIMS.h / 2, 0]} castShadow>
        <meshStandardMaterial color="#101f42" roughness={0.45} />
      </RoundedBox>
      <RoundedBox args={[0.7, LIPO_DIMS.h - 0.1, LIPO_DIMS.w - 0.1]} radius={0.16} smoothness={3} position={[5.1, LIPO_DIMS.h / 2, 0]} castShadow>
        <meshStandardMaterial color="#101f42" roughness={0.45} />
      </RoundedBox>

      {/* balance lead tab strain relief */}
      <RoundedBox args={[0.9, 0.5, 1.5]} radius={0.1} smoothness={3} position={[4.85, 0.3, 1.1]} castShadow>
        <meshStandardMaterial color="#e8e3d5" roughness={0.5} />
      </RoundedBox>

      {/* ---- main silicone leads to the XT60 (capsules laid along X) ---- */}
      {/* red */}
      <mesh position={[5.65, 0.9, 0.3]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.18, 0.75, 6, 14]} />
        <meshStandardMaterial {...M.siliconeRed} />
      </mesh>
      {/* black */}
      <mesh position={[5.65, 0.9, -0.3]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.18, 0.75, 6, 14]} />
        <meshStandardMaterial {...M.siliconeBlack} />
      </mesh>
      {/* the yellow XT60 connector itself (axis already along X) */}
      <XT60 position={[6.75, 0.9, 0]} half="female" />

      {/* ---- balance lead: 4 thin wires to the JST-XH ---- */}
      {(
        [
          ['#2b2b30', -0.42],
          ['#8a2020', -0.14],
          ['#d8a020', 0.14],
          ['#1f4fa8', 0.42],
        ] as Array<[string, number]>
      ).map(([color, z], i) => (
        <group key={i} position={[0, 0, 0]} rotation={[0, 0.5, 0]}>
          <mesh position={[5.45, 0.35, 1.1 + z * 0.5]} rotation={[0, 0, -Math.PI / 2]} castShadow>
            <capsuleGeometry args={[0.075, 1.1, 4, 10]} />
            <meshStandardMaterial color={color} roughness={0.45} />
          </mesh>
        </group>
      ))}
      {/* white JST-XH plug */}
      <group position={[6.55, 0.3, 1.45]} rotation={[0, 0.5, 0]}>
        <RoundedBox args={[0.75, 0.4, 0.95]} radius={0.07} smoothness={3} castShadow>
          <meshStandardMaterial color="#e3e2da" roughness={0.45} />
        </RoundedBox>
        {[0.28, 0.09, -0.09, -0.28].map((z, i) => (
          <mesh key={i} position={[0.3, 0.02, z]} castShadow>
            <boxGeometry args={[0.3, 0.14, 0.16]} />
            <meshStandardMaterial {...M.gold} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default LipoPack
