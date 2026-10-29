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
export type ComponentCategory =
  | 'Actuators'
  | 'Sensors'
  | 'Power'
  | 'Controller'
  | 'Mechanical'
  | 'Pneumatics'

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
  status: 'available',
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
    note: 'Exact procedural replica — 37 mm silver gearbox barrel with M3 face holes, 6 mm flat shaft that spins when powered, black motor can, solder-tab leads. See three/DcGearMotor.tsx.',
  },
}

/** NEMA 17 bipolar stepper. */
export const STEPPER_MOTOR: RoboticsComponent = {
  id: 'stepper-motor',
  name: 'Stepper Motor',
  category: 'Actuators',
  status: 'available',
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
    component: 'Nema17Stepper',
    dimensionAccurate: true,
    note: 'Exact procedural replica — laminated 42.3 mm stack, aluminium front plate with cap screws, 5 mm shaft that steps in visible 1.8° increments, 4-wire lead. See three/Nema17Stepper.tsx.',
  },
}

/** HC-SR04 ultrasonic rangefinder. */
export const ULTRASONIC_SENSOR: RoboticsComponent = {
  id: 'ultrasonic-sensor',
  name: 'Ultrasonic Sensor',
  category: 'Sensors',
  status: 'available',
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
    component: 'HcSr04',
    dimensionAccurate: true,
    note: 'Exact procedural replica — blue silkscreened carrier, two Ø16 mm aluminium transducer cans with canvas-drawn perforated mesh faces, right-angle 4-pin header. See three/HcSr04.tsx.',
  },
}

/** TCRT5000-based reflective IR sensor. */
export const IR_SENSOR: RoboticsComponent = {
  id: 'ir-sensor',
  name: 'IR Proximity Sensor',
  category: 'Sensors',
  status: 'available',
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
    component: 'IrSensor',
    dimensionAccurate: true,
    note: 'Exact procedural replica — TCRT5000 block with dual down-facing lenses, blue trimmer with brass screw, LM393, power LED that lights when energized. See three/IrSensor.tsx.',
  },
}

/** Brushed ESC with BEC. */
export const ESC: RoboticsComponent = {
  id: 'esc',
  name: 'Speed Controller',
  category: 'Controller',
  status: 'available',
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
    component: 'EscBoard',
    dimensionAccurate: true,
    note: 'Exact procedural replica — green power board, 4× TO-252 MOSFET bank, electrolytics, BEC regulator with lit status LED, silicone leads and Dupont signal plug. See three/EscBoard.tsx.',
  },
}

