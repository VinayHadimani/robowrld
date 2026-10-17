/**
 * The component schema — the platform's single source of truth.
 *
 * This file is what turns "a nice 3D viewer" into Pillar 1 of the robotics
 * creation platform. Every library component is described as DATA:
 *
 *   identity    → what it is, who makes it, what it costs (real-world commerce)
 *   specs       → the headline engineering numbers from the datasheet
 *   physics     → mass, materials, electrical load — what a simulation engine
 *                 (Godot later) needs to make the virtual behave like the real
 *   ai          → a machine-readable profile the AI generation layer (Pillar 2)
 *                 reads when a user says "build me a robot that avoids walls"
 *   model       → where the 3D geometry comes from (procedural today, glTF
 *                 from OpenSCAD/STL exports later — the schema accepts both)
 *
 * The geometry itself stays procedural in TypeScript (see ServoMotor.tsx):
 * procedural models can be parameterized, are tiny to download, and render
 * interactively. The DB stores the catalog + ownership; this file is the
 * definition. Everything here is JSON-serializable on purpose so it can be
 * served straight to browsers, the AI layer, and the future build-instruction
 * exporter without transformation.
 */

import type { ComponentModel } from './connections'
import { SERVO_MODEL } from './connections'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ComponentStatus = 'available' | 'soon'
export type ComponentCategory = 'Actuators' | 'Sensors' | 'Power' | 'Controller'

export interface SpecRow {
  label: string
  value: string
}

export interface PhysicsProperties {
  /** Mass in grams — the number a physics engine steps with. */
  mass: number
  /** Footprint in mm: length × width × height. */
  dimensions: { l: number; w: number; h: number }
  /** What each part is made of — feeds material physics + cost realism. */
  materials: Array<{ part: string; material: string }>
  /** Electrical load profile. */
  electrical: Array<{ label: string; value: string }>
  /** Mechanical ratings relevant to simulation. */
  mechanical: Array<{ label: string; value: string }>
  /** One-paragraph note on how the sim engine should treat this part. */
  simNotes: string
}

export interface CommerceInfo {
  manufacturer: string
  partNumber: string
  /** Typical street price range in USD. */
  priceUsd: [number, number]
  /** INR equivalent — the first market this platform targets. */
  priceInr: [number, number]
  availability: string
  /** Where a student can actually buy it. */
  vendors: string[]
}

export interface AiProfile {
  /** One line the AI layer reads first. */
  summary: string
  /** What this component can do in an assembly. */
  capabilities: string[]
  /** Hard limits the AI must respect when designing. */
  constraints: string[]
  /** Situations where this is the right pick. */
  bestFor: string[]
}

export type ModelSource =
  | {
      /** Code-generated parametric geometry (an R3F component export). */
      kind: 'procedural'
      /** Name of the exported React Three Fiber component. */
      component: string
      /** True if the mesh matches the spec-sheet dimensions exactly. */
      dimensionAccurate: boolean
      note: string
    }
  | {
      /** External asset (future: OpenSCAD → STL → glTF pipeline). */
      kind: 'gltf'
      url: string
    }

export interface RoboticsComponent {
  id: string
  name: string
  category: ComponentCategory
  status: ComponentStatus
  tagline: string
  /** Long-form description for the component detail page. */
  description: string
  specs: SpecRow[]
  physics: PhysicsProperties
  commerce: CommerceInfo
  ai: AiProfile
  model: ModelSource
  /** Connection contract (ports + DOF) — defined in connections.ts. */
  connectionModel?: ComponentModel
}

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

/**
 * The servo. Modeled after the Tower Pro MG996R class of metal-gear
 * hobby servos — the workhorse of student robotics. This is the first
 * fully-modeled component of the platform: procedural 3D, connection
 * contract, live PWM control, physics data and AI profile.
 */
