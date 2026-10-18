'use client'

/**
 * ArduinoUno — an exact procedural replica of the Arduino Uno R3 at
 * 1 unit = 10 mm (68.6 × 53.4 mm board).
 *
 * The realism budget went where a real Uno's identity lives:
 *  - The PCB top is a full SILKSCREEN TEXTURE (canvas-drawn): the
 *    ARDUINO / UNO wordmark, "MADE IN ITALY" fine print, and every
 *    pin label printed beside its socket — drawn from the SAME
 *    coordinates as the 3D headers, so text and hardware align
 *  - Solder-mask traces and via dots under the silkscreen, like a
 *    real 2-layer board
 *  - Real parts, all in real positions: USB-B with shield seam +
 *    white insert, 2.1 mm barrel jack with brass center pin,
 *    ATmega328P DIP-28 WITH legs and laser-etched part number,
 *    16 MHz HC-49S crystal, reset tact button, ON / L / TX / RX
 *    LEDs, NCP1117 regulator, ATmega16U2 QFP, ICSP 2×3 header,
 *    female socket headers with gold contacts, plated mounting holes
 *
 * Electrical anchors (used by the playground wiring): the VIN jack
 * on the left edge and the 5 V pin in the bottom power header.
 */

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import {
  DIPChip,
  Crystal,
  ElectrolyticCap,
  HeaderSocketStrip,
  M,
  PhillipsScrew,
  SMDSpeck,
  TactButton,
  USBConnectorB,
  BarrelJack,
  LED3mm,
  makeLabelTexture,
  seeded,
} from './kit'

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface ArduinoUnoProps {
  position?: [number, number, number]
  /** True while the board receives power — lights the ON LED (real!). */
  ledOn?: boolean
  scale?: number
}

/* ------------------------------------------------------------------ */
/* Dimensions (1 unit = 10 mm — Uno R3: 68.6 × 53.4 mm)                */
/* ------------------------------------------------------------------ */

export const ARDUINO_SIZE = { w: 6.86, d: 5.34 }

const PCB_T = 0.16 // 1.6 mm
const PITCH = 0.254 // 2.54 mm header pitch

// ---- Header positions (local board coords, origin = board center) ----
// Digital header: 18 sockets along the top edge (AREF…D0)
const DIGITAL = {
  x: 0.35, // bar center
  z: -2.37,
  pins: 18,
  length: PITCH * 18,
}
// Power header: 8 sockets (NC IOREF RESET 3V3 5V GND GND VIN)
const POWER = {
  x: -1.72,
  z: 2.37,
  pins: 8,
  length: PITCH * 8,
}
// Analog header: 6 sockets (A0–A5)
const ANALOG = {
  x: 1.15,
  z: 2.37,
  pins: 6,
  length: PITCH * 6,
}

/**
 * Electrical anchor points — where the playground's wires clip on:
 *  - vin: the barrel jack on the left edge (red = +, black = −)
 *  - header: the 5 V pin in the bottom power header
 */
export const ARDUINO_ANCHORS: {
  vin: { plus: [number, number, number]; minus: [number, number, number] }
  header: [number, number, number]
} = {
  vin: {
    plus: [-3.55, 0.66, 1.35],
    minus: [-3.55, 0.66, 1.75],
  },
  header: [POWER.x + PITCH * 0.5, 0.72, POWER.z],
}

/* ------------------------------------------------------------------ */
/* The silkscreen (canvas texture, aligned to the 3D geometry)          */
/* ------------------------------------------------------------------ */

const PXMM = 18 // texture pixels per millimeter

/** Board-space (mm) → canvas px. */
function mmToPxBoard(x: number, z: number, wPx: number, hPx: number) {
  const halfW = ARDUINO_SIZE.w * 10 / 2 // mm
  const halfD = ARDUINO_SIZE.d * 10 / 2
  return {
    x: (x * 10 + halfW) / (halfW * 2) * wPx,
    y: (z * 10 + halfD) / (halfD * 2) * hPx,
  }
}

