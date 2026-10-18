'use client'

/**
 * ServoMotor — an exact procedural replica of the Tower Pro MG996R
 * metal-gear servo at 1 unit = 10 mm (40.7 × 19.7 × 42.9 mm case).
 *
 * The anatomy that makes it read as the real part:
 *  - Black PBT top + bottom caps around a BRUSHED ALUMINIUM center
 *    band — the MG996R's signature sandwich
 *  - FOUR mounting tabs in two rows (upper pair on the plastic, lower
 *    pair on the aluminum), each with a real M3 clearance hole
 *  - Round output boss with a 25-tooth SPLINE shaft (faceted cylinder)
 *    and dual-bearing collar
 *  - Phillips screws: 4 self-tappers in the bottom, 2 on the top cap,
 *    2 long case screws on the front face
 *  - White glass-filled nylon horn on the spline, secured by a center
 *    phillips screw (single / double / round horn types)
 *  - PRINTED SIDE LABEL (canvas texture): "TowerPro MG996R DIGITAL
 *    SERVO", exactly like the real sticker
 *  - Rear cable exit → black sheath → orange / red / brown leads →
 *    a real 3-pin Dupont plug with gold contacts
 *
 * The horn still tracks the commanded angle at `speed` °/s — real servo
 * behavior, not decoration. Drag machinery is unchanged.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { RoundedBox, Html } from '@react-three/drei'
import { SERVO_PORTS, type Port } from '@/lib/connections'
import { DupontPlug3, M, PhillipsScrew, makeLabelTexture, wireTube } from './kit'

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export type HornType = 'single' | 'double' | 'round'

export interface ServoMotorProps {
  /** Commanded angle in degrees (0–180). The horn moves toward it at `speed`. */
  angle?: number
  /** Maximum travel speed in degrees/second (a real MG996R does ~350 °/s). */
  speed?: number
  /** Case color — MG996R black by default. */
  bodyColor?: string
  /** Horn color — white glass-filled nylon by default. */
  hornColor?: string
  hornType?: HornType
  showHorn?: boolean
  showCable?: boolean
  showLabels?: boolean
  showPorts?: boolean
  interactive?: boolean
  grabRadius?: number
  grabY?: number
  /** Self-contained sweep animation — handy for list previews. */
  autoSweep?: { min: number; max: number; speed: number } | false
  /** Fires while the user drags the horn (the new commanded angle). */
  onAngleChange?: (angle: number) => void
  /** Fires when horn dragging starts / ends. */
  onDragStateChange?: (dragging: boolean) => void
  /** The component writes its true (speed-limited) shaft angle here every
   *  frame — this is how attached mechanisms stay in sync without re-renders. */
  liveAngleRef?: { current: number }
  scale?: number
  position?: [number, number, number]
  rotation?: [number, number, number]
}

/* ------------------------------------------------------------------ */
/* Exact dimensions (1 unit = 10 mm)                                    */
/* ------------------------------------------------------------------ */

/** MG996R case: 40.7 × 19.7 × 42.9 mm (L × W × H incl. boss). */
export const SERVO_DIMS = { l: 4.07, w: 1.97, h: 4.29 }

/** Output shaft center (local) — the boss sits near one end. */
const SHAFT: [number, number, number] = [1.15, 4.3, 0]
/** Where the cable leaves the rear face. */
export const SERVO_CABLE_EXIT: [number, number, number] = [-2.05, 0.95, 0]

/* ------------------------------------------------------------------ */
/* Default palette (matches a real MG996R)                              */
/* ------------------------------------------------------------------ */

const DEFAULT_BODY = '#212227' // black PBT caps
const DEFAULT_HORN = '#e9e4d6' // white nylon horn

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

/** Rounded-rectangle outline centered at (cx, cy). */
export function roundedRectShape(w: number, h: number, r: number, cx = 0, cy = 0): THREE.Shape {
  const s = new THREE.Shape()
  const x0 = cx - w / 2
  const y0 = cy - h / 2
  const x1 = cx + w / 2
  const y1 = cy + h / 2
  s.moveTo(x0 + r, y0)
  s.lineTo(x1 - r, y0)
  s.quadraticCurveTo(x1, y0, x1, y0 + r)
  s.lineTo(x1, y1 - r)
  s.quadraticCurveTo(x1, y1, x1 - r, y1)
  s.lineTo(x0 + r, y1)
  s.quadraticCurveTo(x0, y1, x0, y1 - r)
  s.lineTo(x0, y0 + r)
  s.quadraticCurveTo(x0, y0, x0 + r, y0)
  return s
}