/** 3S LiPo pack. */
export const LIPO_BATTERY: RoboticsComponent = {
  id: 'lipo-battery',
  name: 'LiPo Battery Pack',
  category: 'Power',
  status: 'available',
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
    component: 'LipoPack',
    dimensionAccurate: true,
    note: 'Exact procedural replica — three bulging cell segments under a printed heat-shrink wrap, silicone main leads into a yellow XT60, 4-wire balance lead with JST-XH. See three/LipoPack.tsx.',
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
/* Mechanical transmission — strain wave gear                          */
/* ------------------------------------------------------------------ */

/**
 * The strain wave gear (harmonic drive). An elliptical wave generator
 * flexes a thin-toothed flexspline inside a circular spline that has
 * two more teeth — so one input revolution walks the output by exactly
 * 1/100th of a turn. Huge ratio, tiny package, zero backlash; the cost
 * is the flexing steel itself, which abrades over its lifetime.
 */
export const STRAIN_WAVE_GEAR: RoboticsComponent = {
  id: 'strain-wave-gear',
  name: 'Strain Wave Gear',
  category: 'Mechanical',
  status: 'available',
  tagline: 'Harmonic drive: 100:1 reduction in one tiny, zero-backlash stage.',
  description:
    'A strain wave gear (harmonic drive) uses an elliptical wave generator to flex a thin steel cup — the flexspline — against a fixed circular spline that has exactly two more teeth. Each input revolution advances the output by the tooth difference: 100:1 in a package smaller than a servo, with essentially zero backlash because the pre-loaded teeth never stop touching. Robot arms love it; the trade-off is wear — the flexspline flexes every single turn, and its abrasion sets the drive’s lifetime.',
  specs: [
    { label: 'Reduction ratio', value: '100:1 in a single stage' },
    { label: 'Rated torque', value: '8 N·m (rated) · 24 N·m (momentary)' },
    { label: 'Backlash', value: '≈ 0 (tooth pre-load)' },
    { label: 'Repeatability', value: '± 5 arc-sec' },
    { label: 'Dimensions', value: 'Ø42 × 36 mm + input shaft' },
    { label: 'Weight', value: '≈ 250 g' },
  ],
  physics: {
    mass: 250,
    dimensions: { l: 42, w: 42, h: 36 },
    materials: [
      { part: 'Circular spline', material: 'Steel, black oxide' },
      { part: 'Flexspline cup', material: 'Thin alloy steel, polished' },
      { part: 'Wave generator', material: 'Chrome steel ball-bearing assembly' },
    ],
    electrical: [],
    mechanical: [
      { label: 'Ratio', value: '100:1 (two-tooth difference)' },
      { label: 'Torsional stiffness', value: '≈ 4.5 N·m/arc-min' },
      { label: 'Lifetime limit', value: 'Flexspline abrasion (the flexing steel wears)' },
    ],
    simNotes:
      'Model as an exact 100:1 rotational reduction with zero backlash and a torque ceiling. The honest disadvantage is the flexing: every input revolution fatigues the flexspline — accumulate flex-cycles and derate torque as abrasion grows, exactly the wear lesson from the notes.',
  },
  commerce: {
    manufacturer: 'Harmonic Drive Systems / Leaderdrive',
    partNumber: 'CSF-20-100 (class)',
    priceUsd: [45, 260],
    priceInr: [3500, 22000],
    availability: 'Precision stock — clones make it student-affordable',
    vendors: ['Leaderdrive', 'AliExpress', 'Misumi', 'Harmonic Drive'],
  },
  ai: {
    summary: 'Single-stage 100:1 zero-backlash reducer: tiny and light for robot joints.',
    capabilities: [
      '100:1 reduction in one compact stage',
      'Essentially zero backlash — pre-loaded teeth',
      'Excellent repeatability (± 5 arc-sec)',
      'Very light for the torque it carries',
    ],
    constraints: [
      'Flexspline abrasion limits lifetime — the flexing steel wears',
      'Needs the input driven smoothly (a motor, never fingers)',
      'Not cheap, even as clones',
    ],
    bestFor: ['Robot arm joints', 'CNC rotary tables / indexers', 'Precision gimbals and pan-tilts'],
  },
  model: {
    kind: 'procedural',
    component: 'StrainWaveGear',
    dimensionAccurate: true,
    note: 'Exact procedural replica — black-oxide circular spline ring with 72 internal teeth and bolts, polished flexspline cup with 70 external teeth and flange, chrome elliptical wave generator on the input shaft. The wave generator spins at input speed while the flexspline crawls at input ÷ 100. See three/StrainWaveGear.tsx.',
  },
}

/**
 * The planetary gear stage. A brass sun on the input shaft drives three
 * planets inside a steel ring; the carrier (and output shaft) turn at
 * input ÷ 5. Load is shared across the three planets — the reason
 * planetaries punch above their weight — while pushing for a big ratio
 * in ONE stage needs tiny, weaker teeth, which is why real gearboxes
 * stack stages instead.
 */
export const PLANETARY_GEAR: RoboticsComponent = {
  id: 'planetary-gear',
  name: 'Planetary Gear',
  category: 'Mechanical',
  status: 'available',
  tagline: '5:1 sun-planets-ring stage — load shared three ways, torque dense.',
  description:
    'A planetary (epicyclic) gear stage spins a central sun gear with three planet gears orbiting inside a fixed ring gear. Because the three planets share the load, a small stage carries surprising torque, and the coaxial layout stays compact and balanced. The carrier pinned to the planets is the output: it turns at exactly input ÷ 5. A single stage stays at modest ratios on purpose — a very high single-stage ratio means tiny teeth, and tiny teeth are not strong. Easily backdrivable, which makes it friendly for hand-moving mechanisms.',
  specs: [
    { label: 'Reduction ratio', value: '5:1 single stage' },
    { label: 'Continuous torque', value: '1.2 N·m at the carrier' },
    { label: 'Efficiency', value: '≈ 97 % per stage' },
    { label: 'Backlash', value: '< 20 arc-min (stock)' },
    { label: 'Dimensions', value: 'Ø43.5 × 35.5 mm on its stand' },
    { label: 'Weight', value: '≈ 180 g' },
  ],
  physics: {
    mass: 180,
    dimensions: { l: 43.5, w: 43.5, h: 35.5 },
    materials: [
      { part: 'Ring gear', material: 'Hardened steel' },
      { part: 'Sun + planets', material: 'Brass' },
      { part: 'Carrier + stand', material: 'Steel + aluminium' },
    ],
    electrical: [],
    mechanical: [
      { label: 'Load path', value: 'Shared across 3 planet meshes' },
      { label: 'Backdrivable', value: 'Yes — easily' },
      { label: 'High single-stage ratio', value: 'Needs tiny teeth → not strong' },
    ],
    simNotes:
      'Exact 5:1 reduction with three load-sharing mesh points. Model backlash ~15 arc-min and stage-stacking: compound two stages for 25:1 rather than asking one stage for it — the classic high-ratio-weakness lesson.',
  },
  commerce: {
    manufacturer: 'generic (PG-5 class)',
    partNumber: 'PG-5',
    priceUsd: [12, 28],
    priceInr: [900, 2200],
    availability: 'Every robotics shop; also sold as NEMA add-ons',
    vendors: ['Amazon', 'Robu.in', 'AliExpress', 'Pololu'],
  },
  ai: {
    summary: 'Compact 5:1 torque-sharing reducer: coaxial, efficient, easily backdrivable.',
    capabilities: [
      'Exact 5:1 reduction with 97 % efficiency',
      'Three planets share the load — torque-dense',
      'Coaxial input/output stays compact',
      'Backdrivable — friendly to hand-moving',
    ],
    constraints: [
      'High ratio in one stage = tiny teeth = not strong',
      'Backlash makes it wrong for servo-grade positioning',
      'Stack stages rather than over-asking one',
    ],
    bestFor: ['Motor-to-wheel reduction', 'Stacking into multi-stage boxes', 'Any torque-dense rotary transmission'],
  },
  model: {
    kind: 'procedural',
    component: 'PlanetaryGear',
    dimensionAccurate: true,
    note: 'Exact procedural replica — steel ring with 48 internal teeth on an aluminium stand, brass sun (12 teeth) on the chrome input shaft, three brass planets (16 teeth) on carrier pins, steel carrier and output shaft. Sun spins at input, carrier crawls at ÷ 5, planets counter-rotate. See three/PlanetaryGear.tsx.',
  },
}

/**
 * The ball screw. A chrome shaft with helical grooves and a nut full of
 * recirculating BALL BEARINGS: rolling instead of sliding gives ~90 %
 * efficiency turning rotation into straight-line travel. The reason
 * CNC machines and printers use it instead of a lead screw.
 */
export const BALL_SCREW: RoboticsComponent = {
  id: 'ball-screw',
  name: 'Ball Screw',
  category: 'Mechanical',
  status: 'available',
  tagline: 'Balls roll where threads would slide — rotation to travel at ~90 % efficiency.',
  description:
    'A ball screw is a threaded shaft whose nut contains recirculating ball bearings that roll in the helical groove — so instead of the 30–50 % efficiency of a sliding lead screw, 90 % of the input rotation comes out as straight-line motion. Couple a motor onto the driven journal; each turn advances the nut by exactly the 4 mm lead. This is the linear transmission precision machines trust, and the mechanical partner of planetary gears in the notes’ transmission chain.',
  specs: [
    { label: 'Shaft / lead', value: 'Ø12 mm · 4 mm lead (SFU1204)' },
    { label: 'Travel', value: '58 mm between blocks' },
    { label: 'Efficiency', value: '≈ 90 % (balls roll, not slide)' },
    { label: 'Backlash', value: 'C7 rolled grade · < 50 µm' },
    { label: 'Dynamic load', value: '≈ 2.7 kN' },
    { label: 'Weight', value: '≈ 420 g with blocks' },
  ],
  physics: {
    mass: 420,
    dimensions: { l: 160, w: 28, h: 23 },
    materials: [
      { part: 'Shaft', material: 'Chrome-plated alloy steel' },
      { part: 'Nut + return tube', material: 'Hardened steel' },
      { part: 'Bearing blocks', material: 'Anodized aluminium' },
    ],
    electrical: [],
    mechanical: [
      { label: 'Linear speed', value: 'RPM × 4 mm per turn' },
      { label: 'Friction', value: 'Rolling — near-silent, minimal wear' },
      { label: 'Driving', value: 'Needs motor torque ≪ lead screw' },
    ],
    simNotes:
      'Convert arriving RPM into linear travel at lead × RPM ÷ 60, at 90 % efficiency, and hold position under load with negligible stiction. The honest coupling lesson: it must be DRIVEN (a motor on the journal) — pushing the nut alone just skews the balls.',
  },
  commerce: {
    manufacturer: 'TBI / Hiwin / generic',
    partNumber: 'SFU1204-160',
    priceUsd: [25, 60],
    priceInr: [1800, 4500],
    availability: 'Ubiquitous in CNC part stores',
    vendors: ['AliExpress', 'Amazon', 'Robu.in', 'OMC stepper online'],
  },
  ai: {
    summary: 'High-efficiency linear transmission: 4 mm of travel per input revolution.',
    capabilities: [
      'Turns rotation into exact linear travel (4 mm/rev)',
      '≈ 90 % efficient — motors run cool',
      'Holds position with negligible stiction',
      'Pairs with planetary gears for gantry drives',
    ],
    constraints: [
      'Needs a driven journal — never push the nut alone',
      'Rolling balls need clean lubrication',
      'Long shafts need support blocks at both ends',
    ],
    bestFor: ['Gantry / CNC X-Y axes', 'Printers and plotters', 'Precision lifts and focus stages'],
  },
  model: {
    kind: 'procedural',
    component: 'BallScrew',
    dimensionAccurate: true,
    note: 'Exact procedural replica — chrome shaft with bright helical ball grooves, two aluminium bearing blocks with bolt-on caps and screws, brass lock nut on the driven journal, steel ball nut with flanged bolt face and return tube. The shaft spins at input RPM while the nut glides at RPM × 4 mm. See three/BallScrew.tsx.',
  },
}

/**
 * The M3 socket head cap screw — DIN 912, A2 stainless, the fastener
 * that holds every robot together. An inclined plane wrapped around a
 * cylinder: small, precise, and fast to install with one hex key.
 */
export const SMALL_SCREW: RoboticsComponent = {
  id: 'm3-screw',
  name: 'M3 Socket Screw',
  category: 'Mechanical',
  status: 'available',
  tagline: 'The M3 × 10 DIN 912 fastener — easy, fast, and holding everything together.',
  description:
    'A small screw is an inclined plane wrapped around a cylinder: every turn advances it one 0.5 mm pitch and multiplies your wrist torque into clamping force. The M3 socket-head cap screw is the robotics standard — precise, strong for its size, and fast to drive with a single 2.5 mm hex key. On the playground it is the component that FASTENS: thread it into any M3 hole — a board’s mounting holes, a servo’s tabs, an actuator’s flange — and that part is bolted down.',
  specs: [
    { label: 'Thread', value: 'M3 × 0.5 (coarse)' },
    { label: 'Length', value: '10 mm under head' },
    { label: 'Standard', value: 'DIN 912 · ISO 4762' },
    { label: 'Material', value: 'A2 stainless steel' },
    { label: 'Head / key', value: 'Ø5.5 × 3 mm · hex 2.5 mm' },
    { label: 'Weight', value: '0.68 g' },
  ],
  physics: {
    mass: 0.68,
    dimensions: { l: 13, w: 5.5, h: 5.5 },
    materials: [{ part: 'Shank + head', material: 'A2 stainless steel, passivated' }],
    electrical: [],
    mechanical: [
      { label: 'Pitch', value: '0.5 mm per revolution' },
      { label: 'Proof load', value: '≈ 2.1 kN (M3 A2)' },
      { label: 'Install', value: 'Easy & fast — one hex key' },
    ],
    simNotes:
      'A pure fastener: carries no power, no rotation — only clamping. Treat a screwed joint as rigid; a missing screw as a loose DOF. Cheap enough that the right answer is usually more screws.',
  },
  commerce: {
    manufacturer: 'generic DIN 912',
    partNumber: 'M3×10 A2',
    priceUsd: [0.05, 0.12],
    priceInr: [4, 10],
    availability: 'Sold by the hundred — every hardware store on earth',
    vendors: ['Amazon', 'Robu.in', 'Hardware stores', 'AliExpress'],
  },
  ai: {
    summary: 'The universal fastener: threads into any M3 hole to clamp parts together.',
    capabilities: [
      'Converts rotation into 0.5 mm-per-turn clamping travel',
      'High force from a tiny, cheap part',
      'Fast to install and remove with one hex key',
    ],
    constraints: [
      'Only works where there is a threaded or nut-backed hole',
      'Over-torque strips both screw and hole',
      'Carries no power or motion of its own',
    ],
    bestFor: ['Mounting boards and actuators', 'Grippers and brackets', 'Every joint a robot is built from'],
  },
  model: {
    kind: 'procedural',
    component: 'SmallScrew',
    dimensionAccurate: true,
    note: 'Exact procedural replica — Ø5.5 head with chamfer and dark 6-flute hex socket, Ø3 shank with a true helical 0.5 mm-class thread modeled as a spiral tube, pointed roll-pressed tip. Lying on the bench at true M3 scale. See three/SmallScrew.tsx.',
  },
}

/* ------------------------------------------------------------------ */
/* Pneumatics — muscle, vane motor, air pump                           */
/* ------------------------------------------------------------------ */

/**
 * The pneumatic artificial muscle (McKibben). A rubber tube inside a
 * braided mesh: inflate it and the braid angle forces the muscle to
 * balloon radially and CONTRACT axially — it shortens and PULLS, like
 * biology does it. Lightweight, compliant, and honest about needing a
 * supply of clean compressed air.
 */
export const PNEUMATIC_MUSCLE: RoboticsComponent = {
  id: 'pneumatic-muscle',
  name: 'Pneumatic Muscle',
  category: 'Pneumatics',
  status: 'available',
  tagline: 'McKibben muscle — inflate the braid and it contracts like biology.',
  description:
    'A McKibben pneumatic artificial muscle is a rubber tube inside a braided mesh sleeve, crimped at both ends. Feed it air and the internal pressure forces the braid’s helical strands apart: the muscle expands radially and contracts axially — it gets shorter and pulls on whatever is at its ends, exactly how biological muscle works. It is extraordinarily light and compliant for the force it makes, and in this playground it visibly contracts ~15 % when the mini pump pressurizes it (real muscles run 2–6 bar for their full 20 % stroke and hundreds of newtons).',
  specs: [
    { label: 'Size', value: 'Ø20 × 90 mm between collars' },
    { label: 'Contraction', value: 'up to 20 % of length at rated pressure' },
    { label: 'Force', value: '≈ 400 N at 6 bar (scales with pressure)' },
    { label: 'Air port', value: 'M5 push-in fitting' },
    { label: 'Working pressure', value: '0–6 bar (demo runs 0.4 bar)' },
    { label: 'Weight', value: '≈ 40 g' },
  ],
  physics: {
    mass: 40,
    dimensions: { l: 90, w: 20, h: 20 },
    materials: [
      { part: 'Inner tube', material: 'Butyl rubber' },
      { part: 'Braid sleeve', material: 'Polyester / steel braid' },
      { part: 'End collars', material: 'Crimped aluminium' },
    ],
    electrical: [],
    mechanical: [
      { label: 'Actuation', value: 'Radial expansion → axial contraction' },
      { label: 'Compliance', value: 'Inherently springy — safe around humans' },
      { label: 'Bandwidth', value: 'Fast (5–10 Hz) with a good valve' },
    ],
    simNotes:
      'Model contraction as pressure-driven: length × (1 − k·P), force rising with pressure and falling with contraction. It can only PULL, never push — pairs of muscles antagonize like real limbs. Needs a pump and tubing; electricity alone does nothing here.',
  },
  commerce: {
    manufacturer: 'Festo DMSP / Shadow / generic',
    partNumber: 'DMSP-20-90N',
    priceUsd: [25, 400],
    priceInr: [2000, 30000],
    availability: 'Festo for industry; braided sleeves for DIY from any robotics store',
    vendors: ['Festo', 'Shadow Robot', 'AliExpress', 'Robu.in'],
  },
  ai: {
    summary: 'Air-powered pull-only actuator: contracts like muscle when inflated.',
    capabilities: [
      'Contracts up to 20 % and pulls with hundreds of newtons',
      'Featherweight for its force',
      'Compliant and safe around people',
      'Silent next to any motor',
    ],
    constraints: [
      'Pulls only — never pushes (pair them antagonistically)',
      'Needs a pump, tubing and a valve — no electricity does this',
      'Full force needs real pressure (2–6 bar)',
    ],
    bestFor: ['Bio-inspired walkers and grippers', 'Wearable / soft robotics', 'Anywhere compliance beats precision'],
  },
  model: {
    kind: 'procedural',
    component: 'PneumaticMuscle',
    dimensionAccurate: true,
    note: 'Exact procedural replica — braided sleeve drawn as a diamond weave (canvas texture + bump for thread relief), crimped aluminium collars with ridge rings, blind-end rubber cap with steel pull lug, brass push-in air fitting with its blue collar. Pressurize it and it visibly contracts and thickens. See three/PneumaticMuscle.tsx.',
  },
}

/**
 * The vane rotary actuator. A rotor with sliding vanes inside a sealed
 * cylinder: air pressure enters, pushes the vane, and the shaft swings
 * a LIMITED arc — 270° here — and holds hard against the stop. The
 * notes’ “vane rotary”: rotation from compressed air, no electricity
 * anywhere inside.
 */
export const VANE_ACTUATOR: RoboticsComponent = {
  id: 'vane-actuator',
  name: 'Vane Rotary Actuator',
  category: 'Pneumatics',
  status: 'available',
  tagline: 'Air pressure on a vane — a hard-hitting 270° swing, no electricity.',
  description:
    'A pneumatic vane rotary actuator has a shaft-mounted vane dividing a sealed cylindrical chamber into two pressure zones. Feed the drive port and the pressure differential pushes the vane around — the shaft sweeps its working arc (270° on this size) and slams home against an adjustable stop with force proportional to pressure. Two ports give clockwise and counter-clockwise motion. It is the classic pick-and-place and indexing motion: fast, simple, and powered entirely by air.',
  specs: [
    { label: 'Working rotation', value: '270° (adjustable stops)' },
    { label: 'Torque', value: '3.4 N·m at 6 bar — scales with pressure' },
    { label: 'Ports', value: '2 × M5 (CW / CCW)' },
    { label: 'Body', value: 'Ø42 mm clear-anodized barrel' },
    { label: 'Cushioning', value: 'Adjustable end cushions' },
    { label: 'Weight', value: '≈ 310 g' },
  ],
  physics: {
    mass: 310,
    dimensions: { l: 44, w: 44, h: 39 },
    materials: [
      { part: 'Body + caps', material: 'Anodized aluminium' },
      { part: 'Shaft + vane', material: 'Hardened steel, keyed' },
      { part: 'Fittings', material: 'Brass, M5' },
    ],
    electrical: [],
    mechanical: [
      { label: 'Motion', value: 'Limited arc — 270°, then a hard stop' },
      { label: 'Torque', value: '∝ pressure × vane area × radius' },
      { label: 'Speed', value: 'Fast — cushion at the ends matters' },
    ],
    simNotes:
      'A bounded rotational joint, not continuous rotation: command an angle inside 0–270°, torque = k × pressure, and model the end cushions so real robots do not hammer their stops. Drives from the air pump — never wires to a battery.',
  },
  commerce: {
    manufacturer: 'SMC / Festo / generic',
    partNumber: 'CRB2BW30-270 (class)',
    priceUsd: [40, 120],
    priceInr: [3000, 9000],
    availability: 'Standard pneumatic catalog part; clones everywhere',
    vendors: ['SMC', 'Festo', 'AliExpress', 'Pneumatic suppliers'],
  },
  ai: {
    summary: 'Air-driven limited-rotation actuator: a powerful 270° swing from two air ports.',
    capabilities: [
      'Swings 270° and holds against the stop with real force',
      'Torque scales linearly with air pressure',
      'Simple two-port control (CW / CCW)',
      'No electronics inside — pure pneumatics',
    ],
    constraints: [
      'Limited arc — never continuous rotation',
      'Needs an air supply and valve',
      'Position control requires external feedback',
    ],
    bestFor: ['Pick-and-place arms', 'Indexing and flipping motions', 'Air-powered automation cells'],
  },
  model: {
    kind: 'procedural',
    component: 'VaneActuator',
    dimensionAccurate: true,
    note: 'Exact procedural replica — clear-anodized barrel between screwed end caps, keyed chrome shaft with a red position indicator, two brass M5 fittings with blue collars, external stop screws. Pressurize it and the shaft sweeps its 270° arc smoothly to the stop. See three/VaneActuator.tsx.',
  },
}

/**
 * The mini air pump — the pneumatic power source. A 9 V diaphragm
 * pump: a small motor rocks a rubber diaphragm and pushes air out of
 * the brass nozzle at up to 0.4 bar. Wire it to the battery and the
 * pneumatic side of the playground comes alive.
 */
export const AIR_PUMP: RoboticsComponent = {
  id: 'mini-air-pump',
  name: 'Mini Air Pump',
  category: 'Pneumatics',
  status: 'available',
  tagline: 'The 9 V pneumatic source — diaphragm pump feeding 0.4 bar to the air side.',
  description:
    'A mini diaphragm air pump is the smallest honest air supply a robot can carry: a 9 V DC motor rocks a rubber diaphragm, and one-way valves turn that wobble into a steady flow of compressed air out of the brass nozzle — up to about 0.4 bar and 150 litres/hour on this class. It is the bridge between the electrical playground and the pneumatic one: wire it to the battery, tube it to a muscle or vane motor, and air — not electricity — does the work.',
  specs: [
    { label: 'Supply', value: '6–9 V DC (9 V battery-friendly)' },
    { label: 'Pressure', value: '0.04 MPa (≈ 0.4 bar) max' },
    { label: 'Flow', value: '≈ 150 L/h free-flow' },
    { label: 'Current', value: '≈ 350 mA running' },
    { label: 'Outlet', value: 'Brass Ø6 mm push-on nozzle' },
    { label: 'Weight', value: '≈ 130 g' },
  ],
  physics: {
    mass: 130,
    dimensions: { l: 76, w: 42, h: 36 },
    materials: [
      { part: 'Case', material: 'ABS on rubber feet' },
      { part: 'Motor', material: 'Brushed DC, nickel can' },
      { part: 'Diaphragm + valves', material: 'NBR rubber' },
    ],
    electrical: [
      { label: 'Running current', value: '≈ 350 mA at 9 V' },
      { label: 'Stall-prone start', value: 'Benefits from a smoothed supply' },
    ],
    mechanical: [
      { label: 'Noise', value: 'A 30 Hz tremble — the diaphragm’s beat' },
      { label: 'Duty cycle', value: 'Intermittent — it runs warm' },
    ],
    simNotes:
      'The pneumatic origin node: while powered it provides 0.4 bar at its nozzle; anything tubed to it is pressurized. Model flow as finite — one pump happily feeds one muscle, not a chorus of them.',
  },
  commerce: {
    manufacturer: 'generic (diaphragm class)',
    partNumber: 'JQB-0617 (class)',
    priceUsd: [8, 16],
    priceInr: [600, 1200],
    availability: 'Aquarium and lab-supply stores everywhere',
    vendors: ['Amazon', 'AliExpress', 'Robu.in', 'Lab supply stores'],
  },
  ai: {
    summary: 'Battery-powered air source: 0.4 bar at the nozzle for muscles and vane motors.',
    capabilities: [
      'Turns a 9 V supply into a steady 0.4 bar air feed',
      'Feeds pneumatic muscles and vane actuators',
      'Light and small enough for onboard robots',
    ],
    constraints: [
      '0.4 bar ceiling — real muscles want 2–6 bar for full force',
      '≈ 350 mA: a shared drain on small batteries',
      'One pump, one meaningful load',
    ],
    bestFor: ['Powering demo muscles and vane motors', 'Pneumatic grippers on small robots', 'Teaching the electrical→pneumatic bridge'],
  },
  model: {
    kind: 'procedural',
    component: 'AirPump',
    dimensionAccurate: true,
    note: 'Exact procedural replica — black ABS case with parting seam, vent slots and printed rating label on four rubber feet, brass outlet nozzle and capped inlet on top, nickel motor can out the back with red/black leads, and the diaphragm’s faint 30 Hz tremble while running. See three/AirPump.tsx.',
  },
}

/* ------------------------------------------------------------------ */
/* Electrical — capacitor filter, rotary + linear actuators           */
/* ------------------------------------------------------------------ */

/**
 * The electrolytic capacitor — the power rail’s shock absorber. Two
 * plates, an oxide dielectric, an electrolyte: it charges on voltage
 * spikes and dumps charge into sags, smoothing what the load sees. Clip
 * it across a battery and everything downstream rides a steadier rail.
 */
export const CAPACITOR: RoboticsComponent = {
  id: 'electrolytic-capacitor',
  name: 'Capacitor',
  category: 'Power',
  status: 'available',
  tagline: '470 µF of rail smoothing — charges on spikes, fills the sags.',
  description:
    'An aluminum electrolytic capacitor stores charge in an electrochemical sandwich: an etched foil anode, an oxide dielectric a few molecules thick, and an electrolyte-soaked cathode. In a power circuit it is the buffer — it charges when voltage rises and discharges into dips — so the rail a motor or logic chip sees stays smooth instead of sawtoothed. Wire it across the battery’s terminals here (mind the minus stripe: reversed electrolytics vent through the scored top, loudly). It passes no power of its own; it conditions everyone else’s.',
  specs: [
    { label: 'Capacitance', value: '470 µF ± 20 %' },
    { label: 'Rated voltage', value: '25 V DC' },
    { label: 'ESR', value: '≈ 0.6 Ω at 100 kHz' },
    { label: 'Size', value: 'Ø16 × 25 mm, 7.5 mm pitch' },
    { label: 'Lifetime', value: '2000 h at 105 °C' },
    { label: 'Weight', value: '≈ 2.6 g' },
  ],
  physics: {
    mass: 2.6,
    dimensions: { l: 16, w: 16, h: 31 },
    materials: [
      { part: 'Can', material: 'Aluminium, blue insulating sleeve' },
      { part: 'Winding', material: 'Etched foil + electrolyte' },
      { part: 'Leads', material: 'Tinned steel' },
    ],
    electrical: [
      { label: 'Ripple current', value: '≈ 660 mA at 100 kHz' },
      { label: 'Leakage', value: '< 6 µA after 2 min' },
      { label: 'Polarity', value: 'MUST be respected — reversed units vent' },
    ],
    mechanical: [{ label: 'Mounting', value: 'Through-hole, 6 mm stand-off' }],
    simNotes:
      'A parallel reservoir, not a series element: model dV = I·dt/C at each rail node so brown-out dips shrink by the capacitance. Wire it across a source and everything that source feeds gets the smoothed rail. Reverse polarity should vent it — an honest failure students should meet in simulation first.',
  },
  commerce: {
    manufacturer: 'Rubycon / Nichicon / generic',
    partNumber: '470µF 25V 16×25',
    priceUsd: [0.1, 0.5],
    priceInr: [8, 40],
    availability: 'Every electronics counter on earth, by the handful',
    vendors: ['Amazon', 'Robu.in', 'Electronics bazaars', 'Mouser'],
  },
  ai: {
    summary: 'Passive reservoir: smooths a power rail by absorbing spikes and filling sags.',
    capabilities: [
      'Smooths the supply rail for every consumer on it',
      'Handles brief current surges a battery cannot',
      'Penny-cheap and ubiquitous',
    ],
    constraints: [
      'Polarized — reversed units vent through the top',
      'Passes no power; only conditions rails',
      'Electrolytes dry out — they age',
    ],
    bestFor: ['Across motor-supply rails', 'Decoupling logic supplies', 'The brown-out lesson, solved for ₹10'],
  },
  model: {
    kind: 'procedural',
    component: 'Capacitor',
    dimensionAccurate: true,
    note: 'Exact procedural replica — Ø16 × 25 can in a navy sleeve with vertical rating print and the minus stripe on the negative lead, aluminum top with the K-vent score, crimp ring, and two tinned legs. See three/Capacitor.tsx.',
  },
}

/**
 * The rotary actuator — the general class from the notes: a device
 * that turns energy into REVOLVING motion, not a straight line. This
 * one is an electric industrial style: a keyed output shaft that turns
 * continuously at 30 RPM with 1.5 N·m behind it, ready to carry gears,
 * couplers or a strain wave input.
 */
export const ROTARY_ACTUATOR: RoboticsComponent = {
  id: 'rotary-actuator',
  name: 'Rotary Actuator',
  category: 'Actuators',
  status: 'available',
  tagline: 'Energy in, keyed shaft turning — 30 RPM and 1.5 N·m of continuous rotation.',
  description:
    'A rotary actuator is the umbrella class the notes draw: electric, pneumatic or hydraulic energy converted into revolving motion rather than a straight line. This replica is the electric kind students actually buy — a compact anodized barrel with a flange and a Ø8 mm shaft carrying a machine key. Wire it to 6–12 V and it turns continuously at 30 RPM with 1.5 N·m behind the key: bolt a gear, a crank, or a strain wave gear’s input straight onto it.',
  specs: [
    { label: 'Supply', value: '6–12 V DC (9 V battery-friendly)' },
    { label: 'Output', value: '30 RPM continuous · keyed Ø8 mm shaft' },
    { label: 'Torque', value: '1.5 N·m rated' },
    { label: 'Mounting', value: 'Face flange, 4 × M3' },
    { label: 'Dimensions', value: 'Ø30 × 66 mm with flange' },
    { label: 'Weight', value: '≈ 220 g' },
  ],
  physics: {
    mass: 220,
    dimensions: { l: 66, w: 37, h: 37 },
    materials: [
      { part: 'Body', material: 'Anodized aluminium with fins' },
      { part: 'Shaft + key', material: 'Chrome steel' },
      { part: 'Cap + gland', material: 'PBT, brass gland' },
    ],
    electrical: [
      { label: 'Running current', value: '≈ 0.6 A at 12 V' },
      { label: 'Wiring', value: 'Red + black, no controller needed' },
    ],
    mechanical: [
      { label: 'Motion', value: 'Continuous rotation — energy to revolving motion' },
      { label: 'Overhung load', value: '≤ 80 N on the shaft nose' },
    ],
    simNotes:
      'A slow, torque-rich continuous rotor: 30 RPM at the key, 1.5 N·m ceiling, current draw that sags small batteries. The class definition from the notes: rotational output, never a straight line.',
  },
  commerce: {
    manufacturer: 'generic (RA-30 class)',
    partNumber: 'RA-30',
    priceUsd: [35, 80],
    priceInr: [2600, 6000],
    availability: 'Automation suppliers; gearmotor equivalents everywhere',
    vendors: ['AliExpress', 'Amazon', 'Automation parts stores'],
  },
  ai: {
    summary: 'Continuous rotary power unit: a keyed 30 RPM shaft that bolts to anything.',
    capabilities: [
      'Turns supply energy into continuous rotation',
      '1.5 N·m behind a keyed Ø8 shaft',
      'Flange-mounts with four M3 screws',
      'Drives gear trains, cranks and conveyors directly',
    ],
    constraints: [
      'No position feedback — it turns, it doesn’t aim',
      '0.6 A class draw — budget the battery',
      'Single speed per supply voltage',
    ],
    bestFor: ['Driving gear trains and harmonic inputs', 'Crank and conveyor motions', 'The “rotary not linear” lesson itself'],
  },
  model: {
    kind: 'procedural',
    component: 'RotaryActuator',
    dimensionAccurate: true,
    note: 'Exact procedural replica — finned anodized barrel with printed nameplate, aluminium flange plate with four M3 phillips bolts and pilot boss, keyed chrome output shaft (the key visibly turning), rear cap with brass cable gland and tinned red/black leads. See three/RotaryActuator.tsx.',
  },
}

/**
 * The linear actuator — the notes’ counterpart to rotary: the same
 * energy, turned into straight-line push and pull. A motor inside the
 * profile drives a lead screw that pushes the chrome rod out and pulls
 * it back at 12 mm/s with 30 N of thrust.
 */
export const LINEAR_ACTUATOR: RoboticsComponent = {
  id: 'linear-actuator',
  name: 'Linear Actuator',
  category: 'Actuators',
  status: 'available',
  tagline: 'Rotation turned into straight-line push/pull — 40 mm at 12 mm/s, 30 N.',
  description:
    'A linear actuator takes a motor’s rotation and converts it into straight-line motion: inside the extruded profile a screw and nut push the chrome rod out through the front bearing block and pull it back, with limit switches quietly handling the ends. This 9–12 V class travels 40 mm at 12 mm/s and pushes 30 N — the transmission the notes describe as “forward”: energy in, something moves in a line. Bolt things to its clevis; it does the rest.',
  specs: [
    { label: 'Supply', value: '6–12 V DC (9 V battery-friendly)' },
    { label: 'Stroke', value: '40 mm' },
    { label: 'Speed', value: '12 mm/s under load' },
    { label: 'Force', value: '30 N push / pull' },
    { label: 'Mounting', value: 'Clevis ends + T-slot body' },
    { label: 'Dimensions', value: '150 mm body × 16 mm profile' },
  ],
  physics: {
    mass: 160,
    dimensions: { l: 190, w: 20, h: 20 },
    materials: [
      { part: 'Body', material: 'Anodized extruded aluminium' },
      { part: 'Rod + clevis', material: 'Chrome-plated steel' },
      { part: 'Motor can', material: 'Blackened steel' },
    ],
    electrical: [
      { label: 'Running current', value: '≈ 0.5 A at 12 V' },
      { label: 'Stall at ends', value: 'Current-limited by internal clutch' },
    ],
    mechanical: [
      { label: 'Motion', value: 'Straight line — push and pull' },
      { label: 'Self-locking', value: 'Holds load unpowered (screw ratio)' },
    ],
    simNotes:
      'A prismatic joint with a stroke limit: extend/retract at 12 mm/s, 30 N ceiling, self-locking when unpowered. Reverse polarity to reverse — the H-bridge lesson again.',
  },
  commerce: {
    manufacturer: 'generic (LA-40 class)',
    partNumber: 'LA-40-12-30',
    priceUsd: [18, 45],
    priceInr: [1400, 3500],
    availability: 'Widely stocked for automation and access projects',
    vendors: ['Amazon', 'AliExpress', 'Robu.in'],
  },
  ai: {
    summary: 'Straight-line muscle: 40 mm stroke at 12 mm/s and 30 N of push-pull.',
    capabilities: [
      'Converts rotation into linear push/pull — moves things forward',
      'Holds its position unpowered (self-locking)',
      'Clevis ends make mounting trivial',
    ],
    constraints: [
      '12 mm/s is not fast — design around it',
      '30 N ceiling; strokes cost current',
      'No feedback — limit switches only',
    ],
    bestFor: ['Lifts, latches and grippers', 'Panels and hatches', 'The linear-vs-rotary lesson itself'],
  },
  model: {
    kind: 'procedural',
    component: 'LinearActuator',
    dimensionAccurate: true,
    note: 'Exact procedural replica — black extruded profile with true T-slot grooves and printed label, front bearing block with wiper seal and four bolts, chrome rod sliding to a steel clevis with cross-hole, rear motor can with leads. Powered, the rod extends and retracts at honest speed. See three/LinearActuator.tsx.',
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
  ROTARY_ACTUATOR,
  LINEAR_ACTUATOR,
  STRAIN_WAVE_GEAR,
  PLANETARY_GEAR,
  BALL_SCREW,
  SMALL_SCREW,
  PNEUMATIC_MUSCLE,
  VANE_ACTUATOR,
  AIR_PUMP,
  CAPACITOR,
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