function drawSilkTop(ctx: CanvasRenderingContext2D, wPx: number, hPx: number) {
  const halfWmm = (ARDUINO_SIZE.w * 10) / 2
  const halfDmm = (ARDUINO_SIZE.d * 10) / 2
  const mm = (v: number) => (v / (halfWmm * 2)) * wPx
  const mmD = (v: number) => (v / (halfDmm * 2)) * hPx
  const at = (x: number, z: number) => mmToPxBoard(x, z, wPx, hPx)

  // --- solder mask base (Uno teal) ---
  ctx.fillStyle = '#0d8189'
  ctx.fillRect(0, 0, wPx, hPx)
  // subtle glass fabric weave
  ctx.globalAlpha = 0.05
  for (let y = 0; y < hPx; y += 3) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, y, wPx, 1)
  }
  ctx.globalAlpha = 1

  // --- copper traces under the mask (darker teal, Manhattan runs) ---
  const rnd = seeded(20260101)
  ctx.strokeStyle = 'rgba(6,96,102,0.85)'
  ctx.lineWidth = Math.max(1.5, mm(0.25))
  ctx.lineCap = 'round'
  for (let i = 0; i < 46; i++) {
    const xA = rnd() * wPx
    const yA = rnd() * hPx
    let x = xA
    let y = yA
    ctx.beginPath()
    ctx.moveTo(x, y)
    const steps = 2 + Math.floor(rnd() * 3)
    for (let s = 0; s < steps; s++) {
      if (rnd() > 0.5) x = Math.min(wPx, Math.max(0, x + (rnd() - 0.5) * mm(22)))
      else y = Math.min(hPx, Math.max(0, y + (rnd() - 0.5) * mmD(18)))
      ctx.lineTo(x, y)
    }
    ctx.stroke()
    // via dot at the trace end
    ctx.fillStyle = 'rgba(5,84,90,0.9)'
    ctx.beginPath()
    ctx.arc(x, y, mm(0.5), 0, Math.PI * 2)
    ctx.fill()
  }

  // --- gold pads flanking the header sockets ---
  const padRow = (
    hx: number,
    hz: number,
    pins: number,
    offsetZ: number
  ) => {
    ctx.fillStyle = '#c9a23c'
    for (let i = 0; i < pins; i++) {
      const p = at(hx - ((pins - 1) / 2) * (PITCH / 10) + (i * PITCH) / 10, hz + offsetZ / 10)
      ctx.beginPath()
      ctx.arc(p.x, p.y, mm(0.75), 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#e7d9a8'
      ctx.lineWidth = Math.max(1, mm(0.12))
      ctx.stroke()
    }
  }
  padRow(DIGITAL.x, DIGITAL.z, DIGITAL.pins, -0.5)
  padRow(POWER.x, POWER.z, POWER.pins, 0.5)
  padRow(ANALOG.x, ANALOG.z, ANALOG.pins, 0.5)

  // --- white silkscreen ---
  ctx.fillStyle = '#e9ecec'
  ctx.textAlign = 'center'

  // ARDUINO wordmark, bottom-right clear area
  ctx.font = `italic 800 ${mm(9.5)}px Arial`
  ctx.fillText('ARDUINO', wPx * 0.6, hPx * 0.72)
  ctx.font = `700 ${mm(6.5)}px Arial`
  ctx.fillText('UNO', wPx * 0.6, hPx * 0.83)

  // The little circle-of-pins logo hint beside the wordmark
  ctx.strokeStyle = '#e9ecec'
  ctx.lineWidth = Math.max(1.4, mm(0.3))
  ctx.beginPath()
  ctx.arc(wPx * 0.6 + mm(14), hPx * 0.68, mm(2.6), 0, Math.PI * 2)
  ctx.stroke()

  // "MADE IN ITALY" + fine print
  ctx.font = `500 ${mm(2.2)}px Arial`
  ctx.fillStyle = '#dfe5e5'
  ctx.textAlign = 'left'
  const fi = at(-1.6, 0.65)
  ctx.fillText('www.arduino.cc', fi.x, fi.y)
  ctx.fillText('MADE IN ITALY', fi.x, fi.y + mm(3))
  ctx.fillText('90 AA0043 · CC BY-SA', fi.x, fi.y + mm(6))

  // Pin labels for the DIGITAL header (top edge, text below sockets)
  const DIG_LABELS = ['SCL','SDA','AREF','GND','13','12','~11','~10','~9','8']
  const DIG_LABELS2 = ['7','~6','~5','4','~3','2','TX→1','RX→0']
  ctx.fillStyle = '#e9ecec'
  ctx.font = `600 ${mm(2.1)}px Arial`
  ctx.textAlign = 'center'
  // first 10 labels (right block) then 8 (left block) — R3 layout
  const rightStart = DIGITAL.x + (DIGITAL.pins - 10) * (PITCH / 10)
  DIG_LABELS.forEach((t, i) => {
    const p = at(rightStart + i * (PITCH / 10), DIGITAL.z - 1.1)
    ctx.fillText(t, p.x, p.y)
  })
  const leftStart = DIGITAL.x - 10 * (PITCH / 10)
  DIG_LABELS2.forEach((t, i) => {
    const p = at(leftStart + i * (PITCH / 10), DIGITAL.z - 1.1)
    ctx.fillText(t, p.x, p.y)
  })

  // Power header labels (bottom edge, above sockets)
  const PWR_LABELS = ['NC','IOREF','RST','3V3','5V','GND','GND','VIN']
  PWR_LABELS.forEach((t, i) => {
    const p = at(POWER.x - ((POWER.pins - 1) / 2) * (PITCH / 10) + (i * PITCH) / 10, POWER.z + 1.15)
    ctx.fillText(t, p.x, p.y)
  })
  // Analog labels
  const ANA_LABELS = ['A0','A1','A2','A3','A4','A5']
  ANA_LABELS.forEach((t, i) => {
    const p = at(ANALOG.x - ((ANALOG.pins - 1) / 2) * (PITCH / 10) + (i * PITCH) / 10, ANALOG.z + 1.15)
    ctx.fillText(t, p.x, p.y)
  })

  // LED legends + misc marks
  ctx.font = `600 ${mm(2.0)}px Arial`
  const led = (x: number, z: number, t: string) => {
    const p = at(x, z)
    ctx.fillText(t, p.x, p.y)
  }
  led(-1.55, 0.28, 'ON')
  led(-1.05, 0.28, 'L')
  led(-0.6, 0.28, 'TX')
  led(-0.15, 0.28, 'RX')
  led(2.62, -1.15, 'ICSP')
  ctx.save()
  ctx.translate(at(-2.6, -1.0).x, at(-2.6, -1.0).y)
  ctx.font = `600 ${mm(1.9)}px Arial`
  ctx.fillText('RESET', 0, mm(2.6))
  ctx.restore()

  // Component outline boxes (real silkscreens show these)
  ctx.strokeStyle = 'rgba(233,236,236,0.8)'
  ctx.lineWidth = Math.max(1, mm(0.18))
  const outline = (x: number, z: number, w: number, d: number) => {
    const p1 = at(x - w / 2, z - d / 2)
    const p2 = at(x + w / 2, z + d / 2)
    ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y)
  }
  outline(1.0, 0.5, 2.9, 1.1) // ATmega328P
  outline(-0.95, -0.85, 1.3, 0.6) // crystal
  outline(1.65, -0.75, 1.5, 1.5) // ATmega16U2 zone
  outline(-2.0, 1.0, 1.0, 0.9) // regulator zone
}

