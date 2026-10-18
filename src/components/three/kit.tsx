'use client'

/**
 * kit — the realism toolbox shared by every exact-replica component.
 *
 * Ultra-realistic procedural hardware needs three things, and they all
 * live here so each model file stays about its own anatomy:
 *
 *   1. PRINTED LABELS  — canvas-generated textures (battery wraps, PCB
 *      silkscreens, motor nameplates). Real parts are covered in text;
 *      `makeLabelTexture` draws it crisp at 16–24 px/mm.
 *   2. REAL MATERIALS  — PBR presets measured off the real things:
 *      tin-plated brass, gold-flash header pins, FR4 solder mask,
 *      anodized aluminium, black PBT, silicone wire.
 *   3. MICRO-PARTS     — the small hardware that makes a replica read
 *      as real: phillips screws, DIP chips with legs, header sockets,
 *      snap terminals, Dupont plugs, USB-B and barrel jacks, XT60.
 *
 * Everything works at the shared 1 unit = 10 mm scale.
 */

import * as React from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'

/* ------------------------------------------------------------------ */
/* 1. Printed labels (canvas → texture)                                */
/* ------------------------------------------------------------------ */

/**
 * Draw onto an offscreen canvas and wrap it as a texture. The draw
 * callback receives a 2D context already scaled so that (0,0) is the
 * top-left of the requested pixel size. Text drawn with system fonts
 * at these resolutions photographs beautifully at 2× DPR.
 */
export function makeLabelTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D context unavailable')
  draw(ctx, w, h)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/** Deterministic pseudo-random (so traces/scratches look identical each mount). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

/* ------------------------------------------------------------------ */
/* 2. Real materials — presets measured off the real parts              */
/* ------------------------------------------------------------------ */

/** Spread these onto <meshStandardMaterial {...M.brass} />. */
export const M = {
  /** Tin-plated brass battery terminals / lugs. */
  brass: { color: '#caa64e', metalness: 0.95, roughness: 0.3 },
  /** Gold-flash header pins and socket contacts. */
  gold: { color: '#d8ac4e', metalness: 1, roughness: 0.22 },
  /** Brushed stainless screws. */
  steel: { color: '#c8cdd4', metalness: 0.92, roughness: 0.3 },
  /** Bright chrome shield (USB). */
  chrome: { color: '#d4d9df', metalness: 0.95, roughness: 0.18 },
  /** Anodized aluminium (servo center case, motor flange). */
  alu: { color: '#9aa0a8', metalness: 0.85, roughness: 0.4 },
  /** Raw aluminium transducer can. */
  aluRaw: { color: '#b8bcc2', metalness: 0.9, roughness: 0.28 },
  /** Nickel-plated steel motor can. */
  nickel: { color: '#aeb2b8', metalness: 0.88, roughness: 0.34 },
  /** Black PBT injection-molded plastic (servo caps, jack bodies). */
  pbt: { color: '#212227', roughness: 0.48, metalness: 0.05 },
  /** Black ABS (NEMA body end caps). */
  abs: { color: '#1d1e22', roughness: 0.55, metalness: 0.04 },
  /** White glass-filled nylon (servo horn). */
  nylon: { color: '#e9e4d6', roughness: 0.42, metalness: 0.02 },
  /** FR4 solder mask — classic (Uno teal). */
  fr4Teal: { color: '#087f86', roughness: 0.58, metalness: 0.06 },
  /** FR4 solder mask — HC-SR04 / sensor board blue. */
  fr4Blue: { color: '#1a4a9e', roughness: 0.58, metalness: 0.06 },
  /** Black epoxy IC body. */
  ic: { color: '#131418', roughness: 0.42, metalness: 0.08 },
  /** Dark solder-mask holes. */
  hole: { color: '#06070a', roughness: 0.7 },
  /** PVC wire insulation. */
  pvcRed: { color: '#c22a26', roughness: 0.55 },
  pvcBlack: { color: '#1b1d21', roughness: 0.55 },
  pvcOrange: { color: '#e07a1f', roughness: 0.55 },
  pvcBrown: { color: '#5d3a21', roughness: 0.55 },
  pvcBlue: { color: '#1f4fa8', roughness: 0.55 },
  pvcGreen: { color: '#1e7a3c', roughness: 0.55 },
  pvcYellow: { color: '#e0b41f', roughness: 0.55 },
  pvcWhite: { color: '#d8dade', roughness: 0.55 },
  /** Silicone RC wire (glossier than PVC). */
  siliconeRed: { color: '#d02a24', roughness: 0.35, metalness: 0.02 },
  siliconeBlack: { color: '#141518', roughness: 0.35, metalness: 0.02 },
} as const

