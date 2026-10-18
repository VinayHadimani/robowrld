'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Activity,
  ArrowLeft,
  Bot,
  Check,
  ChevronRight,
  Copy,
  Gauge,
  Hand,
  Link2,
  MousePointer2,
  MoveHorizontal,
  Orbit,
  Workflow,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { RigTelemetry } from '@/components/three/MechanismRig'
import { PORT_KIND_LABEL, SERVO_MODEL } from '@/lib/connections'
import { useToast } from '@/hooks/use-toast'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

const AssemblyStage = dynamic(() => import('@/components/three/AssemblyStage'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-muted-foreground">
      Loading assembly…
    </div>
  ),
})

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const ANGLE_PRESETS = [0, 45, 90, 135, 180]

/** How each servo port is consumed by this rig. */
const PORT_USAGE: Record<string, string> = {
  'mount-r1': 'Deck bolt hole — M3 bolt (this rig)',
  'mount-r2': 'Free — spare tab hole',
  'mount-l1': 'Deck bolt hole — M3 bolt (this rig)',
  'mount-l2': 'Free — spare tab hole',
  shaft: 'Crank hub — 25T spline (this rig)',
  'base-face': 'Free — bracket / chassis mount',
  signal: 'PWM driver (electrical, not mechanical)',
}

/** The assembly graph — what bolts to what, through which ports. */
const RIG_CONNECTIONS: Array<{ from: string; to: string; via: string }> = [
  { from: 'servo.mount-r1', to: 'deck.hole-r1', via: 'M3 bolt + nyloc nut' },
  { from: 'servo.mount-l1', to: 'deck.hole-l1', via: 'M3 bolt + nyloc nut' },
  { from: 'servo.shaft', to: 'crank.hub', via: '25T spline + screw' },
  { from: 'crank.pin', to: 'rocker.pin', via: 'connecting rod · ball ends' },
  { from: 'rocker.hub', to: 'post.bearing', via: 'pivot shoulder + cap' },
  { from: 'post.flange', to: 'deck.holes', via: '2× M3 bolts' },
  { from: 'effector.plate', to: '— free port —', via: '2× M3 · attach the next part' },
]

const RIG_CODE = `import { ServoMotor } from "@/components/three/ServoMotor"
import { MechanismRig } from "@/components/three/MechanismRig"

// The servo streams its TRUE shaft angle into the rig —
// one ref, zero re-renders per frame:
const shaft = useRef(90)

// The servo drops through the deck pocket; its mount ports
// land exactly on the deck's bolt holes:
<ServoMotor
  position={[0, 0, 0]}
  showHorn={false}        // the crank takes over the shaft port
  liveAngleRef={shaft}    // publishes the live angle
  interactive
  grabRadius={3.8}        // the whole crank is grabbable
/>

// The rig reads shaft.current and solves the four-bar:
//   |P − Q| = L   (crank pin → rocker pin, branch-safe)
<MechanismRig liveAngleRef={shaft} />

// Add your next component by bolting it to the
// effector plate's free 2× M3 port…`

