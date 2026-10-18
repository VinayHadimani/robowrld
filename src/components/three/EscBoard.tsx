'use client'

/**
 * EscBoard — an exact procedural replica of a bidirectional brushed
 * ESC with BEC (WP-60A class) at 1 unit = 10 mm (55 × 28 mm board).
 *
 * Real anatomy: the green FR4 power board with silkscreen, a bank of
 * four TO-252 MOSFETs with their metal tabs, two fat aluminium
 * electrolytics across the rail, the BEC regulator (SOT-223) that
 * feeds 5 V back out for the logic, the microcontroller DIP, screw
 * terminal or solder pads for the motor pair, and the three leads a
 * real unit carries: battery input (red + black silicone), motor
 * output pair, and the 3-wire servo signal lead ending in a Dupont
 * plug. The BEC status LED lights when powered.
 */

import { useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import { DupontPlug3, ElectrolyticCap, LED3mm, M, SMDSpeck, makeLabelTexture, seeded, wireTube } from './kit'

export interface EscBoardProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** True while powered — the BEC LED lights. */
  powered?: boolean
  scale?: number
}

/** Board: 55 × 28 mm. */
export const ESC_DIMS = { l: 5.5, w: 2.8 }

/**
 * Electrical anchors (local):
 *  - pwr: battery input leads (red +, black −)
 *  - moto: motor output pair
 *  - bec: the 5 V servo signal lead plug
 */
export const ESC_ANCHORS: {
  pwr: { plus: [number, number, number]; minus: [number, number, number] }
  moto: { plus: [number, number, number]; minus: [number, number, number] }
  bec: [number, number, number]
} = {
  pwr: { plus: [-2.4, 0.5, 0.62], minus: [-2.4, 0.5, -0.62] },
  moto: { plus: [2.55, 0.5, 0.4], minus: [2.55, 0.5, -0.4] },
  bec: [-3.1, 0.24, 1.05],
}

function drawBoardSilk(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#0f5c2e'
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 0.05
  ctx.fillStyle = '#ffffff'
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
  ctx.globalAlpha = 1
  const rnd = seeded(909)
  ctx.fillStyle = 'rgba(6,44,22,0.55)'
  for (let i = 0; i < 260; i++) ctx.fillRect(rnd() * w, rnd() * h, 2, 2)
  // fat copper pours
  ctx.fillStyle = 'rgba(201,162,60,0.75)'
  ctx.fillRect(w * 0.06, h * 0.12, w * 0.24, h * 0.76)
  ctx.fillRect(w * 0.7, h * 0.12, w * 0.2, h * 0.76)
  // silk
  ctx.fillStyle = '#eceff2'
  ctx.textAlign = 'left'
  ctx.font = `800 ${Math.round(h * 0.13)}px Arial`
  ctx.fillText('WP-60A', w * 0.34, h * 0.2)
  ctx.font = `600 ${Math.round(h * 0.085)}px Arial`
  ctx.fillText('BRUSHED ESC · BEC 5V/2A', w * 0.34, h * 0.32)
  ctx.fillText('M+   M−   BAT+   BAT−', w * 0.08, h * 0.95)
}