export const SERVO: RoboticsComponent = {
  id: 'servo-motor',
  name: 'Servo Motor',
  category: 'Actuators',
  status: 'available',
  tagline: 'Closed-loop positional actuator with PWM control and a metal gear train.',
  description:
    'A servo motor is a rotary actuator that rotates to a commanded position and actively holds it there using closed-loop feedback from an internal potentiometer. It is driven by a PWM signal — at 50 Hz, a 0.5 ms pulse commands 0° and a 2.5 ms pulse commands 180°. This replica is modeled procedurally after a metal-gear hobby servo: drag the horn with your pointer, sweep it back and forth, swap horns and colors, and watch the control signal respond in real time.',
  specs: [
    { label: 'Operating voltage', value: '4.8 – 7.2 V DC' },
    { label: 'Stall torque', value: '9.4 kg·cm @ 4.8 V · 11 kg·cm @ 6 V' },
    { label: 'Travel speed', value: '0.17 s / 60° @ 4.8 V' },
    { label: 'Rotation range', value: '~180° (commandable 0 – 180°)' },
    { label: 'Control signal', value: 'PWM @ 50 Hz · 0.5 – 2.5 ms pulse' },
    { label: 'Gear train', value: 'All-metal, dual ball bearing output' },
    { label: 'Dimensions', value: '40.7 × 19.7 × 42.9 mm' },
    { label: 'Weight', value: '55 g (typical)' },
    { label: 'Cable', value: '300 mm, 3-pin (S · +V · GND)' },
  ],
  physics: {
    mass: 55,
    dimensions: { l: 40.7, w: 19.7, h: 42.9 },
    materials: [
      { part: 'Center case', material: 'Anodized aluminium' },
      { part: 'Top & end caps', material: 'Glass-filled PBT' },
      { part: 'Gear train', material: 'Hardened steel + brass' },
      { part: 'Output shaft', material: 'Steel, dual ball bearing' },
      { part: 'Horn', material: 'Glass-filled nylon' },
      { part: 'Cable', material: 'PVC, 26 AWG' },
    ],
    electrical: [
      { label: 'Idle current', value: '~10 mA' },
      { label: 'Typical moving load', value: '400 – 900 mA' },
      { label: 'Stall current', value: '~2.5 A @ 6 V' },
      { label: 'Supply range', value: '4.8 – 7.2 V' },
    ],
    mechanical: [
      { label: 'Stall torque', value: '9.4 kg·cm @ 4.8 V (0.92 N·m)' },
      { label: 'No-load speed', value: '~350°/s @ 4.8 V' },
      { label: 'Backlash', value: '< 1° (metal gears)' },
      { label: 'Axial load', value: '≤ 5 N on output shaft' },
    ],
    simNotes:
      'Treat as a positional rotary joint with a torque limit and a speed limit: command an angle, ramp toward it at ~350°/s max, and saturate torque at 0.92 N·m. Drawing more than ~2.5 A should brown-out an undersized supply — a lesson students should meet in simulation before they meet it in smoke.',
  },
  commerce: {
    manufacturer: 'Tower Pro',
    partNumber: 'MG996R',
    priceUsd: [7, 12],
    priceInr: [550, 950],
    availability: 'In stock everywhere — the most common hobby servo on earth',
    vendors: ['Amazon', 'Robu.in', 'SparkFun', 'Local robotics stores'],
  },
  ai: {
    summary: 'Precise rotary position actuator: turns to a commanded 0–180° angle and holds it under load.',
    capabilities: [
      'Positional rotation to any angle in 0–180°',
      'Actively holds position against external torque',
      '~0.17 s per 60° of travel under no load',
      'Closed-loop: no encoder needed by the controller',
    ],
    constraints: [
      'Not continuous rotation — cannot spin a wheel (stock)',
      'Adds 55 g per joint — arms compound quickly',
      'Stall current ~2.5 A can brown-out small battery packs',
      'Needs one PWM-capable pin per servo',
    ],
    bestFor: [
      'Robotic arm joints and grippers',
      'Walking / balancing robot hips and knees',
      'Steering on a rover (paired with a DC drive motor)',
      'Any mechanism that must HOLD a position, not just reach it',
    ],
  },
  model: {
    kind: 'procedural',
    component: 'ServoMotor',
    dimensionAccurate: true,
    note: 'Fully parametric TypeScript geometry — tabs, spline, horns and cable are all code. Spec-sheet dimensions are ground truth for simulation.',
  },
  connectionModel: SERVO_MODEL,
}