/** Bottom face: mask + pads + the one-line legal print. */
function drawSilkBottom(ctx: CanvasRenderingContext2D, wPx: number, hPx: number) {
  ctx.fillStyle = '#0b7278'
  ctx.fillRect(0, 0, wPx, hPx)
  const rnd = seeded(777)
  ctx.strokeStyle = 'rgba(6,90,96,0.8)'
  ctx.lineWidth = 2
  for (let i = 0; i < 40; i++) {
    const x = rnd() * wPx
    const y = rnd() * hPx
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (rnd() - 0.5) * 180, y)
    ctx.lineTo(x + (rnd() - 0.5) * 180, y + (rnd() - 0.5) * 140)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(233,236,236,0.75)'
  ctx.font = '600 26px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('RoboWrld Part Replica · Arduino Uno R3 Compatible', wPx / 2, hPx / 2)
}

/* ------------------------------------------------------------------ */
/* The board                                                           */
/* ------------------------------------------------------------------ */

export function ArduinoUno({
  position = [0, 0, 0],
  ledOn = false,
  scale = 1,
}: ArduinoUnoProps) {
  const baseY = 0.03
  const boardY = baseY + PCB_T / 2

  const [topMat, bottomMat] = useMemo(() => {
    const wPx = Math.round(ARDUINO_SIZE.w * 10 * PXMM)
    const hPx = Math.round(ARDUINO_SIZE.d * 10 * PXMM)
    const top = new THREE.MeshStandardMaterial({
      map: makeLabelTexture(wPx, hPx, drawSilkTop),
      roughness: 0.55,
      metalness: 0.08,
    })
    const bottom = new THREE.MeshStandardMaterial({
      map: makeLabelTexture(wPx, hPx, drawSilkBottom),
      roughness: 0.6,
      metalness: 0.08,
    })
    return [top, bottom] as const
  }, [])

  useEffect(() => {
    return () => {
      topMat.map?.dispose()
      bottomMat.map?.dispose()
      topMat.dispose()
      bottomMat.dispose()
    }
  }, [topMat, bottomMat])

  // BoxGeometry face order: +x, -x, +y (TOP), -y (BOTTOM), +z, -z
  const pcbMats = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color: '#0c7d84', roughness: 0.55, metalness: 0.07 }),
      new THREE.MeshStandardMaterial({ color: '#0c7d84', roughness: 0.55, metalness: 0.07 }),
      topMat,
      bottomMat,
      new THREE.MeshStandardMaterial({ color: '#0b7278', roughness: 0.6, metalness: 0.07 }),
      new THREE.MeshStandardMaterial({ color: '#0b7278', roughness: 0.6, metalness: 0.07 }),
    ],
    [topMat, bottomMat]
  )
  useEffect(() => {
    return () => pcbMats.slice(0, 2).concat(pcbMats.slice(4)).forEach((m) => m.dispose())
  }, [pcbMats])

  return (
    <group position={position} scale={scale}>
      {/* PCB — silkscreened top, traced bottom */}
      <mesh position={[0, boardY, 0]} material={pcbMats} castShadow receiveShadow>
        <boxGeometry args={[ARDUINO_SIZE.w, PCB_T, ARDUINO_SIZE.d]} />
      </mesh>

      {/* Plated mounting holes with eyelets */}
      {(
        [
          [-3.08, -2.22],
          [3.08, -2.22],
          [3.08, 2.22],
          [-1.55, 2.22],
        ] as Array<[number, number]>
      ).map(([x, z], i) => (
        <group key={i} position={[x, boardY + PCB_T / 2 + 0.005, z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.145, 0.21, 24]} />
            <meshStandardMaterial {...M.gold} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
            <circleGeometry args={[0.145, 24]} />
            <meshStandardMaterial {...M.hole} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* ---- headers: female socket strips with gold contacts ---- */}
      <HeaderSocketStrip
        position={[DIGITAL.x, boardY + 0.35, DIGITAL.z]}
        pins={DIGITAL.pins}
        length={DIGITAL.length}
      />
      <HeaderSocketStrip
        position={[POWER.x, boardY + 0.35, POWER.z]}
        pins={POWER.pins}
        length={POWER.length}
      />
      <HeaderSocketStrip
        position={[ANALOG.x, boardY + 0.35, ANALOG.z]}
        pins={ANALOG.pins}
        length={ANALOG.length}
      />
      {/* ICSP 2×3 header near the ATmega */}
      {[0, 1].map((row) => (
        <HeaderSocketStrip
          key={row}
          position={[2.62, boardY + 0.3, -0.35 + row * 0.254]}
          pins={3}
          length={0.762}
          width={0.5}
          height={0.68}
        />
      ))}

      {/* ---- left edge: USB-B above, barrel jack below ---- */}
      <USBConnectorB position={[-2.95, boardY + 0.62, -1.5]} />
      <BarrelJack position={[-2.9, boardY + 0.6, 1.35]} />

      {/* ---- ATmega328P DIP-28 with real legs + etched part number ---- */}
      <DIPChip
        position={[1.0, boardY + 0.35, 0.5]}
        body={[2.7, 0.32, 0.9]}
        legsPerSide={14}
        label="ATMEGA328P-PU"
      />

      {/* ATmega16U2 QFP near the USB */}
      <group position={[1.65, boardY + 0.19, -0.85]}>
        <mesh castShadow>
          <boxGeometry args={[0.95, 0.14, 0.95]} />
          <meshStandardMaterial {...M.ic} />
        </mesh>
        {[
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ].map(([dx, dz], side) =>
          Array.from({ length: 7 }, (_, i) => {
            const off = -0.33 + i * 0.11
            return (
              <mesh
                key={`${side}-${i}`}
                position={[dx !== 0 ? dx * 0.55 : off, 0, dz !== 0 ? dz * 0.55 : off]}
                castShadow
              >
                <boxGeometry args={[dx !== 0 ? 0.18 : 0.08, 0.1, dz !== 0 ? 0.18 : 0.08]} />
                <meshStandardMaterial {...M.gold} />
              </mesh>
            )
          })
        )}
      </group>

      {/* 16 MHz crystal */}
      <Crystal position={[-0.95, boardY + 0.16, 0.5]} />

      {/* Reset button */}
      <TactButton position={[-2.42, boardY + 0.17, -1.75]} />

      {/* LEDs — ON (lights when powered), L, TX, RX */}
      <LED3mm position={[-1.62, boardY + 0.12, 0.55]} lit={ledOn} />
      <LED3mm position={[-1.18, boardY + 0.12, 0.55]} color="#f59e0b" />
      <LED3mm position={[-0.74, boardY + 0.12, 0.55]} color="#f59e0b" />
      <LED3mm position={[-0.3, boardY + 0.12, 0.55]} color="#f59e0b" />

      {/* NCP1117 regulator with metal tab */}
      <group position={[-2.0, boardY + 0.14, 1.0]}>
        <mesh castShadow>
          <boxGeometry args={[0.68, 0.14, 0.45]} />
          <meshStandardMaterial {...M.ic} />
        </mesh>
        <mesh position={[0, 0.16, 0]} castShadow>
          <boxGeometry args={[0.62, 0.2, 0.4]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
      </group>

      {/* Electrolytic caps in the power section */}
      <ElectrolyticCap position={[-1.85, boardY + 0.3, 1.85]} r={0.3} h={0.55} />
      <ElectrolyticCap position={[2.95, boardY + 0.24, 1.5]} r={0.22} h={0.4} color="#1d3a8f" />

      {/* SMD passives scattered like the real board */}
      {(
        [
          [0.35, 1.3, 0.2],
          [0.62, 1.3, -0.9],
          [1.9, 1.55, 0.4],
          [2.3, -1.9, 0.5],
          [-1.3, -1.6, 1.2],
          [-0.5, -1.9, -0.4],
          [2.9, -0.9, 1.6],
          [1.35, 1.9, 2.1],
          [0.1, 2.1, -1.8],
          [-2.15, -0.5, 1.9],
        ] as Array<[number, number, number]>
      ).map(([x, z, rot], i) => (
        <SMDSpeck
          key={i}
          position={[x, boardY + 0.07, z]}
          rotation={[0, rot, 0]}
          color={i % 3 === 0 ? '#1a1c22' : '#c8b088'}
        />
      ))}

      {/* USB shield retaining screws (the two small ones on the shield) */}
      <PhillipsScrew position={[-2.6, boardY + 1.2, -1.95]} r={0.09} />
      <PhillipsScrew position={[-2.6, boardY + 1.2, -1.05]} r={0.09} />
    </group>
  )
}

export default ArduinoUno
