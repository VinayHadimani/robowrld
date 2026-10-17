/**
 * Shared client-side types + tiny helpers for the simplified app:
 * a plain component list, a detail view, and the playground.
 *
 * The playground is an attachment graph: every placed component may be
 * attached to a parent (parentId). Power flows through that graph — a
 * component only runs while it is connected, directly or through a chain
 * of attached components, to a power source (a 9V battery).
 */

export interface SpecRow {
  label: string
  value: string
}

/** Which procedural/asset model renders this component. */
export type PlayKind = 'servo' | 'battery' | 'gltf' | 'stl'

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
 * reloads). `parentId` links it into the attachment graph; positions stay
 * absolute so attached groups can be moved together by a shared delta.
 */
export interface PlayInstance {
  id: string
  slug: string
  name: string
  kind: PlayKind
  modelUrl: string | null
  x: number
  z: number
  /** The instance this one is wired to, or null when free-standing. */
  parentId: string | null
}

/** A position commit for one dragged component (groups move together). */
export interface Move {
  id: string
  x: number
  z: number
}

/** A snap-attach that happened at the end of a drag. */
export interface Attach {
  childId: string
  parentId: string
}

/**
 * A connection waiting for the user's permission. Created when a component
 * is brought near another connectable one — nothing is wired until the
 * user answers the prompt.
 */
export interface ConnectRequest {
  childId: string
  parentId: string
}

/**
 * Can these two components be connected? Every component accepts every
 * other component EXCEPT power sources: batteries power components, they
 * don't daisy-chain onto each other.
 */
export function areConnectable(a: PlayInstance, b: PlayInstance): boolean {
  return !(isPowerSource(a.kind) && isPowerSource(b.kind))
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
/* The attachment / power graph                                        */
/* ------------------------------------------------------------------ */

/** True for components that generate power — the origin of the graph. */
export function isPowerSource(kind: PlayKind): boolean {
  return kind === 'battery'
}

/** Approximate ground footprint radius (world units) per component kind. */
export function footprintFor(kind: PlayKind): number {
  if (kind === 'servo') return 2.35
  if (kind === 'battery') return 1.9
  return 2.15
}

/** Height where the power wire clips on, per component kind. */
export function anchorYFor(kind: PlayKind): number {
  if (kind === 'servo') return 3.9
  if (kind === 'battery') return 5.0
  return 2.35
}

/**
 * Every instance connected to `id` through the attachment graph —
 * parents, children and siblings alike (the whole connected group).
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

/** `id` plus everything attached below it (its subtree in the tree). */
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
 * The set of instance ids that are powered: every member of any group
 * that contains at least one power source. Everything else stays still.
 */
export function poweredIds(instances: PlayInstance[]): Set<string> {
  const sources = instances.filter((i) => isPowerSource(i.kind))
  if (sources.length === 0) return new Set()
  const powered = new Set<string>()
  for (const src of sources) {
    for (const id of groupMembers(instances, src.id)) powered.add(id)
  }
  return powered
}
