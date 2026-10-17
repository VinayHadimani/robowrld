'use client'

/**
 * ServoMotor — a self-contained, reusable 3D replica of a real-world hobby
 * servo motor (SG90 / MG996R class), modeled entirely from procedural
 * Three.js geometry (no external model files).
 *
 * Anatomy replicated from the real part:
 *  - Injection-molded case with chamfered edges and a bottom cap
 *  - Round top boss with a splined brass output shaft (the shaft rotates)
 *  - Horn / output arm mounted on the shaft, secured by a center screw
 *  - Twin mounting tabs with two M3 mounting holes each
 *  - Rear grommet, 3-wire lead (brown / red / orange) and 3-pin connector
 *
 * Reusability:
 *  <ServoMotor angle={90} speed={400} hornType="single" interactive />
 *
 * The horn always rotates toward the commanded `angle` at `speed` degrees per
 * second — just like a real servo tracking a PWM command — so it animates
 * smoothly even when the prop jumps.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { RoundedBox, Html } from '@react-three/drei'
import { SERVO_PORTS, type Port } from '@/lib/connections'

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export type HornType = 'single' | 'double' | 'round'

export interface ServoMotorProps {
  /** Commanded angle in degrees (0–180). The horn moves toward it at `speed`. */
  angle?: number
  /** Maximum travel speed in degrees/second (a real MG996R does ~350 °/s). */
  speed?: number
  /** Case + boss color (CSS color string). */
  bodyColor?: string
  /** Horn (arm) color. */
  hornColor?: string
  /** Horn style: "single" arm, "double" arm or "round" disc. */
  hornType?: HornType
  /** Render the horn on the output shaft. */
  showHorn?: boolean
  /** Render the 3-wire cable and connector. */
  showCable?: boolean
  /** Render floating part labels. */
  showLabels?: boolean
  /** Render the connection-port markers + range arc (assembly view). */
  showPorts?: boolean
  /** Allow grabbing the horn/shaft and dragging it to steer the servo. */
  interactive?: boolean
  /** Radius of the invisible grab volume around the shaft (for rigs with a crank). */
  grabRadius?: number
  /** Height of the grab volume's center (for rigged cranks). */
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
/* Default palette (matches a classic hobby servo)                     */
/* ------------------------------------------------------------------ */

const DEFAULT_BODY = '#1c56b2'
const DEFAULT_HORN = '#efe8d8'

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

/**
 * Extrude a shape lying flat in the XZ plane (thickness along +Y),
 * with a tiny bevel for an injection-molded look.
 */
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

/** Smooth tube along a Catmull-Rom curve — used for the cable. */
function cableTube(points: Array<[number, number, number]>, radius: number, segments = 56): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
  return new THREE.TubeGeometry(curve, segments, radius, 10, false)
}

/* ------------------------------------------------------------------ */
/* Static part data                                                    */
/* ------------------------------------------------------------------ */

const PART_LABELS: Array<{ position: [number, number, number]; text: string }> = [
  { position: [1.95, 5.42, 0.35], text: 'Horn (output arm)' },
  { position: [0.72, 4.82, 0.38], text: 'Splined output shaft' },
  { position: [3.42, 2.98, 0.42], text: 'Mounting tab · M3 holes' },
  { position: [1.62, 2.32, 1.32], text: 'Case (nylon)' },
  { position: [-4.55, 1.62, 0.42], text: '3-wire lead' },
  { position: [-7.85, 0.42, 0.62], text: '3-pin connector' },
]

const TOP_SCREWS: Array<[number, number]> = [
  [-1.72, 0.92],
  [-1.72, -0.92],
]

const BOTTOM_SCREWS: Array<[number, number]> = [
  [1.85, 0.72],
  [1.85, -0.72],
  [-1.85, 0.72],
  [-1.85, -0.72],
]

const CONNECTOR_PINS: number[] = [-0.28, 0, 0.28]

/* ------------------------------------------------------------------ */
/* Port markers (rendered from the connection contract data)          */
/* ------------------------------------------------------------------ */