/** 37 mm brushed DC gear motor — the traction actuator. */
export const DC_MOTOR: RoboticsComponent = {
  id: 'dc-motor',
  name: 'DC Gear Motor',
  category: 'Actuators',
  status: 'soon',
  tagline: 'Continuous-rotation brushed DC motor with planetary gearbox.',
  description:
    'A brushed DC gear motor spins continuously in either direction — the classic traction actuator for wheels, tracks and props. The built-in gearbox trades raw speed for torque; direction and speed are set by an H-bridge (see the Speed Controller).',
  specs: [
    { label: 'Operating voltage', value: '6 – 12 V DC' },
    { label: 'Gearbox', value: 'Planetary, 19:1 steel' },
    { label: 'Output speed', value: '200 RPM @ 12 V (no load)' },
    { label: 'Stall torque', value: '15 kg·cm @ 12 V' },
    { label: 'Dimensions', value: '37 mm Ø × 56 mm' },
    { label: 'Weight', value: '210 g' },
  ],
  physics: {
    mass: 210,
    dimensions: { l: 56, w: 37, h: 37 },
    materials: [
      { part: 'Gearbox housing', material: 'Anodized aluminium' },
      { part: 'Gears', material: 'Steel, planetary' },
      { part: 'Motor can', material: 'Steel, nickel-plated' },
    ],
    electrical: [
      { label: 'No-load current', value: '~0.3 A' },
      { label: 'Typical load', value: '1.5 – 3 A' },
      { label: 'Stall current', value: '~7 A @ 12 V' },
    ],
    mechanical: [
      { label: 'Stall torque', value: '15 kg·cm @ 12 V (1.47 N·m)' },
      { label: 'No-load speed', value: '200 RPM @ 12 V' },
    ],
    simNotes:
      'Model as a torque-speed line: max torque at stall, max speed at no-load, linear in between. Direction flips with voltage polarity — always paired with an H-bridge ESC.',
  },
  commerce: {
    manufacturer: 'Yonge / generic',
    partNumber: '37D-19:1',
    priceUsd: [9, 16],
    priceInr: [700, 1200],
    availability: 'Widely stocked; buy with matching mounting brackets',
    vendors: ['Amazon', 'Robu.in', 'Pololu'],
  },
  ai: {
    summary: 'Continuous-rotation traction motor: speed and direction set by an ESC, no position feedback.',
    capabilities: [
      'Continuous rotation in both directions',
      'Speed control via PWM through an H-bridge',
      'High torque from the 19:1 planetary gearbox',
    ],
    constraints: [
      'No position feedback — needs encoders for odometry',
      'Must be driven by a speed controller, never straight from a microcontroller pin',
      'Stall current ~7 A — size the ESC and battery for it',
    ],
    bestFor: ['Drive wheels on rovers', 'Tank-style locomotion', 'Conveyor / feeder mechanisms'],
  },
  model: {
    kind: 'procedural',
    component: 'DcGearMotor',
    dimensionAccurate: true,
    note: 'Queued for procedural modeling — the geometry builder follows the same pipeline as the servo.',
  },
}

/** NEMA 17 bipolar stepper. */
export const STEPPER_MOTOR: RoboticsComponent = {
  id: 'stepper-motor',
  name: 'Stepper Motor',
  category: 'Actuators',
  status: 'soon',
  tagline: 'NEMA 17 bipolar stepper for precise open-loop positioning.',
  description:
    'A stepper motor moves in exact increments — steps — instead of to a commanded angle. Driven by a chopper driver (A4988/DRV8825 class), it gives CNC-grade positioning without any feedback sensor, at the cost of weight and heat.',
  specs: [
    { label: 'Frame', value: 'NEMA 17 · 42.3 × 42.3 mm' },
    { label: 'Step angle', value: '1.8° (200 steps/rev)' },
    { label: 'Rated current', value: '1.68 A per phase' },
    { label: 'Holding torque', value: '0.59 N·m (6.0 kg·cm)' },
    { label: 'Body length', value: '47 mm' },
    { label: 'Weight', value: '350 g' },
  ],
  physics: {
    mass: 350,
    dimensions: { l: 42.3, w: 42.3, h: 47 },
    materials: [
      { part: 'Laminations & shaft', material: 'Silicon steel' },
      { part: 'End caps', material: 'Cast aluminium' },
      { part: 'Bearings', material: 'Dual ball bearing' },
    ],
    electrical: [
      { label: 'Phase current', value: '1.68 A (chopper-controlled)' },
      { label: 'Driver supply', value: '8 – 35 V (A4988/DRV8825)' },
    ],
    mechanical: [
      { label: 'Holding torque', value: '0.59 N·m' },
      { label: 'Positioning', value: '±0.05° (microstepping)' },
    ],
    simNotes:
      'Open-loop positioning: count steps to know where you are. Model torque falloff with speed and add missed-step detection hints for high accelerations.',
  },
  commerce: {
    manufacturer: 'LDO / OMC',
    partNumber: '42STH47-1684',
    priceUsd: [9, 15],
    priceInr: [700, 1100],
    availability: 'Ubiquitous — the 3D-printer workhorse',
    vendors: ['Amazon', 'Robu.in', 'Eckart Tech'],
  },
  ai: {
    summary: 'Open-loop precision positioning motor: moves in exact 1.8° steps with no feedback sensor.',
    capabilities: [
      'Exact incremental positioning (200 full steps/rev)',
      'Holds position when energized',
      'Microstepping for smooth, quiet motion',
    ],
    constraints: [
      'Heavy — 350 g each; poor strength-to-weight vs servos',
      'Skips steps under overload (silent failure)',
      'Needs a current-controlled driver board, not a bare pin',
    ],
    bestFor: ['Gantry / CNC axes', 'Precise rotating platforms', 'Camera gimbals'],
  },
  model: {
    kind: 'procedural',
    component: 'StepperMotor',
    dimensionAccurate: true,
    note: 'Queued for procedural modeling.',
  },
}

