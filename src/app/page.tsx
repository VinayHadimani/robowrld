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
  if (c.source === 'user' && c.modelUrl && (c.modelKind === 'gltf' || c.modelKind === 'stl')) {
    return true
  }
  return false
}

export default function Home() {
  const [view, setView] = useState<View>({ name: 'list' })
  const [components, setComponents] = useState<PlayComponent[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [loadTick, setLoadTick] = useState(0)
  // Restored during the first client render (SSR renders the list view,
  // which doesn't depend on instances — no hydration mismatch). Older saved
  // playgrounds predate attachments — parentId normalizes to null.
  const [instances, setInstances] = useState<PlayInstance[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(PLAYGROUND_STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as Partial<PlayInstance>[]) : []
      return parsed.map((i) => ({
        id: String(i.id),
        slug: String(i.slug),
        name: String(i.name),
        kind: (i.kind ?? 'gltf') as PlayInstance['kind'],
        modelUrl: i.modelUrl ?? null,
        x: Number(i.x) || 0,
        z: Number(i.z) || 0,
        parentId: i.parentId ?? null,
      }))
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
        },
      ]
    })
    setView({ name: 'playground' })
  }, [])

  const removeInstance = useCallback((id: string) => {
    setInstances((prev) => {
      const target = prev.find((i) => i.id === id)
      // Removing a link in a chain splices it: children re-attach to the
      // removed instance's own parent so the rest of the robot stays wired.
      return prev
        .filter((i) => i.id !== id)
        .map((i) => (i.parentId === id ? { ...i, parentId: target?.parentId ?? null } : i))
    })
  }, [])

  /** Apply the end-of-drag positions for a whole moved group (+ any snap). */
  const dropCommit = useCallback((moves: Move[], attach: Attach | null) => {
    setInstances((prev) => {
      const byMove = new Map(moves.map((m) => [m.id, m]))
      return prev.map((i) => {
        const m = byMove.get(i.id)
        if (!m) return i
        const parent =
          attach && attach.childId === i.id ? attach.parentId : i.parentId
        return { ...i, x: m.x, z: m.z, parentId: parent }
      })
    })
  }, [])

  /** Wire two components together — runs only after the user grants
      permission in the connection prompt. */
  const attachInstance = useCallback((childId: string, parentId: string) => {
    setInstances((prev) => prev.map((i) => (i.id === childId ? { ...i, parentId } : i)))
  }, [])

  /** Cut one component loose from its parent (it stays where it is). */
  const detachInstance = useCallback((id: string) => {
    setInstances((prev) => prev.map((i) => (i.id === id ? { ...i, parentId: null } : i)))
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
