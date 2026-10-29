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
export type PlayKind =
  | 'servo'
  | 'battery'
  | 'controller'
  | 'dcmotor'
  | 'stepper'
  | 'ultrasonic'
  | 'irsensor'
  | 'esc'
  | 'lipo'
  | 'strainwave'
  | 'planetary'
  | 'muscle'
  | 'capacitor'
  | 'screw'
  | 'rotaryact'
  | 'linact'
  | 'ballscrew'
  | 'vaneact'
  | 'airpump'
  | 'gltf'
  | 'stl'

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
/* Energy ports — electrical, mechanical and pneumatic                 */
/* ------------------------------------------------------------------ */

/** The energy domain a port carries — ports only mate within a domain. */
export type PortDomain = 'electrical' | 'mechanical' | 'pneumatic'

/** Mechanical interface subtype — rotation, linear travel, or fastening. */
export type MechInterface = 'rotation' | 'linear' | 'fastening'

/**
 * An energy port on a component.
 *
 *  ELECTRICAL  `role: 'out'` provides power at a voltage inside `v`;
 *              `role: 'in'` accepts power anywhere inside `v`.
 *  MECHANICAL  rotation ports transfer rotation (`rpm` on drivers,
 *              `ratio` on gear stages, `pitch` mm/rev on screws);
 *              fastening ports are M3 holes that accept a screw.
 *  PNEUMATIC   `v` is the pressure range in bar — a pump provides it,
 *              muscles and vane motors consume it.
 *
 * `wire` is how a connection to this port renders: a red/black pair for
 * power splices, a 3-wire signal ribbon for servo-style plugs, a rigid
 * steel coupling sleeve for shafts, or clear blue tubing for air.
 */
export interface ElecPort {
  id: string
  label: string
  role: 'out' | 'in'
  /** Energy domain (default: electrical). */
  domain?: PortDomain
  /** Voltage (electrical) or pressure in bar (pneumatic): provided (out)
   *  or the acceptable range (in). */
  v: [number, number]
  wire: 'pair' | 'ribbon3' | 'coupling' | 'tubing'
  /** Mechanical interface subtype (mechanical ports only). */
  mech?: MechInterface
  /** Rotation this driver's shaft turns at, while powered (RPM). */
  rpm?: number
  /** Gear-stage ratio: the component's own output runs at input ÷ ratio. */
  ratio?: number
  /** Screw lead (mm/rev): converts arriving RPM into nut travel. */
  pitch?: number
  /** Why NOTHING can wire here, when that is the real-life answer
   *  (e.g. a stepper needs a driver board that isn't stocked). */
  refusal?: string
}

const domainOf = (p: ElecPort): PortDomain => p.domain ?? 'electrical'
const mechOf = (p: ElecPort): MechInterface => p.mech ?? 'rotation'

/**
 * The real-life electrical contract per component kind:
 *  - 9V battery: PP3 snap terminals provide 9 V.
 *  - LiPo 3S pack: XT60 leads provide 11.1 V.
 *  - Controller (Arduino Uno): VIN jack accepts 7–12 V; when powered,
 *    its 5 V pin header feeds servos, sensors and small loads.
 *  - ESC: battery leads accept 7.2–16 V; its motor terminals pass
 *    battery voltage (6–12 V) to the motor; its BEC regurgitates 5 V
 *    for logic on a servo-style plug — exactly like a real ESC.
 *  - Servo (MG996R class): 3-pin lead accepts 4.8–7.2 V.
 *  - DC gear motor: bare leads accept 6–12 V (a 9 V battery spins it,
 *    an ESC drives it — both real).
 *  - Stepper (NEMA 17): needs a chopper driver (A4988/DRV8825) that
 *    the library doesn't stock — it can NEVER wire straight to power,
 *    exactly like real life.
 *  - Sensors: 5 V logic headers — they plug into controllers/BECs,
 *    never into batteries.
 *  - Uploaded models: generic power leads, 3–12 V.
 */
