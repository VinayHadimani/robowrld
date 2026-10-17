'use client'

import { ArrowLeft, Plus } from 'lucide-react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { firstSentences, formatBytes, type PlayComponent } from '@/lib/playground'

const ServoStage = dynamic(() => import('@/components/three/ServoStage'), { ssr: false })
const BatteryStage = dynamic(() => import('@/components/three/BatteryStage'), { ssr: false })
const ModelStage = dynamic(() => import('@/components/three/ModelStage'), { ssr: false })

/**
 * Component detail — a virtual version of the real machine on the left,
 * a little bit of information on the right, one action: add to playground.
 */
export function ComponentView({
  component,
  onBack,
  onAdd,
}: {
  component: PlayComponent
  onBack: () => void
  onAdd: (component: PlayComponent) => void
}) {
  const c = component

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Components
      </button>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* The virtual machine */}
        <div>
          <div className="h-[380px] overflow-hidden rounded-xl border bg-muted/30 sm:h-[460px] lg:h-[560px]">
            {c.kind === 'servo' ? (
              <ServoStage interactive showCable />
            ) : c.kind === 'battery' ? (
              <BatteryStage />
            ) : c.modelUrl ? (
              <ModelStage url={c.modelUrl} kind={c.kind} autoRotate />
            ) : null}
          </div>
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            {c.kind === 'servo'
              ? 'Drag the horn — it steers like the real thing.'
              : c.kind === 'battery'
                ? 'Connect it to components in the playground to power them.'
                : 'Drag to orbit · scroll to zoom.'}
          </p>
        </div>

        {/* A little bit of information */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            {c.tagline && <p className="mt-1 text-sm text-muted-foreground">{c.tagline}</p>}
          </div>

          {c.description && (
            <p className="text-sm leading-relaxed text-foreground/90">
              {firstSentences(c.description, 2)}
            </p>
          )}

          {c.specs.length > 0 && (
            <dl className="text-sm">
              {c.specs.slice(0, 5).map((s) => (
                <div key={s.label} className="flex items-baseline justify-between gap-4 border-b py-1.5">
                  <dt className="shrink-0 text-muted-foreground">{s.label}</dt>
                  <dd className="text-right font-medium">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {c.kind !== 'servo' && c.kind !== 'battery' && (
            <dl className="text-sm">
              <div className="flex items-baseline justify-between gap-4 border-b py-1.5">
                <dt className="shrink-0 text-muted-foreground">Format</dt>
                <dd className="font-medium">{c.kind === 'stl' ? 'STL' : 'glTF'}</dd>
              </div>
              {c.fileSize != null && (
                <div className="flex items-baseline justify-between gap-4 border-b py-1.5">
                  <dt className="shrink-0 text-muted-foreground">File size</dt>
                  <dd className="font-medium">{formatBytes(c.fileSize)}</dd>
                </div>
              )}
            </dl>
          )}

          <Button className="mt-auto w-full" onClick={() => onAdd(c)}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Add to Playground
          </Button>
        </div>
      </div>
    </div>
  )
}
