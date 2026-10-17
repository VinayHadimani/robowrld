'use client'

/**
 * PlaygroundStage — the 3D canvas where placed components live.
 *
 * Interaction model:
 *   - pointer-down on a component → grab it (orbit controls freeze); its
 *     whole connected group comes along — wired things move together
 *   - move → the group slides along the ground plane (imperative, no
 *     re-renders); the nearest foreign component in reach gets a pulsing
 *     ring: green when the pair may REALLY connect, red when it may not
 *   - release near a CONNECTABLE neighbour → the piece slides into the
 *     connected spot as a preview and the app ASKS FOR PERMISSION; only a
 *     "Connect" answer wires them together
 *   - release near a NON-connectable pair (e.g. a servo onto a 9V
 *     battery — 9 V is outside its 4.8–7.2 V range) → nothing happens;
 *     they simply can't be connected, like real life
 *   - a click without movement → select (ring + panel)
 *   - Run → only components with a valid wire path to a power source
 *     animate; everything else stays still. Battery and board LEDs light
 *     while they are actually powering something.
 *
 * Wiring is drawn BETWEEN REAL PORTS: each connection renders a cable
 * from the provider's port (the battery's brass +/− snap terminals, the
 * controller's 5 V header) to the consumer's port (a motor's leads, a
 * servo's signal cable, the board's VIN jack). Power splices are a red +
 * black pair (red always on +); servo-style links are a 3-wire ribbon.
 * When one battery feeds several components, their wire pairs fan out
 * side by side from the same two terminals — like stacked spade lugs.
 *
 * Positions are applied ONCE on mount (never via the `position` prop) so a
 * re-render mid-drag can never snap a component back to a stale spot.
 */

import * as React from 'react'
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import {
  ContactShadows,
  Environment,
  Grid,
  Lightformer,
  OrbitControls,
} from '@react-three/drei'
import { ServoMotor } from '@/components/three/ServoMotor'
import { GltfModel } from '@/components/three/GltfModel'
import { Battery9V, BATTERY_TERMINALS } from '@/components/three/Battery9V'
import { ArduinoUno, ARDUINO_ANCHORS } from '@/components/three/ArduinoUno'
import {
  ELEC_PORTS,
  batteriesWithLoad,
  connectBetween,
  footprintFor,
  getPort,
  groupMembers,
  sweepFor,
  subtreeIds,
  type Attach,
  type Move,
  type PlayInstance,
} from '@/lib/playground'

const BOUND = 15
/** How far apart two components may be dropped to still snap together. */
const SNAP_REACH = 1.35
/** The visual gap kept between snapped-together components. */
const SNAP_GAP = 0.55
/** How far a DECLINED component is pushed back out of the preview spot. */
const DECLINE_GAP = 1.2
/** Lateral spacing between wire pairs sharing one battery terminal. */
const TERMINAL_SPREAD = 0.17
/** How far cables bow toward the camera side, clearing the source body. */
const BOW = 1.35

/** The live proximity state: which neighbour is in reach, may it connect, why/why not. */
export interface LiveCandidate {
  id: string
  connectable: boolean
  reason: string
}

/** Imperative bridge so the React layer can finish a declined connection. */
export interface StageActions {
  separate?: (childId: string, parentId: string) => void
}

/**
 * Wire clip points registered per instance, per electrical port:
 * `red` is the + lead anchor, `black` the − lead (ribbon ports share one).
 */
export interface PortAnchor {
  red: THREE.Object3D
  black: THREE.Object3D
}
export type AnchorMap = Map<string, Map<string, PortAnchor>>

/* ---------- helpers ---------- */

/** Uploaded models slowly turn in place while powered and running. */
function SpinGroup({ running, children }: { running: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (running && ref.current) ref.current.rotation.y += dt * 1.1
  })
  return <group ref={ref}>{children}</group>
}

/** A failed model load degrades to a placeholder box instead of a hole. */
class LoadBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) {
      return (
        <mesh position={[0, 1.05, 0]} castShadow>
          <boxGeometry args={[1.9, 1.9, 1.9]} />
          <meshStandardMaterial color="#d4a72c" roughness={0.5} metalness={0.08} />
        </mesh>
      )
    }
    return this.props.children
  }
}

