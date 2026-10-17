'use client'

/**
 * PlaygroundStage — the 3D canvas where placed components live.
 *
 * Interaction model:
 *   - pointer-down on a component → grab it (orbit controls freeze); its
 *     whole attached group comes along — attached things move together
 *   - move → the group slides along the ground plane (imperative, no
 *     re-renders); the nearest foreign component in reach gets a pulsing
 *     ring: green when the pair may connect, red when it may not
 *   - release near a CONNECTABLE neighbour → the piece slides into the
 *     connected spot as a preview and the app ASKS FOR PERMISSION; only a
 *     "Connect" answer wires them together (red + black power wires) —
 *     "Don't connect" pushes the piece back out, unwired
 *   - release near a NON-connectable pair (battery onto battery) → nothing
 *     happens; they simply can't be connected
 *   - a click without movement → select (ring + panel)
 *   - Run → only components CONNECTED (directly or through a chain) to a
 *     power source animate; everything else stays still. The battery's
 *     LED lights while it is powering something.
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
import {
  anchorYFor,
  areConnectable,
  footprintFor,
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

/** The live proximity state: which neighbour is in reach, and may it connect? */
export interface LiveCandidate {
  id: string
  connectable: boolean
}

/** Imperative bridge so the React layer can finish a declined connection. */
export interface StageActions {
  separate?: (childId: string, parentId: string) => void
}

/** Wire endpoints registered per instance — where the power wires clip on. */
export interface WireAnchors {
  a: THREE.Object3D
  b: THREE.Object3D
}

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

/* ---------- power wires ---------- */

/**
 * One wire between a parent's and a child's anchor. The tube geometry is
 * rebuilt in useFrame only when an endpoint actually moved — so wires stay
 * glued to their components even during imperative (mid-drag) moves, at
 * zero React render cost.
 */
function Wire({
  anchors,
  parentId,
  childId,
  side,
  color,
  live,
}: {
  anchors: React.RefObject<Map<string, WireAnchors>>
  parentId: string
  childId: string
  side: 'a' | 'b'
  color: string
  live: boolean
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
    }),
    []
  )

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const parent = anchors.current?.get(parentId)
    const child = anchors.current?.get(childId)
    if (!parent || !child) {
      m.visible = false
      return
    }
    m.visible = true
    ;(side === 'a' ? parent.a : parent.b).getWorldPosition(tmp.a)
    ;(side === 'a' ? child.a : child.b).getWorldPosition(tmp.b)
    if (
      tmp.a.distanceToSquared(lastA.current) < 1e-8 &&
      tmp.b.distanceToSquared(lastB.current) < 1e-8
    ) {
      return
    }
    lastA.current.copy(tmp.a)
    lastB.current.copy(tmp.b)
    // A gentle sag between the two clip points, never dipping under the floor.
    tmp.mid.addVectors(tmp.a, tmp.b).multiplyScalar(0.5)
    const sagY = Math.max(0.32, Math.min(tmp.a.y, tmp.b.y) - 0.5)
    tmp.ctrl.set(tmp.mid.x, sagY, tmp.mid.z)
    const curve = new THREE.QuadraticBezierCurve3(
      tmp.a.clone(),
      tmp.ctrl.clone(),
      tmp.b.clone()
    )
    const geom = new THREE.TubeGeometry(curve, 24, 0.11, 10, false)
    m.geometry.dispose()
    m.geometry = geom
  })

  return (
    <mesh ref={mesh}>
      <meshStandardMaterial
        color={color}
        roughness={0.38}
        metalness={0.12}
        emissive={live && side === 'a' ? '#b91c1c' : '#000000'}
        emissiveIntensity={live && side === 'a' ? 0.85 : 0}
      />
    </mesh>
  )
}