export const ELEC_PORTS: Record<PlayKind, ElecPort[]> = {
  battery: [{ id: 'pp3', label: 'snap terminals', role: 'out', v: [9, 9], wire: 'pair' }],
  lipo: [{ id: 'xt60', label: 'XT60 leads', role: 'out', v: [11.1, 11.1], wire: 'pair' }],
  controller: [
    { id: 'vin', label: 'VIN power jack', role: 'in', v: [7, 12], wire: 'pair' },
    { id: 'hdr', label: '5 V pin header', role: 'out', v: [5, 5], wire: 'ribbon3' },
    {
      id: 'mount',
      label: 'M3 mounting holes',
      role: 'out',
      domain: 'mechanical',
      mech: 'fastening',
      v: [0, 0],
      wire: 'coupling',
    },
  ],
  esc: [
    { id: 'pwr', label: 'battery leads', role: 'in', v: [7.2, 16], wire: 'pair' },
    { id: 'moto', label: 'motor terminals', role: 'out', v: [6, 12], wire: 'pair' },
    { id: 'bec', label: 'BEC 5 V signal lead', role: 'out', v: [5, 5], wire: 'ribbon3' },
  ],
  servo: [
    { id: 'plug', label: '3-pin signal lead', role: 'in', v: [4.8, 7.2], wire: 'ribbon3' },
    {
      id: 'horn',
      label: '25T spline horn',
      role: 'out',
      domain: 'mechanical',
      mech: 'rotation',
      v: [0, 0],
      wire: 'coupling',
      rpm: 58,
    },
    {
      id: 'tabs',
      label: 'mounting tabs (M3)',
      role: 'out',
      domain: 'mechanical',
      mech: 'fastening',
      v: [0, 0],
      wire: 'coupling',
    },
  ],
  dcmotor: [
    { id: 'leads', label: 'power leads', role: 'in', v: [6, 12], wire: 'pair' },
    {
      id: 'shaft',
      label: '6 mm output shaft',
      role: 'out',
      domain: 'mechanical',
      mech: 'rotation',
      v: [0, 0],
      wire: 'coupling',
      rpm: 150,
    },
    {
      id: 'mount',
      label: 'face bolt holes (M3)',
      role: 'out',
      domain: 'mechanical',
      mech: 'fastening',
      v: [0, 0],
      wire: 'coupling',
    },
  ],
  stepper: [
    {
      id: 'leads',
      label: 'driver leads',
      role: 'in',
      v: [0, 0],
      wire: 'ribbon3',
      refusal:
        'a stepper never wires straight to a battery or ESC — it needs a current-controlled driver board (A4988 / DRV8825), which the library does not stock yet',
    },
    {
      id: 'shaft',
      label: '5 mm output shaft',
      role: 'out',
      domain: 'mechanical',
      mech: 'rotation',
      v: [0, 0],
      wire: 'coupling',
      rpm: 200,
    },
    {
      id: 'mount',
      label: 'flange bolt holes (M3)',
      role: 'out',
      domain: 'mechanical',
      mech: 'fastening',
      v: [0, 0],
      wire: 'coupling',
    },
  ],
  ultrasonic: [{ id: 'hdr', label: '4-pin logic header', role: 'in', v: [4.5, 5.5], wire: 'ribbon3' }],
  irsensor: [{ id: 'hdr', label: '3-pin logic header', role: 'in', v: [3.3, 5], wire: 'ribbon3' }],
  /* --- mechanical transmission: strain wave gear, planetary, ball screw --- */
  strainwave: [
    {
      id: 'input',
      label: 'wave-generator input shaft',
      role: 'in',
      domain: 'mechanical',
      mech: 'rotation',
      v: [0, 0],
      wire: 'coupling',
    },
    {
      id: 'output',
      label: 'flexspline output flange',
      role: 'out',
      domain: 'mechanical',
      mech: 'rotation',
      v: [0, 0],
      wire: 'coupling',
      ratio: 100,
    },
    {
      id: 'mount',
      label: 'circular-spline bolt holes (M3)',
      role: 'out',
      domain: 'mechanical',
      mech: 'fastening',
      v: [0, 0],
      wire: 'coupling',
    },
  ],
  planetary: [
    {
      id: 'input',
      label: 'sun input shaft',
      role: 'in',
      domain: 'mechanical',
      mech: 'rotation',
      v: [0, 0],
      wire: 'coupling',
    },
    {
      id: 'output',
      label: 'carrier output shaft',
      role: 'out',
      domain: 'mechanical',
      mech: 'rotation',
      v: [0, 0],
      wire: 'coupling',
      ratio: 5,
    },
  ],
  ballscrew: [
    {
      id: 'journal',
      label: 'driven journal',
      role: 'in',
      domain: 'mechanical',
      mech: 'rotation',
      v: [0, 0],
      wire: 'coupling',
      pitch: 4,
    },
    {
      id: 'nut',
      label: 'ball-nut flange',
      role: 'out',
      domain: 'mechanical',
      mech: 'linear',
      v: [0, 0],
      wire: 'coupling',
    },
    {
      id: 'mount',
      label: 'bearing-block bolt holes (M3)',
      role: 'out',
      domain: 'mechanical',
      mech: 'fastening',
      v: [0, 0],
      wire: 'coupling',
    },
  ],
  screw: [
    {
      id: 'thread',
      label: 'M3 thread',
      role: 'in',
      domain: 'mechanical',
      mech: 'fastening',
      v: [0, 0],
      wire: 'coupling',
    },
  ],
  /* --- pneumatic: muscle, vane motor, air pump --- */
  muscle: [
    {
      id: 'port',
      label: 'air inlet fitting',
      role: 'in',
      domain: 'pneumatic',
      v: [0.2, 4],
      wire: 'tubing',
    },
  ],
  vaneact: [
    {
      id: 'port',
      label: 'air port (M5)',
      role: 'in',
      domain: 'pneumatic',
      v: [0.15, 6],
      wire: 'tubing',
    },
    {
      id: 'mount',
      label: 'body bolt holes (M4)',
      role: 'out',
      domain: 'mechanical',
      mech: 'fastening',
      v: [0, 0],
      wire: 'coupling',
    },
  ],
  airpump: [
    { id: 'leads', label: 'power leads', role: 'in', v: [6, 9], wire: 'pair' },
    {
      id: 'air',
      label: 'outlet nozzle',
      role: 'out',
      domain: 'pneumatic',
      v: [0.4, 0.4],
      wire: 'tubing',
    },
  ],
  /* --- electrical: capacitor filter, rotary + linear actuators --- */
  capacitor: [{ id: 'legs', label: 'lead legs (+/−)', role: 'in', v: [3, 16], wire: 'pair' }],
  rotaryact: [
    { id: 'leads', label: 'power leads', role: 'in', v: [6, 12], wire: 'pair' },
    {
      id: 'shaft',
      label: 'keyed output shaft',
      role: 'out',
      domain: 'mechanical',
      mech: 'rotation',
      v: [0, 0],
      wire: 'coupling',
      rpm: 30,
    },
    {
      id: 'mount',
      label: 'flange bolt holes (M3)',
      role: 'out',
      domain: 'mechanical',
      mech: 'fastening',
      v: [0, 0],
      wire: 'coupling',
    },
  ],
  linact: [
    { id: 'leads', label: 'power leads', role: 'in', v: [6, 12], wire: 'pair' },
    {
      id: 'mount',
      label: 'mounting slots (M3)',
      role: 'out',
      domain: 'mechanical',
      mech: 'fastening',
      v: [0, 0],
      wire: 'coupling',
    },
  ],
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

function fmtBar(v: [number, number]): string {
  return v[0] === v[1] ? `${v[0]} bar` : `${v[0]}–${v[1]} bar`
}

/** True when the provided voltage (or pressure) lies inside the accepted range. */
function voltageOk(out: ElecPort, inPort: ElecPort): boolean {
  return out.v[0] >= inPort.v[0] - 1e-9 && out.v[1] <= inPort.v[1] + 1e-9
}

export function getPort(kind: PlayKind, portId: string | null | undefined): ElecPort | undefined {
  if (!portId) return undefined
  return portsFor(kind).find((p) => p.id === portId)
}

/** The domain of a link’s ports — electrical unless declared otherwise. */
export function portDomain(p: ElecPort | undefined): PortDomain {
  return p ? domainOf(p) : 'electrical'
}

/** Do these two ports mate in real life? Same domain + same interface +
 *  (for electricity and air) a provided value inside the accepted range. */
function portsMate(out: ElecPort, inP: ElecPort): boolean {
  if (out.role !== 'out' || inP.role !== 'in') return false
  const dom = domainOf(out)
  if (dom !== domainOf(inP)) return false
  if (dom === 'mechanical') return mechOf(out) === mechOf(inP)
  return voltageOk(out, inP)
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
 * a port that provides exactly what the other’s port accepts — in ANY
 * energy domain:
 *
 *   ELECTRICAL   9V battery → motor leads (6–12 V)              ✓
 *                controller 5 V header → servo (4.8–7.2 V)     ✓
 *                9V battery → servo                             ✗ over-voltage
 *   MECHANICAL   motor 6 mm shaft → strain-wave input           ✓ (150 RPM in)
 *                strain-wave output → planetary input           ✓ (÷ 100, then ÷ 5)
 *                M3 screw → Arduino mounting holes              ✓ fastening
 *                motor shaft → motor shaft                       ✗ both only drive
 *   PNEUMATIC    mini pump (0.4 bar) → muscle air inlet         ✓
 *                mini pump → vane motor                         ✓
 *                battery → muscle                               ✗ electricity ≠ air
 *
 * Electrical matches are tried first so existing wiring behavior is
 * unchanged; the parent of a link is always the side that PROVIDES.
 */
export function connectBetween(a: PlayInstance, b: PlayInstance): ConnectMatch {
  const aPorts = portsFor(a.kind)
  const bPorts = portsFor(b.kind)

  const trySide = (prov: PlayInstance, cons: PlayInstance): ConnectMatch | null => {
    const provPorts = prov.id === a.id ? aPorts : bPorts
    const consPorts = prov.id === a.id ? bPorts : aPorts
    const domains: PortDomain[] = ['electrical', 'mechanical', 'pneumatic']
    for (const dom of domains) {
      for (const out of provPorts.filter((p) => domainOf(p) === dom)) {
        for (const inP of consPorts.filter((p) => domainOf(p) === dom)) {
          if (!portsMate(out, inP)) continue
          let reason: string
          if (dom === 'electrical') {
            reason = `${prov.name} provides ${fmtV(out.v)} on its ${out.label}, within ${cons.name}'s ${inP.label} range (${fmtV(inP.v)}).`
          } else if (dom === 'pneumatic') {
            reason = `${prov.name} supplies ${fmtBar(out.v)} of air on its ${out.label} — inside what ${cons.name}'s ${inP.label} needs (${fmtBar(inP.v)}).`
          } else if (mechOf(out) === 'fastening') {
            reason = `${prov.name} offers its ${out.label} — the M3 screw threads straight in.`
          } else if (out.rpm != null) {
            reason = `${prov.name} drives its ${out.label} at ${out.rpm} RPM — ${cons.name}'s ${inP.label} couples onto it.`
          } else {
            // A gear stage feeding another stage: name the consumer’s own
            // ratio or lead so the sentence says what the coupling does.
            const consOut = consPorts.find(
              (p) => domainOf(p) === 'mechanical' && p.role === 'out' && mechOf(p) === 'rotation'
            )
            if (inP.pitch != null) {
              reason = `${prov.name}'s ${out.label} couples onto ${cons.name}'s ${inP.label} — each turn becomes ${inP.pitch} mm of nut travel.`
            } else if (consOut?.ratio != null) {
              reason = `${prov.name}'s ${out.label} couples into ${cons.name}'s ${inP.label} — the stage divides speed by ${consOut.ratio}.`
            } else {
              reason = `${prov.name}'s ${out.label} couples to ${cons.name}'s ${inP.label}.`
            }
          }
          return {
            ok: true,
            reason,
            outId: prov.id,
            inId: cons.id,
            outPortId: out.id,
            inPortId: inP.id,
          }
        }
      }
    }
    return null
  }

  const direct = trySide(a, b) ?? trySide(b, a)
  if (direct) return direct

  // No match in any domain — explain WHY, like a real one would.
  const aElecOut = aPorts.filter((p) => domainOf(p) === 'electrical' && p.role === 'out')
  const bElecOut = bPorts.filter((p) => domainOf(p) === 'electrical' && p.role === 'out')
  const aMechOut = aPorts.filter((p) => domainOf(p) === 'mechanical' && p.role === 'out' && mechOf(p) === 'rotation')
  const bMechOut = bPorts.filter((p) => domainOf(p) === 'mechanical' && p.role === 'out' && mechOf(p) === 'rotation')
  const aPneuOut = aPorts.filter((p) => domainOf(p) === 'pneumatic' && p.role === 'out')
  const bPneuOut = bPorts.filter((p) => domainOf(p) === 'pneumatic' && p.role === 'out')

  let reason: string
  const bothElecSources = aElecOut.length > 0 && bElecOut.length > 0
  const noProviderAtAll =
    aElecOut.length + bElecOut.length + aMechOut.length + bMechOut.length + aPneuOut.length + bPneuOut.length === 0

  if (bothElecSources) {
    reason = `${a.name} and ${b.name} are both power sources — sources don't power each other`
  } else if (noProviderAtAll) {
    reason = `neither provides power, rotation or air — connect one of them to a battery, motor or pump first`
  } else if (aElecOut.length > 0 || bElecOut.length > 0) {
    // There IS an electrical source, but the other side won't take it.
    const outSide = aElecOut.length > 0 ? a : b
    const inSide = aElecOut.length > 0 ? b : a
    const out = (aElecOut.length > 0 ? aElecOut : bElecOut)[0]
    const inP = (aElecOut.length > 0 ? bPorts : aPorts).find((p) => p.role === 'in')
    if (!inP) {
      reason = `${outSide.name} provides electricity but ${inSide.name} has nothing that accepts it`
    } else if (domainOf(inP) === 'pneumatic') {
      reason = `${outSide.name} makes electricity, not air — ${inSide.name} needs ${fmtBar(inP.v)} of compressed air from a pump`
    } else if (domainOf(inP) === 'mechanical') {
      reason = `${inSide.name} needs rotation on its ${inP.label} — couple a motor's shaft into it, a battery can't drive steel`
    } else if (inP.refusal) {
      reason = inP.refusal
    } else {
      reason = `${outSide.name}'s ${fmtV(out.v)} is outside the ${fmtV(inP.v)} ${inSide.name} accepts on its ${inP.label}`
      if (inSide.kind === 'servo' && outSide.kind === 'battery') {
        reason += ' — power it through a controller'
      }
    }
  } else if (aMechOut.length > 0 && bMechOut.length > 0) {
    reason = `${a.name} and ${b.name} both only provide rotation — one side must accept it`
  } else if (aPneuOut.length > 0 || bPneuOut.length > 0) {
    reason = `air needs a matching air port — this pair shares none`
  } else {
    reason = `these two parts share no compatible interface — real parts only mate where ports match`
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
  return kind === 'battery' || kind === 'lipo'
}

/** True for components that pass power through (controller, ESC). */
export function isPowerBroker(kind: PlayKind): boolean {
  return kind === 'controller' || kind === 'esc'
}

/** True for components that live on compressed air, not electricity. */
export function isPneumaticKind(kind: PlayKind): boolean {
  return kind === 'muscle' || kind === 'vaneact'
}

/** True for components whose whole job is transmission — they need a
 *  motor’s rotation on their input to do anything. */
export function isMechanicalKind(kind: PlayKind): boolean {
  return kind === 'strainwave' || kind === 'planetary' || kind === 'ballscrew'
}

/** Approximate ground footprint radius (world units) per component kind. */
export function footprintFor(kind: PlayKind): number {
  if (kind === 'servo') return 2.35
  if (kind === 'battery') return 1.9
  if (kind === 'controller') return 4.0
  if (kind === 'lipo') return 5.6
  if (kind === 'esc') return 3.1
  if (kind === 'dcmotor') return 2.3
  if (kind === 'stepper') return 2.7
  if (kind === 'ultrasonic') return 2.5
  if (kind === 'irsensor') return 2.1
  if (kind === 'strainwave') return 2.6
  if (kind === 'planetary') return 2.9
  if (kind === 'muscle') return 4.6
  if (kind === 'capacitor') return 0.95
  if (kind === 'screw') return 0.8
  if (kind === 'rotaryact') return 2.6
  if (kind === 'linact') return 7.6
  if (kind === 'ballscrew') return 8.5
  if (kind === 'vaneact') return 2.8
  if (kind === 'airpump') return 2.5
  return 2.15
}

/** Height where the wire anchor sits (world units) per component kind. */
export function anchorYFor(kind: PlayKind): number {
  if (kind === 'servo') return 4.0
  if (kind === 'battery') return 5.0
  if (kind === 'controller') return 0.7
  if (kind === 'lipo') return 0.9
  if (kind === 'esc') return 0.5
  if (kind === 'dcmotor') return 1.0
  if (kind === 'stepper') return 1.1
  if (kind === 'ultrasonic') return 0.6
  if (kind === 'irsensor') return 0.5
  if (kind === 'strainwave') return 3.2
  if (kind === 'planetary') return 3.4
  if (kind === 'muscle') return 1.0
  if (kind === 'capacitor') return 1.3
  if (kind === 'screw') return 0.35
  if (kind === 'rotaryact') return 1.6
  if (kind === 'linact') return 1.1
  if (kind === 'ballscrew') return 0.9
  if (kind === 'vaneact') return 1.5
  if (kind === 'airpump') return 1.1
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
 * Does ELECTRICAL power flow across one wire? Mechanical couplings and
 * pneumatic tubes carry rotation and air, never electricity — so a link
 * whose mated ports are in another domain is electrically dead. (Whether
 * the parent itself is powered is a separate, recursive question — see
 * poweredIds.)
 */
function linkCarriesPower(parent: PlayInstance, child: PlayInstance): boolean {
  const out = getPort(parent.kind, child.parentPort)
  const inP = getPort(child.kind, child.childPort)
  if (!out || !inP || out.role !== 'out' || inP.role !== 'in') {
    // Ports not recorded (older saves) — resolve them by compatibility.
    const m = connectBetween(parent, child)
    if (!m.ok || m.outId !== parent.id) return false
    return domainOf(getPort(parent.kind, m.outPortId) ?? { domain: 'electrical' } as ElecPort) === 'electrical'
  }
  if (domainOf(out) !== 'electrical' || domainOf(inP) !== 'electrical') return false
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
    if (isPowerSource(inst.kind)) return true
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
 * Power sources that are actually powering something: at least one
 * child is wired to them with a valid link (9V batteries and LiPos).
 */
export function batteriesWithLoad(instances: PlayInstance[]): Set<string> {
  const byId = new Map(instances.map((i) => [i.id, i]))
  const withLoad = new Set<string>()
  for (const inst of instances) {
    if (!inst.parentId) continue
    const parent = byId.get(inst.parentId)
    if (!parent || !isPowerSource(parent.kind)) continue
    if (linkCarriesPower(parent, inst)) withLoad.add(parent.id)
  }
  return withLoad
}

/* ------------------------------------------------------------------ */
/* The mechanical transmission graph                                   */
/* ------------------------------------------------------------------ */

/** Mechanical interface state for one placed component. */
export interface MechState {
  /** True when rotation actually arrives on its input. */
  driven: boolean
  /** Rotation arriving at the input (RPM). */
  inRpm: number
  /** Rotation leaving via this component’s output shaft/flange (RPM) —
   *  the input speed divided by the stage’s ratio. */
  outRpm: number | null
  /** Linear travel of a ball screw’s nut (mm/s), when applicable. */
  linearMmS: number | null
}

/** The component’s own mechanical output port, if it has one. */
function mechOutPortOf(kind: PlayKind): ElecPort | undefined {
  return portsFor(kind).find(
    (p) => domainOf(p) === 'mechanical' && p.role === 'out' && mechOf(p) === 'rotation'
  )
}

/** True when the recorded parent→child link is a mechanical coupling. */
function isMechLink(parent: PlayInstance, child: PlayInstance): boolean {
  const out = getPort(parent.kind, child.parentPort)
  const inP = getPort(child.kind, child.childPort)
  return !!(
    out &&
    inP &&
    domainOf(out) === 'mechanical' &&
    domainOf(inP) === 'mechanical' &&
    out.role === 'out' &&
    inP.role === 'in' &&
    mechOf(out) === mechOf(inP)
  )
}

/**
 * The mechanical state of every placed component. Prime movers (a
 * powered, running motor) spin their own output at `rpm`; every stage
 * coupled to a turning output is driven, and its own output turns at
 * input ÷ ratio — so a 150 RPM motor through a 100:1 strain wave gear
 * crawls at 1.5 RPM, and a 5:1 planetary after it at 0.3 RPM, exactly
 * like the real gear train. Ball screws convert arriving RPM into
 * linear nut travel via their 4 mm lead.
 */
export function drivenStates(
  instances: PlayInstance[],
  powered: Set<string>,
  running: boolean
): Map<string, MechState> {
  const byId = new Map(instances.map((i) => [i.id, i]))
  const states = new Map<string, MechState>()

  const resolve = (inst: PlayInstance): MechState => {
    const cached = states.get(inst.id)
    if (cached) return cached
    const s: MechState = { driven: false, inRpm: 0, outRpm: null, linearMmS: null }
    states.set(inst.id, s) // set before recursing — cycle guard

    const ownOut = mechOutPortOf(inst.kind)
    if (ownOut?.rpm != null) {
      // A prime mover: its shaft turns while it is powered and running.
      if (running && powered.has(inst.id)) {
        s.driven = true
        s.inRpm = ownOut.rpm
        s.outRpm = ownOut.rpm
      }
    } else if (inst.parentId) {
      const parent = byId.get(inst.parentId)
      if (parent && isMechLink(parent, inst)) {
        const ps = resolve(parent)
        if (ps.driven && ps.outRpm != null) {
          s.driven = true
          s.inRpm = ps.outRpm
          if (ownOut?.ratio != null) {
            s.outRpm = ps.outRpm / ownOut.ratio
          } else {
            const inP = getPort(inst.kind, inst.childPort)
            if (inP?.pitch != null) {
              s.linearMmS = (ps.outRpm * inP.pitch) / 60
            } else {
              s.outRpm = ps.outRpm
            }
          }
        }
      }
    }
    return s
  }

  for (const inst of instances) resolve(inst)
  return states
}

/* ------------------------------------------------------------------ */
/* The pneumatic supply graph                                          */
/* ------------------------------------------------------------------ */

/**
 * The set of instances with live air: their air port is tubed to the
 * outlet of a pump that is powered (and the system is running).
 */
export function pressurizedIds(
  instances: PlayInstance[],
  powered: Set<string>,
  running: boolean
): Set<string> {
  const byId = new Map(instances.map((i) => [i.id, i]))
  const live = new Set<string>()
  if (!running) return live
  for (const inst of instances) {
    if (!inst.parentId) continue
    const parent = byId.get(inst.parentId)
    if (!parent || parent.kind !== 'airpump') continue
    const out = getPort(parent.kind, inst.parentPort)
    const inP = getPort(inst.kind, inst.childPort)
    if (
      out &&
      inP &&
      domainOf(out) === 'pneumatic' &&
      domainOf(inP) === 'pneumatic' &&
      out.role === 'out' &&
      inP.role === 'in' &&
      voltageOk(out, inP) &&
      powered.has(parent.id)
    ) {
      live.add(inst.id)
    }
  }
  return live
}

/**
 * Power sources with a capacitor wired across their terminals — the
 * rail every consumer on that source shares is smoothed.
 */
export function smoothedSourceIds(instances: PlayInstance[], powered: Set<string>): Set<string> {
  const byId = new Map(instances.map((i) => [i.id, i]))
  const smoothed = new Set<string>()
  for (const inst of instances) {
    if (inst.kind !== 'capacitor' || !inst.parentId || !powered.has(inst.id)) continue
    const parent = byId.get(inst.parentId)
    if (parent) smoothed.add(parent.id)
  }
  return smoothed
}
