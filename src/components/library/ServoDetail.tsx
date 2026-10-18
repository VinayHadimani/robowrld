'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  ArrowLeft,
  Bot,
  BrainCircuit,
  Check,
  ChevronRight,
  Circle,
  Copy,
  Gauge,
  Hand,
  Link2,
  MousePointer2,
  MoveHorizontal,
  MoveRight,
  Orbit,
  RotateCw,
  Scale,
  ShoppingCart,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PwmWaveform } from '@/components/three/PwmWaveform'
import type { HornType } from '@/components/three/ServoMotor'
import { PORT_KIND_LABEL, SERVO_MODEL } from '@/lib/connections'
import { SERVO } from '@/lib/component-schema'
import { useToast } from '@/hooks/use-toast'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

const ServoStage = dynamic(() => import('@/components/three/ServoStage'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-muted-foreground">
      Loading 3D model…
    </div>
  ),
})

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const BODY_COLORS = [
  { id: 'classic', name: 'Classic Blue', value: '#1c56b2' },
  { id: 'midnight', name: 'Midnight Black', value: '#181a20' },
  { id: 'alpine', name: 'Alpine White', value: '#e9e7df' },
]

const ANGLE_PRESETS = [0, 45, 90, 135, 180]

// Specs, physics, commerce and AI profile now live in src/lib/component-schema.ts —
// the platform's single source of truth. This page only renders them.

const AI_JSON = JSON.stringify(
  {
    id: SERVO.id,
    name: SERVO.name,
    category: SERVO.category,
    mass_g: SERVO.physics.mass,
    dimensions_mm: SERVO.physics.dimensions,
    price_usd: SERVO.commerce.priceUsd,
    ports: SERVO_MODEL.ports.length,
    dof: SERVO_MODEL.dof.map((d) => ({ kind: d.kind, range_deg: d.range, axis: d.axis })),
    ai: SERVO.ai,
  },
  null,
  2
)

const AI_DEMO_SELECTION = [
  { name: 'Servo Motor', role: 'Steering — holds an angle while the robot drives', self: true },
  { name: 'DC Gear Motor + Speed Controller', role: 'Traction — continuous rotation at speed', self: false },
  { name: 'Ultrasonic Sensor', role: 'Obstacle eyes — 2–400 cm time-of-flight', self: false },
  { name: 'LiPo Battery', role: 'Power budget — 55 A headroom for stall spikes', self: false },
]

const PINOUT = [
  { color: '#f0801e', name: 'Orange', pin: 'Signal', detail: 'PWM input · 50 Hz · 0.5–2.5 ms' },
  { color: '#c33131', name: 'Red', pin: 'V+', detail: '4.8 – 7.2 V motor supply' },
  { color: '#5d3a21', name: 'Brown', pin: 'GND', detail: 'Common ground with controller' },
]

const USAGE_CODE = `import { ServoMotor } from "@/components/three/ServoMotor"

// 1 — Drop it into any React Three Fiber canvas.
//     No model files, no assets, fully procedural:
<Canvas camera={{ position: [7.6, 5.6, 9.8], fov: 34 }}>
  <ambientLight intensity={0.4} />
  <directionalLight position={[5, 9, 6]} intensity={2.3} />
  <ServoMotor angle={90} hornType="single" interactive />
</Canvas>

// 2 — Drive it like a real servo: change the angle
//     prop and the horn tracks it at \`speed\` deg/s.
setAngle(180)

// 3 — Bolt it into a mechanism: stream its true shaft
//     angle to a linkage solver (see the Assembly Lab):
const shaft = useRef(90)
<ServoMotor liveAngleRef={shaft} showHorn={false} />`

