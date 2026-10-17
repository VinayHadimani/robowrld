/**
 * The connection contract — the foundation of the assembly system.
 *
 * Every component in the library declares its mechanical *ports* (bolt holes,
 * shafts, faces, connectors) and its *degrees of freedom* (what can move).
 * These declarations live as pure data, separate from the 3D meshes, so that:
 *
 *   1. A future Assembly Builder can snap part A's port to part B's port
 *      (position + orientation) without knowing anything about the meshes.
 *   2. The 3D components render their own port markers from the same data —
 *      what you see bolted together is exactly what the data describes.
 *   3. Kinematics solvers (linkages, arms, grippers) can be driven from the
 *      DOF descriptors instead of hard-coded numbers.
 *
 * Positions are in component-local model units (same units the 3D component
 * is modeled in), with the component's origin at the bottom-center of its
 * body and +Y up.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** The mechanical flavor of a port — determines what it can bolt to. */
export type PortKind =
  | 'bolt-hole' // a clearance hole for a screw (e.g. M3 through a mounting tab)
  | 'spline-shaft' // a driven output shaft (horn / crank mounts here)
  | 'face' // a flat mounting face
  | 'pin-socket' // an electrical connector

export interface Port {
  /** Stable machine id, e.g. "mount-r1" — used by assembly recipes. */
  id: string
  /** Human label shown on markers and in tables. */
  label: string
  kind: PortKind
  /** Position in component-local units: [x, y, z]. */
  position: [number, number, number]
  /** Interface axis (outward normal / screw pass direction). */
  axis: [number, number, number]
  /** Engineering spec of the interface. */
  spec: string
  /** Port kinds this port can connect to. */
  accepts: PortKind[]
  /** Rendering hint: where the floating label chip sits. */
  labelOffset?: [number, number, number]
}

export interface DegreeOfFreedom {
  id: string
  label: string
  kind: 'rotational'
  /** Rotation axis in component-local units. */
  axis: [number, number, number]
  /** Pivot origin in component-local units. */
  origin: [number, number, number]
  /** Commandable range in degrees. */
  range: [number, number]
  /** Live state stream: the component writes its true angle here every frame. */
  driverPortId: string
}

export interface ComponentModel {
  id: string
  ports: Port[]
  dof: DegreeOfFreedom[]
}

/* ------------------------------------------------------------------ */
/* Servo motor — port map                                             */
/* ------------------------------------------------------------------ */

/**
 * Port positions mirror the procedural geometry in ServoMotor.tsx exactly:
 *  - Mounting tabs sit at y = 2.63 with M3 holes at local x = ±2.52 / ±3.12.
 *  - The 25T spline output shaft tops out at y ≈ 5.18 on the centerline.
 *  - The JR-style 3-pin connector lives at the end of the cable.
 */
export const SERVO_PORTS: Port[] = [
  {
    id: 'mount-r1',
    label: 'Mount R1',
    kind: 'bolt-hole',
    position: [3.12, 2.63, 0],
    axis: [0, 1, 0],
    spec: 'M3 clearance',
    accepts: ['bolt-hole', 'face'],
    labelOffset: [1.1, 0.55, 0],
  },
  {
    id: 'mount-r2',
    label: 'Mount R2',
    kind: 'bolt-hole',
    position: [2.52, 2.63, 0],
    axis: [0, 1, 0],
    spec: 'M3 clearance',
    accepts: ['bolt-hole', 'face'],
    labelOffset: [0.9, 0.75, 0],
  },
  {
    id: 'mount-l1',
    label: 'Mount L1',
    kind: 'bolt-hole',
    position: [-3.12, 2.63, 0],
    axis: [0, 1, 0],
    spec: 'M3 clearance',
    accepts: ['bolt-hole', 'face'],
    labelOffset: [-1.1, 0.55, 0],
  },
  {
    id: 'mount-l2',
    label: 'Mount L2',
    kind: 'bolt-hole',
    position: [-2.52, 2.63, 0],
    axis: [0, 1, 0],
    spec: 'M3 clearance',
    accepts: ['bolt-hole', 'face'],
    labelOffset: [-0.9, 0.75, 0],
  },
  {
    id: 'shaft',
    label: 'Output shaft',
    kind: 'spline-shaft',
    position: [0, 5.18, 0],
    axis: [0, 1, 0],
    spec: '25T spline · 180°',
    accepts: ['spline-shaft'],
    labelOffset: [0, 0.9, 0.6],
  },
  {
    id: 'base-face',
    label: 'Base face',
    kind: 'face',
    position: [0, 0, 0],
    axis: [0, -1, 0],
    spec: '40.7 × 19.7 mm pad',
    accepts: ['bolt-hole', 'face'],
    labelOffset: [0, -0.7, 0],
  },
  {
    id: 'signal',
    label: 'Signal lead',
    kind: 'pin-socket',
    position: [-8.38, -0.24, 0],
    axis: [-1, 0, 0],
    spec: 'JR 3-pin · PWM',
    accepts: ['pin-socket'],
    labelOffset: [-0.9, 0.5, 0],
  },
]

export const SERVO_DOF: DegreeOfFreedom[] = [
  {
    id: 'shaft-rotation',
    label: 'Shaft rotation',
    kind: 'rotational',
    axis: [0, 1, 0],
    origin: [0, 4.84, 0],
    range: [0, 180],
    driverPortId: 'shaft',
  },
]

export const SERVO_MODEL: ComponentModel = {
  id: 'servo-motor',
  ports: SERVO_PORTS,
  dof: SERVO_DOF,
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const PORT_KIND_LABEL: Record<PortKind, string> = {
  'bolt-hole': 'Bolt hole',
  'spline-shaft': 'Spline shaft',
  face: 'Mount face',
  'pin-socket': 'Pin socket',
}

export function getPort(model: ComponentModel, id: string): Port | undefined {
  return model.ports.find((p) => p.id === id)
}
