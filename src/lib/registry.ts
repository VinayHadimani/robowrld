import {
  RotateCw,
  Cog,
  Layers,
  Radar,
  Waves,
  BatteryCharging,
  Zap,
  RefreshCw,
  MoveHorizontal,
  Disc,
  Orbit,
  Spline,
  Bolt,
  Activity,
  Fan,
  Wind,
  CircuitBoard,
  type LucideIcon,
} from 'lucide-react'
import { COMPONENTS, type ComponentCategory, type ComponentStatus } from './component-schema'

export type { ComponentCategory, ComponentStatus }

/** Lucide icon per component — UI-layer concern, kept out of the serializable schema. */
const ICONS: Record<string, LucideIcon> = {
  'servo-motor': RotateCw,
  'dc-motor': Cog,
  'stepper-motor': Layers,
  'ultrasonic-sensor': Radar,
  'ir-sensor': Waves,
  esc: Zap,
  'lipo-battery': BatteryCharging,
  'rotary-actuator': RefreshCw,
  'linear-actuator': MoveHorizontal,
  'strain-wave-gear': Disc,
  'planetary-gear': Orbit,
  'ball-screw': Spline,
  'm3-screw': Bolt,
  'pneumatic-muscle': Activity,
  'vane-actuator': Fan,
  'mini-air-pump': Wind,
  'electrolytic-capacitor': CircuitBoard,
}

export interface LibraryComponent {
  id: string
  name: string
  category: ComponentCategory
  status: ComponentStatus
  tagline: string
  icon: LucideIcon
  /** Declared connection ports (from the connection contract). */
  ports?: number
  /** Declared degrees of freedom. */
  dof?: number
  /** Mass in grams — surfaced on cards for design-minded browsing. */
  mass: number
  /** Typical street price, USD low bound. */
  priceUsd: number
}

/**
 * The component registry — derived from the platform schema
 * (src/lib/component-schema.ts), which is the single source of truth.
 */
export const LIBRARY: LibraryComponent[] = COMPONENTS.map((c) => ({
  id: c.id,
  name: c.name,
  category: c.category,
  status: c.status,
  tagline: c.tagline,
  icon: ICONS[c.id] ?? Cog,
  ports: c.connectionModel?.ports.length,
  dof: c.connectionModel?.dof.length,
  mass: c.physics.mass,
  priceUsd: c.commerce.priceUsd[0],
}))

export const CATEGORIES: Array<'All' | ComponentCategory> = [
  'All',
  'Actuators',
  'Sensors',
  'Controller',
  'Power',
  'Mechanical',
  'Pneumatics',
]