const API_PROPS: Array<{ prop: string; type: string; def: string; note: string }> = [
  { prop: 'angle', type: 'number', def: '90', note: 'Commanded angle, 0–180°' },
  { prop: 'speed', type: 'number', def: '400', note: 'Max travel speed, °/s' },
  { prop: 'hornType', type: '"single" | "double" | "round"', def: '"single"', note: 'Output horn style' },
  { prop: 'bodyColor', type: 'string', def: '#1c56b2', note: 'Case color (CSS)' },
  { prop: 'showHorn / showCable / showLabels', type: 'boolean', def: 'true / true / false', note: 'Toggle sub-parts' },
  { prop: 'showPorts', type: 'boolean', def: 'false', note: 'Render connection-port markers + DOF arc' },
  { prop: 'interactive', type: 'boolean', def: 'false', note: 'Pointer-drag the horn' },
  { prop: 'grabRadius / grabY', type: 'number', def: '1.06 / 5.32', note: 'Grab volume size & height (rigged cranks)' },
  { prop: 'autoSweep', type: '{ min, max, speed } | false', def: 'false', note: 'Built-in sweep animation' },
  { prop: 'onAngleChange', type: '(deg) => void', def: '—', note: 'Fires while dragging' },
  { prop: 'liveAngleRef', type: '{ current: number }', def: '—', note: 'Streams the true shaft angle every frame' },
]

