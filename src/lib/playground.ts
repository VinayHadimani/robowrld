/**
 * Shared client-side types + tiny helpers for the simplified app:
 * a plain component list, a detail view, and the playground.
 *
 * The playground is a REAL-LIFE wiring graph. Every component carries
 * electrical ports (a 9V battery's snap terminals, a servo's 3-pin lead,
 * a controller's VIN jack and 5V header, bare power leads on motors…)
 * and two components may only connect when their ports could mate in
 * real life: one side must PROVIDE power, the other must ACCEPT it, and
 * the provided voltage must lie inside the consumer's operating range.
 * A 9V battery snaps onto a motor's leads; it does NOT feed a servo
 * directly (the MG996R takes 4.8–7.2 V) — the servo plugs into a
 * controller's 5 V pins, and the controller takes the 9 V on its VIN
 * jack. Power flows only along those real connections, from a battery,
 * through the chain, to each consumer.
 */

export interface SpecRow {
  label: string
  value: string
}

/** Which procedural/asset model renders this component. */
export type PlayKind = 'servo' | 'battery' | 'controller' | 'gltf' | 'stl'

/** A component that has a real, viewable 3D representation. */
export interface PlayComponent {
  slug: string
  name: string
  category: string
  kind: PlayKind
  modelUrl: string | null
  tagline: string
  description: string
  specs: SpecRow[]
  fileName: string | null
  fileSize: number | null
}

/**
 * One placed component in the playground. Self-contained (survives
 * reloads). `parentId` links it to the component that PROVIDES its power
 * (a battery, or a powered controller); the mated ports are recorded so
 * the wires render between the real connectors. Positions stay absolute
 * so connected groups move together by a shared delta.
 */
export interface PlayInstance {
  id: string
  slug: string
  name: string
  kind: PlayKind
  modelUrl: string | null
  x: number
  z: number
  /** The component feeding this one, or null when free-standing. */
  parentId: string | null
  /** The PROVIDING port on the parent (e.g. 'pp3', 'hdr'). */
  parentPort: string | null
  /** The ACCEPTING port on this component (e.g. 'vin', 'plug', 'leads'). */
  childPort: string | null
}

/** A position commit for one dragged component (groups move together). */
export interface Move {
  id: string
  x: number
  z: number
}

/** A wire-up that happened after the user granted permission. */
export interface Attach {
  childId: string
  parentId: string
  parentPort: string
  childPort: string
}

/**
 * A connection waiting for the user's permission. Created when a
 * component is brought near another connectable one — nothing is wired
 * until the user answers the prompt.
 */
export interface ConnectRequest {
  childId: string
  parentId: string
  parentPort: string
  childPort: string
}

export const PLAYGROUND_STORAGE_KEY = 'playground.v1'

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** A loose spiral of spots so added components never spawn on top of each other. */
export function nextSpot(index: number): { x: number; z: number } {
  if (index === 0) return { x: 0, z: 0 }
  const angle = index * 2.399_963 // golden angle
  const radius = 3 + index * 0.9
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }
}

/** Per-instance sweep profile (deterministic from the id so it survives reloads). */
export function sweepFor(id: string): { min: number; max: number; speed: number } {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return {
    min: 12 + (h % 20),
    max: 150 + (h % 25),
    speed: 130 + (h % 80),
  }
}

/** Keep "a little bit of information" little — the first N sentences. */
export function firstSentences(text: string, count = 2): string {
  if (!text) return ''
  const parts = text.split(/(?<=[.!?])\s+/)
  return parts.slice(0, count).join(' ')
}

