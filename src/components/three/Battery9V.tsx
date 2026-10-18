'use client'

/**
 * Battery9V — an exact procedural replica of a PP3 / 6LR61 9-volt
 * battery at 1 unit = 10 mm.
 *
 * What makes this one read as the real thing:
 *  - The vinyl sleeve is a PRINTED WRAP (canvas texture): "9V" hero
 *    type, alkaline chemistry line, brand block and warning strip,
 *    correctly laid out on all four faces with a copper top band
 *  - The two snap terminals on top are the REAL shapes and the REAL
 *    12.7 mm spacing: PLUS is the hex-collared crown with a smaller
 *    stud, MINUS is the shallow round cup — the connectors a real
 *    battery clip actually grabs
 *  - The top cap is a separate molded plastic plate with an insulating
 *    ridge BETWEEN the terminals, exactly like the real part
 *  - Crimp seam at the sleeve's bottom edge, matte metallic jacket
 *
 * The playground's power wires clip onto the terminal anchors exported
 * below (BATTERY_TERMINALS) — red to +, black to −, always.
 */

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { M, SnapTerminals, makeLabelTexture } from './kit'

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface Battery9VProps {
  /** World position of the battery's base center. */
  position?: [number, number, number]
  /** Legacy prop — a real PP3 has no LED; kept so call sites compile. */
  ledOn?: boolean
  scale?: number
}

/* ------------------------------------------------------------------ */
/* Dimensions — PP3: 26.5 × 17.5 × 48.5 mm (1 unit = 10 mm)             */
/* ------------------------------------------------------------------ */

export const BATTERY_SIZE = { w: 2.65, d: 1.75, h: 4.85 }

/** Snap spacing on a real PP3: 12.7 mm center-to-center. */
const SNAP_SPACING = 1.27

/**
 * Snap-terminal anchor positions (local, base-center origin) — the
 * playground wires clip to these. PLUS is the crown; MINUS the cup.
 */
export const BATTERY_TERMINALS: {
  minus: [number, number, number]
  plus: [number, number, number]
} = {
  minus: [-SNAP_SPACING / 2, BATTERY_SIZE.h + 0.1, 0],
  plus: [SNAP_SPACING / 2, BATTERY_SIZE.h + 0.1, 0],
}

/* ------------------------------------------------------------------ */
/* The printed sleeve                                                  */
/* ------------------------------------------------------------------ */

/**
 * Front/back faces: 26.5 mm × 48.5 mm at 20 px/mm. The classic
 * alkaline layout — copper band up top, huge "9V", chemistry lines,
 * warning strip at the bottom.
 */
function drawFace(ctx: CanvasRenderingContext2D, w: number, h: number, back: boolean) {
  // black vinyl base
  ctx.fillStyle = '#17181c'
  ctx.fillRect(0, 0, w, h)

  // copper band across the top quarter
  const bandH = h * 0.24
  ctx.fillStyle = '#8a5a24'
  ctx.fillRect(0, 0, w, bandH)
  // brushed metal streaks in the band
  ctx.globalAlpha = 0.25
  ctx.fillStyle = '#c98f45'
  for (let y = 4; y < bandH; y += 3) ctx.fillRect(0, y, w, 1)
  ctx.globalAlpha = 1

  // brand block
  ctx.fillStyle = '#e8e2d4'
  ctx.textAlign = 'center'
  ctx.font = `italic 700 ${Math.round(w * 0.11)}px Arial`
  ctx.fillText(back ? 'POWER CELL' : 'VOLTAIC', w / 2, bandH + w * 0.16)

  // the hero "9V" mark
  ctx.font = `900 ${Math.round(w * 0.62)}px Arial`
  ctx.fillStyle = '#f2ede1'
  ctx.fillText('9V', w / 2, h * 0.6)
  // tight keyline around the hero
  ctx.strokeStyle = 'rgba(242,237,225,0.55)'
  ctx.lineWidth = w * 0.012
  const kw = w * 0.72
  const kh = h * 0.23
  ctx.strokeRect((w - kw) / 2, h * 0.6 - kh * 0.82, kw, kh)

  // chemistry + spec lines
  ctx.font = `600 ${Math.round(w * 0.075)}px Arial`
  ctx.fillStyle = '#cfc9bb'
  ctx.fillText('ALKALINE  ·  6LR61', w / 2, h * 0.71)
  ctx.font = `500 ${Math.round(w * 0.065)}px Arial`
  ctx.fillStyle = '#a8a294'
  ctx.fillText('6 AM-6 UM-5  550 mAh', w / 2, h * 0.755)

  // bottom warning strip
  ctx.fillStyle = '#d29a2c'
  ctx.fillRect(0, h - h * 0.055, w, h * 0.055)
  ctx.fillStyle = '#14151a'
  ctx.font = `700 ${Math.round(w * 0.058)}px Arial`
  ctx.fillText('DO NOT RECHARGE OR DISPOSE IN FIRE', w / 2, h - h * 0.014)
}