/** HC-SR04 ultrasonic rangefinder. */
export const ULTRASONIC_SENSOR: RoboticsComponent = {
  id: 'ultrasonic-sensor',
  name: 'Ultrasonic Sensor',
  category: 'Sensors',
  status: 'soon',
  tagline: 'HC-SR04 time-of-flight distance sensor, 2–400 cm range.',
  description:
    'The HC-SR04 bounces 40 kHz sound pulses off the nearest object and measures the echo time — a two-eyed distance sensor that works regardless of light or surface color. It is the default "eyes" of an obstacle-avoiding robot.',
  specs: [
    { label: 'Working voltage', value: '5 V DC' },
    { label: 'Range', value: '2 – 400 cm' },
    { label: 'Accuracy', value: '± 3 mm' },
    { label: 'Beam angle', value: '~15°' },
    { label: 'Trigger', value: '10 µs pulse → echo on return' },
    { label: 'Dimensions', value: '45 × 20 × 15 mm' },
  ],
  physics: {
    mass: 9,
    dimensions: { l: 45, w: 20, h: 15 },
    materials: [
      { part: 'Body', material: 'ABS' },
      { part: 'Transducers', material: 'Piezoelectric, aluminium can' },
    ],
    electrical: [
      { label: 'Operating current', value: '~15 mA' },
      { label: 'Logic', value: '5 V (3.3 V tolerant on Echo via divider)' },
    ],
    mechanical: [
      { label: 'Update rate', value: 'up to ~20 Hz' },
      { label: 'Beam', value: '15° cone at 40 kHz' },
    ],
    simNotes:
      'Raycast a 15° cone, add gaussian noise of ±3 mm, and gate returns to 2–400 cm. Soft/angled surfaces should drop echoes, just like reality.',
  },
  commerce: {
    manufacturer: 'Elecfreaks / generic',
    partNumber: 'HC-SR04',
    priceUsd: [1.5, 3],
    priceInr: [120, 250],
    availability: 'Cheapest usable robot sensor in existence',
    vendors: ['Amazon', 'Robu.in', 'Any electronics shop'],
  },
  ai: {
    summary: 'Time-of-flight distance sensor: measures 2–400 cm with 15° beam — the robot’s obstacle eyes.',
    capabilities: [
      'Measures distance to nearest object in a 15° cone',
      'Works in darkness and on any surface color',
      '±3 mm repeatable accuracy',
    ],
    constraints: [
      'Blind below 2 cm',
      'Soft fabric or steeply angled surfaces absorb/deflect the echo',
      'Needs ~60 ms between reads to avoid echo cross-talk',
    ],
    bestFor: ['Obstacle avoidance', 'Wall following', 'Parking / docking distance'],
  },
  model: {
    kind: 'procedural',
    component: 'UltrasonicSensor',
    dimensionAccurate: true,
    note: 'Queued for procedural modeling.',
  },
}

