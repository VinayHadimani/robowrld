'use client'

/**
 * IrSensor — an exact procedural replica of a TCRT5000-based reflective
 * IR proximity / line-follower board (FC-51 class) at 1 unit = 10 mm.
 *
 * Real anatomy: the compact blue FR4 board, the black TCRT5000 sensor
 * block with its two lenses (IR emitter + phototransistor) facing the
 * ground, the blue 10 kΩ trimmer potentiometer with its brass
 * adjustment screw, the LM393 comparator DIP-8, three LEDs (power red
 * — lights when the board is powered, output indicator), and the
 * 3-pin right-angle header (VCC · GND · OUT).
 */

import { useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import { DIPChip, LED3mm, M, PinHeader, PhillipsScrew, SMDSpeck, makeLabelTexture, seeded } from './kit'

export interface IrSensorProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** True while powered — lights the red power LED (real behavior). */
  powered?: boolean
  scale?: number
}

/** Board: 38 × 10 mm (schema dims). */
export const IR_DIMS = { l: 3.8, w: 1.0 }

/** 3-pin header anchor (VCC GND OUT) — local. */
export const IR_HEADER: { plus: [number, number, number]; minus: [number, number, number] } = {
  plus: [-1.45, 0.3, 0.26],
  minus: [-1.45, 0.3, 0.0],
}

function drawBoardSilk(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#1a4a9e'
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 0.06
  ctx.fillStyle = '#ffffff'
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
  ctx.globalAlpha = 1
  const rnd = seeded(818)
  ctx.fillStyle = 'rgba(10,40,92,0.5)'
  for (let i = 0; i < 220; i++) ctx.fillRect(rnd() * w, rnd() * h, 2, 2)
  // silk labels
  ctx.fillStyle = '#eceff2'
  ctx.textAlign = 'center'
  ctx.font = `800 ${Math.round(h * 0.24)}px Arial`
  ctx.fillText('IR SENSOR', w * 0.42, h * 0.38)
  ctx.font = `600 ${Math.round(h * 0.17)}px Arial`
  ctx.fillText('TCRT5000', w * 0.42, h * 0.6)
  // pin labels
  ctx.font = `700 ${Math.round(h * 0.2)}px Arial`
  const labels = ['VCC', 'GND', 'OUT']
  labels.forEach((t, i) => {
    ctx.fillText(t, w * 0.06 + i * w * 0.075, h * 0.88)
  })
}

export function IrSensor({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  powered = false,
  scale = 1,
}: IrSensorProps) {
  const boardTex = useMemo(() => makeLabelTexture(760, 200, drawBoardSilk), [])

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ---- board ---- */}
      <group position={[0, 0.11, 0]}>
        <RoundedBox args={[IR_DIMS.l, 0.16, IR_DIMS.w]} radius={0.02} smoothness={2} castShadow receiveShadow>
          <meshStandardMaterial {...M.fr4Blue} />
        </RoundedBox>
        <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[IR_DIMS.l, IR_DIMS.w]} />
          <meshStandardMaterial map={boardTex} roughness={0.55} metalness={0.05} />
        </mesh>
        {/* the two mounting holes */}
        {(
          [
            [1.6, 0],
            [-1.6, 0],
          ] as Array<[number, number]>
        ).map(([x, z], i) => (
          <group key={i} position={[x, 0.086, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.11, 18]} />
              <meshStandardMaterial {...M.hole} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ---- the TCRT5000 sensor block (lenses face DOWN at the ground) ---- */}
      <group position={[0.75, 0.16, 0]}>
        <RoundedBox args={[1.1, 0.68, 0.75]} radius={0.04} smoothness={3} castShadow>
          <meshStandardMaterial {...M.abs} />
        </RoundedBox>
        {/* the two lens domes, facing down */}
        {(
          [
            [-0.26, '#1a2f6e'],
            [0.26, '#0a0c10'],
          ] as Array<[number, string]>
        ).map(([x, color], i) => (
          <mesh key={i} position={[x, -0.36, 0]}>
            <sphereGeometry args={[0.16, 16, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color={color} roughness={0.15} metalness={0.2} />
          </mesh>
        ))}
        {/* 4 legs down to the board */}
        {(
          [
            [-0.4, -0.22],
            [-0.4, 0.22],
            [0.4, -0.22],
            [0.4, 0.22],
          ] as Array<[number, number]>
        ).map(([x, z], i) => (
          <mesh key={i} position={[x, -0.09, z]}>
            <boxGeometry args={[0.06, 0.5, 0.06]} />
            <meshStandardMaterial {...M.steel} />
          </mesh>
        ))}
      </group>

      {/* ---- blue trimmer potentiometer with brass screw ---- */}
      <group position={[1.55, 0.32, 0]}>
        <RoundedBox args={[0.5, 0.34, 0.5]} radius={0.03} smoothness={2} castShadow>
          <meshStandardMaterial color="#2b62c4" roughness={0.45} />
        </RoundedBox>
        <PhillipsScrew position={[0, 0.18, 0]} r={0.12} />
      </group>

      {/* ---- LM393 comparator ---- */}
      <DIPChip position={[1.35, 0.31, 0]} body={[0.9, 0.28, 0.4]} legsPerSide={4} label="LM393" />

      {/* ---- LEDs: power (red, lights when powered) + output (green) ---- */}
      <LED3mm position={[-0.55, 0.17, 0.28]} color="#ef4444" lit={powered} />
      <LED3mm position={[-0.55, 0.17, -0.28]} color="#4ade80" />

      {/* ---- passives ---- */}
      <SMDSpeck position={[-1.0, 0.19, 0.3]} color="#c8b088" />
      <SMDSpeck position={[-1.0, 0.19, -0.3]} color="#1a1c22" />
      <SMDSpeck position={[0.2, 0.19, 0.35]} color="#c8b088" />

      {/* ---- 3-pin right-angle header ---- */}
      <PinHeader position={[-1.45, 0.14, 0]} pins={3} length={0.76} pinHeight={0.36} lying />
    </group>
  )
}

export default IrSensor
