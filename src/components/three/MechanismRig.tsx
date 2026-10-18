'use client'

/**
 * MechanismRig — the proof that components connect into working mechanisms.
 *
 * A crank-rocker linkage, assembled entirely from port connections:
 *
 *   servo.mount-r1 / mount-l1  ──M3 bolts──▶  chassis deck (pocket mount)
 *   servo.shaft                ──25T spline▶  crank hub
 *   crank pin                  ──ball rod──▶  rocker pin (pivot post)
 *   rocker effector plate      ──2× M3──▶    (free port: attach the next part)
 *
 * The rig never re-implements the servo's motion. It reads the TRUE shaft
 * angle streamed through `liveAngleRef` (published by ServoMotor every frame,
 * speed-limited like the real actuator) and solves the four-bar kinematics:
 *
 *   crank pin  P = R_a · (cos θ, sin θ)          (θ = live servo angle)
 *   rocker pin Q = O_B + R_q · e(ψ)              (|P − Q| = L, constant)
 *
 * The rocker branch is chosen by continuity, so the linkage never flips as
 * the servo sweeps 0° ↔ 180°.
 */

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, Html } from '@react-three/drei'
import { roundedRectShape, circleHole, extrudeFlat } from './ServoMotor'

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface RigTelemetry {
  /** Live crank angle (the servo's true, speed-limited angle). */
  crank: number
  /** Rocker arm angle in degrees, normalized to (−180, 180]. */
  rocker: number
  /** Connecting rod heading in degrees. */
  rod: number
  /** Effector plate position in world XZ. */
  effX: number
  effZ: number
}

export interface MechanismRigProps {
  /** Streamed from ServoMotor — the servo's true shaft angle. */
  liveAngleRef: { current: number }
  /** Optional telemetry sink, written every frame (zero re-renders). */
  telemetryRef?: { current: RigTelemetry }
  showLabels?: boolean
}

/* ------------------------------------------------------------------ */
/* Layout — every number traces back to a port position               */
/* ------------------------------------------------------------------ */

const DECK = {
  x0: -5.4,
  x1: 6.6,
  z0: -2.6,
  z1: 7.6,
  top: 2.51, // flush with the servo's mounting-tab underside (y 2.51)
  thick: 0.35,
}

/** Rocker pivot post — flange-bolted to the deck. */
const POST = { x: -0.4, z: 6.4 }

const R_CRANK_PIN = 1.4 // crank pin radius from the servo shaft
const R_ROCKER_PIN = 2.0 // rocker pin radius from the post
const ROD_LEN = 6.4 // connecting-rod length (constant)
const ROCKER_ARM = 5.2 // pivot → effector plate

const LINK_Y = 5.35 // crank / rocker hub plane (on the servo's shaft port)
const ROD_Y = 6.0 // rod rides on standoff bosses above the bars

/** Tab-bolt positions — the servo's outer mount holes (SERVO_PORTS r1/l1). */
const TAB_BOLTS: Array<[number, number]> = [
  [3.12, 0],
  [-3.12, 0],
]

const LEG_BOLTS: Array<[number, number]> = [
  [-5.17, 1.9],
  [-5.17, 3.1],
  [6.37, 1.9],
  [6.37, 3.1],
]

const FLANGE_BOLTS: Array<[number, number]> = [
  [POST.x - 0.6, POST.z],
  [POST.x + 0.6, POST.z],
]

