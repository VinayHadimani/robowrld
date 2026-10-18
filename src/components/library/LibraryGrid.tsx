'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  ArrowRight,
  Bot,
  BatteryCharging,
  Check,
  Clock3,
  CloudUpload,
  Download,
  Link2,
  Lock,
  Package,
  Radar,
  RotateCw,
  Search,
  Sparkles,
  Trash2,
  Weight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { CATEGORIES, LIBRARY, type ComponentCategory } from '@/lib/registry'
import { getComponent } from '@/lib/component-schema'
import type { PackState } from '@/lib/packs'

const ServoStage = dynamic(() => import('@/components/three/ServoStage'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading 3D…</div>
  ),
})

type CategoryFilter = 'All' | ComponentCategory

const STUDIO_BG =
  'radial-gradient(ellipse at 50% 32%, #ffffff 0%, #f0f2f6 55%, #e2e5ea 100%)'

const PACK_ICONS: Record<string, typeof Bot> = {
  bot: Bot,
  radar: Radar,
  crosshair: RotateCw,
  battery: BatteryCharging,
}

const FEATURED_PACK_ID = 'beginner-robot-pack'

export function LibraryGrid({
  onOpenServo,
  onOpenLab,
  onOpenStudio,
}: {
  onOpenServo: () => void
  onOpenLab: () => void
  onOpenStudio: () => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('All')
  const [packs, setPacks] = useState<PackState[] | null>(null)
  const [installingPackId, setInstallingPackId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const { toast } = useToast()

  /* ---- pack catalog from the server (install state lives in the DB) ---- */
  useEffect(() => {
    let cancelled = false
    fetch('/api/packs')
      .then((r) => {
        if (!r.ok) throw new Error('catalog request failed')
        return r.json()
      })
      .then((d: { packs: PackState[] }) => {
        if (!cancelled) setPacks(d.packs)
      })
      .catch(() => {
        if (!cancelled) setPacks(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const installPackFlow = useCallback(
    async (packId: string) => {
      if (installingPackId || !packs) return
      const pack = packs.find((p) => p.id === packId)
      if (!pack) return
      setInstallingPackId(packId)
      setProgress(0)
      const start = performance.now()
      const tick = (t: number) => {
        const pct = Math.min(92, ((t - start) / 1400) * 100)
        setProgress(pct)
        if (pct < 92) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      try {
        const res = await fetch('/api/packs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packId, action: 'install' }),
        })
        if (!res.ok) throw new Error('install failed')
        const d: { packs: PackState[] } = await res.json()
        const remaining = 1400 - (performance.now() - start)
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining))
        setProgress(100)
        setPacks(d.packs)
        toast({
          title: `${pack.name} added to your library`,
          description: `${pack.componentIds.length} components unlocked — spec sheets, physics data and 3D models.`,
        })
      } catch {
        toast({
          title: 'Could not add the pack',
          description: 'The library service is unavailable — try again in a moment.',
        })
      } finally {
        setTimeout(() => {
          setInstallingPackId(null)
          setProgress(0)
        }, 450)
      }
    },
    [installingPackId, packs, toast]
  )

  const uninstallPackFlow = useCallback(
    async (packId: string) => {
      if (!packs || packId === FEATURED_PACK_ID) return
      const pack = packs.find((p) => p.id === packId)
      if (!pack) return
      try {
        const res = await fetch('/api/packs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packId, action: 'uninstall' }),
        })
        if (!res.ok) throw new Error('uninstall failed')
        const d: { packs: PackState[] } = await res.json()
        setPacks(d.packs)
        toast({
          title: `${pack.name} removed`,
          description: 'Its components are locked again — reinstall any time, free during beta.',
        })
      } catch {
        toast({ title: 'Could not remove the pack', description: 'The library service is unavailable.' })
      }
    },
    [packs, toast]
  )

  const exportAiCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/catalog')
      if (!res.ok) throw new Error('catalog failed')
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'robotics-ai-catalog.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({
        title: 'AI catalog exported',
        description: `${data.componentCount} components as machine-readable JSON — the exact artifact the AI generation layer will read.`,
      })
    } catch {
      toast({ title: 'Export failed', description: 'Could not reach the catalog API.' })
    }
  }, [toast])

  /* ---- which components are unlocked by installed packs ---- */
  const unlockedIds = useMemo(() => {
    if (!packs) return null
    const s = new Set<string>()
    for (const p of packs) if (p.installed) p.componentIds.forEach((id) => s.add(id))
    return s
  }, [packs])

  const packOf = useCallback(
    (componentId: string) => packs?.find((p) => p.componentIds.includes(componentId)),
    [packs]
  )

  const isLocked = useCallback(
    (componentId: string) => unlockedIds !== null && !unlockedIds.has(componentId),
    [unlockedIds]
  )

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return LIBRARY.filter((c) => {
      const matchesCategory = category === 'All' || c.category === category
      const matchesQuery =
        !q || c.name.toLowerCase().includes(q) || c.tagline.toLowerCase().includes(q)
      return matchesCategory && matchesQuery
    })
  }, [query, category])

  const servo = items.find((c) => c.id === 'servo-motor')
  const upcoming = items.filter((c) => c.status === 'soon')
  const availableCount = LIBRARY.filter((c) => c.status === 'available').length
  const installedCount = packs?.filter((p) => p.installed).length ?? 0

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          The component library<span className="text-amber-500">.</span>
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Real robotics parts as living 3D models — but a model alone is not a component.
          Every entry here carries its datasheet specs, physics properties, real-world cost
          and a machine-readable AI profile, so the same library that a student browses is
          the one a future AI designer reads when you say &ldquo;build me a robot.&rdquo;
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge className="gap-1 border-amber-200 bg-amber-50 font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            <Sparkles className="h-3 w-3" />
            {availableCount} live model · {LIBRARY.length} components
          </Badge>
          <Badge variant="secondary" className="gap-1 font-medium">
            <Link2 className="h-3 w-3" />
            Connection contract · ports + DOF
          </Badge>
          <Badge variant="secondary" className="gap-1 font-medium">
            <Weight className="h-3 w-3" />
            Physics + cost data on every part
          </Badge>
          <button
            onClick={exportAiCatalog}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400"
            aria-label="Export the machine-readable AI catalog as JSON"
          >
            <Download className="h-3 w-3" />
            Export AI catalog (JSON)
          </button>
        </div>
      </div>

      {/* Pack shelf */}
      <section className="mt-10" aria-labelledby="packs-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="packs-heading" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <Package className="h-5 w-5 text-amber-500" />
              Component packs
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Download only what you need — curated bundles like game skin packs. Installing
              unlocks the components&apos; spec sheets, physics data and 3D models in your
              library.
            </p>
          </div>
          <Badge variant="outline" className="font-medium text-muted-foreground">
            {packs ? `${installedCount}/${packs.length} installed` : 'Loading…'}
          </Badge>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(packs ?? []).map((p) => {
            const PackIcon = PACK_ICONS[p.icon] ?? Package
            const installing = installingPackId === p.id
            const levelColor =
              p.level === 'Beginner'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            return (
              <Card
                key={p.id}
                className={`flex h-full flex-col transition-all duration-300 ${
                  p.featured
                    ? 'border-amber-300 shadow-sm dark:border-amber-800'
                    : 'hover:border-foreground/25'
                }`}
              >
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                        p.installed
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      <PackIcon className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[11px] font-semibold ${levelColor}`}>{p.level}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {p.sizeMb} MB · {p.priceLabel}
                      </span>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold leading-tight">{p.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.tagline}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.componentIds.map((cid) => {
                      const comp = getComponent(cid)
                      const modeled = comp?.status === 'available'
                      return (
                        <span
                          key={cid}
                          className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              modeled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
                            }`}
                          />
                          {comp?.name ?? cid}
                        </span>
                      )
                    })}
                  </div>

                  <div className="mt-auto space-y-2 pt-1">
                    {installing ? (
                      <div className="space-y-1.5" aria-live="polite">
                        <Progress value={progress} className="h-1.5" />
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Downloading… {Math.round(progress)}%
                        </p>
                      </div>
                    ) : p.installed ? (
                      <div className="flex items-center gap-2">
                        <Badge className="flex-1 justify-center gap-1 border-emerald-200 bg-emerald-50 font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                          <Check className="h-3 w-3" />
                          Installed
                        </Badge>
                        {p.id !== FEATURED_PACK_ID && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-500"
                            aria-label={`Remove ${p.name}`}
                            title={`Remove ${p.name}`}
                            onClick={() => uninstallPackFlow(p.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full gap-1.5 font-medium"
                        aria-label={`Add ${p.name} to your library`}
                        onClick={() => installPackFlow(p.id)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Add to library
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {!packs && (
            <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
              Loading pack catalog from the library service…
            </p>
          )}
        </div>
      </section>

      {/* Search + category filter */}
      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search components…"
            className="pl-8"
            aria-label="Search components"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter by category">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                category === c
                  ? 'border-foreground/80 bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {items.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-2 text-center text-muted-foreground">
          <Search className="h-8 w-8 opacity-40" />
          <p className="text-sm">No components match your filters.</p>
          <button
            className="text-xs font-medium text-amber-600 underline-offset-4 hover:underline dark:text-amber-400"
            onClick={() => {
              setQuery('')
              setCategory('All')
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Featured: the servo motor with a live 3D preview */}
          {servo && !isLocked('servo-motor') && (
            <Card
              role="button"
              tabIndex={0}
              aria-label="Open the Servo Motor 3D model"
              onClick={onOpenServo}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onOpenServo()
              }}
              className="group cursor-pointer overflow-hidden transition-all duration-300 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-100 dark:hover:border-amber-800 dark:hover:shadow-none sm:col-span-2"
            >
              <CardContent className="flex flex-col gap-0 p-0 md:flex-row">
                <div
                  className="relative h-60 min-w-0 flex-1 overflow-hidden md:h-auto"
                  style={{ background: STUDIO_BG }}
                >
                  <ServoStage
                    variant="mini"
                    showCable={false}
                    autoSweep={{ min: 15, max: 165, speed: 75 }}
                  />
                  <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-amber-700 shadow-sm backdrop-blur dark:border-amber-800 dark:bg-zinc-900/90 dark:text-amber-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                    </span>
                    Live · WebGL preview
                  </span>
                  <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-medium text-zinc-500">
                    Horn is sweeping — open to take control
                  </span>
                </div>

                <div className="flex w-full flex-col gap-3 border-t p-5 md:w-[270px] md:shrink-0 md:border-l md:border-t-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <RotateCw className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="font-medium">
                      {servo.category}
                    </Badge>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold leading-tight">{servo.name}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{servo.tagline}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    <span className="rounded border px-1.5 py-0.5">180° travel</span>
                    <span className="rounded border px-1.5 py-0.5">PWM 50 Hz</span>
                    <span className="rounded border px-1.5 py-0.5">7 ports · 1 DOF</span>
                    <span className="rounded border px-1.5 py-0.5">{servo.mass} g</span>
                    <span className="rounded border px-1.5 py-0.5">from ${servo.priceUsd}</span>
                  </div>
                  <Button className="mt-auto w-full gap-1.5 font-medium" aria-label="Open the servo motor 3D model">
                    Open 3D model
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Locked servo placeholder (pack removed) */}
          {servo && isLocked('servo-motor') && (
            <LockedCard
              component={servo}
              pack={packOf('servo-motor')}
              onGetPack={installPackFlow}
            />
          )}

          {/* Upcoming components */}
          {upcoming.map((c) =>
            isLocked(c.id) ? (
              <LockedCard key={c.id} component={c} pack={packOf(c.id)} onGetPack={installPackFlow} />
            ) : (
              <Card
                key={c.id}
                role="button"
                tabIndex={0}
                aria-label={`${c.name} — spec sheet available, 3D model coming soon`}
                onClick={() =>
                  toast({
                    title: `${c.name} is modeled next`,
                    description: `Spec sheet unlocked: ${c.mass} g, from $${c.priceUsd}. The procedural 3D model is in the modeling queue.`,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ')
                    toast({
                      title: `${c.name} is modeled next`,
                      description: `Spec sheet unlocked: ${c.mass} g, from $${c.priceUsd}. The procedural 3D model is in the modeling queue.`,
                    })
                }}
                className="cursor-pointer transition-all duration-300 hover:border-foreground/25"
              >
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <c.icon className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="gap-1 font-medium text-muted-foreground">
                      <Clock3 className="h-3 w-3" />
                      3D queued
                    </Badge>
                  </div>
                  <div>
                    <h2 className="font-semibold leading-tight">{c.name}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.tagline}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                    <span>{c.category}</span>
                    <span className="flex items-center gap-2 opacity-80">
                      <span className="inline-flex items-center gap-1">
                        <Weight className="h-3 w-3" />
                        {c.mass} g
                      </span>
                      <span>from ${c.priceUsd}</span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}

      {/* Assembly Lab — the connect-components proof of concept */}
      <div className="mt-10">
        <Card
          role="button"
          tabIndex={0}
          aria-label="Open the Assembly Lab"
          onClick={onOpenLab}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onOpenLab()
          }}
          className="group cursor-pointer overflow-hidden border-zinc-200 bg-zinc-900 text-zinc-50 transition-all duration-300 hover:border-amber-400/60 hover:shadow-xl hover:shadow-amber-500/10 dark:border-zinc-800"
        >
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-7">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <Bot className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">Assembly Lab</h2>
                <Badge className="gap-1 border-amber-400/30 bg-amber-500/15 font-medium text-amber-300">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                  </span>
                  Live mechanism
                </Badge>
              </div>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-400">
                See components working together: the servo bolts to a chassis deck through its
                mount ports and drives a crank-rocker linkage through its output shaft. Command
                it, drag the crank, watch the motion transmit — this is how robots get built here.
              </p>
            </div>
            <Button className="w-full shrink-0 gap-1.5 font-medium sm:w-auto" aria-label="Open the Assembly Lab">
              Open Assembly Lab
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Model Studio — bring your own parts to the same library */}
      <div className="mt-4">
        <Card
          role="button"
          tabIndex={0}
          aria-label="Open the Model Studio"
          onClick={onOpenStudio}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onOpenStudio()
          }}
          className="group cursor-pointer overflow-hidden border-amber-200 bg-amber-50/60 transition-all duration-300 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:hover:shadow-none"
        >
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-7">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <CloudUpload className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">Model Studio</h2>
                <Badge variant="outline" className="gap-1 border-amber-300 font-medium text-amber-700 dark:border-amber-700 dark:text-amber-400">
                  Supabase cloud
                </Badge>
              </div>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Bring your own parts: upload GLB · glTF · STL exports from OpenSCAD or CAD to your
                Supabase project — they render in a live auto-fit viewer and join the AI-readable
                catalog. The same on-ramp the built-in components will use.
              </p>
            </div>
            <Button className="w-full shrink-0 gap-1.5 font-medium sm:w-auto" aria-label="Open the Model Studio">
              Open Model Studio
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Locked component card                                               */
/* ------------------------------------------------------------------ */

function LockedCard({
  component,
  pack,
  onGetPack,
}: {
  component: { id: string; name: string; tagline: string; category: string; mass: number; priceUsd: number; icon: typeof Bot }
  pack?: PackState
  onGetPack: (packId: string) => void
}) {
  return (
    <Card className="relative overflow-hidden opacity-90">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <component.icon className="h-5 w-5 opacity-60" />
          </div>
          <Badge variant="outline" className="gap-1 font-medium text-muted-foreground">
            <Lock className="h-3 w-3" />
            Pack required
          </Badge>
        </div>
        <div>
          <h2 className="font-semibold leading-tight text-muted-foreground">{component.name}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground/80">{component.tagline}</p>
        </div>
        <div className="mt-auto space-y-2.5 pt-2">
          <p className="text-xs text-muted-foreground">
            Included in the{' '}
            <span className="font-medium text-foreground">{pack?.name ?? 'component pack'}</span>
            <span className="ml-2 inline-flex items-center gap-1 opacity-75">
              <Weight className="h-3 w-3" />
              {component.mass} g · from ${component.priceUsd}
            </span>
          </p>
          {pack && (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 font-medium"
              onClick={() => onGetPack(pack.id)}
              aria-label={`Add ${pack.name} to unlock ${component.name}`}
            >
              <Download className="h-3.5 w-3.5" />
              Get {pack.name}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