/** The red + black wire pair drawn for every attached parent→child link. */
function WirePair({
  anchors,
  parentId,
  childId,
  live,
}: {
  anchors: React.RefObject<Map<string, WireAnchors>>
  parentId: string
  childId: string
  live: boolean
}) {
  return (
    <>
      <Wire anchors={anchors} parentId={parentId} childId={childId} side="a" color="#d92626" live={live} />
      <Wire anchors={anchors} parentId={parentId} childId={childId} side="b" color="#23262d" live={live} />
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
}

/**
 * The nearest foreign instance within snap reach of the dragged group —
 * null when nothing is close enough. `connectable` decides whether a
 * permission prompt is offered at all (batteries never chain onto
 * batteries, so that pair stays silent).
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
  let nearest: { id: string; x: number; z: number; dist: number; kind: PlayInstance['kind'] } | null = null
  for (const other of insts) {
    if (members.includes(other.id)) continue
    const g = groups.current?.get(other.id)
    if (!g) continue
    const dist = Math.hypot(g.position.x - pos.x, g.position.z - pos.z)
    if (!nearest || dist < nearest.dist) {
      nearest = { id: other.id, x: g.position.x, z: g.position.z, dist, kind: other.kind }
    }
  }
  if (!nearest) return null
  const reach = footprintFor(grabbedInst.kind) + footprintFor(nearest.kind) + SNAP_REACH
  if (nearest.dist >= reach) return null
  const targetInst = byId.get(nearest.id)
  if (!targetInst) return null
  return {
    id: nearest.id,
    x: nearest.x,
    z: nearest.z,
    dist: nearest.dist,
    connectable: areConnectable(grabbedInst, targetInst),
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
  anchors: React.RefObject<Map<string, WireAnchors>>
  onDragStart: (e: ThreeEvent<PointerEvent>, id: string) => void
}) {
  const ref = useRef<THREE.Group>(null)

  useEffect(() => {
    const g = ref.current
    if (!g) return
    g.position.set(inst.x, 0, inst.z)
    groups.current?.set(inst.id, g)

    // Wire clip points: the battery's real snap terminals, a nominal pair
    // of posts on top of everything else.
    const isBattery = inst.kind === 'battery'
    const y = isBattery ? 0 : anchorYFor(inst.kind)
    const a = new THREE.Object3D()
    const b = new THREE.Object3D()
    if (isBattery) {
      a.position.set(BATTERY_TERMINALS.minus[0], BATTERY_TERMINALS.minus[1], 0)
      b.position.set(BATTERY_TERMINALS.plus[0], BATTERY_TERMINALS.plus[1], 0)
    } else {
      a.position.set(-0.45, y, 0)
      b.position.set(0.45, y, 0)
    }
    g.add(a)
    g.add(b)
    anchors.current?.set(inst.id, { a, b })

    return () => {
      groups.current?.delete(inst.id)
      g.remove(a)
      g.remove(b)
      anchors.current?.delete(inst.id)
    }
    // Position is set imperatively; inst.x/z only matter at mount.
  }, [inst.id, inst.x, inst.z, inst.kind, groups, anchors])

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
  anchors: React.RefObject<Map<string, WireAnchors>>
  onSelect: (id: string) => void
  onDropCommit: (moves: Move[], attach: Attach | null) => void
  /** Fired when a component is dropped near a connectable one — the app
      must ASK FOR PERMISSION; nothing is wired until it answers. */
  onConnectRequest: (childId: string, parentId: string) => void
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
  // actually attached to at least one other component.
  const batteriesWithLoad = useMemo(() => {
    const set = new Set<string>()
    for (const inst of instances) {
      if (inst.kind !== 'battery') continue
      const group = groupMembers(instances, inst.id)
      for (const memberId of group) {
        if (memberId !== inst.id && instances.find((i) => i.id === memberId)?.kind !== 'battery') {
          set.add(inst.id)
          break
        }
      }
    }
    return set
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
      // The whole attached group travels together.
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
          // Preview: slide the grabbed piece AND everything attached below
          // it into the connected spot while the user decides. The wires
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
          onConnectRequest(d.id, cand.id)
          return
        }
      }

      // Nothing connectable nearby (or an impossible pair) — a plain drop.
      onDropCommit(moves, null)
    }
    window.addEventListener('pointerup', finish)
    return () => window.removeEventListener('pointerup', finish)
  }, [get, groups, onDropCommit, onSelect, onConnectRequest, setCandidateLive])

  // "Don't connect" — push the declined piece (and its subtree) back out
  // of the preview spot so it clearly isn't attached to anything, then
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
    setCandidateLive(cand ? { id: cand.id, connectable: cand.connectable } : null)
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
          energized={inst.kind === 'battery' && batteriesWithLoad.has(inst.id)}
          selected={inst.id === selectedId}
          candidate={candidate}
          groups={groups}
          anchors={anchors}
          onDragStart={onDragStart}
        />
      ))}

      {/* Power wires for every attached link */}
      {instances
        .filter((i) => i.parentId)
        .map((i) => (
          <WirePair
            key={`wire-${i.id}`}
            anchors={anchors}
            parentId={i.parentId as string}
            childId={i.id}
            live={running && poweredIds.has(i.id)}
          />
        ))}

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
  anchors: React.RefObject<Map<string, WireAnchors>>
  onSelect: (id: string) => void
  onDropCommit: (moves: Move[], attach: Attach | null) => void
  onConnectRequest: (childId: string, parentId: string) => void
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