const PORT_RING_R: Record<Port['kind'], number> = {
  'bolt-hole': 0.32,
  'spline-shaft': 0.62,
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
            {/* Ring aligned with the port axis */}
            <mesh rotation={flat ? [-Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]}>
              <torusGeometry args={[ringR, 0.045, 10, 40]} />
              <meshBasicMaterial color="#f59e0b" toneMapped={false} />
            </mesh>
            {/* Center dot */}
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
      <group position={[0, 4.62, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.6, 0.028, 8, 72, Math.PI]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.75} toneMapped={false} />
        </mesh>
        {[0, 90, 180].map((deg) => (
          <mesh
            key={deg}
            position={[3.6 * Math.cos((deg * Math.PI) / 180), 0, 3.6 * Math.sin((deg * Math.PI) / 180)]}
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
  grabY = 5.32,
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
    // Mounting tab: rounded bar with two M3 clearance holes
    const tab = roundedRectShape(1.34, 2.5, 0.32)
    tab.holes.push(circleHole(-0.3, 0, 0.27), circleHole(0.3, 0, 0.27))

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

    return {
      tab: extrudeFlat(tab, 0.24),
      arm: extrudeFlat(arm, 0.26),
      disc: extrudeFlat(disc, 0.22),
      sheath: cableTube(
        [
          [-2.45, 1.6, 0],
          [-3.2, 1.55, 0],
          [-4.2, 1.15, 0],
          [-5.0, 0.5, 0],
          [-5.45, 0.12, 0],
        ],
        0.33
      ),
      wireBrown: cableTube(
        [
          [-5.45, 0.12, -0.04],
          [-5.9, -0.14, -0.2],
          [-6.4, -0.34, -0.28],
          [-7.32, -0.34, -0.28],
        ],
        0.15
      ),
      wireRed: cableTube(
        [
          [-5.45, 0.12, 0],
          [-5.95, -0.12, 0],
          [-6.5, -0.34, 0],
          [-7.42, -0.34, 0],
        ],
        0.15
      ),
      wireOrange: cableTube(
        [
          [-5.45, 0.12, 0.04],
          [-5.9, -0.14, 0.2],
          [-6.4, -0.34, 0.28],
          [-7.32, -0.34, 0.28],
        ],
        0.15
      ),
    }
  }, [])

  /* ---------------- materials (shared instances) -------------------- */

  const mats = useMemo(() => {
    return {
      body: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(DEFAULT_BODY),
        roughness: 0.38,
        metalness: 0.05,
        clearcoat: 0.55,
        clearcoatRoughness: 0.35,
      }),
      trim: new THREE.MeshStandardMaterial({ color: '#26272c', roughness: 0.55, metalness: 0.15 }),
      horn: new THREE.MeshStandardMaterial({ color: new THREE.Color(DEFAULT_HORN), roughness: 0.4, metalness: 0.02 }),
      brass: new THREE.MeshStandardMaterial({
        color: '#d0a84f',
        metalness: 0.95,
        roughness: 0.3,
        flatShading: true, // faceted cylinder reads as a splined shaft
      }),
      steel: new THREE.MeshStandardMaterial({ color: '#cfd4dc', metalness: 0.9, roughness: 0.35 }),
      pin: new THREE.MeshStandardMaterial({ color: '#e0b45c', metalness: 1, roughness: 0.25 }),
      sheath: new THREE.MeshStandardMaterial({ color: '#202228', roughness: 0.7, metalness: 0.05 }),
      brown: new THREE.MeshStandardMaterial({ color: '#5d3a21', roughness: 0.65 }),
      red: new THREE.MeshStandardMaterial({ color: '#c33131', roughness: 0.65 }),
      orange: new THREE.MeshStandardMaterial({ color: '#f0801e', roughness: 0.65 }),
      label: new THREE.MeshStandardMaterial({ color: '#f4f1e8', roughness: 0.5 }),
      ink: new THREE.MeshStandardMaterial({ color: '#23262c', roughness: 0.6 }),
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
    const shaftWorld = root.current.localToWorld(new THREE.Vector3(0, 5.0, 0))
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

      // Freeze orbit controls while steering the horn
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
        // Wrap the delta to (-π, π] so crossing the ±180° seam stays smooth
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

  return (
    <group ref={root} position={position} rotation={rotation} scale={scale}>
      {/* Case + bottom cap */}
      <RoundedBox args={[4.8, 3.56, 2.5]} radius={0.14} smoothness={4} position={[0, 2.12, 0]} castShadow receiveShadow material={mats.body} />
      <RoundedBox args={[4.55, 0.34, 2.3]} radius={0.1} smoothness={4} position={[0, 0.17, 0]} castShadow receiveShadow material={mats.trim} />

      {/* Bottom mounting screws */}
      {BOTTOM_SCREWS.map(([x, z]) => (
        <mesh key={`bs-${x}-${z}`} position={[x, 0.06, z]} castShadow material={mats.steel}>
          <cylinderGeometry args={[0.22, 0.22, 0.14, 20]} />
        </mesh>
      ))}

      {/* Top boss (chamfered) + shaft well */}
      <mesh position={[0, 4.16, 0]} castShadow receiveShadow material={mats.body}>
        <cylinderGeometry args={[1.25, 1.25, 0.52, 48]} />
      </mesh>
      <mesh position={[0, 4.46, 0]} castShadow material={mats.body}>
        <cylinderGeometry args={[1.16, 1.25, 0.1, 48]} />
      </mesh>
      <mesh position={[0, 4.525, 0]} material={mats.trim}>
        <cylinderGeometry args={[0.52, 0.52, 0.035, 32]} />
      </mesh>

      {/* Rear case screws (top face) */}
      {TOP_SCREWS.map(([x, z]) => (
        <group key={`ts-${x}-${z}`} position={[x, 3.93, z]}>
          <mesh castShadow material={mats.steel}>
            <cylinderGeometry args={[0.17, 0.17, 0.1, 24]} />
          </mesh>
          <mesh position={[0, 0.051, 0]} material={mats.trim}>
            <boxGeometry args={[0.26, 0.03, 0.07]} />
          </mesh>
        </group>
      ))}

      {/* Mounting tabs with M3 holes + support gussets */}
      <mesh geometry={geo.tab} position={[2.82, 2.63, 0]} castShadow receiveShadow material={mats.body} />
      <mesh geometry={geo.tab} position={[-2.82, 2.63, 0]} rotation-y={Math.PI} castShadow receiveShadow material={mats.body} />
      <mesh position={[2.38, 2.28, 0]} rotation-z={-0.55} castShadow material={mats.body}>
        <boxGeometry args={[0.55, 1.05, 1.85]} />
      </mesh>
      <mesh position={[-2.38, 2.28, 0]} rotation-z={0.55} castShadow material={mats.body}>
        <boxGeometry args={[0.55, 1.05, 1.85]} />
      </mesh>

      {/* Side label plate */}
      <RoundedBox args={[2.7, 1.5, 0.06]} radius={0.04} smoothness={3} position={[0.35, 2.25, 1.27]} material={mats.label} />
      <mesh position={[0.42, 2.62, 1.31]} material={mats.ink}>
        <boxGeometry args={[1.85, 0.16, 0.03]} />
      </mesh>
      <mesh position={[0.42, 2.32, 1.31]} material={mats.ink}>
        <boxGeometry args={[1.5, 0.1, 0.03]} />
      </mesh>
      <mesh position={[0.42, 2.02, 1.31]} material={mats.ink}>
        <boxGeometry args={[1.65, 0.1, 0.03]} />
      </mesh>

      {/* Rear cable grommet */}
      <RoundedBox args={[0.55, 1.05, 0.85]} radius={0.12} smoothness={3} position={[-2.42, 1.6, 0]} castShadow material={mats.trim} />

      {/* -------- rotating output: shaft + horn + screw -------- */}
      <group ref={rotor} onPointerDown={beginDrag} onPointerOver={onRotorOver} onPointerOut={onRotorOut}>
        {/* Splined brass shaft */}
        <mesh position={[0, 4.84, 0]} castShadow material={mats.brass}>
          <cylinderGeometry args={[0.36, 0.36, 0.68, 14]} />
        </mesh>
        <mesh position={[0, 4.56, 0]} castShadow material={mats.steel}>
          <cylinderGeometry args={[0.42, 0.42, 0.1, 24]} />
        </mesh>

        {showHorn && (
          <group position={[0, 5.18, 0]}>
            {/* Hub */}
            <mesh position={[0, 0.15, 0]} castShadow material={mats.horn}>
              <cylinderGeometry args={[0.62, 0.62, 0.3, 32]} />
            </mesh>

            {hornType === 'single' && <mesh geometry={geo.arm} castShadow material={mats.horn} />}
            {hornType === 'double' && (
              <>
                <mesh geometry={geo.arm} castShadow material={mats.horn} />
                <mesh geometry={geo.arm} rotation-y={Math.PI} castShadow material={mats.horn} />
              </>
            )}
            {hornType === 'round' && <mesh geometry={geo.disc} castShadow material={mats.horn} />}

            {/* Center retaining screw */}
            <mesh position={[0, 0.34, 0]} castShadow material={mats.steel}>
              <cylinderGeometry args={[0.2, 0.2, 0.09, 20]} />
            </mesh>
            <mesh position={[0, 0.388, 0]} material={mats.trim}>
              <boxGeometry args={[0.3, 0.03, 0.07]} />
            </mesh>
          </group>
        )}

        {/* Invisible grab volume so the horn is easy to grab */}
        {interactive && (
          <mesh position={[0, grabY, 0]} material={mats.grab}>
            <cylinderGeometry args={[grabRadius, grabRadius, 0.5, 24]} />
          </mesh>
        )}
      </group>

      {/* -------- cable assembly -------- */}
      {showCable && (
        <group>
          <mesh geometry={geo.sheath} castShadow receiveShadow material={mats.sheath} />
          <mesh geometry={geo.wireBrown} castShadow receiveShadow material={mats.brown} />
          <mesh geometry={geo.wireRed} castShadow receiveShadow material={mats.red} />
          <mesh geometry={geo.wireOrange} castShadow receiveShadow material={mats.orange} />

          {/* 3-pin connector */}
          <RoundedBox args={[0.85, 0.52, 1.15]} radius={0.08} smoothness={3} position={[-7.82, -0.24, 0]} castShadow material={mats.trim} />
          {CONNECTOR_PINS.map((z) => (
            <mesh key={`pin-${z}`} position={[-8.38, -0.24, z]} rotation-z={Math.PI / 2} castShadow material={mats.pin}>
              <cylinderGeometry args={[0.085, 0.085, 0.45, 12]} />
            </mesh>
          ))}
        </group>
      )}

      {/* -------- connection ports + DOF range (assembly view) -------- */}
      {showPorts && <PortMarkers />}

      {/* -------- floating part labels -------- */}
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