const RIG_LABELS: Array<{ position: [number, number, number]; text: string }> = [
  { position: [4.6, 3.15, 5.4], text: 'Chassis deck — servo pocket + M3 pattern' },
  { position: [3.12, 3.6, 0.75], text: 'M3 bolt × mount-R1 / L1' },
  { position: [1.35, 6.45, 0.85], text: 'Crank — on shaft port (25T)' },
  { position: [-0.85, 6.95, 3.5], text: 'Connecting rod — ball ends' },
  { position: [-2.5, 6.95, 6.4], text: 'Rocker — pivot post' },
]

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function MechanismRig({ liveAngleRef, telemetryRef, showLabels = false }: MechanismRigProps) {
  const crank = useRef<THREE.Group>(null!)
  const rocker = useRef<THREE.Group>(null!)
  const rod = useRef<THREE.Group>(null!)

  // Rocker branch memory (continuity — prevents linkage flip-flops)
  const prevPsi = useRef(Math.PI - 0.55) // ≈ 148.7°, the assembled branch

  /* ---------------- geometry (built once, disposed on unmount) ------- */

  const geo = useMemo(() => {
    // Deck: rounded plate with a servo pocket, tab-bolt holes,
    // leg-bolt holes and post-flange holes.
    // Shape-space maps to the XZ plane: shape (x, y) → world (x, ·, −y).
    const cx = (DECK.x0 + DECK.x1) / 2
    const cz = (DECK.z0 + DECK.z1) / 2
    const w = DECK.x1 - DECK.x0
    const d = DECK.z1 - DECK.z0
    const deck = roundedRectShape(w, d, 0.45, cx, -cz)

    // Servo body pocket (body is 4.8 × 2.5, + clearance)
    deck.holes.push(roundedRectShape(5.0, 2.7, 0.28))

    // Tab-bolt holes at the servo's outer mount-port positions
    TAB_BOLTS.forEach(([x, z]) => deck.holes.push(circleHole(x, -z, 0.28)))
    // Leg bolts
    LEG_BOLTS.forEach(([x, z]) => deck.holes.push(circleHole(x, -z, 0.26)))
    // Post flange bolts
    FLANGE_BOLTS.forEach(([x, z]) => deck.holes.push(circleHole(x, -z, 0.24)))

    // Crank bar: hub → 3.9, with the rod-pin hole at 1.4
    const crankBar = roundedRectShape(3.6, 0.68, 0.3, 2.1, 0)
    crankBar.holes.push(circleHole(1.4, 0, 0.17), circleHole(2.35, 0, 0.13), circleHole(3.2, 0, 0.13))

    // Rocker bar: pin end at −2.0, effector end at +5.2
    const rockerBar = roundedRectShape(7.2, 0.68, 0.3, 1.6, 0)
    rockerBar.holes.push(
      circleHole(-1.95, 0, 0.17),
      circleHole(0.9, 0, 0.13),
      circleHole(2.3, 0, 0.13),
      circleHole(3.7, 0, 0.13)
    )

    return {
      deck: extrudeFlat(deck, DECK.thick),
      crankBar: extrudeFlat(crankBar, 0.3),
      rockerBar: extrudeFlat(rockerBar, 0.3),
    }
  }, [])

  const mats = useMemo(
    () => ({
      alu: new THREE.MeshStandardMaterial({ color: '#b9bec6', metalness: 0.85, roughness: 0.34 }),
      aluDark: new THREE.MeshStandardMaterial({ color: '#8f959e', metalness: 0.8, roughness: 0.42 }),
      nylon: new THREE.MeshStandardMaterial({ color: '#2a2c33', roughness: 0.6, metalness: 0.15 }),
      steel: new THREE.MeshStandardMaterial({ color: '#cfd4dc', metalness: 0.92, roughness: 0.3 }),
      amber: new THREE.MeshStandardMaterial({ color: '#b45309', metalness: 0.65, roughness: 0.38 }),
      dark: new THREE.MeshStandardMaterial({ color: '#1b1d22', roughness: 0.55, metalness: 0.2 }),
    }),
    []
  )

  const rodMats = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: '#a6adb8', metalness: 0.88, roughness: 0.3 }),
      ball: new THREE.MeshStandardMaterial({ color: '#5a5f68', metalness: 0.7, roughness: 0.35 }),
    }),
    []
  )

  // Dispose everything on unmount
  useEffect(() => {
    return () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(mats).forEach((m) => m.dispose())
      Object.values(rodMats).forEach((m) => m.dispose())
    }
  }, [geo, mats, rodMats])

  /* ---------------- four-bar kinematics ------------------------------ */

  useFrame(() => {
    const theta = THREE.MathUtils.degToRad(liveAngleRef.current)

    // Crank pin position (XZ plane)
    const px = R_CRANK_PIN * Math.cos(theta)
    const pz = R_CRANK_PIN * Math.sin(theta)

    // Solve the rocker angle ψ: |P − (O_B + R_q·e(ψ))| = L
    const wx = px - POST.x
    const wz = pz - POST.z
    const wd = Math.hypot(wx, wz)
    if (wd > 1e-6) {
      const c = (R_ROCKER_PIN * R_ROCKER_PIN + wd * wd - ROD_LEN * ROD_LEN) / (2 * R_ROCKER_PIN * wd)
      if (c >= -1 && c <= 1) {
        const base = Math.atan2(wz, wx)
        const a = Math.acos(c)
        const s1 = base + a
        const s2 = base - a
        const norm = (v: number) => Math.atan2(Math.sin(v), Math.cos(v))
        prevPsi.current =
          Math.abs(norm(s1 - prevPsi.current)) <= Math.abs(norm(s2 - prevPsi.current)) ? s1 : s2
      }
    }
    const psiPin = prevPsi.current

    // Rocker pin position
    const qx = POST.x + R_ROCKER_PIN * Math.cos(psiPin)
    const qz = POST.z + R_ROCKER_PIN * Math.sin(psiPin)

    // Drive the meshes (same rotation convention as the servo's rotor)
    if (crank.current) crank.current.rotation.y = -theta
    if (rocker.current) rocker.current.rotation.y = -(psiPin + Math.PI)
    if (rod.current) {
      rod.current.position.set((px + qx) / 2, ROD_Y, (pz + qz) / 2)
      rod.current.rotation.y = -Math.atan2(qz - pz, qx - px)
      rod.current.scale.x = ROD_LEN
    }

    // Telemetry sink
    if (telemetryRef) {
      const psiJaw = psiPin + Math.PI
      telemetryRef.current = {
        crank: liveAngleRef.current,
        rocker: THREE.MathUtils.radToDeg(
          THREE.MathUtils.euclideanModulo(psiJaw + Math.PI, Math.PI * 2) - Math.PI
        ),
        rod: THREE.MathUtils.radToDeg(Math.atan2(qz - pz, qx - px)),
        effX: POST.x + ROCKER_ARM * Math.cos(psiJaw),
        effZ: POST.z + ROCKER_ARM * Math.sin(psiJaw),
      }
    }
  })

  /* ---------------- render ------------------------------------------ */

  return (
    <group>
      {/* ======== chassis deck (pocket-mounted over the servo) ======== */}
      <mesh
        geometry={geo.deck}
        position={[0, DECK.top - DECK.thick, 0]}
        castShadow
        receiveShadow
        material={mats.alu}
      />

      {/* Deck edge trim for a machined look */}
      <RoundedBox
        args={[0.5, 0.42, 2.6]}
        radius={0.08}
        smoothness={3}
        position={[6.35, DECK.top - 0.21, 2.5]}
        castShadow
        receiveShadow
        material={mats.aluDark}
      />

      {/* ======== support legs (deck stands on the bench) ======== */}
      {[-5.17, 6.37].map((x) => (
        <RoundedBox
          key={`leg-${x}`}
          args={[0.5, DECK.top - DECK.thick, 2.3]}
          radius={0.07}
          smoothness={3}
          position={[x, (DECK.top - DECK.thick) / 2, 2.5]}
          castShadow
          receiveShadow
          material={mats.nylon}
        />
      ))}

      {/* ======== tab bolts: servo mount ports → deck ======== */}
      {TAB_BOLTS.map(([x, z]) => (
        <group key={`tabbolt-${x}`} position={[x, 0, z]}>
          {/* hex head on the tab */}
          <mesh position={[0, 2.89, 0]} rotation-y={Math.PI / 6} castShadow material={mats.steel}>
            <cylinderGeometry args={[0.32, 0.32, 0.28, 6]} />
          </mesh>
          {/* shank through tab + deck */}
          <mesh position={[0, 2.42, 0]} castShadow material={mats.steel}>
            <cylinderGeometry args={[0.22, 0.22, 1.0, 14]} />
          </mesh>
          {/* nyloc nut under the deck */}
          <mesh position={[0, 2.02, 0]} rotation-y={Math.PI / 6} castShadow material={mats.steel}>
            <cylinderGeometry args={[0.3, 0.3, 0.24, 6]} />
          </mesh>
        </group>
      ))}

      {/* ======== deck leg bolts ======== */}
      {LEG_BOLTS.map(([x, z]) => (
        <group key={`legbolt-${x}-${z}`} position={[x, 0, z]}>
          <mesh position={[0, 2.63, 0]} rotation-y={Math.PI / 6} castShadow material={mats.steel}>
            <cylinderGeometry args={[0.24, 0.24, 0.2, 6]} />
          </mesh>
          <mesh position={[0, 2.36, 0]} material={mats.steel}>
            <cylinderGeometry args={[0.17, 0.17, 0.36, 12]} />
          </mesh>
        </group>
      ))}

      {/* ======== rocker pivot post ======== */}
      <group position={[POST.x, 0, POST.z]}>
        {/* flange */}
        <RoundedBox args={[1.9, 0.28, 1.9]} radius={0.1} smoothness={3} position={[0, 2.65, 0]} castShadow receiveShadow material={mats.alu} />
        {FLANGE_BOLTS.map(([x, z]) => (
          <group key={`flbolt-${x}`} position={[x - POST.x, 0, z - POST.z]}>
            <mesh position={[0, 2.9, 0]} rotation-y={Math.PI / 6} castShadow material={mats.steel}>
              <cylinderGeometry args={[0.2, 0.2, 0.18, 6]} />
            </mesh>
            <mesh position={[0, 2.6, 0]} material={mats.steel}>
              <cylinderGeometry args={[0.15, 0.15, 0.5, 12]} />
            </mesh>
          </group>
        ))}
        {/* column */}
        <mesh position={[0, (2.79 + 4.98) / 2, 0]} castShadow receiveShadow material={mats.alu}>
          <cylinderGeometry args={[0.45, 0.45, 4.98 - 2.79, 28]} />
        </mesh>
        {/* bearing shoulder + cap screw above the rocker */}
        <mesh position={[0, 5.8, 0]} castShadow material={mats.aluDark}>
          <cylinderGeometry args={[0.5, 0.5, 0.34, 24]} />
        </mesh>
        <mesh position={[0, 6.02, 0]} castShadow material={mats.steel}>
          <cylinderGeometry args={[0.2, 0.2, 0.12, 6]} />
        </mesh>
      </group>

      {/* ======== crank (bolted to the servo's shaft port) ======== */}
      <group ref={crank} position={[0, LINK_Y, 0]}>
        {/* hub on the spline */}
        <mesh position={[0, -0.15, 0]} castShadow material={mats.alu}>
          <cylinderGeometry args={[0.72, 0.78, 0.44, 28]} />
        </mesh>
        {/* center retaining screw */}
        <mesh position={[0, 0.22, 0]} rotation-y={Math.PI / 6} castShadow material={mats.steel}>
          <cylinderGeometry args={[0.2, 0.2, 0.12, 6]} />
        </mesh>
        {/* arm */}
        <mesh geometry={geo.crankBar} castShadow receiveShadow material={mats.alu} />
        {/* rod-pin standoff boss */}
        <mesh position={[R_CRANK_PIN, 0.62, 0]} castShadow material={mats.steel}>
          <cylinderGeometry args={[0.27, 0.27, 0.62, 18]} />
        </mesh>

        {showLabels && (
          <Html position={[2.6, 1.35, 0]} center distanceFactor={13} occlude zIndexRange={[30, 0]}>
            <div className="pointer-events-none flex select-none items-center gap-1.5 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 ring-2 ring-white" />
              <span className="rounded-full border border-zinc-200 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-zinc-700 shadow-sm">
                Crank arm
              </span>
            </div>
          </Html>
        )}
      </group>

      {/* ======== rocker (pivot on the post) ======== */}
      <group ref={rocker} position={[POST.x, LINK_Y, POST.z]}>
        {/* hub around the column */}
        <mesh position={[0, -0.15, 0]} castShadow material={mats.alu}>
          <cylinderGeometry args={[0.72, 0.78, 0.44, 28]} />
        </mesh>
        {/* arm: pin end (−2.0) → effector end (+5.2) */}
        <mesh geometry={geo.rockerBar} castShadow receiveShadow material={mats.alu} />
        {/* rod-pin standoff boss at the pin end */}
        <mesh position={[-R_ROCKER_PIN, 0.62, 0]} castShadow material={mats.steel}>
          <cylinderGeometry args={[0.27, 0.27, 0.62, 18]} />
        </mesh>

        {/* effector plate — the rig's free output port (2× M3) */}
        <group position={[ROCKER_ARM, 0.42, 0]}>
          <RoundedBox args={[0.24, 1.55, 1.35]} radius={0.07} smoothness={3} castShadow material={mats.amber} />
          {[-0.42, 0.42].map((z) => (
            <mesh key={`effhole-${z}`} position={[0.13, 0, z]} rotation-z={Math.PI / 2} material={mats.dark}>
              <cylinderGeometry args={[0.14, 0.14, 0.3, 14]} />
            </mesh>
          ))}
          {/* stiffener gussets */}
          <mesh position={[-0.18, -0.72, 0]} rotation-z={0.5} castShadow material={mats.aluDark}>
            <boxGeometry args={[0.5, 0.16, 1.0]} />
          </mesh>
        </group>

        {showLabels && (
          <Html position={[ROCKER_ARM, 1.75, 0]} center distanceFactor={13} occlude zIndexRange={[30, 0]}>
            <div className="pointer-events-none flex select-none items-center gap-1.5 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 ring-2 ring-white" />
              <span className="rounded-full border border-amber-300 bg-amber-50/95 px-2.5 py-1 font-mono text-[11px] font-semibold text-amber-800 shadow-sm">
                Effector mount · 2× M3 free
              </span>
            </div>
          </Html>
        )}
      </group>

      {/* ======== connecting rod (ball ends, constant length) ======== */}
      <group ref={rod} position={[0, ROD_Y, 0]}>
        {/* shaft (unit length, scaled to ROD_LEN every frame) */}
        <mesh castShadow material={rodMats.body}>
          <boxGeometry args={[1, 0.24, 0.24]} />
        </mesh>
        {/* ball rod-ends */}
        <mesh position={[-ROD_LEN / 2 + 0.1, 0, 0]} castShadow material={rodMats.ball}>
          <sphereGeometry args={[0.3, 20, 20]} />
        </mesh>
        <mesh position={[ROD_LEN / 2 - 0.1, 0, 0]} castShadow material={rodMats.ball}>
          <sphereGeometry args={[0.3, 20, 20]} />
        </mesh>
      </group>

      {/* ======== static part labels ======== */}
      {showLabels &&
        RIG_LABELS.map((l) => (
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
