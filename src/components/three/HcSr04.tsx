'use client'

/**
 * HcSr04 — an exact procedural replica of the HC-SR04 ultrasonic
 * rangefinder at 1 unit = 10 mm (45 × 20 × 15 mm).
 *
 * Real anatomy: the blue FR4 carrier board with white silkscreen
 * (HC-SR04 + element marks), two Ø16 mm aluminium transducer cans
 * whose faces are the iconic PERFORATED MESH (canvas dot-grid
 * texture), a right-angle 4-pin header on the back edge (VCC · Trig ·
 * Echo · GND), the 24 MHz crystal and support ICs on board.
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { Crystal, ElectrolyticCap, M, PinHeader, SMDSpeck, makeLabelTexture, seeded } from './kit'

export interface HcSr04Props {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

/** 45 × 20 mm board. */
export const HCSR04_DIMS = { l: 4.5, w: 2.0 }

/** The 4-pin header position (VCC Trig Echo GND) — local. */
export const HCSR04_HEADER: { plus: [number, number, number]; minus: [number, number, number] } = {
  plus: [-1.75, 0.35, 0.38],
  minus: [-1.75, 0.35, 0.9],
}

/** Radial hole-mesh for the transducer faces. */
function drawTransducerFace(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bg = ctx.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w / 2)
  bg.addColorStop(0, '#d6dae0')
  bg.addColorStop(1, '#aab0b8')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  // concentric ring reinforcement + radial hole grid
  const cx = w / 2
  const cy = h / 2
  ctx.strokeStyle = 'rgba(120,126,134,0.8)'
  ctx.lineWidth = w * 0.02
  for (const r of [0.24, 0.4, 0.55, 0.7]) {
    ctx.beginPath()
    ctx.arc(cx, cy, w * r, 0, Math.PI * 2)
    ctx.stroke()
  }
  const holeR = w * 0.018
  ctx.fillStyle = '#3a3e45'
  for (let ring = 1; ring <= 8; ring++) {
    const count = ring * 6
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      const rr = (ring / 8) * w * 0.42
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, holeR, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawBoardSilk(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#1a4a9e'
  ctx.fillRect(0, 0, w, h)
  // fabric weave
  ctx.globalAlpha = 0.06
  ctx.fillStyle = '#ffffff'
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
  ctx.globalAlpha = 1
  // ground pour dots
  const rnd = seeded(311)
  ctx.fillStyle = 'rgba(10,40,92,0.5)'
  for (let i = 0; i < 300; i++) ctx.fillRect(rnd() * w, rnd() * h, 2, 2)
  // silkscreen
  ctx.fillStyle = '#eceff2'
  ctx.textAlign = 'center'
  ctx.font = `800 ${Math.round(h * 0.16)}px Arial`
  ctx.fillText('HC-SR04', w * 0.5, h * 0.3)
  ctx.font = `600 ${Math.round(h * 0.09)}px Arial`
  ctx.fillText('ULTRASONIC SENSOR', w * 0.5, h * 0.44)
  // element outlines around the two cans
  ctx.strokeStyle = '#eceff2'
  ctx.lineWidth = Math.max(2, w * 0.008)
  for (const cx of [w * 0.28, w * 0.72]) {
    ctx.beginPath()
    ctx.arc(cx, h * 0.66, h * 0.3, 0, Math.PI * 2)
    ctx.stroke()
  }
  // pin labels beside the header
  ctx.font = `700 ${Math.round(h * 0.085)}px Arial`
  const labels = ['VCC', 'Trig', 'Echo', 'GND']
  labels.forEach((t, i) => {
    const x = w * 0.13 + (i * w * 0.075)
    ctx.save()
    ctx.translate(x, h * 0.94)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(t, 0, 0)
    ctx.restore()
  })
}

export function HcSr04({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}: HcSr04Props) {
  const texs = useMemo(
    () => ({
      face: makeLabelTexture(360, 160, (ctx, w, h) => drawTransducerFace(ctx, w, h)),
      board: makeLabelTexture(900, 400, drawBoardSilk),
    }),
    []
  )

  // transducer centers: two cans at x ±1.05
  const cans: Array<[number, number]> = [
    [1.05, 0],
    [-1.05, 0],
  ]

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ---- the carrier board (silkscreened top) ---- */}
      <group position={[0, 0.11, 0]}>
        {/* core */}
        <RoundedBox args={[HCSR04_DIMS.l, 0.16, HCSR04_DIMS.w]} radius={0.02} smoothness={2} castShadow receiveShadow>
          <meshStandardMaterial {...M.fr4Blue} />
        </RoundedBox>
        {/* silkscreen top */}
        <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[HCSR04_DIMS.l, HCSR04_DIMS.w]} />
          <meshStandardMaterial map={texs.board} roughness={0.55} metalness={0.05} />
        </mesh>
      </group>

      {/* ---- the two transducer cans (mesh faces up) ---- */}
      {cans.map(([x], i) => (
        <group key={i} position={[x, 0.19, 0]}>
          {/* bright aluminium barrel */}
          <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.8, 0.8, 1.24, 40]} />
            <meshStandardMaterial color="#c9ced5" metalness={0.92} roughness={0.26} />
          </mesh>
          {/* shallow chamfer ring instead of a rim */}
          <mesh position={[0, 1.21, 0]} castShadow>
            <cylinderGeometry args={[0.75, 0.8, 0.09, 40]} />
            <meshStandardMaterial color="#d3d8de" metalness={0.92} roughness={0.22} />
          </mesh>
          {/* the perforated mesh face — textured, so low metalness or the map goes black */}
          <mesh position={[0, 1.27, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.76, 40]} />
            <meshStandardMaterial map={texs.face} roughness={0.38} metalness={0.15} />
          </mesh>
          {/* plastic base flange seated on the board */}
          <mesh position={[0, 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.84, 0.86, 0.2, 40]} />
            <meshStandardMaterial {...M.abs} />
          </mesh>
        </group>
      ))}

      {/* ---- crystal + support parts on the board ---- */}
      <Crystal position={[-1.8, 0.32, 0.62]} scale={0.8} />
      <ElectrolyticCap position={[-1.8, 0.35, -0.55]} r={0.22} h={0.42} />
      {/* SOIC support chip (no legs — the real board's MAX232-class IC) */}
      <mesh position={[0.15, 0.25, -0.66]} castShadow>
        <boxGeometry args={[1.05, 0.14, 0.5]} />
        <meshStandardMaterial {...M.ic} />
      </mesh>
      <SMDSpeck position={[1.85, 0.21, 0.62]} color="#1a1c22" />
      <SMDSpeck position={[1.85, 0.21, -0.62]} color="#c8b088" />

      {/* ---- right-angle 4-pin header on the back edge ---- */}
      <PinHeader
        position={[-1.75, 0.14, 0.64]}
        rotation={[0, 0, 0]}
        pins={4}
        length={1.02}
        pinHeight={0.42}
        lying
      />
    </group>
  )
}

export default HcSr04