/** Narrow side faces: band continues, vertical 9V, fine print. */
function drawSide(ctx: CanvasRenderingContext2D, w: number, h: number, mirror: boolean) {
  ctx.fillStyle = '#17181c'
  ctx.fillRect(0, 0, w, h)
  const bandH = h * 0.24
  ctx.fillStyle = '#8a5a24'
  ctx.fillRect(0, 0, w, bandH)

  ctx.save()
  ctx.translate(mirror ? 0 : w, 0)
  ctx.scale(mirror ? 1 : -1, 1)
  ctx.textAlign = 'center'
  // vertical reading-direction text
  ctx.translate(w / 2, h / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.font = `900 ${Math.round(w * 0.62)}px Arial`
  ctx.fillStyle = '#f2ede1'
  ctx.fillText('9V', 0, w * 0.2)
  ctx.font = `600 ${Math.round(w * 0.22)}px Arial`
  ctx.fillStyle = '#a8a294'
  ctx.fillText('6LR61 ALKALINE', 0, w * 0.62)
  ctx.restore()
}

/* ------------------------------------------------------------------ */
/* The battery                                                         */
/* ------------------------------------------------------------------ */

export function Battery9V({
  position = [0, 0, 0],
  ledOn: _ledOn = false,
  scale = 1,
}: Battery9VProps) {
  const baseY = 0.03
  const bodyCenterY = baseY + BATTERY_SIZE.h / 2
  const topY = baseY + BATTERY_SIZE.h

  // BoxGeometry material order: +x, -x, +y, -y, +z, -z
  const mats = useMemo(() => {
    const pxmm = 20
    const face = makeLabelTexture(
      Math.round(BATTERY_SIZE.w * pxmm),
      Math.round(BATTERY_SIZE.h * pxmm),
      (ctx, w, h) => drawFace(ctx, w, h, false)
    )
    const back = makeLabelTexture(
      Math.round(BATTERY_SIZE.w * pxmm),
      Math.round(BATTERY_SIZE.h * pxmm),
      (ctx, w, h) => drawFace(ctx, w, h, true)
    )
    const sideR = makeLabelTexture(
      Math.round(BATTERY_SIZE.d * pxmm),
      Math.round(BATTERY_SIZE.h * pxmm),
      (ctx, w, h) => drawSide(ctx, w, h, true)
    )
    const sideL = makeLabelTexture(
      Math.round(BATTERY_SIZE.d * pxmm),
      Math.round(BATTERY_SIZE.h * pxmm),
      (ctx, w, h) => drawSide(ctx, w, h, false)
    )
    const cap = { color: '#101116', roughness: 0.5, metalness: 0.08 }
    const wrap = (map: THREE.CanvasTexture) =>
      new THREE.MeshStandardMaterial({ map, ...M.pbt })
    return [
      wrap(sideR),
      wrap(sideL),
      new THREE.MeshStandardMaterial(cap),
      new THREE.MeshStandardMaterial(cap),
      wrap(face),
      wrap(back),
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Dispose the printed wrap materials on unmount.
    return () => mats.forEach((m) => m.dispose())
  }, [mats])

  return (
    <group position={position} scale={scale}>
      {/* Cell body with the printed wrap on all four faces */}
      <mesh position={[0, bodyCenterY, 0]} material={mats} castShadow receiveShadow>
        <boxGeometry args={[BATTERY_SIZE.w, BATTERY_SIZE.h, BATTERY_SIZE.d]} />
      </mesh>

      {/* Crimp seam at the sleeve's bottom edge */}
      <mesh position={[0, baseY + 0.05, 0]}>
        <boxGeometry args={[BATTERY_SIZE.w + 0.02, 0.1, BATTERY_SIZE.d + 0.02]} />
        <meshStandardMaterial color="#0d0e12" roughness={0.6} metalness={0.15} />
      </mesh>

      {/* Molded top cap with the insulating ridge between terminals */}
      <group position={[0, topY - 0.06, 0]}>
        <RoundedBox
          args={[BATTERY_SIZE.w - 0.06, 0.22, BATTERY_SIZE.d - 0.06]}
          radius={0.03}
          smoothness={3}
          position={[0, 0.06, 0]}
          castShadow
        >
          <meshStandardMaterial color="#14151a" roughness={0.52} metalness={0.06} />
        </RoundedBox>
        {/* the raised ridge between + and − */}
        <mesh position={[0, 0.16, 0]} castShadow>
          <boxGeometry args={[BATTERY_SIZE.w / 2 - 0.72, 0.08, BATTERY_SIZE.d - 0.1]} />
          <meshStandardMaterial color="#1a1b20" roughness={0.5} />
        </mesh>
      </group>

      {/* The real snap terminals — PLUS crown & MINUS cup */}
      <SnapTerminals spacing={SNAP_SPACING} y={topY + 0.06} />
    </group>
  )
}

/** Shared material constants (kept for stage parity). */
export const BATTERY_MATERIALS = { brass: M.brass.color }

export default Battery9V
