'use client'

/**
 * The whole app, on purpose:
 *   Components (a plain list of names)
 *     → click → the virtual machine + a little info + "Add to Playground"
 *   Playground → add components, move them around, run everything.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ComponentList } from '@/components/simple/ComponentList'
import { ComponentView } from '@/components/simple/ComponentView'
import { Playground } from '@/components/simple/Playground'
import {
  PLAYGROUND_STORAGE_KEY,
  connectBetween,
  nextSpot,
  uid,
  type Attach,
  type Move,
  type PlayComponent,
  type PlayInstance,
  type SpecRow,
} from '@/lib/playground'

type View = { name: 'list' } | { name: 'component'; slug: string } | { name: 'playground' }

const SERVO_SLUG = 'servo-motor'
const BATTERY_SLUG = '9v-battery'
const CONTROLLER_SLUG = 'arduino-uno'

interface ApiComponent {
  slug: string
  name: string
  category: string
  source: string
  modelKind: string
  modelUrl: string | null
  tagline: string
  description: string
  specs: SpecRow[] | null
  fileName: string | null
  fileSize: number | null
}

function toPlayComponent(c: ApiComponent): PlayComponent {
  const kind: PlayComponent['kind'] =
    c.slug === SERVO_SLUG
      ? 'servo'
      : c.slug === BATTERY_SLUG
        ? 'battery'
        : c.slug === CONTROLLER_SLUG
          ? 'controller'
          : c.modelKind === 'stl'
            ? 'stl'
            : 'gltf'
  return {
    slug: c.slug,
    name: c.name,
    category: c.category,
    kind,
    modelUrl: c.modelUrl,
    tagline: c.tagline ?? '',
    description: c.description ?? '',
    specs: (c.specs ?? []).slice(0, 5),
    fileName: c.fileName ?? null,
    fileSize: c.fileSize ?? null,
  }
}

/** Only components that actually have a viewable 3D representation. */
function isPlayable(c: ApiComponent): boolean {
  if (c.slug === SERVO_SLUG && c.modelKind === 'procedural') return true
  if (c.slug === BATTERY_SLUG && c.modelKind === 'procedural') return true
  if (c.slug === CONTROLLER_SLUG && c.modelKind === 'procedural') return true
  if (c.source === 'user' && c.modelUrl && (c.modelKind === 'gltf' || c.modelKind === 'stl')) {
    return true
  }
  return false
}

/**
 * Normalize a restored playground: every wire must satisfy TODAY's
 * real-life connection rules. Links are re-oriented so the power
 * provider is the parent; impossible links (e.g. an old battery→servo
 * drop, invalid since servos take 4.8–7.2 V) are dropped, and cycles
 * from corrupted saves are cut.
 */
function normalizeInstances(raw: Partial<PlayInstance>[]): PlayInstance[] {
  const insts: PlayInstance[] = raw.map((i) => ({
    id: String(i.id),
    slug: String(i.slug),
    name: String(i.name),
    kind: (i.kind ?? 'gltf') as PlayInstance['kind'],
    modelUrl: i.modelUrl ?? null,
    x: Number(i.x) || 0,
    z: Number(i.z) || 0,
    parentId: i.parentId ?? null,
    parentPort: i.parentPort ?? null,
    childPort: i.childPort ?? null,
  }))

  // Drop links whose parent no longer exists.
  for (const inst of insts) {
    if (inst.parentId && !insts.some((o) => o.id === inst.parentId)) {
      inst.parentId = null
      inst.parentPort = null
      inst.childPort = null
    }
  }

  // Validate + orient each link (two passes so reversals settle).
  for (let pass = 0; pass < 2; pass++) {
    for (const inst of insts) {
      if (!inst.parentId) continue
      const parent = insts.find((o) => o.id === inst.parentId)
      if (!parent) continue
      const m = connectBetween(parent, inst)
      if (!m.ok) {
        // Impossible in real life — drop the wire.
        inst.parentId = null
        inst.parentPort = null
        inst.childPort = null
        continue
      }
      if (m.outId === parent.id) {
        // Correct direction: the parent provides the power.
        inst.parentPort = m.outPortId
        inst.childPort = m.inPortId
      } else {
        // Stored backwards — the PROVIDER (currently the child) must
        // become the parent.
        inst.parentId = null
        inst.parentPort = null
        inst.childPort = null
        parent.parentId = inst.id
        parent.parentPort = m.outPortId
        parent.childPort = m.inPortId
      }
    }
  }

  // Cut any remaining cycles (corrupted saves).
  const visiting = new Set<string>()
  const cut = (id: string) => {
    const inst = insts.find((o) => o.id === id)
    if (!inst || !inst.parentId) return
    if (visiting.has(id)) {
      inst.parentId = null
      inst.parentPort = null
      inst.childPort = null
      return
    }
    visiting.add(id)
    cut(inst.parentId)
    visiting.delete(id)
  }
  for (const inst of insts) cut(inst.id)

  return insts
}