/* ------------------------------------------------------------------ */
/* 3. Micro-parts                                                       */
/* ------------------------------------------------------------------ */

/** A phillips-head screw: round head + cross slot, at any orientation. */
export function PhillipsScrew({
  position,
  rotation = [0, 0, 0],
  r = 0.14,
  color = '#c8cdd4',
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  r?: number
  color?: string
}) {
  const slot = r * 1.15
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <cylinderGeometry args={[r, r * 1.04, r * 0.55, 20]} />
        <meshStandardMaterial color={color} metalness={0.92} roughness={0.3} />
      </mesh>
      {/* The cross — two intersecting dark slots */}
      <mesh position={[0, r * 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[slot, r * 0.34]} />
        <meshStandardMaterial color="#3d4046" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, r * 0.26, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[slot, r * 0.34]} />
        <meshStandardMaterial color="#3d4046" roughness={0.6} metalness={0.3} />
      </mesh>
    </group>
  )
}

/**
 * The PP3 snap-terminal pair, exactly as on a real 9 V battery:
 *  - PLUS: hex-collared crown with a smaller round stud on top
 *  - MINUS: shallow round cup with an open rim
 * Centers sit 12.7 mm apart (the standard snap spacing).
 */
export function SnapTerminals({
  spacing = 1.27,
  y = 0,
  scale = 1,
}: {
  spacing?: number
  y?: number
  scale?: number
}) {
  const plus = spacing / 2
  return (
    <group position={[0, y, 0]} scale={scale}>
      {/* PLUS — hex collar + crown stud */}
      <group position={[plus, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.21, 0.23, 0.12, 6]} />
          <meshStandardMaterial {...M.brass} />
        </mesh>
        <mesh position={[0, 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.145, 0.165, 0.11, 20]} />
          <meshStandardMaterial {...M.brass} />
        </mesh>
        {/* center dimple */}
        <mesh position={[0, 0.158, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 0.03, 16]} />
          <meshStandardMaterial color="#8d6f2c" metalness={0.9} roughness={0.4} />
        </mesh>
      </group>
      {/* MINUS — round cup */}
      <group position={[-plus, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.165, 0.18, 0.14, 20]} />
          <meshStandardMaterial {...M.brass} />
        </mesh>
        {/* recessed contact floor */}
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.125, 0.125, 0.05, 16]} />
          <meshStandardMaterial color="#7d6228" metalness={0.9} roughness={0.45} />
        </mesh>
      </group>
    </group>
  )
}

/**
 * A black female header strip (Uno R3 style): matte plastic bar with a
 * row of square gold socket openings. `pins` at 2.54 mm pitch.
 */