const STUDIO_BG =
  'radial-gradient(ellipse at 50% 30%, #ffffff 0%, #f0f2f6 55%, #e2e5ea 100%)'

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ServoDetail({ onBack, onOpenLab }: { onBack: () => void; onOpenLab: () => void }) {
  const [angle, setAngle] = useState(90)
  const angleRef = useRef(90)
  const [speed, setSpeed] = useState(400)
  const [sweep, setSweep] = useState(false)
  const [hornType, setHornType] = useState<HornType>('single')
  const [bodyColor, setBodyColor] = useState(BODY_COLORS[0].value)
  const [showCable, setShowCable] = useState(true)
  const [showLabels, setShowLabels] = useState(false)
  const [showPorts, setShowPorts] = useState(false)
  const [autoRotate, setAutoRotate] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)
  const { toast } = useToast()

  const pulseMs = 0.5 + (angle / 180) * 2
  const duty = (pulseMs / 20) * 100

  const setAngleBoth = useCallback((a: number) => {
    angleRef.current = a
    setAngle(a)
  }, [])

  /* Sweep generator — updates the commanded angle ~25 times per second;
     the servo component itself smooths the motion at its speed limit. */
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
      if (d && sweep) setSweep(false) // grabbing the horn cancels sweep
    },
    [sweep]
  )

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(USAGE_CODE)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: 'Copy failed', description: 'Clipboard is not available in this context.' })
    }
  }

  const copyAiJson = async () => {
    try {
      await navigator.clipboard.writeText(AI_JSON)
      setCopiedJson(true)
      setTimeout(() => setCopiedJson(false), 2000)
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
        <span className="text-muted-foreground">Actuators</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">Servo Motor</span>
      </div>

      {/* Title */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Servo Motor</h1>
        <Badge variant="secondary" className="font-medium">Actuators</Badge>
        <Badge className="gap-1 border-amber-200 bg-amber-50 font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <RotateCw className="h-3 w-3" />
          Interactive 3D
        </Badge>
        <Badge variant="outline" className="gap-1 font-medium text-muted-foreground">
          <Link2 className="h-3 w-3" />
          {SERVO_MODEL.ports.length} ports · {SERVO_MODEL.dof.length} DOF
        </Badge>
        <Badge variant="outline" className="gap-1 font-medium text-muted-foreground">
          <Scale className="h-3 w-3" />
          {SERVO.physics.mass} g · from ${SERVO.commerce.priceUsd[0]}
        </Badge>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5 font-medium" onClick={onOpenLab}>
          <Bot className="h-4 w-4 text-amber-500" />
          Open in Assembly Lab
        </Button>
      </div>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
        A servo motor is a rotary actuator that rotates to a commanded position and actively
        holds it there using closed-loop feedback from an internal potentiometer. It is
        driven by a PWM signal — at 50 Hz, a 0.5 ms pulse commands 0° and a 2.5 ms pulse
        commands 180°. This replica is modeled procedurally after a metal-gear hobby servo:
        drag the horn with your pointer, sweep it back and forth, swap horns and colors, and
        watch the control signal respond in real time.
      </p>

      {/* Viewer + controls */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* 3D viewer */}
        <Card className="relative overflow-hidden p-0">
          <div className="relative h-[420px] w-full sm:h-[520px] lg:h-[600px]" style={{ background: STUDIO_BG }}>
            <ServoStage
              angle={angle}
              speed={speed}
              bodyColor={bodyColor}
              hornType={hornType}
              showCable={showCable}
              showLabels={showLabels}
              showPorts={showPorts}
              interactive
              autoRotate={autoRotate}
              onAngleChange={setAngleBoth}
              onDragStateChange={handleDragState}
            />

            {/* Angle HUD */}
            <div className="pointer-events-none absolute right-3 top-3 rounded-xl border border-zinc-200 bg-white/85 px-3.5 py-2.5 text-right shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/85">
              <div className="font-mono text-2xl font-bold tabular-nums leading-none text-zinc-900 dark:text-zinc-50">
                {Math.round(angle)}
                <span className="text-sm font-medium text-muted-foreground">°</span>
              </div>
              <div className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                pulse {pulseMs.toFixed(2)} ms
              </div>
            </div>

            {/* Drag state badge */}
            {dragging && (
              <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-semibold text-white shadow-md">
                <Hand className="h-3 w-3" />
                Driving servo…
              </div>
            )}

            {/* Interaction hint */}
            <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-zinc-200/70 bg-white/80 px-4 py-1.5 text-[11px] font-medium text-zinc-500 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <Orbit className="h-3 w-3" /> Drag background to orbit
              </span>
              <span className="inline-flex items-center gap-1">
                <MousePointer2 className="h-3 w-3" /> Drag the horn to steer
              </span>
              <span className="hidden items-center gap-1 sm:inline-flex">
                <Gauge className="h-3 w-3" /> Scroll to zoom
              </span>
            </div>
          </div>
        </Card>

        {/* Control panel */}
        <div className="flex flex-col gap-4">
          {/* Position */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MoveHorizontal className="h-4 w-4 text-amber-500" />
                Position control
              </CardTitle>
              <CardDescription>Command the output shaft, 0–180°.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="angle-slider" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Angle
                </Label>
                <span className="font-mono text-lg font-semibold tabular-nums">{Math.round(angle)}°</span>
              </div>
              <Slider
                id="angle-slider"
                value={[angle]}
                min={0}
                max={180}
                step={1}
                onValueChange={([v]) => setAngleBoth(v)}
                aria-label="Servo angle"
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
                    aria-label={`Set angle to ${p} degrees`}
                  >
                    {p}°
                  </Button>
                ))}
              </div>

              <Separator />

              {/* PWM scope */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    PWM control signal
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    live
                  </span>
                </div>
                <PwmWaveform angle={angle} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-muted px-2 py-1.5">
                    <div className="font-mono text-sm font-semibold tabular-nums">50 Hz</div>
                    <div className="text-[10px] text-muted-foreground">frequency</div>
                  </div>
                  <div className="rounded-md bg-muted px-2 py-1.5">
                    <div className="font-mono text-sm font-semibold tabular-nums">{pulseMs.toFixed(2)} ms</div>
                    <div className="text-[10px] text-muted-foreground">pulse width</div>
                  </div>
                  <div className="rounded-md bg-muted px-2 py-1.5">
                    <div className="font-mono text-sm font-semibold tabular-nums">{duty.toFixed(1)}%</div>
                    <div className="text-[10px] text-muted-foreground">duty cycle</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Motion */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="h-4 w-4 text-amber-500" />
                Motion
              </CardTitle>
              <CardDescription>Sweep back and forth, or cap the travel speed.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <div>
                  <Label htmlFor="sweep-switch" className="text-sm font-medium">
                    Sweep mode
                  </Label>
                  <p className="text-xs text-muted-foreground">Oscillate 0° ↔ 180° continuously</p>
                </div>
                <Switch id="sweep-switch" checked={sweep} onCheckedChange={setSweep} />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="speed-slider" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Travel speed
                  </Label>
                  <span className="font-mono text-sm font-semibold tabular-nums">{speed} °/s</span>
                </div>
                <Slider
                  id="speed-slider"
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

          {/* Model options */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Circle className="h-4 w-4 text-amber-500" />
                Model options
              </CardTitle>
              <CardDescription>All of these are props on the reusable component.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Horn type</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'single', label: 'Single', icon: MoveRight },
                      { id: 'double', label: 'Double', icon: MoveHorizontal },
                      { id: 'round', label: 'Round', icon: Circle },
                    ] as Array<{ id: HornType; label: string; icon: typeof Circle }>
                  ).map((h) => (
                    <Button
                      key={h.id}
                      variant={hornType === h.id ? 'default' : 'outline'}
                      size="sm"
                      className="h-9 flex-col gap-0.5 text-[11px]"
                      onClick={() => setHornType(h.id)}
                      aria-pressed={hornType === h.id}
                    >
                      <h.icon className="h-4 w-4" />
                      {h.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Body color</span>
                <div className="flex items-center gap-2">
                  {BODY_COLORS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setBodyColor(c.value)}
                      title={c.name}
                      aria-label={`Body color ${c.name}`}
                      aria-pressed={bodyColor === c.value}
                      className={`h-8 w-8 rounded-full border shadow-sm transition-transform hover:scale-110 ${
                        bodyColor === c.value ? 'ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-zinc-950' : ''
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                  <span className="ml-1 text-xs text-muted-foreground">{BODY_COLORS.find((c) => c.value === bodyColor)?.name}</span>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-3">
                {(
                  [
                    { id: 'cable', label: 'Cable & connector', desc: '3-wire lead with pins', value: showCable, set: setShowCable },
                    { id: 'labels', label: 'Part labels', desc: 'Annotate the anatomy', value: showLabels, set: setShowLabels },
                    { id: 'ports', label: 'Connection ports', desc: 'Show the 7 interfaces + DOF arc', value: showPorts, set: setShowPorts },
                    { id: 'rotate', label: 'Turntable', desc: 'Auto-rotate the camera', value: autoRotate, set: setAutoRotate },
                  ] as Array<{ id: string; label: string; desc: string; value: boolean; set: (v: boolean) => void }>
                ).map((t) => (
                  <div key={t.id} className="flex items-center justify-between">
                    <div>
                      <Label htmlFor={`switch-${t.id}`} className="text-sm font-medium">
                        {t.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </div>
                    <Switch id={`switch-${t.id}`} checked={t.value} onCheckedChange={t.set} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Specs / pinout / usage */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Specifications</CardTitle>
            <CardDescription>Metal-gear hobby class — {SERVO.commerce.partNumber} reference.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {SERVO.specs.map((s) => (
                  <TableRow key={s.label}>
                    <TableCell className="py-2.5 pl-0 font-medium">{s.label}</TableCell>
                    <TableCell className="py-2.5 text-right text-muted-foreground">{s.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pinout &amp; wiring</CardTitle>
            <CardDescription>Standard 3-pin servo lead.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {PINOUT.map((p) => (
              <div key={p.pin} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                <span className="h-4 w-4 shrink-0 rounded-full border border-black/10 shadow-inner" style={{ backgroundColor: p.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{p.pin}</span>
                    <span className="text-xs text-muted-foreground">{p.name}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{p.detail}</p>
                </div>
              </div>
            ))}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Tip: always share a common ground between the servo supply and the
              microcontroller, or the PWM reference will float and the servo will jitter.
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Reuse it</CardTitle>
                <CardDescription>The 3D part is a single React component.</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={copyCode}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="overflow-auto rounded-lg" style={{ maxHeight: 340 }}>
              <SyntaxHighlighter
                language="tsx"
                style={oneDark}
                codeTagProps={{ className: 'font-mono text-[11px] leading-relaxed' }}
                customStyle={{ margin: 0, borderRadius: 8, fontSize: 11.5, padding: '14px 16px', background: '#18181b' }}
              >
                {USAGE_CODE}
              </SyntaxHighlighter>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connection interfaces — the assembly-ready contract */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-4 w-4 text-amber-500" />
                Connection interfaces
              </CardTitle>
              <CardDescription>
                The declared ports of this component — what future parts bolt onto.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 font-medium" onClick={onOpenLab}>
              <Bot className="h-4 w-4 text-amber-500" />
              See them working in the Assembly Lab
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 lg:flex-row">
          <div className="min-w-0 flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-0">Port</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Position (local)</TableHead>
                  <TableHead className="pr-0 text-right">Spec</TableHead>
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
                    <TableCell className="py-2.5 pr-0 text-right text-xs text-muted-foreground">{p.spec}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[300px]">
            {SERVO_MODEL.dof.map((d) => (
              <div key={d.id} className="rounded-lg border bg-muted/40 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <RotateCw className="h-3.5 w-3.5 text-amber-500" />
                  {d.label}
                  <Badge variant="outline" className="ml-auto font-mono text-[10px]">{d.kind}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-background px-2.5 py-1.5">
                    <div className="text-[10px] text-muted-foreground">axis</div>
                    <div className="font-mono font-semibold">[{d.axis.join(', ')}]</div>
                  </div>
                  <div className="rounded-md bg-background px-2.5 py-1.5">
                    <div className="text-[10px] text-muted-foreground">range</div>
                    <div className="font-mono font-semibold">{d.range[0]}° – {d.range[1]}°</div>
                  </div>
                </div>
                <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  Driven through the <span className="font-mono">{d.driverPortId}</span> port; the
                  true angle streams via <span className="font-mono">liveAngleRef</span> so attached
                  mechanisms stay in sync every frame.
                </p>
              </div>
            ))}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Ports are pure data (<span className="font-mono text-[11px]">src/lib/connections.ts</span>),
              rendered by the model itself — a future assembly builder snaps any two compatible
              ports together and the parts align automatically.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Physics & sourcing — the data layers that make this a platform component */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4 text-amber-500" />
              Physics properties
            </CardTitle>
            <CardDescription>
              The numbers a simulation engine steps with — so the virtual one behaves
              like the real one in the testing environments.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-muted/40 p-3 text-center">
                <div className="font-mono text-xl font-bold tabular-nums">
                  {SERVO.physics.mass}
                  <span className="text-xs font-medium text-muted-foreground"> g</span>
                </div>
                <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">mass</div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-center">
                <div className="font-mono text-sm font-bold tabular-nums leading-7">
                  {SERVO.physics.dimensions.l}×{SERVO.physics.dimensions.w}×{SERVO.physics.dimensions.h}
                  <span className="text-xs font-medium text-muted-foreground"> mm</span>
                </div>
                <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">L×W×H</div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-center">
                <div className="font-mono text-xl font-bold tabular-nums">
                  0.92<span className="text-xs font-medium text-muted-foreground"> N·m</span>
                </div>
                <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">stall torque</div>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Materials</span>
                {SERVO.physics.materials.map((m) => (
                  <div key={m.part} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{m.part}</span>
                    <span className="text-right font-medium">{m.material}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Electrical load</span>
                {SERVO.physics.electrical.map((e) => (
                  <div key={e.label} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{e.label}</span>
                    <span className="text-right font-mono text-xs font-semibold">{e.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mechanical ratings</span>
              <div className="flex flex-wrap gap-1.5">
                {SERVO.physics.mechanical.map((m) => (
                  <span key={m.label} className="rounded border px-2 py-0.5 text-[11px] text-muted-foreground">
                    {m.label}: <span className="font-medium text-foreground">{m.value}</span>
                  </span>
                ))}
              </div>
            </div>

            <p className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Sim engine note · </span>
              {SERVO.physics.simNotes}
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4 text-amber-500" />
              Cost &amp; sourcing
            </CardTitle>
            <CardDescription>The real-world part behind this virtual model.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{SERVO.commerce.manufacturer}</span>
                <span className="font-mono text-xs font-medium text-muted-foreground">{SERVO.commerce.partNumber}</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <div>
                  <div className="font-mono text-lg font-bold tabular-nums">
                    ${SERVO.commerce.priceUsd[0]}–${SERVO.commerce.priceUsd[1]}
                  </div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">typical street price</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold tabular-nums">
                    ₹{SERVO.commerce.priceInr[0]}–₹{SERVO.commerce.priceInr[1]}
                  </div>
                  <div className="text-[10px] text-muted-foreground">India</div>
                </div>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">{SERVO.commerce.availability}.</p>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Where to buy</span>
              <div className="flex flex-wrap gap-1.5">
                {SERVO.commerce.vendors.map((v) => (
                  <span key={v} className="rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {v}
                  </span>
                ))}
              </div>
            </div>

            <p className="mt-auto rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Virtual-to-real · </span>
              Every assembly you design here resolves to a bill of materials with real part
              numbers and prices — export build instructions, buy the exact parts, and the
              physical robot matches the virtual one.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI design profile — Pillar 2 preview */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BrainCircuit className="h-4 w-4 text-amber-500" />
                AI design profile
              </CardTitle>
              <CardDescription>
                What the AI generation layer reads when it picks parts on your behalf.
              </CardDescription>
            </div>
            <Badge className="gap-1 border-amber-200 bg-amber-50 font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              <Sparkles className="h-3 w-3" />
              Pillar 2 preview
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
          <div className="flex min-w-0 flex-col gap-5">
            <p className="text-sm leading-relaxed">{SERVO.ai.summary}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Capabilities</span>
                <ul className="flex flex-col gap-1.5">
                  {SERVO.ai.capabilities.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-xs leading-relaxed">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                      <span className="text-muted-foreground">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Constraints</span>
                <ul className="flex flex-col gap-1.5">
                  {SERVO.ai.constraints.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-xs leading-relaxed">
                      <span className="mt-0.5 h-3 w-3 shrink-0 text-center text-red-500 leading-none" aria-hidden>×</span>
                      <span className="text-muted-foreground">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Best for</span>
              <div className="flex flex-wrap gap-1.5">
                {SERVO.ai.bestFor.map((b) => (
                  <span key={b} className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    {b}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Example — &ldquo;Build me a robot that avoids obstacles&rdquo;
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                The AI reads the catalog and drafts a bill of materials, reasoning over
                capabilities, constraints, mass and cost:
              </p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {AI_DEMO_SELECTION.map((s) => (
                  <li
                    key={s.name}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs ${
                      s.self ? 'bg-amber-500/10 font-semibold text-amber-700 dark:text-amber-300' : 'text-muted-foreground'
                    }`}
                  >
                    <Check className={`h-3 w-3 shrink-0 ${s.self ? 'text-amber-500' : 'text-emerald-500'}`} />
                    <span className={s.self ? '' : 'font-medium text-foreground/80'}>{s.name}</span>
                    <span className="min-w-0 flex-1 truncate font-normal opacity-80">— {s.role}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                When the AI layer ships, this selection happens automatically from the
                exported catalog — the data is already in shape.
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Machine-readable entry
              </span>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2.5 text-xs" onClick={copyAiJson}>
                {copiedJson ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copiedJson ? 'Copied' : 'Copy JSON'}
              </Button>
            </div>
            <div className="overflow-auto rounded-lg" style={{ maxHeight: 420 }}>
              <SyntaxHighlighter
                language="json"
                style={oneDark}
                codeTagProps={{ className: 'font-mono text-[11px] leading-relaxed' }}
                customStyle={{ margin: 0, borderRadius: 8, fontSize: 11, padding: '14px 16px', background: '#18181b' }}
              >
                {AI_JSON}
              </SyntaxHighlighter>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reusable API */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            ServoMotor&nbsp;
            <span className="font-mono text-sm font-normal text-muted-foreground">props</span>
          </CardTitle>
          <CardDescription>
            Every control on this page is a prop — the model is fully reusable in any
            React Three Fiber scene.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-0">Prop</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Default</TableHead>
                <TableHead className="pr-0 text-right">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {API_PROPS.map((p) => (
                <TableRow key={p.prop}>
                  <TableCell className="py-2.5 pl-0 font-mono text-xs font-semibold">{p.prop}</TableCell>
                  <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">{p.type}</TableCell>
                  <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">{p.def}</TableCell>
                  <TableCell className="py-2.5 pr-0 text-right text-muted-foreground">{p.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