/* ---------- cables between real ports ---------- */

/**
 * One cable between two anchor objects. The tube geometry is rebuilt in
 * useFrame only when an endpoint actually moved — so cables stay glued
 * to their components even during imperative (mid-drag) moves, at zero
 * React render cost. `offsetA` shifts the provider-side clip point
 * (battery terminal fan-out); ribbon wires shift perpendicular to the
 * run so the three leads sit side by side like a flat cable.
 */
function Cable({
  anchors,
  parentId,
  parentPortId,
  childId,
  childPortId,
  side,
  color,
  live,
  spread,
  lateral,
  radius,
}: {
  anchors: React.RefObject<AnchorMap>
  parentId: string
  parentPortId: string
  childId: string
  childPortId: string
  /** Which lead of each port this cable carries ('red' | 'black'). */
  side: 'red' | 'black'
  color: string
  live: boolean
  /** Provider-side lateral fan-out at a shared terminal (world X). */
  spread: number
  /** Consumer-side perpendicular offset (ribbon wires; world space). */
  lateral: number
  radius: number
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const lastA = useRef(new THREE.Vector3(1e9, 1e9, 1e9))
  const lastB = useRef(new THREE.Vector3(1e9, 1e9, 1e9))
  const tmp = useMemo(
    () => ({
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      ctrl: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      perp: new THREE.Vector3(),
    }),
    []
  )

  useFrame((state) => {
    const m = mesh.current
    if (!m) return
    const parentPort = anchors.current?.get(parentId)?.get(parentPortId)
    const childPort = anchors.current?.get(childId)?.get(childPortId)
    if (!parentPort || !childPort) {
      m.visible = false
      return
    }
    m.visible = true
    ;(side === 'red' ? parentPort.red : parentPort.black).getWorldPosition(tmp.a)
    ;(side === 'red' ? childPort.red : childPort.black).getWorldPosition(tmp.b)

    // Provider-side terminal fan-out.
    tmp.a.setX(tmp.a.x + spread)
    // Consumer-side perpendicular ribbon offset (only when nonzero).
    if (lateral !== 0) {
      tmp.dir.subVectors(tmp.b, tmp.a).setY(0)
      if (tmp.dir.lengthSq() > 1e-6) {
        tmp.perp.set(-tmp.dir.z, 0, tmp.dir.x).normalize().multiplyScalar(lateral)
        tmp.b.add(tmp.perp)
      }
    }

    if (
      tmp.a.distanceToSquared(lastA.current) < 1e-8 &&
      tmp.b.distanceToSquared(lastB.current) < 1e-8 &&
      m.geometry.type === 'TubeGeometry'
    ) {
      return
    }
    lastA.current.copy(tmp.a)
    lastB.current.copy(tmp.b)

    // The cable sags between the two clip points — and bows toward the
    // camera side, so it arcs AROUND the provider's own body instead of
    // disappearing behind it when the consumer sits around the back.
    tmp.mid.addVectors(tmp.a, tmp.b).multiplyScalar(0.5)
    const sagY = Math.max(0.32, Math.min(tmp.a.y, tmp.b.y) - 0.5)
    let bowX = 0
    let bowZ = 0
    tmp.dir.subVectors(tmp.b, tmp.a).setY(0)
    if (tmp.dir.lengthSq() > 1e-6) {
      tmp.perp.set(-tmp.dir.z, 0, tmp.dir.x).normalize()
      const camX = state.camera.position.x
      const camZ = state.camera.position.z
      const toCam = (camX - tmp.mid.x) * tmp.perp.x + (camZ - tmp.mid.z) * tmp.perp.z
      const sign = toCam >= 0 ? 1 : -1
      bowX = tmp.perp.x * sign * BOW
      bowZ = tmp.perp.z * sign * BOW
    }
    tmp.ctrl.set(tmp.mid.x + bowX, sagY, tmp.mid.z + bowZ)
    const curve = new THREE.QuadraticBezierCurve3(
      tmp.a.clone(),
      tmp.ctrl.clone(),
      tmp.b.clone()
    )
    const geom = new THREE.TubeGeometry(curve, 24, radius, 10, false)
    m.geometry.dispose()
    m.geometry = geom
  })

  return (
    <mesh ref={mesh}>
      <meshStandardMaterial
        color={color}
        roughness={0.38}
        metalness={0.12}
        emissive={live ? '#b91c1c' : '#000000'}
        emissiveIntensity={live ? (side === 'red' ? 0.85 : 0.3) : 0}
      />
    </mesh>
  )
}

/**
 * The cable(s) for one wired link, styled by the consumer's port:
 * a red + black power pair for splices, or an orange/red/brown 3-wire
 * ribbon for servo-style signal leads.
 */
function LinkWire({
  anchors,
  parentId,
  parentPortId,
  childId,
  childPortId,
  wire,
  live,
  spread,
}: {
  anchors: React.RefObject<AnchorMap>
  parentId: string
  parentPortId: string
  childId: string
  childPortId: string
  wire: 'pair' | 'ribbon3'
  live: boolean
  /** Fan-out index at the provider's terminal (multiple consumers). */
  spread: number
}) {
  if (wire === 'ribbon3') {
    return (
      <>
        <Cable anchors={anchors} parentId={parentId} parentPortId={parentPortId} childId={childId} childPortId={childPortId} side="red" color="#f97316" live={live} spread={0} lateral={-0.13} radius={0.075} />
        <Cable anchors={anchors} parentId={parentId} parentPortId={parentPortId} childId={childId} childPortId={childPortId} side="red" color="#dc2626" live={live} spread={0} lateral={0} radius={0.075} />
        <Cable anchors={anchors} parentId={parentId} parentPortId={parentPortId} childId={childId} childPortId={childPortId} side="black" color="#78350f" live={live} spread={0} lateral={0.13} radius={0.075} />
      </>
    )
  }
  return (
    <>
      <Cable anchors={anchors} parentId={parentId} parentPortId={parentPortId} childId={childId} childPortId={childPortId} side="red" color="#d92626" live={live} spread={spread} lateral={0} radius={0.11} />
      <Cable anchors={anchors} parentId={parentId} parentPortId={parentPortId} childId={childId} childPortId={childPortId} side="black" color="#23262d" live={live} spread={spread} lateral={0} radius={0.11} />
    </>
  )
}

/* ---------- proximity: "may I connect?" ---------- */

/** A nearby foreign component the dragged one could connect to. */
interface Candidate {
  id: string
  x: number
  z: number
  dist: number
  connectable: boolean
  reason: string
  outId: string
  inId: string
  outPortId: string
  inPortId: string
}

/**
 * The nearest foreign instance within snap reach of the dragged group —
 * null when nothing is close enough. `connectable` + `reason` come from
 * the REAL-LIFE port matching: one side must provide power the other
 * accepts (a 9V battery onto a servo is refused — 9 V is outside the
 * MG996R's 4.8–7.2 V range).
 */
function findCandidate(
  insts: PlayInstance[],
  groups: React.RefObject<Map<string, THREE.Group>>,
  grabbedId: string,
  members: string[],
  pos: { x: number; z: number }
): Candidate | null {
  const byId = new Map(insts.map((i) => [i.id, i]))
  const grabbedInst = byId.get(grabbedId)
  if (!grabbedInst) return null
  let nearest: { id: string; x: number; z: number; dist: number } | null = null
  for (const other of insts) {
    if (members.includes(other.id)) continue
    const g = groups.current?.get(other.id)
    if (!g) continue
    const dist = Math.hypot(g.position.x - pos.x, g.position.z - pos.z)
    if (!nearest || dist < nearest.dist) {
      nearest = { id: other.id, x: g.position.x, z: g.position.z, dist }
    }
  }
  if (!nearest) return null
  const reach = footprintFor(grabbedInst.kind) + footprintFor(byId.get(nearest.id)?.kind ?? 'gltf') + SNAP_REACH
  if (nearest.dist >= reach) return null
  const targetInst = byId.get(nearest.id)
  if (!targetInst) return null
  const match = connectBetween(grabbedInst, targetInst)
  return {
    id: nearest.id,
    x: nearest.x,
    z: nearest.z,
    dist: nearest.dist,
    connectable: match.ok,
    reason: match.reason,
    outId: match.outId,
    inId: match.inId,
    outPortId: match.outPortId,
    inPortId: match.inPortId,
  }
}

/**
 * The pulsing ring under a nearby component while something is dragged
 * toward it — green when the pair may connect, red when it may not.
 */
function PulseRing({ radius, connectable }: { radius: number; connectable: boolean }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const mesh = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const k = (Math.sin(clock.elapsedTime * 4.5) + 1) / 2
    if (mat.current) mat.current.opacity = 0.3 + 0.55 * k
    if (mesh.current) mesh.current.scale.setScalar(1 + 0.05 * k)
  })
  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} position={[0, 0.06, 0]}>
      <ringGeometry args={[radius, radius + 0.26, 64]} />
      <meshBasicMaterial
        ref={mat}
        color={connectable ? '#10b981' : '#dc2626'}
        transparent
        opacity={0.6}
        depthWrite={false}
      />
    </mesh>
  )
}