/** TCRT5000-based reflective IR sensor. */
export const IR_SENSOR: RoboticsComponent = {
  id: 'ir-sensor',
  name: 'IR Proximity Sensor',
  category: 'Sensors',
  status: 'soon',
  tagline: 'Reflective infrared sensor for line following and edge detection.',
  description:
    'An IR emitter/receiver pair that detects reflectance at close range. On a line-following robot, two or three of these straddle the line and steer the wheels; aimed downward past a table edge, they detect the drop-off before the robot does.',
  specs: [
    { label: 'Working voltage', value: '3.3 – 5 V' },
    { label: 'Sensing range', value: '1 – 25 mm (analog)' },
    { label: 'Output', value: 'Digital threshold + analog voltage' },
    { label: 'Emitter', value: '940 nm infrared LED' },
    { label: 'Dimensions', value: '38 × 10 × 12 mm (board)' },
  ],
  physics: {
    mass: 5,
    dimensions: { l: 38, w: 10, h: 12 },
    materials: [
      { part: 'PCB', material: 'FR4' },
      { part: 'Sensor can', material: 'Plastic, TCRT5000' },
    ],
    electrical: [
      { label: 'Operating current', value: '~20 mA' },
      { label: 'Logic', value: '3.3 / 5 V compatible' },
    ],
    mechanical: [
      { label: 'Response time', value: '< 1 ms' },
      { label: 'Optimal height', value: '~8 mm above surface' },
    ],
    simNotes:
      'Sample surface reflectance under the emitter: dark line → low value, white floor → high value. Add the 1–25 mm height window and ~1 ms latency.',
  },
  commerce: {
    manufacturer: 'generic (TCRT5000)',
    partNumber: 'TCRT5000-module',
    priceUsd: [1, 2],
    priceInr: [60, 150],
    availability: 'Sold in packs of 5 — one robot uses 2–3',
    vendors: ['Amazon', 'Robu.in', 'Electronics bazaars'],
  },
  ai: {
    summary: 'Short-range reflective sensor: tells dark from light surfaces at 1–25 mm — the line follower’s eyes.',
    capabilities: [
      'Distinguishes dark/light surface reflectance',
      'Digital + analog output on one board',
      'Sub-millisecond response for fast steering loops',
    ],
    constraints: [
      'Range is millimeters, not centimeters — mount 8 mm above ground',
      'Fooled by glossy black surfaces and IR-rich sunlight',
    ],
    bestFor: ['Line following', 'Edge / cliff detection', 'Wheel encoder discs'],
  },
  model: {
    kind: 'procedural',
    component: 'IrProximitySensor',
    dimensionAccurate: true,
    note: 'Queued for procedural modeling.',
  },
}

/** Brushed ESC with BEC. */
export const ESC: RoboticsComponent = {
  id: 'esc',
  name: 'Speed Controller',
  category: 'Controller',
  status: 'soon',
  tagline: 'Bidirectional brushed ESC with BEC and PWM input.',
  description:
    'An Electronic Speed Controller is the muscle between the battery and the DC motor: it switches tens of amps through an H-bridge in response to a small PWM signal from the microcontroller, and its BEC regulator feeds 5 V back out to power the logic.',
  specs: [
    { label: 'Motor support', value: 'Brushed DC, bidirectional' },
    { label: 'Supply voltage', value: '7.2 – 16 V (2S–4S)' },
    { label: 'Continuous current', value: '60 A' },
    { label: 'BEC output', value: '5 V / 2 A for logic' },
    { label: 'Input signal', value: 'PWM 50 Hz or 1–2 ms pulse' },
    { label: 'Weight', value: '35 g' },
  ],
  physics: {
    mass: 35,
    dimensions: { l: 55, w: 28, h: 14 },
    materials: [
      { part: 'PCB', material: 'FR4, 2 oz copper' },
      { part: 'MOSFET bank', material: 'Silicon, heatsink pad' },
      { part: 'Case', material: 'Heat-shrink sleeve' },
    ],
    electrical: [
      { label: 'Continuous current', value: '60 A with airflow' },
      { label: 'Burst (10 s)', value: '80 A' },
      { label: 'BEC', value: '5 V, 2 A (linear)' },
    ],
    mechanical: [
      { label: 'Thermal', value: 'Derates above 60 ° case' },
    ],
    simNotes:
      'The electrical router: enforces current limits and supply brown-out. Model BEC sag when motor stall current spikes — a realistic failure students should see coming.',
  },
  commerce: {
    manufacturer: 'Hobbywing / generic',
    partNumber: 'WP-60A-BR',
    priceUsd: [12, 20],
    priceInr: [900, 1600],
    availability: 'RC hobby shops stock dozens of equivalents',
    vendors: ['Amazon', 'HobbyKing', 'Robu.in'],
  },
  ai: {
    summary: 'Power interface between battery and DC motor: PWM in, 60 A out, plus a 5 V supply for the brain.',
    capabilities: [
      'Drives brushed motors at up to 60 A continuous',
      'Reverse and braking (H-bridge)',
      'BEC powers the microcontroller from the motor battery',
    ],
    constraints: [
      'Brushed only — brushless motors need a different ESC',
      'Needs airflow at continuous high current',
      'One ESC per motor (or a dual-board)',
    ],
    bestFor: ['Rover drive trains', 'Any DC motor above 2 A', 'Sharing one battery for motors + logic'],
  },
  model: {
    kind: 'procedural',
    component: 'SpeedController',
    dimensionAccurate: true,
    note: 'Queued for procedural modeling.',
  },
}