export function EscBoard({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  powered = false,
  scale = 1,
}: EscBoardProps) {
  const boardTex = useMemo(() => makeLabelTexture(880, 450, drawBoardSilk), [])

  const geo = useMemo(
    () => ({
      battRed: wireTube(
        [
          [-2.45, 0.5, 0.62],
          [-3.0, 0.42, 0.85],
          [-3.5, 0.28, 0.9],
        ],
        0.16,
        20
      ),
      battBlack: wireTube(
        [
          [-2.45, 0.5, -0.62],
          [-3.0, 0.42, -0.85],
          [-3.5, 0.28, -0.9],
        ],
        0.16,
        20
      ),
      motoRed: wireTube(
        [
          [2.5, 0.5, 0.4],
          [3.05, 0.42, 0.6],
          [3.55, 0.28, 0.65],
        ],
        0.16,
        20
      ),
      motoBlue: wireTube(
        [
          [2.5, 0.5, -0.4],
          [3.05, 0.42, -0.6],
          [3.55, 0.28, -0.65],
        ],
        0.16,
        20
      ),
      becWires: (
        [
          [M.pvcOrange, -0.14],
          [M.pvcRed, 0],
          [M.pvcBrown, 0.14],
        ] as Array<[Record<string, unknown>, number]>
      ).map(([mat, z]) => ({
        tube: wireTube(
          [
            [-2.55, 0.4, 1.0 + z * 0.6],
            [-2.85, 0.32, 1.05 + z],
            [-3.2, 0.24, 1.05 + z],
          ],
          0.085,
          16
        ),
        mat,
      })),
    }),
    []
  )

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ---- the power board ---- */}
      <group position={[0, 0.11, 0]}>
        <RoundedBox args={[ESC_DIMS.l, 0.16, ESC_DIMS.w]} radius={0.02} smoothness={2} castShadow receiveShadow>
          <meshStandardMaterial color="#0f5c2e" roughness={0.55} metalness={0.06} />
        </RoundedBox>
        <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[ESC_DIMS.l, ESC_DIMS.w]} />
          <meshStandardMaterial map={boardTex} roughness={0.5} metalness={0.08} />
        </mesh>
        {/* 4 mounting holes at the corners */}
        {(
          [
            [-2.5, 1.1],
            [2.5, 1.1],
            [-2.5, -1.1],
            [2.5, -1.1],
          ] as Array<[number, number]>
        ).map(([x, z], i) => (
          <mesh key={i} position={[x, 0.086, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.13, 18]} />
            <meshStandardMaterial {...M.hole} />
          </mesh>
        ))}
      </group>

      {/* ---- MOSFET bank: 4× TO-252 with metal tabs ---- */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[-1.15 + i * 0.78, 0.28, -0.62]}>
          <mesh castShadow>
            <boxGeometry args={[0.62, 0.24, 0.55]} />
            <meshStandardMaterial {...M.ic} />
          </mesh>
          <mesh position={[0, 0.14, 0.1]} castShadow>
            <boxGeometry args={[0.58, 0.16, 0.42]} />
            <meshStandardMaterial {...M.steel} />
          </mesh>
        </group>
      ))}

      {/* ---- two fat electrolytics across the rail ---- */}
      <ElectrolyticCap position={[-1.9, 0.5, 0.72]} r={0.33} h={0.7} color="#26356b" />
      <ElectrolyticCap position={[-1.1, 0.5, 0.72]} r={0.33} h={0.7} color="#26356b" />

      {/* ---- BEC regulator (SOT-223 with tab) ---- */}
      <group position={[0.4, 0.25, 0.62]}>
        <mesh castShadow>
          <boxGeometry args={[0.7, 0.16, 0.42]} />
          <meshStandardMaterial {...M.ic} />
        </mesh>
        <mesh position={[0, 0.13, -0.06]} castShadow>
          <boxGeometry args={[0.66, 0.18, 0.38]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
      </group>

      {/* ---- controller DIP + crystal ---- */}
      <group position={[0.75, 0.3, -0.55]}>
        <RoundedBox args={[1.25, 0.3, 0.5]} radius={0.03} smoothness={2} castShadow>
          <meshStandardMaterial {...M.ic} />
        </RoundedBox>
        {/* 8 legs */}
        {[-0.5, -0.25, 0, 0.25, 0.5].map((x) => (
          <mesh key={x} position={[x, -0.2, 0.31]}>
            <boxGeometry args={[0.09, 0.18, 0.07]} />
            <meshStandardMaterial {...M.gold} />
          </mesh>
        ))}
      </group>

      {/* ---- BEC LED + passives ---- */}
      <LED3mm position={[1.75, 0.17, 0.55]} color="#ef4444" lit={powered} />
      <SMDSpeck position={[1.35, 0.19, -0.55]} color="#c8b088" />
      <SMDSpeck position={[1.75, 0.19, -0.55]} color="#1a1c22" />

      {/* ---- input leads (battery) ---- */}
      <mesh geometry={geo.battRed} castShadow>
        <meshStandardMaterial {...M.siliconeRed} />
      </mesh>
      <mesh geometry={geo.battBlack} castShadow>
        <meshStandardMaterial {...M.siliconeBlack} />
      </mesh>

      {/* ---- motor output pair ---- */}
      <mesh geometry={geo.motoRed} castShadow>
        <meshStandardMaterial {...M.siliconeRed} />
      </mesh>
      <mesh geometry={geo.motoBlue} castShadow>
        <meshStandardMaterial {...M.pvcBlue} />
      </mesh>

      {/* ---- BEC 3-wire signal lead + Dupont plug ---- */}
      {geo.becWires.map(({ tube, mat }, i) => (
        <mesh key={i} geometry={tube} castShadow>
          <meshStandardMaterial {...(mat as object)} />
        </mesh>
      ))}
      <DupontPlug3 position={[-3.6, 0.22, 1.05]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  )
}

export default EscBoard