export function formatBytes(n?: number | null): string {
  if (n === null || n === undefined) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

/* ------------------------------------------------------------------ */
/* Electrical ports — what connects to what, like real life            */
/* ------------------------------------------------------------------ */

/**
 * An electrical port on a component. `role: 'out'` provides power at a
 * voltage inside `v`; `role: 'in'` accepts power anywhere inside `v`.
 * `wire` is how a connection to this port renders: a red/black pair for
 * power splices, or a 3-wire signal ribbon for servo-style plugs.
 */
export interface ElecPort {
  id: string
  label: string
  role: 'out' | 'in'
  /** Voltage provided (out) or the acceptable range (in). */
  v: [number, number]
  wire: 'pair' | 'ribbon3'
}

/**
 * The real-life electrical contract per component kind:
 *  - 9V battery: PP3 snap terminals provide 9 V.
 *  - Controller (Arduino Uno): VIN jack accepts 7–12 V; when powered,
 *    its 5 V pin header feeds servos and small motors.
 *  - Servo (MG996R class): 3-pin lead accepts 4.8–7.2 V — a battery's
 *    9 V would cook it; it plugs into a controller.
 *  - Uploaded models: generic power leads, 3–12 V (typical small DC
 *    motors and similar loads people upload).
 */
export const ELEC_PORTS: Record<PlayKind, ElecPort[]> = {
  battery: [{ id: 'pp3', label: 'snap terminals', role: 'out', v: [9, 9], wire: 'pair' }],
  controller: [
    { id: 'vin', label: 'VIN power jack', role: 'in', v: [7, 12], wire: 'pair' },
    { id: 'hdr', label: '5 V pin header', role: 'out', v: [5, 5], wire: 'ribbon3' },
  ],
  servo: [{ id: 'plug', label: '3-pin signal lead', role: 'in', v: [4.8, 7.2], wire: 'ribbon3' }],
  gltf: [{ id: 'leads', label: 'power leads', role: 'in', v: [3, 12], wire: 'pair' }],
  stl: [{ id: 'leads', label: 'power leads', role: 'in', v: [3, 12], wire: 'pair' }],
}

/** The port record for a kind, or an empty fallback for unknown kinds. */
export function portsFor(kind: PlayKind): ElecPort[] {
  return ELEC_PORTS[kind] ?? []
}

function fmtV(v: [number, number]): string {
  return v[0] === v[1] ? `${v[0]} V` : `${v[0]}–${v[1]} V`
}

/** True when the provided voltage lies inside the accepted range. */
function voltageOk(out: ElecPort, inPort: ElecPort): boolean {
  return out.v[0] >= inPort.v[0] - 1e-9 && out.v[1] <= inPort.v[1] + 1e-9
}

export function getPort(kind: PlayKind, portId: string | null | undefined): ElecPort | undefined {
  if (!portId) return undefined
  return portsFor(kind).find((p) => p.id === portId)
}

/** The result of asking whether two components can connect, and why. */
export interface ConnectMatch {
  ok: boolean
  /** Human-readable explanation — the red-ring hint or the dialog text. */
  reason: string
  /** The instance whose port PROVIDES power (becomes the parent). */
  outId: string
  /** The instance whose port ACCEPTS power (becomes the child). */
  inId: string
  outPortId: string
  inPortId: string
}

const NO_MATCH: ConnectMatch = {
  ok: false,
  reason: '',
  outId: '',
  inId: '',
  outPortId: '',
  inPortId: '',
}

/**
 * Can these two components connect IN REAL LIFE? They can when one has
 * a port that provides power at a voltage the other's port accepts:
 *
 *   9V battery → motor leads (3–12 V)          ✓
 *   9V battery → controller VIN (7–12 V)       ✓
 *   controller 5 V header → servo (4.8–7.2 V)  ✓
 *   9V battery → servo (4.8–7.2 V)             ✗ — over-voltage
 *   battery ↔ battery, consumer ↔ consumer     ✗ — nothing provides power
 */
export function connectBetween(a: PlayInstance, b: PlayInstance): ConnectMatch {
  const aPorts = portsFor(a.kind)
  const bPorts = portsFor(b.kind)
  const aOut = aPorts.filter((p) => p.role === 'out')
  const bOut = bPorts.filter((p) => p.role === 'out')
  const aIn = aPorts.filter((p) => p.role === 'in')
  const bIn = bPorts.filter((p) => p.role === 'in')

  // Prefer the tighter first match (servo before generic leads etc.).
  for (const out of aOut) {
    for (const inP of bIn) {
      if (voltageOk(out, inP)) {
        return {
          ok: true,
          reason: `${a.name} provides ${fmtV(out.v)} on its ${out.label}, within ${b.name}'s ${inP.label} range (${fmtV(inP.v)}).`,
          outId: a.id,
          inId: b.id,
          outPortId: out.id,
          inPortId: inP.id,
        }
      }
    }
  }
  for (const out of bOut) {
    for (const inP of aIn) {
      if (voltageOk(out, inP)) {
        return {
          ok: true,
          reason: `${b.name} provides ${fmtV(out.v)} on its ${out.label}, within ${a.name}'s ${inP.label} range (${fmtV(inP.v)}).`,
          outId: b.id,
          inId: a.id,
          outPortId: out.id,
          inPortId: inP.id,
        }
      }
    }
  }

  // No electrical match — explain WHY, like a real one would.
  const bothSources = aOut.length > 0 && bOut.length > 0
  const noSource = aOut.length === 0 && bOut.length === 0
  let reason: string
  if (bothSources) {
    reason = `${a.name} and ${b.name} are both power sources — sources don't power each other`
  } else if (noSource) {
    reason = `neither provides power — connect one of them to a battery (or a powered controller) first`
  } else {
    const outSide = aOut.length > 0 ? a : b
    const inSide = aOut.length > 0 ? b : a
    const out = (aOut.length > 0 ? aOut : bOut)[0]
    const inP = (aOut.length > 0 ? bIn : aIn)[0]
    reason = `${outSide.name}'s ${fmtV(out.v)} is outside the ${fmtV(inP.v)} ${inSide.name} accepts on its ${inP.label}`
    if (inSide.kind === 'servo' && outSide.kind === 'battery') {
      reason += ' — power it through a controller'
    }
  }
  return { ...NO_MATCH, reason }
}

/** Back-compat boolean form: may these two connect at all? */
export function areConnectable(a: PlayInstance, b: PlayInstance): boolean {
  return connectBetween(a, b).ok
}

/* ------------------------------------------------------------------ */
/* The wiring / power graph                                            */
/* ------------------------------------------------------------------ */

/** True for components that generate power — the origin of the graph. */
export function isPowerSource(kind: PlayKind): boolean {
  return kind === 'battery'
}

/** True for components that pass power through (controller). */
export function isPowerBroker(kind: PlayKind): boolean {
  return kind === 'controller'
}

/** Approximate ground footprint radius (world units) per component kind. */
export function footprintFor(kind: PlayKind): number {
  if (kind === 'servo') return 2.35
  if (kind === 'battery') return 1.9
  if (kind === 'controller') return 4.0
  return 2.15
}

/** Height where generic power leads clip on (uploaded models). */
export function anchorYFor(kind: PlayKind): number {
  if (kind === 'servo') return 3.9
  if (kind === 'battery') return 5.0
  if (kind === 'controller') return 0.7
  return 2.35
}

/**
 * Every instance connected to `id` through the wiring graph — parents,
 * children and siblings alike (the whole connected assembly).
 */
export function groupMembers(instances: PlayInstance[], id: string): Set<string> {
  const byId = new Map(instances.map((i) => [i.id, i]))
  const adj = new Map<string, string[]>()
  for (const inst of instances) {
    if (inst.parentId && byId.has(inst.parentId)) {
      adj.set(inst.parentId, [...(adj.get(inst.parentId) ?? []), inst.id])
      adj.set(inst.id, [...(adj.get(inst.id) ?? []), inst.parentId])
    }
  }
  const seen = new Set<string>([id])
  const stack = [id]
  while (stack.length > 0) {
    const cur = stack.pop() as string
    for (const next of adj.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        stack.push(next)
      }
    }
  }
  return seen
}