/** 3S LiPo pack. */
export const LIPO_BATTERY: RoboticsComponent = {
  id: 'lipo-battery',
  name: 'LiPo Battery Pack',
  category: 'Power',
  status: 'soon',
  tagline: '3S 11.1 V lithium polymer pack with XT60 connector.',
  description:
    'The energy tank. A 3-cell lithium polymer pack delivers 11.1 V nominal at high discharge rates in a featherweight package — the standard power source for anything that moves. It demands respect: low-voltage cutoffs and fire-safe charging.',
  specs: [
    { label: 'Configuration', value: '3S (11.1 V nominal, 12.6 V full)' },
    { label: 'Capacity', value: '2200 mAh' },
    { label: 'Discharge', value: '25C continuous (55 A)' },
    { label: 'Connector', value: 'XT60' },
    { label: 'Dimensions', value: '105 × 33 × 24 mm' },
    { label: 'Weight', value: '185 g' },
  ],
  physics: {
    mass: 185,
    dimensions: { l: 105, w: 33, h: 24 },
    materials: [
      { part: 'Cells', material: 'Lithium polymer, aluminium pouch' },
      { part: 'Wrap', material: 'Vinyl heat-shrink' },
      { part: 'Leads', material: 'Silicone, 12 AWG' },
    ],
    electrical: [
      { label: 'Capacity', value: '2200 mAh' },
      { label: 'Max continuous', value: '55 A (25C)' },
      { label: 'Storage voltage', value: '11.4 V (3.8 V/cell)' },
    ],
    mechanical: [
      { label: 'Do not puncture', value: 'Pouch cells deform — no sharp mounts' },
    ],
    simNotes:
      'The global constraint every design must satisfy: model capacity drain from total current draw, sag under load, and a 9.9 V (3.3 V/cell) floor where performance collapses.',
  },
  commerce: {
    manufacturer: 'Orange / Turnigy',
    partNumber: 'OX-3S-2200',
    priceUsd: [15, 25],
    priceInr: [1200, 2000],
    availability: 'RC shops; always buy with a balance charger',
    vendors: ['Robu.in', 'HobbyKing', 'Amazon'],
  },
  ai: {
    summary: 'The power budget: 11.1 V / 2200 mAh / 55 A — every motor choice must fit inside it.',
    capabilities: [
      'High current in a light 185 g package',
      'Stable 11.1 V rail for motors and logic (via BEC)',
    ],
    constraints: [
      'Runtime = capacity ÷ total draw — budget it before adding motors',
      'Never drain below 3.3 V/cell (permanent damage)',
      'Mount away from sharp edges; pouch cells puncture',
    ],
    bestFor: ['Any untethered robot', 'Teaching the power-budget lesson'],
  },
  model: {
    kind: 'procedural',
    component: 'LipoBattery',
    dimensionAccurate: true,
    note: 'Queued for procedural modeling.',
  },
}

/**
 * The 9V battery (PP3 / 6LR61). The pocket-sized power source: snap
 * terminals on top, 9 volts underneath, and in the playground the origin
 * of the power graph — nothing runs unless a wire path leads back to one
 * of these.
 */