/* ---------- one placed component ---------- */

/**
 * Register the wire-clip anchors for one instance — the REAL connectors:
 * the battery's two brass snap terminals, the controller's VIN jack and
 * 5 V header, the servo's cable exit, nominal lead posts on uploads.
 */
function usePortAnchors(
  ref: React.RefObject<THREE.Group | null>,
  inst: PlayInstance,
  anchors: React.RefObject<AnchorMap>
) {
  useEffect(() => {
    const g = ref.current
    if (!g) return
    const map = new Map<string, PortAnchor>()
    const created: THREE.Object3D[] = []

    const addSingle = (portId: string, pos: [number, number, number]) => {
      const o = new THREE.Object3D()
      o.position.set(pos[0], pos[1], pos[2])
      g.add(o)
      created.push(o)
      map.set(portId, { red: o, black: o })
    }
    const addPair = (
      portId: string,
      plus: [number, number, number],
      minus: [number, number, number]
    ) => {
      const r = new THREE.Object3D()
      r.position.set(plus[0], plus[1], plus[2])
      const b = new THREE.Object3D()
      b.position.set(minus[0], minus[1], minus[2])
      g.add(r)
      g.add(b)
      created.push(r, b)
      map.set(portId, { red: r, black: b })
    }

    if (inst.kind === 'battery') {
      // The two real PP3 snap terminals on top — red goes to + (plus).
      addPair(
        'pp3',
        [BATTERY_TERMINALS.plus[0], BATTERY_TERMINALS.plus[1], 0],
        [BATTERY_TERMINALS.minus[0], BATTERY_TERMINALS.minus[1], 0]
      )
    } else if (inst.kind === 'controller') {
      // VIN jack (pair) + 5 V pin header (servo ribbon).
      addPair('vin', ARDUINO_ANCHORS.vin.plus, ARDUINO_ANCHORS.vin.minus)
      addSingle('hdr', ARDUINO_ANCHORS.header)
    } else if (inst.kind === 'servo') {
      // The cable exit grommet on the rear of the body.
      addSingle('plug', [-2.5, 1.6, 0])
    } else {
      // Uploaded models: nominal power lead posts on top.
      const y = 2.35
      addPair('leads', [0.45, y, 0], [-0.45, y, 0])
    }

    anchors.current?.set(inst.id, map)
    return () => {
      anchors.current?.delete(inst.id)
      for (const o of created) g.remove(o)
    }
  }, [inst.id, inst.kind, ref, anchors])
}