/** Circular hole path for extruded shapes. */
export function circleHole(x: number, y: number, r: number): THREE.Path {
  const p = new THREE.Path()
  p.absarc(x, y, r, 0, Math.PI * 2, true)
  return p
}

/** Extrude a shape lying flat in the XZ plane (thickness along +Y). */
export function extrudeFlat(shape: THREE.Shape, thickness: number, bevel = 0.025): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(thickness - bevel * 2, 0.01),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 22,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, bevel, 0)
  return g
}

/* ------------------------------------------------------------------ */
/* Static part data                                                    */
/* ------------------------------------------------------------------ */

const PART_LABELS: Array<{ position: [number, number, number]; text: string }> = [
  { position: [1.15, 5.35, 0.35], text: 'White nylon horn' },
  { position: [1.15, 4.55, 0.38], text: '25T spline shaft' },
  { position: [2.7, 3.3, 0.42], text: 'Mounting tab · M3' },
  { position: [0.4, 1.9, 1.05], text: 'Aluminium center case' },
  { position: [-2.6, 1.35, 0.42], text: 'Cable exit' },
  { position: [-3.9, 0.5, 0.62], text: '3-pin Dupont plug' },
]

/** Bottom self-tapper positions. */
const BOTTOM_SCREWS: Array<[number, number]> = [
  [1.55, 0.72],
  [1.55, -0.72],
  [-1.55, 0.72],
  [-1.55, -0.72],
]
/** Top-cap screws (rear of the boss). */
const TOP_SCREWS: Array<[number, number]> = [
  [-1.45, 0.62],
  [-1.45, -0.62],
]
/** Long case screws on the front face (into the aluminum band). */
const FRONT_SCREWS: Array<[number, number]> = [
  [1.15, 1.75],
  [-1.15, 1.75],
]

/* ------------------------------------------------------------------ */
/* Port markers (rendered from the connection contract data)          */
/* ------------------------------------------------------------------ */

const PORT_RING_R: Record<Port['kind'], number> = {
  'bolt-hole': 0.3,
  'spline-shaft': 0.6,
  face: 1.7,
  'pin-socket': 0.42,
}