export default function Home() {
  const [view, setView] = useState<View>({ name: 'list' })
  const [components, setComponents] = useState<PlayComponent[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [loadTick, setLoadTick] = useState(0)
  // Restored during the first client render (SSR renders the list view,
  // which doesn't depend on instances — no hydration mismatch). Older
  // saved playgrounds are migrated to the real-life wiring rules.
  const [instances, setInstances] = useState<PlayInstance[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(PLAYGROUND_STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as Partial<PlayInstance>[]) : []
      return normalizeInstances(parsed)
    } catch {
      return []
    }
  })

  /* Load the component list from the cloud (with offline-safe degradation
     happening server-side — the response is always a usable list). */
  useEffect(() => {
    let alive = true
    fetch('/api/components')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { components?: ApiComponent[] }) => {
        if (!alive) return
        const playable = (d.components ?? []).filter(isPlayable).map(toPlayComponent)
        setComponents(playable)
        setLoading(false)
      })
      .catch(() => {
        if (!alive) return
        setError(true)
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [loadTick])

  useEffect(() => {
    try {
      localStorage.setItem(PLAYGROUND_STORAGE_KEY, JSON.stringify(instances))
    } catch {
      /* storage unavailable → in-memory only */
    }
  }, [instances])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [view])

  const bySlug = useMemo(
    () => new Map((components ?? []).map((c) => [c.slug, c])),
    [components]
  )
  const current = view.name === 'component' ? bySlug.get(view.slug) : undefined

  const addToPlayground = useCallback((c: PlayComponent) => {
    setInstances((prev) => {
      const spot = nextSpot(prev.length)
      return [
        ...prev,
        {
          id: uid(),
          slug: c.slug,
          name: c.name,
          kind: c.kind,
          modelUrl: c.modelUrl,
          x: spot.x,
          z: spot.z,
          parentId: null,
          parentPort: null,
          childPort: null,
        },
      ]
    })
    setView({ name: 'playground' })
  }, [])

  const removeInstance = useCallback((id: string) => {
    setInstances((prev) => {
      const target = prev.find((i) => i.id === id)
      const grandparentId = target?.parentId ?? null
      const grandparent = grandparentId ? prev.find((i) => i.id === grandparentId) : null
      return prev
        .filter((i) => i.id !== id)
        .map((i) => {
          if (i.parentId !== id) return i
          // Removing a link in a chain splices it: children re-attach to
          // the removed component's own provider — but ONLY when that
          // grandparent can really power them (a servo orphaned by its
          // controller cannot re-wire to the 9V battery).
          if (grandparent) {
            const m = connectBetween(grandparent, i)
            if (m.ok && m.outId === grandparent.id) {
              return { ...i, parentId: grandparent.id, parentPort: m.outPortId, childPort: m.inPortId }
            }
          }
          return { ...i, parentId: null, parentPort: null, childPort: null }
        })
    })
  }, [])

  /** Apply the end-of-drag positions for a whole moved group (+ any snap). */
  const dropCommit = useCallback((moves: Move[], attach: Attach | null) => {
    setInstances((prev) => {
      const byMove = new Map(moves.map((m) => [m.id, m]))
      return prev.map((i) => {
        const m = byMove.get(i.id)
        if (!m) return i
        const parent = attach && attach.childId === i.id ? attach.parentId : i.parentId
        const parentPort =
          attach && attach.childId === i.id ? attach.parentPort : i.parentPort
        const childPort = attach && attach.childId === i.id ? attach.childPort : i.childPort
        return { ...i, x: m.x, z: m.z, parentId: parent, parentPort, childPort }
      })
    })
  }, [])

  /** Wire two components together — runs only after the user grants
      permission in the connection prompt. The parent provides power. */
  const attachInstance = useCallback(
    (childId: string, parentId: string, parentPort: string, childPort: string) => {
      setInstances((prev) =>
        prev.map((i) =>
          i.id === childId ? { ...i, parentId, parentPort, childPort } : i
        )
      )
    },
    []
  )

  /** Cut one component loose from its power provider (it stays put). */
  const detachInstance = useCallback((id: string) => {
    setInstances((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, parentId: null, parentPort: null, childPort: null } : i
      )
    )
  }, [])

  const clearInstances = useCallback(() => setInstances([]), [])

  const navBtn = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      active ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
    }`

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <nav className="flex h-12 shrink-0 items-center gap-1 border-b px-4" aria-label="Main">
        <button
          type="button"
          className={navBtn(view.name !== 'playground')}
          onClick={() => setView({ name: 'list' })}
        >
          Components
        </button>
        <button
          type="button"
          className={navBtn(view.name === 'playground')}
          onClick={() => setView({ name: 'playground' })}
        >
          Playground
        </button>
      </nav>

      <main className="flex-1">
        {view.name === 'list' && (
          <ComponentList
            components={components}
            loading={loading}
            error={error}
            onOpen={(slug) => setView({ name: 'component', slug })}
            onRetry={() => {
              setLoading(true)
              setError(false)
              setLoadTick((t) => t + 1)
            }}
          />
        )}

        {view.name === 'component' &&
          (current ? (
            <ComponentView
              key={current.slug}
              component={current}
              onBack={() => setView({ name: 'list' })}
              onAdd={addToPlayground}
            />
          ) : (
            <div className="py-20 text-center text-sm text-muted-foreground">
              Component not found.
            </div>
          ))}

        {view.name === 'playground' && (
          <Playground
            components={components}
            instances={instances}
            onAdd={addToPlayground}
            onRemove={removeInstance}
            onDropCommit={dropCommit}
            onAttach={attachInstance}
            onDetach={detachInstance}
            onClear={clearInstances}
          />
        )}
      </main>
    </div>
  )
}