export function HeaderSocketStrip({
  position,
  rotation = [0, 0, 0],
  pins,
  length,
  width = 0.58,
  height = 0.85,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  pins: number
  /** Total length of the plastic bar (units). */
  length: number
  width?: number
  height?: number
}) {
  const pitch = length / pins
  const holeSize = Math.min(pitch * 0.52, 0.24)
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[length, height, width]} radius={0.04} smoothness={3} castShadow>
        <meshStandardMaterial {...M.pbt} />
      </RoundedBox>
      {Array.from({ length: pins }, (_, i) => {
        const x = -length / 2 + pitch / 2 + i * pitch
        return (
          <group key={i} position={[x, height / 2 + 0.011, 0]}>
            {/* square socket opening with a gold contact glinting inside */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[holeSize, holeSize * 0.72]} />
              <meshStandardMaterial {...M.hole} />
            </mesh>
            <mesh position={[0, -0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[holeSize * 0.55, holeSize * 0.4]} />
              <meshStandardMaterial {...M.gold} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/**
 * A male pin header (right-angle or straight) — black plastic base with
 * gold square pins. Used by sensors and the ESC signal lead.
 */
export function PinHeader({
  position,
  rotation = [0, 0, 0],
  pins,
  length,
  pinHeight = 0.62,
  lying = false,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  pins: number
  length: number
  pinHeight?: number
  /** Pins bent 90° like a right-angle header. */
  lying?: boolean
}) {
  const pitch = length / pins
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[length, 0.28, 0.56]} radius={0.03} smoothness={2}>
        <meshStandardMaterial {...M.pbt} />
      </RoundedBox>
      {Array.from({ length: pins }, (_, i) => {
        const x = -length / 2 + pitch / 2 + i * pitch
        if (lying) {
          return (
            <group key={i} position={[x, 0.08, 0]}>
              {/* vertical rise then 90° bend forward */}
              <mesh position={[0, 0.14, 0]}>
                <boxGeometry args={[0.11, 0.28, 0.11]} />
                <meshStandardMaterial {...M.gold} />
              </mesh>
              <mesh position={[0, 0.01, pinHeight / 2 + 0.05]}>
                <boxGeometry args={[0.11, 0.11, pinHeight]} />
                <meshStandardMaterial {...M.gold} />
              </mesh>
            </group>
          )
        }
        return (
          <mesh key={i} position={[x, 0.14 + pinHeight / 2 - 0.06, 0]} castShadow>
            <boxGeometry args={[0.11, pinHeight, 0.11]} />
            <meshStandardMaterial {...M.gold} />
          </mesh>
        )
      })}
    </group>
  )
}

/**
 * A DIP IC — black epoxy body with the pin-1 notch, laser-etched text
 * and one metal leg per side. The legs are what make it read as real.
 */
export function DIPChip({
  position,
  rotation = [0, 0, 0],
  body = [2.7, 0.32, 0.9],
  legsPerSide = 14,
  label = '',
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  /** body = [length, height, width] in units. */
  body?: [number, number, number]
  legsPerSide?: number
  /** Etched part number (rendered onto the top face). */
  label?: string
}) {
  const [len, hgt, wid] = body
  const legPitch = (len - 0.5) / legsPerSide
  const legColor = '#c9ced6'
  const texture = React.useMemo(
    () =>
      label
        ? makeLabelTexture(512, 170, (ctx) => {
            ctx.fillStyle = '#131418'
            ctx.fillRect(0, 0, 512, 170)
            ctx.fillStyle = '#c7ccd4'
            ctx.font = '600 44px Arial'
            ctx.textAlign = 'center'
            ctx.fillText(label, 256, 92)
            ctx.font = '500 26px Arial'
            ctx.fillStyle = '#8b919a'
            ctx.fillText('2427PH', 256, 138)
          })
        : null,
    [label]
  )
  const legRow = (side: 1 | -1) =>
    Array.from({ length: legsPerSide }, (_, i) => {
      const x = -((legsPerSide - 1) / 2) * legPitch + i * legPitch
      return (
        <group key={`${side}-${i}`} position={[x, -hgt / 2 + 0.09, side * (wid / 2 + 0.055)]}>
          {/* shoulder bend then straight pin */}
          <mesh castShadow>
            <boxGeometry args={[0.09, 0.16, 0.14]} />
            <meshStandardMaterial color={legColor} metalness={0.85} roughness={0.32} />
          </mesh>
          <mesh position={[0, -0.13, side * 0.07]}>
            <boxGeometry args={[0.08, 0.26, 0.07]} />
            <meshStandardMaterial color={legColor} metalness={0.85} roughness={0.32} />
          </mesh>
        </group>
      )
    })
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={body} radius={0.03} smoothness={2} castShadow receiveShadow>
        {texture ? (
          <meshStandardMaterial map={texture} roughness={0.4} metalness={0.06} />
        ) : (
          <meshStandardMaterial {...M.ic} />
        )}
      </RoundedBox>
      {/* pin-1 notch at one end */}
      <mesh position={[len / 2 - 0.02, hgt / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.09, 20, Math.PI, Math.PI]} />
        <meshStandardMaterial color="#2a2b31" roughness={0.5} />
      </mesh>
      {legRow(1)}
      {legRow(-1)}
    </group>
  )
}

/** HC-49S crystal can — the oval silver seat. */
export function Crystal({ position, rotation = [0, 0, 0], scale = 1 }: { position: [number, number, number]; rotation?: [number, number, number]; scale?: number }) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh castShadow>
        <cylinderGeometry args={[0.19, 0.19, 0.5, 24, 1, false, 0, Math.PI]} />
        <meshStandardMaterial {...M.chrome} />
      </mesh>
      <mesh castShadow>
        <boxGeometry args={[0.38, 0.3, 0.5]} />
        <meshStandardMaterial {...M.chrome} />
      </mesh>
      {/* two lead wires out the bottom */}
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[x, -0.2, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.16, 8]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
      ))}
    </group>
  )
}