/** `id` plus everything wired below it (its subtree in the power tree). */
export function subtreeIds(instances: PlayInstance[], id: string): string[] {
  const children = new Map<string, string[]>()
  for (const inst of instances) {
    if (inst.parentId) {
      children.set(inst.parentId, [...(children.get(inst.parentId) ?? []), inst.id])
    }
  }
  const out: string[] = []
  const walk = (node: string) => {
    out.push(node)
    for (const child of children.get(node) ?? []) walk(child)
  }
  walk(id)
  return out
}

/**
 * Does power actually flow across one wire? The recorded out-port
 * voltage on the parent must lie inside the child's in-port range —
 * exactly what a real cable would do. (Whether the parent itself is
 * powered is a separate, recursive question — see poweredIds.)
 */
function linkCarriesPower(parent: PlayInstance, child: PlayInstance): boolean {
  const out = getPort(parent.kind, child.parentPort)
  const inP = getPort(child.kind, child.childPort)
  if (!out || !inP || out.role !== 'out' || inP.role !== 'in') {
    // Ports not recorded (older saves) — resolve them by compatibility.
    const m = connectBetween(parent, child)
    return m.ok && m.outId === parent.id
  }
  return voltageOk(out, inP)
}

/**
 * The set of instance ids that are powered: every component with a
 * valid, real-life wire path back to a power source (directly or
 * through a powered controller). Everything else stays still.
 */
export function poweredIds(instances: PlayInstance[]): Set<string> {
  const byId = new Map(instances.map((i) => [i.id, i]))
  const memo = new Map<string, boolean>()

  const check = (inst: PlayInstance, stack: Set<string>): boolean => {
    if (inst.kind === 'battery') return true
    if (memo.has(inst.id)) return memo.get(inst.id) as boolean
    if (!inst.parentId || stack.has(inst.id)) return false
    const parent = byId.get(inst.parentId)
    if (!parent) return false
    stack.add(inst.id)
    const parentPowered = check(parent, stack)
    stack.delete(inst.id)
    const ok = parentPowered && linkCarriesPower(parent, inst)
    memo.set(inst.id, ok)
    return ok
  }

  const powered = new Set<string>()
  for (const inst of instances) {
    if (check(inst, new Set())) powered.add(inst.id)
  }
  return powered
}

/**
 * Batteries that are actually powering something: at least one child is
 * wired to them with a valid link (drives the battery's load LED).
 */
export function batteriesWithLoad(instances: PlayInstance[]): Set<string> {
  const byId = new Map(instances.map((i) => [i.id, i]))
  const withLoad = new Set<string>()
  for (const inst of instances) {
    if (!inst.parentId) continue
    const parent = byId.get(inst.parentId)
    if (!parent || parent.kind !== 'battery') continue
    if (linkCarriesPower(parent, inst)) withLoad.add(parent.id)
  }
  return withLoad
}