function Instance({
  inst,
  running,
  powered,
  energized,
  selected,
  candidate,
  groups,
  anchors,
  onDragStart,
}: {
  inst: PlayInstance
  running: boolean
  powered: boolean
  energized: boolean
  selected: boolean
  candidate: LiveCandidate | null
  groups: React.RefObject<Map<string, THREE.Group>>
  anchors: React.RefObject<AnchorMap>
  onDragStart: (e: ThreeEvent<PointerEvent>, id: string) => void
}) {
  const ref = useRef<THREE.Group>(null)

  useEffect(() => {
    const g = ref.current
    if (!g) return
    g.position.set(inst.x, 0, inst.z)
    groups.current?.set(inst.id, g)
    // Position is set imperatively; inst.x/z only matter at mount.
  }, [inst.id, inst.x, inst.z, groups])

  usePortAnchors(ref, inst, anchors)

  const live = running && powered
  const ringRadius = footprintFor(inst.kind)

  return (
    <group ref={ref} onPointerDown={(e) => onDragStart(e, inst.id)}>
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
          <ringGeometry args={[ringRadius, ringRadius + 0.28, 64]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.9} depthWrite={false} />
        </mesh>
      )}

      {candidate?.id === inst.id && (
        <PulseRing radius={ringRadius} connectable={candidate.connectable} />
      )}

      {inst.kind === 'servo' ? (
        <ServoMotor
          position={[0, 0.03, 0]}
          interactive
          showCable
          autoSweep={live ? sweepFor(inst.id) : false}
        />
      ) : inst.kind === 'battery' ? (
        <Battery9V position={[0, 0.03, 0]} ledOn={running && energized} />
      ) : inst.kind === 'controller' ? (
        <ArduinoUno position={[0, 0.03, 0]} ledOn={running && powered} />
      ) : inst.modelUrl ? (
        <SpinGroup running={live}>
          <Suspense fallback={null}>
            <LoadBoundary key={inst.modelUrl}>
              <GltfModel key={inst.modelUrl} url={inst.modelUrl} kind={inst.kind} />
            </LoadBoundary>
          </Suspense>
        </SpinGroup>
      ) : null}
    </group>
  )
}