/** Aluminum electrolytic capacitor with the polarity stripe. */
export function ElectrolyticCap({
  position,
  r = 0.32,
  h = 0.6,
  color = '#1d2f6e',
}: {
  position: [number, number, number]
  r?: number
  h?: number
  color?: string
}) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[r, r, h, 24]} />
        <meshStandardMaterial color={color} roughness={0.38} metalness={0.25} />
      </mesh>
      {/* top score + polarity stripe */}
      <mesh position={[0, h / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r * 0.985, 24]} />
        <meshStandardMaterial color="#c6cdd8" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[r * 0.62, 0, 0]}>
        <boxGeometry args={[r * 0.38, h * 0.99, r * 2.02]} />
        <meshStandardMaterial color="#d9dee6" roughness={0.5} />
      </mesh>
    </group>
  )
}

/** A 4-leg tactile push button (the Uno's reset). */
export function TactButton({ position, rotation = [0, 0, 0] }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[0.62, 0.24, 0.62]} />
        <meshStandardMaterial {...M.chrome} />
      </mesh>
      <mesh position={[0, 0.19, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.19, 0.14, 20]} />
        <meshStandardMaterial color="#0d0e12" roughness={0.35} />
      </mesh>
    </group>
  )
}

/** An SMD resistor / capacitor — tiny tan or black speck. */
export function SMDSpeck({
  position,
  rotation = [0, 0, 0],
  color = '#c8b088',
  size = [0.16, 0.09, 0.3],
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  color?: string
  size?: [number, number, number]
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.1} />
    </mesh>
  )
}

/** A 3 mm LED dome — dark until powered. */
export function LED3mm({
  position,
  color = '#4ade80',
  lit = false,
}: {
  position: [number, number, number]
  color?: string
  lit?: boolean
}) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.12, 0.13, 0.12, 14]} />
        <meshStandardMaterial
          color={lit ? color : '#2a3328'}
          emissive={color}
          emissiveIntensity={lit ? 2.6 : 0}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[0, 0.09, 0]}>
        <sphereGeometry args={[0.105, 14, 12]} />
        <meshStandardMaterial
          color={lit ? color : '#232b22'}
          emissive={color}
          emissiveIntensity={lit ? 2.6 : 0}
          roughness={0.2}
        />
      </mesh>
    </group>
  )
}

/**
 * The 3-pin Dupont plug at the end of a servo lead — black housing,
 * three gold contacts, and the polarization notch.
 */
export function DupontPlug3({
  position,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
}) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[0.78, 0.42, 1.1]} radius={0.07} smoothness={3} castShadow>
        <meshStandardMaterial {...M.pbt} />
      </RoundedBox>
      {/* polarization notch on top */}
      <mesh position={[0, 0.215, -0.18]}>
        <boxGeometry args={[0.3, 0.05, 0.34]} />
        <meshStandardMaterial color="#2e3036" roughness={0.5} />
      </mesh>
      {/* contact windows + gold pins out the mating face */}
      {[-0.32, 0, 0.32].map((z) => (
        <group key={z}>
          <mesh position={[0, 0.02, z]}>
            <boxGeometry args={[0.2, 0.16, 0.22]} />
            <meshStandardMaterial {...M.gold} />
          </mesh>
          <mesh position={[0.52, 0.02, z]} castShadow>
            <boxGeometry args={[0.3, 0.13, 0.16]} />
            <meshStandardMaterial {...M.gold} />
          </mesh>
        </group>
      ))}
      {/* strain relief wings */}
      <mesh position={[-0.5, 0, 0]}>
        <boxGeometry args={[0.24, 0.5, 1.0]} />
        <meshStandardMaterial color="#26272c" roughness={0.6} />
      </mesh>
    </group>
  )
}