export const BATTERY_9V: RoboticsComponent = {
  id: '9v-battery',
  name: '9V Battery',
  category: 'Power',
  status: 'available',
  tagline: 'Compact 9 V power source with snap terminals — powers whatever it is connected to.',
  description:
    'A 9-volt battery is a compact single-cell-package power source recognisable by the two snap terminals on its top face — one round, one hexagonal — which let it clip onto a matching connector or daisy-chain onto other components. In this library it is the power source: connect it to a component in the playground and that component comes alive. Anything not connected to a battery (directly, or through a chain of connected components) stays still.',
  specs: [
    { label: 'Nominal voltage', value: '9 V DC' },
    { label: 'Chemistry', value: 'Alkaline (6LR61) · zinc-carbon equivalent' },
    { label: 'Capacity', value: '~550 mAh (alkaline)' },
    { label: 'Terminals', value: 'Dual snap on top (round + hex)' },
    { label: 'Dimensions', value: '26.5 × 17.5 × 48.5 mm' },
    { label: 'Weight', value: '~45 g' },
  ],
  physics: {
    mass: 45,
    dimensions: { l: 26.5, w: 17.5, h: 48.5 },
    materials: [
      { part: 'Cell stack', material: 'Zinc / manganese dioxide' },
      { part: 'Outer wrap', material: 'Vinyl or steel jacket' },
      { part: 'Snap terminals', material: 'Tin-plated brass' },
    ],
    electrical: [
      { label: 'Nominal output', value: '9 V' },
      { label: 'Continuous current', value: '~50 – 100 mA (alkaline)' },
      { label: 'Pulse current', value: '~500 mA brief peaks' },
      { label: 'Shelf life', value: '~5 years (alkaline)' },
    ],
    mechanical: [
      { label: 'Leak risk', value: 'Non-rechargeable cells vent if reversed or overdriven' },
      { label: 'Mounting', value: 'Snap clips — no fasteners needed' },
    ],
    simNotes:
      'The origin node of the power graph: any component connected to it (directly or through a chain of attached components) is powered. Model capacity drain from total current draw, and voltage sag when the load tries to pull more than ~100 mA continuous — a single 9V cannot sustain a stalled servo.',
  },
  commerce: {
    manufacturer: 'Energizer / Duracell / generic',
    partNumber: '6LR61 (PP3)',
    priceUsd: [2, 5],
    priceInr: [80, 250],
    availability: 'Sold at every corner store on earth',
    vendors: ['Amazon', 'Local stores', 'Robu.in'],
  },
  ai: {
    summary: 'Pocket 9 V DC power source with snap terminals — the origin of the power graph.',
    capabilities: [
      'Supplies 9 V to everything connected to it',
      'Snap terminals clip straight onto components or battery snaps',
      'Chains through connected components to power an entire assembly',
    ],
    constraints: [
      '~100 mA continuous — fine for logic and idle servos, not stalled motors',
      'Non-rechargeable in the alkaline version',
      'One battery powers only what it is actually connected to',
    ],
    bestFor: [
      'Powering a single servo or small logic circuit',
      'Teaching that power must be connected, not assumed',
      'Quick prototypes before a proper pack exists',
    ],
  },
  model: {
    kind: 'procedural',
    component: 'Battery9V',
    dimensionAccurate: true,
    note: 'Parametric PP3 geometry — body, brass snap terminals and a status LED that lights when the battery is powering something.',
  },
}

/**
 * The controller board (Arduino Uno R3 class). The real-life bridge of
 * every student robot: the 9V battery wires into its VIN jack, and its
 * 5 V pin header feeds servos and small motors through 3-wire signal
 * cables. Without it, nothing that needs a signal or 5 V logic can run.
 */