/* ---------- the scene ---------- */

function Scene({
  instances,
  running,
  poweredIds,
  selectedId,
  groups,
  anchors,
  onSelect,
  onDropCommit,
  onConnectRequest,
  onCandidateChange,
  actionsRef,
}: {
  instances: PlayInstance[]
  running: boolean
  poweredIds: Set<string>
  selectedId: string | null
  groups: React.RefObject<Map<string, THREE.Group>>
  anchors: React.RefObject<AnchorMap>
  onSelect: (id: string) => void
  onDropCommit: (moves: Move[], attach: Attach | null) => void
  /** Fired when a component is dropped near a connectable one — the app
      must ASK FOR PERMISSION; nothing is wired until it answers.
      The parent is the side that PROVIDES power. */
  onConnectRequest: (
    parentId: string,
    childId: string,
    parentPortId: string,
    childPortId: string
  ) => void
  /** Live proximity feedback (the pulsing-ring target), or null. */
  onCandidateChange: (candidate: LiveCandidate | null) => void
  actionsRef: React.RefObject<StageActions>
}) {
  // Read controls through the store getter (mutating a subscribed hook
  // value directly trips react-hooks/immutability — ServoMotor does the same).
  const get = useThree((s) => s.get)
  // Latest instances for the drag/drop logic without re-binding listeners.
  const instancesRef = useRef(instances)
  useEffect(() => {
    instancesRef.current = instances
  }, [instances])

  // A battery's LED means "power is flowing" — lit only while it is
  // actually wired to something it can power.
  const loadedBatteries = useMemo(() => batteriesWithLoad(instances), [instances])

  // Per-parent fan-out indices: when one battery feeds several
  // consumers, their wire pairs attach side by side on the terminals.
  const terminalSpread = useMemo(() => {
    const byParent = new Map<string, string[]>()
    for (const inst of instances) {
      if (!inst.parentId) continue
      const list = byParent.get(inst.parentId) ?? []
      list.push(inst.id)
      byParent.set(inst.parentId, list)
    }
    const spread = new Map<string, number>()
    for (const siblings of byParent.values()) {
      siblings.forEach((childId, i) => {
        spread.set(childId, (i - (siblings.length - 1) / 2) * TERMINAL_SPREAD)
      })
    }
    return spread
  }, [instances])

  // Which neighbour is currently in reach (for the pulsing ring + hint).
  // State only for rendering; the ref keeps the last value so the drag
  // handler can compare without stale-closure surprises.
  const candidateRef = useRef<LiveCandidate | null>(null)
  const [candidate, setCandidate] = React.useState<LiveCandidate | null>(null)
  const setCandidateLive = useCallback(
    (c: LiveCandidate | null) => {
      const prev = candidateRef.current
      const same =
        (prev?.id ?? null) === (c?.id ?? null) &&
        (prev?.connectable ?? null) === (c?.connectable ?? null)
      if (same) return
      candidateRef.current = c
      setCandidate(c)
      onCandidateChange(c)
    },
    [onCandidateChange]
  )

  const drag = useRef<{
    id: string
    members: string[]
    starts: Map<string, { x: number; z: number }>
    grabbedStart: { x: number; z: number }
    offX: number
    offZ: number
    moved: number
  } | null>(null)

  const onDragStart = useCallback(
    (e: ThreeEvent<PointerEvent>, id: string) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.stopPropagation()
      const grabbed = groups.current?.get(id)
      if (!grabbed) return
      // The whole wired group travels together.
      const members = [...groupMembers(instancesRef.current, id)]
      const starts = new Map<string, { x: number; z: number }>()
      for (const memberId of members) {
        const g = groups.current?.get(memberId)
        if (g) starts.set(memberId, { x: g.position.x, z: g.position.z })
      }
      drag.current = {
        id,
        members,
        starts,
        grabbedStart: { x: grabbed.position.x, z: grabbed.position.z },
        offX: e.point.x - grabbed.position.x,
        offZ: e.point.z - grabbed.position.z,
        moved: 0,
      }
      const controls = (get().controls ?? null) as { enabled: boolean } | null
      if (controls) controls.enabled = false
    },
    [get, groups]
  )

  // Release anywhere (even outside the canvas) ends a drag cleanly —
  // committing positions and, when the piece was dropped near a
  // CONNECTABLE neighbour, asking for permission instead of attaching.
  useEffect(() => {
    const finish = () => {
      const d = drag.current
      drag.current = null
      const controls = (get().controls ?? null) as { enabled: boolean } | null
      if (controls) controls.enabled = true
      setCandidateLive(null)
      if (!d) return

      if (d.moved < 0.12) {
        onSelect(d.id)
        return
      }

      const insts = instancesRef.current
      const byId = new Map(insts.map((i) => [i.id, i]))
      const grabbedInst = byId.get(d.id)
      const grabbedGroup = groups.current?.get(d.id)
      if (!grabbedInst || !grabbedGroup) return

      // Collect the group's end positions.
      const moves: Move[] = d.members.map((memberId) => {
        const g = groups.current?.get(memberId)
        return { id: memberId, x: g?.position.x ?? 0, z: g?.position.z ?? 0 }
      })

      const cand = findCandidate(insts, groups, d.id, d.members, {
        x: grabbedGroup.position.x,
        z: grabbedGroup.position.z,
      })

      if (cand && cand.connectable) {
        const targetInst = byId.get(cand.id)
        if (targetInst) {
          // Preview: slide the grabbed piece AND everything wired below
          // it into the connected spot while the user decides. The cables
          // only appear if the answer is "Connect".
          let dx = grabbedGroup.position.x - cand.x
          let dz = grabbedGroup.position.z - cand.z
          const len = Math.hypot(dx, dz)
          if (len < 0.001) {
            dx = 1
            dz = 0
          } else {
            dx /= len
            dz /= len
          }
          const gap = footprintFor(grabbedInst.kind) + footprintFor(targetInst.kind) + SNAP_GAP
          const snappedX = THREE.MathUtils.clamp(cand.x + dx * gap, -BOUND, BOUND)
          const snappedZ = THREE.MathUtils.clamp(cand.z + dz * gap, -BOUND, BOUND)
          const deltaX = snappedX - grabbedGroup.position.x
          const deltaZ = snappedZ - grabbedGroup.position.z
          for (const memberId of subtreeIds(insts, d.id)) {
            const g = groups.current?.get(memberId)
            if (!g) continue
            g.position.x = THREE.MathUtils.clamp(g.position.x + deltaX, -BOUND, BOUND)
            g.position.z = THREE.MathUtils.clamp(g.position.z + deltaZ, -BOUND, BOUND)
            const move = moves.find((m) => m.id === memberId)
            if (move) {
              move.x = g.position.x
              move.z = g.position.z
            } else {
              moves.push({ id: memberId, x: g.position.x, z: g.position.z })
            }
          }
          onDropCommit(moves, null)
          // The parent is whichever side PROVIDES power.
          onConnectRequest(cand.outId, cand.inId, cand.outPortId, cand.inPortId)
          return
        }
      }

      // Nothing connectable nearby (or an impossible-in-real-life pair) —
      // a plain drop.
      onDropCommit(moves, null)
    }
    window.addEventListener('pointerup', finish)
    return () => window.removeEventListener('pointerup', finish)
  }, [get, groups, onDropCommit, onSelect, onConnectRequest, setCandidateLive])

  // "Don't connect" — push the declined piece (and its subtree) back out
  // of the preview spot so it clearly isn't wired to anything, then
  // commit the new positions.
  const separate = useCallback(
    (childId: string, parentId: string) => {
      const insts = instancesRef.current
      const child = insts.find((i) => i.id === childId)
      const parent = insts.find((i) => i.id === parentId)
      const childGroup = groups.current?.get(childId)
      const parentGroup = groups.current?.get(parentId)
      if (!child || !parent || !childGroup || !parentGroup) return

      let dx = childGroup.position.x - parentGroup.position.x
      let dz = childGroup.position.z - parentGroup.position.z
      const len = Math.hypot(dx, dz)
      if (len < 0.001) {
        dx = 1
        dz = 0
      } else {
        dx /= len
        dz /= len
      }
      const clearGap = footprintFor(child.kind) + footprintFor(parent.kind) + DECLINE_GAP
      const targetX = THREE.MathUtils.clamp(parentGroup.position.x + dx * clearGap, -BOUND, BOUND)
      const targetZ = THREE.MathUtils.clamp(parentGroup.position.z + dz * clearGap, -BOUND, BOUND)
      const deltaX = targetX - childGroup.position.x
      const deltaZ = targetZ - childGroup.position.z

      const moves: Move[] = []
      for (const memberId of subtreeIds(insts, childId)) {
        const g = groups.current?.get(memberId)
        if (!g) continue
        g.position.x = THREE.MathUtils.clamp(g.position.x + deltaX, -BOUND, BOUND)
        g.position.z = THREE.MathUtils.clamp(g.position.z + deltaZ, -BOUND, BOUND)
        moves.push({ id: memberId, x: g.position.x, z: g.position.z })
      }
      onDropCommit(moves, null)
    },
    [groups, onDropCommit]
  )

  // Expose the imperative actions to the React layer (decline handling).
  useEffect(() => {
    if (actionsRef.current) actionsRef.current.separate = separate
  }, [actionsRef, separate])

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d) return
    const grabbedGroup = groups.current?.get(d.id)
    if (!grabbedGroup) return
    const x = THREE.MathUtils.clamp(e.point.x - d.offX, -BOUND, BOUND)
    const z = THREE.MathUtils.clamp(e.point.z - d.offZ, -BOUND, BOUND)
    const deltaX = x - d.grabbedStart.x
    const deltaZ = z - d.grabbedStart.z
    for (const memberId of d.members) {
      const g = groups.current?.get(memberId)
      const start = d.starts.get(memberId)
      if (!g || !start) continue
      g.position.x = THREE.MathUtils.clamp(start.x + deltaX, -BOUND, BOUND)
      g.position.z = THREE.MathUtils.clamp(start.z + deltaZ, -BOUND, BOUND)
    }
    d.moved = Math.max(d.moved, Math.hypot(x - d.grabbedStart.x, z - d.grabbedStart.z))

    // Live proximity: pulse the nearest neighbour when it's in reach.
    const cand = findCandidate(instancesRef.current, groups, d.id, d.members, {
      x: grabbedGroup.position.x,
      z: grabbedGroup.position.z,
    })
    setCandidateLive(
      cand ? { id: cand.id, connectable: cand.connectable, reason: cand.reason } : null
    )
  }

  return (
    <>
      <ambientLight intensity={0.42} />
      <directionalLight
        position={[5, 9, 6]}
        intensity={2.3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-7, 4, -6]} intensity={0.55} />

      <Environment resolution={256} frames={1} environmentIntensity={0.62}>
        <Lightformer form="rect" intensity={3} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[9, 9, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.8} position={[6, 3, 4]} rotation-y={-Math.PI / 3} scale={[6, 3, 1]} color="#fff2df" />
        <Lightformer form="rect" intensity={1.8} position={[-6, 2, -3]} rotation-y={Math.PI / 2.5} scale={[5, 3, 1]} color="#eef2f8" />
      </Environment>

      <Grid
        position={[0, 0.001, 0]}
        args={[90, 90]}
        cellSize={0.55}
        cellThickness={0.6}
        cellColor="#d3d6dd"
        sectionSize={2.75}
        sectionThickness={1}
        sectionColor="#b9bfc9"
        fadeDistance={40}
        fadeStrength={1.4}
        infiniteGrid
        followCamera={false}
      />
      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.5}
        scale={44}
        blur={2.4}
        far={4}
        resolution={512}
        color="#18181b"
      />

      {/* Invisible ground plane — the drag surface */}
      <mesh rotation-x={-Math.PI / 2} onPointerMove={handleMove}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {instances.map((inst) => (
        <Instance
          key={inst.id}
          inst={inst}
          running={running}
          powered={poweredIds.has(inst.id)}
          energized={inst.kind === 'battery' && loadedBatteries.has(inst.id)}
          selected={inst.id === selectedId}
          candidate={candidate}
          groups={groups}
          anchors={anchors}
          onDragStart={onDragStart}
        />
      ))}

      {/* Cables for every wired link — between the REAL mated ports */}
      {instances
        .filter((i) => i.parentId)
        .map((i) => {
          const inPort = getPort(i.kind, i.childPort) ?? ELEC_PORTS[i.kind]?.[0]
          return (
            <LinkWire
              key={`wire-${i.id}`}
              anchors={anchors}
              parentId={i.parentId as string}
              parentPortId={i.parentPort ?? 'pp3'}
              childId={i.id}
              childPortId={i.childPort ?? inPort?.id ?? 'leads'}
              wire={inPort?.wire ?? 'pair'}
              live={running && poweredIds.has(i.id)}
              spread={terminalSpread.get(i.id) ?? 0}
            />
          )
        })}

      <OrbitControls
        makeDefault
        target={[0, 0.8, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={45}
        maxPolarAngle={(Math.PI / 2) * 0.985}
      />
    </>
  )
}