const STUDIO_BG =
  'radial-gradient(ellipse at 50% 30%, #ffffff 0%, #f0f2f6 55%, #e2e5ea 100%)'

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function AssemblyLab({ onBack }: { onBack: () => void }) {
  const [angle, setAngle] = useState(90)
  const angleRef = useRef(90)
  const [speed, setSpeed] = useState(320)
  const [sweep, setSweep] = useState(false)
  const [showLabels, setShowLabels] = useState(false)
  const [showPorts, setShowPorts] = useState(false)
  const [autoRotate, setAutoRotate] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  // Live telemetry from the rig (mutated in-place by useFrame)
  const telemetryRef = useRef<RigTelemetry>({ crank: 90, rocker: 0, rod: 0, effX: 0, effZ: 0 })

  // DOM readouts, refreshed without React re-renders
  const hudCrank = useRef<HTMLSpanElement>(null)
  const hudRocker = useRef<HTMLSpanElement>(null)
  const hudRod = useRef<HTMLSpanElement>(null)
  const hudEff = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      if (t - last > 40) {
        last = t
        const tel = telemetryRef.current
        if (hudCrank.current) hudCrank.current.textContent = `${Math.round(tel.crank)}°`
        if (hudRocker.current) hudRocker.current.textContent = `${tel.rocker.toFixed(1)}°`
        if (hudRod.current) hudRod.current.textContent = `${tel.rod.toFixed(1)}°`
        if (hudEff.current) hudEff.current.textContent = `x ${tel.effX.toFixed(2)} · z ${tel.effZ.toFixed(2)}`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const setAngleBoth = useCallback((a: number) => {
    angleRef.current = a
    setAngle(a)
  }, [])

  /* Sweep generator — commands the angle; the servo + rig track it. */
  useEffect(() => {
    if (!sweep) return
    let raf = 0
    let last = performance.now()
    let acc = 0
    let dir = 1
    const tick = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.06)
      last = t
      acc += dt
      if (acc >= 0.04) {
        const next = clamp(angleRef.current + dir * speed * acc, 0, 180)
        if (next === 180) dir = -1
        else if (next === 0) dir = 1
        acc = 0
        angleRef.current = next
        setAngle(next)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [sweep, speed])

  const handleDragState = useCallback(
    (d: boolean) => {
      setDragging(d)
      if (d && sweep) setSweep(false)
    },
    [sweep]
  )

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(RIG_CODE)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: 'Copy failed', description: 'Clipboard is not available in this context.' })
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      {/* Back + breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" className="gap-1.5 px-2 font-medium" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Library
        </Button>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">Assembly Lab</span>
      </div>

      {/* Title */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Assembly Lab</h1>
        <Badge variant="secondary" className="font-medium">Proof of concept</Badge>
        <Badge className="gap-1 border-amber-200 bg-amber-50 font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <Bot className="h-3 w-3" />
          Working mechanism
        </Badge>
      </div>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
        This is what the library is for: components that <em>bolt together</em> into working
        machines. The servo below is the exact same reusable component from its detail page —
        mounted to a chassis deck through its four M3 mount ports, driving a crank-rocker
        linkage through its output shaft. Command it, drag the crank, or let it sweep; the
        motion transmits through the connecting rod to the rocker arm, exactly like a robot
        joint. Every connection is a declared port in the connection contract, so future
        components (brackets, grippers, wheels) snap in the same way.
      </p>

      {/* Viewer + controls */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* 3D viewer */}
        <Card className="relative overflow-hidden p-0">
          <div className="relative h-[420px] w-full sm:h-[520px] lg:h-[600px]" style={{ background: STUDIO_BG }}>
            <AssemblyStage
              angle={angle}
              speed={speed}
              showLabels={showLabels}
              showPorts={showPorts}
              autoRotate={autoRotate}
              onAngleChange={setAngleBoth}
              onDragStateChange={handleDragState}
              telemetryRef={telemetryRef}
            />

            {/* Telemetry HUD */}
            <div className="pointer-events-none absolute right-3 top-3 rounded-xl border border-zinc-200 bg-white/85 px-3.5 py-2.5 text-right shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/85">
              <div className="flex items-center justify-end gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <Activity className="h-3 w-3" />
                Kinematics · live
              </div>
              <div className="mt-1 flex items-baseline justify-end gap-1">
                <span ref={hudCrank} className="font-mono text-2xl font-bold tabular-nums leading-none text-zinc-900 dark:text-zinc-50">
                  90°
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">crank</span>
              </div>
              <div className="mt-1.5 space-y-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                <div>
                  rocker <span ref={hudRocker} className="font-semibold text-foreground">0.0°</span>
                </div>
                <div>
                  rod <span ref={hudRod} className="font-semibold text-foreground">0.0°</span>
                </div>
                <div>
                  eff <span ref={hudEff} className="font-semibold text-foreground">x 0.00 · z 0.00</span>
                </div>
              </div>
            </div>

            {/* Drag state badge */}
            {dragging && (
              <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-semibold text-white shadow-md">
                <Hand className="h-3 w-3" />
                Driving mechanism…
              </div>
            )}

            {/* Interaction hint */}
            <div className="pointer-events-none absolute bottom-3 left-1/2 flex max-w-[92%] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-zinc-200/70 bg-white/80 px-4 py-1.5 text-[11px] font-medium text-zinc-500 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <Orbit className="h-3 w-3" /> Drag background to orbit
              </span>
              <span className="inline-flex items-center gap-1">
                <MousePointer2 className="h-3 w-3" /> Drag the crank to drive
              </span>
              <span className="hidden items-center gap-1 sm:inline-flex">
                <Gauge className="h-3 w-3" /> Scroll to zoom
              </span>
            </div>
          </div>
        </Card>

        {/* Control panel */}
        <div className="flex flex-col gap-4">
          {/* Command */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MoveHorizontal className="h-4 w-4 text-amber-500" />
                Command the servo
              </CardTitle>
              <CardDescription>Same interface as the component page — 0–180°.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="rig-angle" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Commanded angle
                </Label>
                <span className="font-mono text-lg font-semibold tabular-nums">{Math.round(angle)}°</span>
              </div>
              <Slider
                id="rig-angle"
                value={[angle]}
                min={0}
                max={180}
                step={1}
                onValueChange={([v]) => setAngleBoth(v)}
                aria-label="Commanded servo angle"
              />
              <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                <span>0°</span>
                <span>90°</span>
                <span>180°</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {ANGLE_PRESETS.map((p) => (
                  <Button
                    key={p}
                    variant={Math.round(angle) === p ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 px-0 font-mono text-xs tabular-nums"
                    onClick={() => setAngleBoth(p)}
                    aria-label={`Command ${p} degrees`}
                  >
                    {p}°
                  </Button>
                ))}
              </div>

              <Separator />

              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <div>
                  <Label htmlFor="rig-sweep" className="text-sm font-medium">
                    Sweep mode
                  </Label>
                  <p className="text-xs text-muted-foreground">Oscillate 0° ↔ 180° continuously</p>
                </div>
                <Switch id="rig-sweep" checked={sweep} onCheckedChange={setSweep} />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="rig-speed" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Travel speed
                  </Label>
                  <span className="font-mono text-sm font-semibold tabular-nums">{speed} °/s</span>
                </div>
                <Slider
                  id="rig-speed"
                  value={[speed]}
                  min={60}
                  max={600}
                  step={10}
                  onValueChange={([v]) => setSpeed(v)}
                  aria-label="Servo travel speed"
                />
                <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                  <span>sluggish 60</span>
                  <span>fast 600</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* View options */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Workflow className="h-4 w-4 text-amber-500" />
                View options
              </CardTitle>
              <CardDescription>X-ray the assembly architecture.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {(
                [
                  { id: 'labels', label: 'Part labels', desc: 'Annotate the assembly', value: showLabels, set: setShowLabels },
                  { id: 'ports', label: 'Servo ports', desc: 'Show the connection contract', value: showPorts, set: setShowPorts },
                  { id: 'rotate', label: 'Turntable', desc: 'Auto-rotate the camera', value: autoRotate, set: setAutoRotate },
                ] as Array<{ id: string; label: string; desc: string; value: boolean; set: (v: boolean) => void }>
              ).map((t) => (
                <div key={t.id} className="flex items-center justify-between">
                  <div>
                    <Label htmlFor={`rig-switch-${t.id}`} className="text-sm font-medium">
                      {t.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                  <Switch id={`rig-switch-${t.id}`} checked={t.value} onCheckedChange={t.set} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Connection contract / assembly graph / code */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4 text-amber-500" />
              The connection contract
            </CardTitle>
            <CardDescription>Every component declares ports + motion.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="leading-relaxed text-muted-foreground">
              Ports are typed interfaces — <span className="font-medium text-foreground">bolt holes</span>,{' '}
              <span className="font-medium text-foreground">spline shafts</span>,{' '}
              <span className="font-medium text-foreground">mount faces</span> and{' '}
              <span className="font-medium text-foreground">pin sockets</span> — each with an exact
              position, axis and spec. A future builder snaps any two compatible ports together
              and the parts are automatically aligned; kinematics solvers read the degrees of
              freedom instead of hard-coded numbers.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PORT_KIND_LABEL).map(([k, v]) => (
                <div key={k} className="rounded-md bg-muted px-2.5 py-1.5">
                  <div className="text-xs font-semibold">{v}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{k}</div>
                </div>
              ))}
            </div>
            <p className="leading-relaxed text-muted-foreground">
              The servo declares <span className="font-mono text-xs font-semibold text-foreground">7 ports</span> and{' '}
              <span className="font-mono text-xs font-semibold text-foreground">1 DOF</span> (shaft
              rotation, 0–180°, streamed live through <span className="font-mono text-xs">liveAngleRef</span>).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4 text-amber-500" />
              Assembly graph
            </CardTitle>
            <CardDescription>What bolts to what in this rig.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {RIG_CONNECTIONS.map((c, i) => (
                <div key={i} className="rounded-lg border px-3 py-2">
                  <div className="flex items-center justify-between gap-2 font-mono text-xs font-semibold">
                    <span className="truncate">{c.from}</span>
                    <Link2 className="h-3 w-3 shrink-0 text-amber-500" />
                    <span className="truncate text-right">{c.to}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{c.via}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Reuse the pattern</CardTitle>
                <CardDescription>One ref connects actuator to mechanism.</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={copyCode}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="overflow-auto rounded-lg" style={{ maxHeight: 430 }}>
              <SyntaxHighlighter
                language="tsx"
                style={oneDark}
                codeTagProps={{ className: 'font-mono text-[11px] leading-relaxed' }}
                customStyle={{ margin: 0, borderRadius: 8, fontSize: 11.5, padding: '14px 16px', background: '#18181b' }}
              >
                {RIG_CODE}
              </SyntaxHighlighter>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Port map */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Servo port map{' '}
            <span className="font-mono text-sm font-normal text-muted-foreground">
              ({SERVO_MODEL.ports.length} ports · {SERVO_MODEL.dof.length} DOF)
            </span>
          </CardTitle>
          <CardDescription>
            The declared interfaces of the servo component, and how this assembly uses them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-0">Port</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Position (local)</TableHead>
                <TableHead>Spec</TableHead>
                <TableHead className="pr-0 text-right">Used by this rig</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SERVO_MODEL.ports.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="py-2.5 pl-0 font-mono text-xs font-semibold">{p.id}</TableCell>
                  <TableCell className="py-2.5 text-xs text-muted-foreground">{PORT_KIND_LABEL[p.kind]}</TableCell>
                  <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">
                    [{p.position.map((v) => v.toFixed(2)).join(', ')}]
                  </TableCell>
                  <TableCell className="py-2.5 text-xs text-muted-foreground">{p.spec}</TableCell>
                  <TableCell className="py-2.5 pr-0 text-right text-xs">{PORT_USAGE[p.id] ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
