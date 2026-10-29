'use client'

import { ArrowLeft, Plus } from 'lucide-react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { firstSentences, formatBytes, type PlayComponent } from '@/lib/playground'

const ServoStage = dynamic(() => import('@/components/three/ServoStage'), { ssr: false })
const BatteryStage = dynamic(() => import('@/components/three/BatteryStage'), { ssr: false })
const BoardStage = dynamic(() => import('@/components/three/BoardStage'), { ssr: false })
const ModelStage = dynamic(() => import('@/components/three/ModelStage'), { ssr: false })
const PartStage = dynamic(() => import('@/components/three/PartStage'), { ssr: false })

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
            ) : c.kind === 'controller' ? (
              <BoardStage />
            ) : c.modelUrl ? (
              <ModelStage url={c.modelUrl} kind={c.kind as 'gltf' | 'stl'} autoRotate />
            ) : (
              <PartStage kind={c.kind} />
            )}
          </div>
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            {c.kind === 'servo'
              ? 'Drag the horn — it steers like the real thing.'
              : c.kind === 'battery'
                ? 'Wire it to components in the playground to power them.'
                : c.kind === 'controller'
                  ? 'Wire the 9V battery into its VIN jack — its 5 V pins then power servos.'
                  : c.kind === 'esc'
                    ? 'Battery into its leads, motor onto its terminals — its BEC feeds 5 V back out.'
                    : c.kind === 'lipo'
                      ? 'The 11.1 V tank — powers ESCs and controllers through its XT60.'
                      : c.kind === 'stepper'
                        ? 'Needs a current-controlled driver board — it never wires straight to a battery.'
                        : c.kind === 'strainwave'
                          ? 'Couple a motor’s shaft into the wave generator — the flexspline crawls at 1/100th the speed.'
                          : c.kind === 'planetary'
                            ? 'Drive the sun gear — the carrier creeps out at 1/5th speed, three planets sharing the load.'
                            : c.kind === 'ballscrew'
                              ? 'Couple a motor onto the journal — the ball nut glides along at 4 mm per turn.'
                              : c.kind === 'muscle'
                                ? 'Feed it air from the mini pump — the braid contracts and it pulls.'
                                : c.kind === 'vaneact'
                                  ? 'Feed it air — the shaft swings through its 270° arc and holds on the stop.'
                                  : c.kind === 'airpump'
                                    ? 'Wire it to the 9V battery — its nozzle feeds air to muscles and vane motors.'
                                    : c.kind === 'capacitor'
                                      ? 'Clip it across a battery’s terminals — it smooths that rail for everything on it.'
                                      : c.kind === 'screw'
                                        ? 'Thread it into any M3 hole — the fastener that holds robots together.'
                                        : c.kind === 'rotaryact'
                                          ? 'Wire it to the battery — the keyed shaft turns continuously at 30 RPM.'
                                          : c.kind === 'linact'
                                            ? 'Wire it to the battery — the chrome rod pushes and pulls at 12 mm/s.'
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

          {(c.kind === 'gltf' || c.kind === 'stl') && (
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