/* ---------- public stage ---------- */

export default function PlaygroundStage({
  instances,
  running,
  poweredIds,
  selectedId,
  groups,
  anchors,
  onSelect,
  onDropCommit,
  onConnectRequest,
  onCandidateChange,
  actionsRef,
}: {
  instances: PlayInstance[]
  running: boolean
  poweredIds: Set<string>
  selectedId: string | null
  groups: React.RefObject<Map<string, THREE.Group>>
  anchors: React.RefObject<AnchorMap>
  onSelect: (id: string) => void
  onDropCommit: (moves: Move[], attach: Attach | null) => void
  onConnectRequest: (
    parentId: string,
    childId: string,
    parentPortId: string,
    childPortId: string
  ) => void
  onCandidateChange: (candidate: LiveCandidate | null) => void
  actionsRef: React.RefObject<StageActions>
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [12, 10, 14], fov: 36 }}
    >
      <Scene
        instances={instances}
        running={running}
        poweredIds={poweredIds}
        selectedId={selectedId}
        groups={groups}
        anchors={anchors}
        onSelect={onSelect}
        onDropCommit={onDropCommit}
        onConnectRequest={onConnectRequest}
        onCandidateChange={onCandidateChange}
        actionsRef={actionsRef}
      />
    </Canvas>
  )
}