/** USB-B receptacle — nickel shield, white insert, contact tongue. */
export function USBConnectorB({
  position,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* stamped shield with the seam line on top */}
      <RoundedBox args={[1.62, 1.16, 1.35]} radius={0.09} smoothness={3} castShadow>
        <meshStandardMaterial {...M.chrome} />
      </RoundedBox>
      <mesh position={[0, 0.586, 0]}>
        <boxGeometry args={[1.64, 0.012, 0.22]} />
        <meshStandardMaterial color="#7f858d" metalness={0.9} roughness={0.35} />
      </mesh>
      {/* white plastic insert */}
      <mesh position={[0.82, -0.08, 0]}>
        <boxGeometry args={[0.04, 0.86, 1.06]} />
        <meshStandardMaterial color="#e4e6ea" roughness={0.45} />
      </mesh>
      {/* contact tongue with gold pads */}
      <mesh position={[0.6, 0.12, 0]}>
        <boxGeometry args={[0.3, 0.2, 0.98]} />
        <meshStandardMaterial color="#c9ccd2" roughness={0.4} metalness={0.15} />
      </mesh>
      {[0.28, 0.44, 0.6, 0.76].map((z) => (
        <mesh key={z} position={[0.46, 0.2, z - 0.35]}>
          <boxGeometry args={[0.05, 0.1, 0.12]} />
          <meshStandardMaterial {...M.gold} />
        </mesh>
      ))}
      {/* shield tabs on the PCB side */}
      {[-0.45, 0.45].map((z) => (
        <mesh key={z} position={[-0.78, -0.1, z]}>
          <boxGeometry args={[0.14, 0.7, 0.2]} />
          <meshStandardMaterial {...M.chrome} />
        </mesh>
      ))}
    </group>
  )
}

/** 2.1 mm DC barrel jack — black body, open front with center pin. */
export function BarrelJack({
  position,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
}) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[1.42, 1.1, 1.4]} radius={0.09} smoothness={3} castShadow>
        <meshStandardMaterial {...M.pbt} />
      </RoundedBox>
      {/* front opening + brass ring + center pin */}
      <mesh position={[0.72, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.42, 0.42, 0.06, 24]} />
        <meshStandardMaterial color="#0a0b0e" roughness={0.7} />
      </mesh>
      <mesh position={[0.78, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, 0.1, 20]} />
        <meshStandardMaterial {...M.brass} />
      </mesh>
      <mesh position={[0.86, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, 0.22, 14]} />
        <meshStandardMaterial {...M.brass} />
      </mesh>
      {/* solder tabs underneath */}
      {[-0.4, 0.4].map((z) => (
        <mesh key={z} position={[-0.3, -0.58, z]}>
          <boxGeometry args={[0.5, 0.12, 0.22]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
      ))}
    </group>
  )
}

/** XT60 connector — the iconic yellow RC plug with gold bullets. */
export function XT60({
  position,
  rotation = [0, 0, 0],
  half = 'female',
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  half?: 'female' | 'male'
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* yellow body */}
      <RoundedBox args={[1.5, 0.95, 1.0]} radius={0.12} smoothness={3} castShadow>
        <meshStandardMaterial color="#e3b422" roughness={0.45} metalness={0.05} />
      </RoundedBox>
      <RoundedBox args={[0.7, 0.8, 0.9]} radius={0.1} smoothness={3} position={[-1.0, 0, 0]}>
        <meshStandardMaterial color="#e3b422" roughness={0.45} metalness={0.05} />
      </RoundedBox>
      {/* side ribs */}
      {[0.3, 0.6].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.1, 0.97, 1.02]} />
          <meshStandardMaterial color="#c69a18" roughness={0.5} />
        </mesh>
      ))}
      {/* the two bullets */}
      {[-0.26, 0.26].map((z) => (
        <group key={z} position={[half === 'female' ? 0.78 : -0.78, 0, z]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.17, 0.17, 0.5, 16]} />
            <meshStandardMaterial
              color={z < 0 ? '#c22a26' : '#141518'}
              roughness={0.4}
              metalness={0.1}
            />
          </mesh>
          <mesh
            position={[half === 'female' ? -0.28 : 0.28, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.12, 0.12, 0.3, 14]} />
            <meshStandardMaterial {...M.gold} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Smooth tube along a Catmull-Rom curve — wire/lead runs. */
export function wireTube(
  points: Array<[number, number, number]>,
  radius: number,
  segments = 48
): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
  return new THREE.TubeGeometry(curve, segments, radius, 10, false)
}
