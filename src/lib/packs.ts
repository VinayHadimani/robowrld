/**
 * Component packs — the "download only what you need" distribution model.
 *
 * Students don't want 400 components on day one; they want the Beginner
 * Robot Pack, the way gamers want one skin pack at a time. Packs are
 * curated bundles of components; installing a pack unlocks its components
 * in the library (spec sheets, physics data, and 3D models as they ship).
 *
 * Pack definitions live here as code; the installed state lives in the
 * database (per session today, per user account once auth ships). The
 * DB is seeded lazily from these definitions — swap SQLite for Supabase
 * later and nothing else changes.
 */

export interface ComponentPack {
  /** Stable slug — also the DB primary key. */
  id: string
  name: string
  tagline: string
  description: string
  /** Lucide icon name key — mapped to a component in the UI layer. */
  icon: string
  /** Download size shown in the UI (procedural models are tiny by nature). */
  sizeMb: number
  /** Pricing label for the beta ("Free · Beta" for now). */
  priceLabel: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  featured?: boolean
  componentIds: string[]
}

export const PACKS: ComponentPack[] = [
  {
    id: 'beginner-robot-pack',
    name: 'Beginner Robot Pack',
    tagline: 'Everything a first robot needs to move.',
    description:
      'The starter bundle: one servo for steering or a gripper, a DC gear motor with its speed controller for traction, and the battery to feed them. This is the pack every new account starts with — the virtual equivalent of the classic Arduino starter kit.',
    icon: 'bot',
    sizeMb: 14,
    priceLabel: 'Free · Beta',
    level: 'Beginner',
    featured: true,
    componentIds: ['servo-motor', 'dc-motor', 'esc'],
  },
  {
    id: 'sensor-pack',
    name: 'Sensor Pack',
    tagline: 'Give your robot eyes.',
    description:
      'Ultrasonic distance sensing for obstacle avoidance plus IR reflective pairs for line following and edge detection. Add this pack when your robot needs to react to the world instead of just executing a path.',
    icon: 'radar',
    sizeMb: 6,
    priceLabel: 'Free · Beta',
    level: 'Beginner',
    componentIds: ['ultrasonic-sensor', 'ir-sensor'],
  },
  {
    id: 'precision-pack',
    name: 'Precision Pack',
    tagline: 'CNC-grade positioning for serious builds.',
    description:
      'A NEMA 17 stepper with 1.8° steps for gantries, rotating platforms and anything that demands exact open-loop positioning. Pairs with a stepper driver board when the Controller line grows.',
    icon: 'crosshair',
    sizeMb: 8,
    priceLabel: 'Free · Beta',
    level: 'Intermediate',
    componentIds: ['stepper-motor'],
  },
  {
    id: 'power-pack',
    name: 'Power Pack',
    tagline: 'The energy budget for untethered robots.',
    description:
      'A 3S 2200 mAh lithium polymer pack with XT60 connector — 55 A of discharge headroom in 185 g. Includes the power-budget lesson every builder needs before their first brown-out.',
    icon: 'battery',
    sizeMb: 4,
    priceLabel: 'Free · Beta',
    level: 'Intermediate',
    componentIds: ['lipo-battery'],
  },
]

export function getPack(id: string): ComponentPack | undefined {
  return PACKS.find((p) => p.id === id)
}

/** Which pack(s) does a component belong to? */
export function packsForComponent(componentId: string): ComponentPack[] {
  return PACKS.filter((p) => p.componentIds.includes(componentId))
}

/** A pack plus this session's install state (shape of the /api/packs payload). */
export interface PackState extends ComponentPack {
  installed: boolean
  installedAt?: string
}