export const CONTROLLER: RoboticsComponent = {
  id: 'arduino-uno',
  name: 'Arduino Uno',
  category: 'Controller',
  status: 'available',
  tagline: 'The 5 V heartbeat of a robot — takes 9 V in on VIN, feeds servos and sensors out.',
  description:
    'The Arduino Uno is a microcontroller board based on the ATmega328P: 14 digital I/O pins (6 of them PWM outputs for servos), 6 analog inputs, a 16 MHz clock and a USB port for programming. In a real robot it sits between the battery and everything else — the 9 V battery wires into its VIN jack (7–12 V), its onboard regulator drops that to a clean 5 V, and its pin headers then power and command servos, motors and sensors. In this library it plays exactly that role: a component only connects when voltage and connector match; a servo takes 4.8–7.2 V on a 3-pin lead, so it plugs into the Uno — never straight onto a 9 V snap.',
  specs: [
    { label: 'Microcontroller', value: 'ATmega328P · 16 MHz' },
    { label: 'Digital I/O', value: '14 pins (6 PWM) + 6 analog in' },
    { label: 'Input (VIN jack)', value: '7–12 V DC' },
    { label: 'Logic / output', value: '5 V · ~500 mA for peripherals' },
    { label: 'Dimensions', value: '68.6 × 53.4 mm' },
    { label: 'Weight', value: '~25 g' },
  ],
  physics: {
    mass: 25,
    dimensions: { l: 68.6, w: 53.4, h: 15 },
    materials: [
      { part: 'PCB', material: 'FR4, teal solder mask' },
      { part: 'Headers', material: 'Black plastic + gold-plated pins' },
      { part: 'Connectors', material: 'Tin-plated steel (USB-B, barrel jack)' },
    ],
    electrical: [
      { label: 'VIN range', value: '7–12 V (reverse-polarity protected)' },
      { label: '5 V rail', value: '~500 mA shared by headers' },
      { label: 'Logic level', value: '5 V TTL' },
      { label: 'Idle draw', value: '~45–50 mA' },
    ],
    mechanical: [
      { label: 'Mounting', value: '4 × 3.2 mm holes' },
      { label: 'Connectors', value: 'USB-B, 2.1 mm barrel jack' },
    ],
    simNotes:
      'The power broker of the graph: accepts 7–12 V on VIN, provides a regulated 5 V on its headers while powered. A servo wired here runs from the 5 V rail, NOT from the raw battery — voltage compatibility is enforced at every link, exactly like the real part.',
  },
  commerce: {
    manufacturer: 'Arduino (and compatible clones)',
    partNumber: 'A000066 / UNO R3',
    priceUsd: [6, 25],
    priceInr: [500, 2200],
    availability: 'Every robotics shop; clones from ₹500',
    vendors: ['Amazon', 'Robu.in', 'Arduino Store', 'Local electronics markets'],
  },
  ai: {
    summary: 'ATmega328P microcontroller board — regulates 9 V VIN down to a 5 V rail that powers and commands servos and sensors.',
    capabilities: [
      'Regulates 7–12 V VIN into a clean 5 V rail for peripherals',
      'Drives a couple of servos from its headers (PWM)',
      'Reads sensors on analog and digital pins',
      'The bridge every signal-dependent component plugs into',
    ],
    constraints: [
      '5 V rail is ~500 mA shared — not for stalled motors',
      'Servos draw through the board, never straight from the battery',
      'Needs 7 V minimum on VIN — a 5 V feed will not run it',
    ],
    bestFor: [
      'Standing between a 9V battery and servos/sensors',
      'Any robot that needs more than raw motor power',
      'Teaching why voltage compatibility matters',
    ],
  },
  model: {
    kind: 'procedural',
    component: 'ArduinoUno',
    dimensionAccurate: true,
    note: 'Parametric Uno R3 geometry — teal PCB, black headers with gold pins, USB-B, barrel jack, ATmega chip and an ON LED that lights while the board is powered.',
  },
}

/* ------------------------------------------------------------------ */
/* The catalog                                                         */
/* ------------------------------------------------------------------ */

export const COMPONENTS: RoboticsComponent[] = [
  SERVO,
  BATTERY_9V,
  CONTROLLER,
  DC_MOTOR,
  STEPPER_MOTOR,
  ULTRASONIC_SENSOR,
  IR_SENSOR,
  ESC,
  LIPO_BATTERY,
]

export function getComponent(id: string): RoboticsComponent | undefined {
  return COMPONENTS.find((c) => c.id === id)
}

/**
 * The machine-readable catalog — exactly what the AI generation layer
 * (Pillar 2) will be fed as tool/context when a user says "build me a
 * line-following robot that avoids obstacles". Geometry references are
 * stripped; capabilities, constraints, ports, physics and cost remain.
 */
export function aiCatalogPayload() {
  return {
    schema: 'robotics-platform.catalog/1.0',
    generatedAt: new Date().toISOString(),
    componentCount: COMPONENTS.length,
    components: COMPONENTS.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      status: c.status,
      tagline: c.tagline,
      mass_g: c.physics.mass,
      dimensions_mm: c.physics.dimensions,
      price_usd: c.commerce.priceUsd,
      part_number: c.commerce.partNumber,
      ports: c.connectionModel?.ports.length ?? 0,
      dof: c.connectionModel?.dof.map((d) => ({
        id: d.id,
        kind: d.kind,
        range_deg: d.range,
        axis: d.axis,
      })) ?? [],
      ai: c.ai,
      key_specs: c.specs.slice(0, 4).map((s) => `${s.label}: ${s.value}`),
    })),
  }
}