function PortMarkers() {
  return (
    <group>
      {SERVO_PORTS.map((p) => {
        const ringR = PORT_RING_R[p.kind]
        const flat = p.kind !== 'pin-socket'
        return (
          <group key={p.id} position={p.position}>
            <mesh rotation={flat ? [-Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]}>
              <torusGeometry args={[ringR, 0.045, 10, 40]} />
              <meshBasicMaterial color="#f59e0b" toneMapped={false} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.09, 14, 14]} />
              <meshBasicMaterial color="#f59e0b" toneMapped={false} />
            </mesh>
            <Html
              position={(p.labelOffset ?? [0, 0.5, 0]) as [number, number, number]}
              center
              distanceFactor={13}
              occlude
              zIndexRange={[30, 0]}
            >
              <div className="pointer-events-none flex select-none items-center gap-1.5 whitespace-nowrap">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 ring-2 ring-white" />
                <span className="rounded-full border border-amber-300 bg-amber-50/95 px-2.5 py-1 font-mono text-[11px] font-semibold text-amber-800 shadow-sm">
                  {p.id.toUpperCase()} · {p.spec}
                </span>
              </div>
            </Html>
          </group>
        )
      })}

      {/* DOF range arc: 0° → 180° around the shaft */}
      <group position={[SHAFT[0], SHAFT[1] + 0.3, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.6, 0.028, 8, 72, Math.PI]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.75} toneMapped={false} />
        </mesh>
        {[0, 90, 180].map((deg) => (
          <mesh
            key={deg}
            position={[SHAFT[0] + 3.6 * Math.cos((deg * Math.PI) / 180), 0, 3.6 * Math.sin((deg * Math.PI) / 180)]}
          >
            <sphereGeometry args={[0.075, 12, 12]} />
            <meshBasicMaterial color="#f59e0b" toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* The MG996R sticker (canvas texture)                                 */
/* ------------------------------------------------------------------ */

function drawServoSticker(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // silver-white label stock
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#e9eaec')
  grad.addColorStop(0.5, '#d9dbdf')
  grad.addColorStop(1, '#e9eaec')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#191b1f'
  ctx.font = `italic 800 ${Math.round(h * 0.19)}px Arial`
  ctx.fillText('TowerPro', w / 2, h * 0.3)
  ctx.font = `900 ${Math.round(h * 0.3)}px Arial`
  ctx.fillText('MG996R', w / 2, h * 0.62)
  ctx.font = `600 ${Math.round(h * 0.115)}px Arial`
  ctx.fillStyle = '#4a4d55'
  ctx.fillText('DIGITAL SERVO · METAL GEAR', w / 2, h * 0.84)
}

/* ------------------------------------------------------------------ */
/* The component                                                       */
/* ------------------------------------------------------------------ */

export function ServoMotor({
  angle = 90,
  speed = 400,
  bodyColor = DEFAULT_BODY,
  hornColor = DEFAULT_HORN,
  hornType = 'single',
  showHorn = true,
  showCable = true,
  showLabels = false,
  showPorts = false,
  interactive = false,
  grabRadius = 1.06,
  grabY = 4.5,
  autoSweep = false,
  onAngleChange,
  onDragStateChange,
  liveAngleRef,
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: ServoMotorProps) {
  const root = useRef<THREE.Group>(null!)
  const rotor = useRef<THREE.Group>(null!)

  // Motion state (kept in refs — zero React re-renders while animating)
  const target = useRef(angle)
  const current = useRef(angle)
  const sweepDir = useRef(1)
  const dragging = useRef(false)

  // Drag machinery
  const { camera, gl, get } = useThree()
  const hover = useRef(false)
  const canvasEl = useRef<HTMLCanvasElement | null>(null)
  const listeners = useRef<{ move: (e: PointerEvent) => void; up: () => void } | null>(null)

  // Latest-prop mirrors so stable drag handlers always see fresh callbacks
  const latest = useRef({ onAngleChange, onDragStateChange, interactive })
  useEffect(() => {
    latest.current = { onAngleChange, onDragStateChange, interactive }
  })

  /* ---------------- geometry (built once, disposed on unmount) ------- */

  const geo = useMemo(() => {
    // Mounting tab: rounded bar with a real M3 clearance hole
    const tab = roundedRectShape(1.5, 0.6, 0.26)
    tab.holes.push(circleHole(0.38, 0, 0.17))

    // Single/double horn arm with lightening holes
    const arm = roundedRectShape(2.58, 0.66, 0.33, 1.61, 0)
    arm.holes.push(circleHole(1.0, 0, 0.11), circleHole(1.66, 0, 0.11), circleHole(2.32, 0, 0.11))

    // Round horn: disc with a ring of holes
    const disc = new THREE.Shape()
    disc.absarc(0, 0, 1.42, 0, Math.PI * 2, false)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      disc.holes.push(circleHole(Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0.13))
    }

    // Cable: sheath out of the rear face, down and back to the plug —
    // a real MG996R lead is 300 mm; shown at playground-friendly length.
    const sheath = wireTube(
      [
        [-1.95, 0.95, 0],
        [-2.55, 0.85, 0],
        [-3.2, 0.55, 0],
        [-3.85, 0.2, 0],
      ],
      0.3,
      44
    )
    const wireBrown = wireTube(
      [
        [-3.8, 0.2, -0.09],
        [-4.3, 0.14, -0.22],
        [-4.8, 0.12, -0.26],
      ],
      0.11,
      24
    )
    const wireRed = wireTube(
      [
        [-3.8, 0.2, 0],
        [-4.3, 0.14, 0],
        [-4.85, 0.12, 0],
      ],
      0.11,
      24
    )
    const wireOrange = wireTube(
      [
        [-3.8, 0.2, 0.09],
        [-4.3, 0.14, 0.22],
        [-4.8, 0.12, 0.26],
      ],
      0.11,
      24
    )

    return {
      tab: extrudeFlat(tab, 0.24),
      arm: extrudeFlat(arm, 0.26),
      disc: extrudeFlat(disc, 0.22),
      sheath,
      wireBrown,
      wireRed,
      wireOrange,
    }
  }, [])

  /* ---------------- materials (shared instances) -------------------- */

  const mats = useMemo(() => {
    return {
      body: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(DEFAULT_BODY),
        roughness: 0.42,
        metalness: 0.06,
        clearcoat: 0.4,
        clearcoatRoughness: 0.4,
      }),
      alu: new THREE.MeshStandardMaterial({ color: '#8e939b', metalness: 0.88, roughness: 0.36 }),
      horn: new THREE.MeshStandardMaterial({ color: new THREE.Color(DEFAULT_HORN), roughness: 0.42, metalness: 0.02 }),
      spline: new THREE.MeshStandardMaterial({
        color: '#c9ced6',
        metalness: 0.9,
        roughness: 0.28,
        flatShading: true, // faceted cylinder reads as a 25T spline
      }),
      steel: new THREE.MeshStandardMaterial({ color: '#c8cdd4', metalness: 0.92, roughness: 0.3 }),
      sheath: new THREE.MeshStandardMaterial({ color: '#202228', roughness: 0.7, metalness: 0.05 }),
      brown: new THREE.MeshStandardMaterial({ ...M.pvcBrown }),
      red: new THREE.MeshStandardMaterial({ ...M.pvcRed }),
      orange: new THREE.MeshStandardMaterial({ ...M.pvcOrange }),
      sticker: new THREE.MeshStandardMaterial({
        map: makeLabelTexture(512, 330, drawServoSticker),
        roughness: 0.35,
        metalness: 0.05,
      }),
      grab: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    }
  }, [])

  useEffect(() => {
    mats.body.color.set(bodyColor)
    mats.horn.color.set(hornColor)
  }, [bodyColor, hornColor, mats])

  useEffect(() => {
    return () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(mats).forEach((m) => m.dispose())
    }
  }, [geo, mats])

  /* ---------------- prop → target sync ------------------------------ */

  useEffect(() => {
    if (!dragging.current) target.current = angle
  }, [angle])

  /* ---------------- per-frame motion -------------------------------- */

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)

    if (autoSweep && !dragging.current) {
      target.current += sweepDir.current * autoSweep.speed * dt
      if (target.current >= autoSweep.max) {
        target.current = autoSweep.max
        sweepDir.current = -1
      } else if (target.current <= autoSweep.min) {
        target.current = autoSweep.min
        sweepDir.current = 1
      }
    }

    // Speed-limited travel toward the commanded angle (like a real servo)
    const diff = target.current - current.current
    if (Math.abs(diff) < 0.05) {
      current.current = target.current
    } else {
      const maxStep = speed * dt
      current.current += THREE.MathUtils.clamp(diff, -maxStep, maxStep)
    }

    if (rotor.current) {
      rotor.current.rotation.y = -THREE.MathUtils.degToRad(current.current)
    }

    // Publish the true shaft angle to any attached mechanism (zero re-renders)
    if (liveAngleRef) liveAngleRef.current = current.current
  })

  /* ---------------- drag-to-rotate the horn ------------------------- */

  /** Project a pointer position onto the horn plane and read the servo angle. */
  const shaftScreenPos = useCallback((): { x: number; y: number; sign: number } | null => {
    if (!root.current) return null
    const rect = gl.domElement.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    root.current.updateWorldMatrix(true, false)
    const shaftWorld = root.current.localToWorld(new THREE.Vector3(SHAFT[0], SHAFT[1], SHAFT[2]))
    const ndcPoint = shaftWorld.clone().project(camera)
    return {
      x: ((ndcPoint.x + 1) / 2) * rect.width + rect.left,
      y: ((1 - ndcPoint.y) / 2) * rect.height + rect.top,
      // Viewing the rotation plane from above keeps direction; from below flips it
      sign: camera.position.y > shaftWorld.y ? 1 : -1,
    }
  }, [camera, gl])

  const setControlsEnabled = useCallback(
    (enabled: boolean) => {
      const controls = get().controls as { enabled?: boolean } | null
      if (controls) controls.enabled = enabled
    },
    [get]
  )

  const endDrag = useCallback(() => {
    if (listeners.current) {
      window.removeEventListener('pointermove', listeners.current.move)
      window.removeEventListener('pointerup', listeners.current.up)
      listeners.current = null
    }
    dragging.current = false
    setControlsEnabled(true)
    if (canvasEl.current) canvasEl.current.style.cursor = hover.current ? 'grab' : ''
    latest.current.onDragStateChange?.(false)
  }, [setControlsEnabled])

  const beginDrag = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!latest.current.interactive) return
      e.stopPropagation()
      e.nativeEvent.preventDefault?.()

      setControlsEnabled(false)

      // Screen-space "knob": track the pointer angle around the projected shaft
      const screen = shaftScreenPos()
      if (!screen) {
        setControlsEnabled(true)
        return
      }
      const startAlpha = Math.atan2(e.nativeEvent.clientY - screen.y, e.nativeEvent.clientX - screen.x)

      dragging.current = true
      canvasEl.current = e.nativeEvent.target as HTMLCanvasElement
      canvasEl.current.style.cursor = 'grabbing'
      latest.current.onDragStateChange?.(true)

      let prevAlpha = startAlpha
      const move = (ev: PointerEvent) => {
        const alpha = Math.atan2(ev.clientY - screen.y, ev.clientX - screen.x)
        let d = alpha - prevAlpha
        d = Math.atan2(Math.sin(d), Math.cos(d))
        prevAlpha = alpha
        const next = THREE.MathUtils.clamp(target.current + screen.sign * THREE.MathUtils.radToDeg(d), 0, 180)
        target.current = next
        latest.current.onAngleChange?.(next)
      }
      const up = () => endDrag()
      listeners.current = { move, up }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [endDrag, setControlsEnabled, shaftScreenPos]
  )

  // Safety: release listeners if the component unmounts mid-drag
  useEffect(() => {
    return () => {
      if (listeners.current) {
        window.removeEventListener('pointermove', listeners.current.move)
        window.removeEventListener('pointerup', listeners.current.up)
        listeners.current = null
      }
    }
  }, [])

  const onRotorOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!latest.current.interactive) return
      e.stopPropagation()
      hover.current = true
      if (!dragging.current) {
        const el = e.nativeEvent.target as HTMLElement | null
        if (el) el.style.cursor = 'grab'
      }
    },
    []
  )

  const onRotorOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      hover.current = false
      if (!dragging.current) {
        const el = e.nativeEvent.target as HTMLElement | null
        if (el) el.style.cursor = ''
      }
    },
    []
  )

  /* ---------------- render ------------------------------------------ */

  const halfL = SERVO_DIMS.l / 2
  const halfW = SERVO_DIMS.w / 2

  return (
    <group ref={root} position={position} rotation={rotation} scale={scale}>
      {/* ---------- the case sandwich ---------- */}
      {/* Solid black PBT core */}
      <RoundedBox
        args={[SERVO_DIMS.l, 3.62, SERVO_DIMS.w]}
        radius={0.1}
        smoothness={4}
        position={[0, 1.84, 0]}
        castShadow
        receiveShadow
        material={mats.body}
      />
      {/* Top cap seam plate */}
      <RoundedBox
        args={[SERVO_DIMS.l - 0.02, 0.3, SERVO_DIMS.w - 0.02]}
        radius={0.06}
        smoothness={3}
        position={[0, 3.5, 0]}
        castShadow
        material={mats.body}
      />
      {/* Bottom cap seam plate */}
      <RoundedBox
        args={[SERVO_DIMS.l - 0.02, 0.2, SERVO_DIMS.w - 0.02]}
        radius={0.06}
        smoothness={3}
        position={[0, 0.13, 0]}
        castShadow
        material={mats.body}
      />
      {/* Brushed aluminium center band — proud of the case, the MG996R signature */}
      <mesh castShadow receiveShadow material={mats.alu} position={[0, 1.7, 0]}>
        <boxGeometry args={[SERVO_DIMS.l + 0.06, 1.28, SERVO_DIMS.w + 0.06]} />
      </mesh>
      {/* fine brushed lines on the front face */}
      <mesh position={[0, 1.7, halfW + 0.063]}>
        <planeGeometry args={[SERVO_DIMS.l - 0.4, 1.06]} />
        <meshStandardMaterial color="#9aa2aa" metalness={0.9} roughness={0.42} />
      </mesh>

      {/* ---------- mounting tabs (4, two rows) with real M3 holes ---------- */}
      <mesh geometry={geo.tab} position={[2.32, 3.28, 0]} castShadow receiveShadow material={mats.body} />
      <mesh geometry={geo.tab} position={[-2.32, 3.28, 0]} rotation-y={Math.PI} castShadow receiveShadow material={mats.body} />
      <mesh geometry={geo.tab} position={[2.32, 1.95, 0]} castShadow receiveShadow material={mats.alu} />
      <mesh geometry={geo.tab} position={[-2.32, 1.95, 0]} rotation-y={Math.PI} castShadow receiveShadow material={mats.alu} />

      {/* ---------- output boss + bearing collar ---------- */}
      <mesh position={[SHAFT[0], 3.85, 0]} castShadow receiveShadow material={mats.body}>
        <cylinderGeometry args={[0.62, 0.68, 0.5, 40]} />
      </mesh>
      <mesh position={[SHAFT[0], 4.06, 0]} castShadow material={mats.steel}>
        <cylinderGeometry args={[0.5, 0.5, 0.09, 36]} />
      </mesh>

      {/* ---------- screws ---------- */}
      {BOTTOM_SCREWS.map(([x, z]) => (
        <PhillipsScrew key={`bs-${x}-${z}`} position={[x, 0.05, z]} r={0.13} />
      ))}
      {TOP_SCREWS.map(([x, z]) => (
        <PhillipsScrew key={`ts-${x}-${z}`} position={[x, 3.66, z]} r={0.12} />
      ))}
      {FRONT_SCREWS.map(([x]) => (
        <PhillipsScrew key={`fs-${x}`} position={[x, 1.7, halfW + 0.07]} r={0.13} />
      ))}

      {/* ---------- printed side label (on the aluminium band) ---------- */}
      <mesh position={[0.35, 1.7, halfW + 0.065]} material={mats.sticker}>
        <planeGeometry args={[2.9, 1.08]} />
      </mesh>
      {/* a second sticker on the back face */}
      <mesh position={[0.35, 1.7, -halfW - 0.065]} rotation-y={Math.PI} material={mats.sticker}>
        <planeGeometry args={[2.9, 1.08]} />
      </mesh>

      {/* ---------- rear cable grommet ---------- */}
      <RoundedBox
        args={[0.4, 0.62, 0.8]}
        radius={0.1}
        smoothness={3}
        position={[-halfL - 0.02, 0.95, 0]}
        castShadow
        material={mats.body}
      />

      {/* ---------- rotating output: spline + horn + screw ---------- */}
      <group ref={rotor} onPointerDown={beginDrag} onPointerOver={onRotorOver} onPointerOut={onRotorOut}>
        {/* 25T splined shaft (faceted) */}
        <mesh position={[SHAFT[0], 4.28, 0]} castShadow material={mats.spline}>
          <cylinderGeometry args={[0.34, 0.34, 0.66, 25]} />
        </mesh>
        {/* brass spline insert on top */}
        <mesh position={[SHAFT[0], 4.55, 0]} castShadow material={mats.steel}>
          <cylinderGeometry args={[0.2, 0.24, 0.1, 24]} />
        </mesh>

        {showHorn && (
          <group position={[SHAFT[0], 4.62, 0]}>
            {/* Hub with spline broach marks */}
            <mesh position={[0, 0.13, 0]} castShadow material={mats.horn}>
              <cylinderGeometry args={[0.58, 0.62, 0.28, 32]} />
            </mesh>

            {hornType === 'single' && <mesh geometry={geo.arm} castShadow material={mats.horn} />}
            {hornType === 'double' && (
              <>
                <mesh geometry={geo.arm} castShadow material={mats.horn} />
                <mesh geometry={geo.arm} rotation-y={Math.PI} castShadow material={mats.horn} />
              </>
            )}
            {hornType === 'round' && <mesh geometry={geo.disc} castShadow material={mats.horn} />}

            {/* Center retaining screw (phillips) */}
            <PhillipsScrew position={[0, 0.28, 0]} r={0.14} />
          </group>
        )}

        {/* Invisible grab volume so the horn is easy to grab */}
        {interactive && (
          <mesh position={[SHAFT[0], grabY, 0]} material={mats.grab}>
            <cylinderGeometry args={[grabRadius, grabRadius, 0.5, 24]} />
          </mesh>
        )}
      </group>

      {/* ---------- cable assembly: sheath → 3 leads → Dupont plug ---------- */}
      {showCable && (
        <group>
          <mesh geometry={geo.sheath} castShadow receiveShadow material={mats.sheath} />
          <mesh geometry={geo.wireBrown} castShadow receiveShadow material={mats.brown} />
          <mesh geometry={geo.wireRed} castShadow receiveShadow material={mats.red} />
          <mesh geometry={geo.wireOrange} castShadow receiveShadow material={mats.orange} />
          <DupontPlug3 position={[-5.35, 0.21, 0]} rotation={[0, Math.PI / 2, 0]} />
        </group>
      )}

      {/* ---------- connection ports + DOF range (assembly view) ---------- */}
      {showPorts && <PortMarkers />}

      {/* ---------- floating part labels ---------- */}
      {showLabels &&
        PART_LABELS.map((l) => (
          <Html key={l.text} position={l.position} center distanceFactor={13} occlude zIndexRange={[30, 0]}>
            <div className="pointer-events-none flex select-none items-center gap-1.5 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 ring-2 ring-white" />
              <span className="rounded-full border border-zinc-200 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-zinc-700 shadow-sm">
                {l.text}
              </span>
            </div>
          </Html>
        ))}
    </group>
  )
}
