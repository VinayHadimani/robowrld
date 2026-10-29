'use client'

/**
 * PartStage — the presentation studio for the exact-replica component
 * models. Same studio treatment as the other stages: key + fill lights,
 * a procedural environment map, a pedestal, contact shadows and a slow
 * turntable — with camera framing tuned per part. Transmission and
 * pneumatic parts run honest DEMO motion on the pedestal so their
 * physics is visible before the playground.
 */

import * as React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Environment, Lightformer, Grid } from '@react-three/drei'
import { DcGearMotor } from './DcGearMotor'
import { Nema17Stepper } from './Nema17Stepper'
import { HcSr04 } from './HcSr04'
import { IrSensor } from './IrSensor'
import { EscBoard } from './EscBoard'
import { LipoPack } from './LipoPack'
import { StrainWaveGear } from './StrainWaveGear'
import { PlanetaryGear } from './PlanetaryGear'
import { PneumaticMuscle } from './PneumaticMuscle'
import { Capacitor } from './Capacitor'
import { SmallScrew } from './SmallScrew'
import { RotaryActuator } from './RotaryActuator'
import { LinearActuator } from './LinearActuator'
import { BallScrew } from './BallScrew'
import { VaneActuator } from './VaneActuator'
import { AirPump } from './AirPump'
import type { PlayKind } from '@/lib/playground'

export interface PartStageProps {
  kind: PlayKind
  /** Demo animation while on the pedestal (motor spins, stepper steps). */
  running?: boolean
  autoRotate?: boolean
}

/** Camera framing per part: [position, target]. */
const FRAMING: Partial<Record<PlayKind, { camera: [number, number, number]; target: [number, number, number] }>> = {
  dcmotor: { camera: [4.4, 3.0, 5.4], target: [0, 1.8, 0] },
  stepper: { camera: [4.2, 3.6, 5.6], target: [0, 2.3, 0] },
  ultrasonic: { camera: [3.0, 2.9, 3.8], target: [0, 0.7, 0] },
  irsensor: { camera: [2.4, 2.1, 3.0], target: [0, 0.4, 0] },
  esc: { camera: [4.0, 3.2, 5.0], target: [0, 0.7, 0] },
  lipo: { camera: [12.5, 5.5, 14.0], target: [0.5, 1.0, 0] },
  strainwave: { camera: [3.4, 3.0, 4.4], target: [0, 1.6, 0] },
  planetary: { camera: [3.8, 3.4, 4.8], target: [0, 1.9, 0] },
  muscle: { camera: [7.5, 3.2, 9.0], target: [0, 1.0, 0] },
  capacitor: { camera: [1.9, 1.65, 2.35], target: [0, 1.45, 0] },
  screw: { camera: [1.35, 1.05, 1.7], target: [0, 0.28, 0] },
  rotaryact: { camera: [3.6, 2.8, 4.6], target: [0, 1.5, 0] },
  linact: { camera: [10.0, 4.2, 12.5], target: [0, 1.2, 0] },
  ballscrew: { camera: [10.5, 4.0, 13.0], target: [0, 1.4, 0] },
  vaneact: { camera: [3.8, 3.2, 4.8], target: [0, 1.7, 0] },
  airpump: { camera: [3.4, 2.8, 4.4], target: [0, 1.4, 0] },
}

/** Parts whose function demos by default on the pedestal. */
const DEMO_KINDS = new Set<PlayKind>([
  'strainwave',
  'planetary',
  'muscle',
  'rotaryact',
  'linact',
  'ballscrew',
  'vaneact',
  'airpump',
])

/** Cycles a boolean on a timer — the muscle/vent demo beat. */
function Cycler({ period = 3600, children }: { period?: number; children: (on: boolean) => React.ReactNode }) {
  const [on, setOn] = React.useState(true)
  React.useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), period)
    return () => clearInterval(id)
  }, [period])
  return <>{children(on)}</>
}

export default function PartStage({ kind, running = false, autoRotate = true }: PartStageProps) {
  const frame = FRAMING[kind] ?? { camera: [5.5, 4.5, 7], target: [0, 1.5, 0] }
  const pedestalR =
    kind === 'lipo' || kind === 'linact' || kind === 'ballscrew' ? 5.4 : kind === 'muscle' ? 4.6 : 3.1
  const shadowScale = kind === 'linact' || kind === 'ballscrew' ? 26 : 14
  const demo = running || DEMO_KINDS.has(kind)

  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: frame.camera, fov: 34 }}
    >
      {/* Lights */}
      <ambientLight intensity={0.42} />
      <directionalLight
        position={[5, 9, 6]}
        intensity={2.3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-7, 4, -6]} intensity={0.55} />

      {/* Procedural studio environment (rendered locally, no external HDRI) */}
      <Environment resolution={256} frames={1} environmentIntensity={0.62}>
        <Lightformer form="rect" intensity={3} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[9, 9, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.8} position={[6, 3, 4]} rotation-y={-Math.PI / 3} scale={[6, 3, 1]} color="#fff2df" />
        <Lightformer form="rect" intensity={1.8} position={[-6, 2, -3]} rotation-y={Math.PI / 2.5} scale={[5, 3, 1]} color="#eef2f8" />
      </Environment>

      {/* Display pedestal + ground grid */}
      <group>
        <mesh position={[0, -0.26, 0]} receiveShadow>
          <cylinderGeometry args={[pedestalR, pedestalR, 0.5, 72]} />
          <meshStandardMaterial color="#e7e5df" roughness={0.65} metalness={0.04} />
        </mesh>
        <mesh position={[0, -0.43, 0]}>
          <cylinderGeometry args={[pedestalR + 0.2, pedestalR + 0.2, 0.16, 72]} />
          <meshStandardMaterial color="#26272c" roughness={0.5} metalness={0.2} />
        </mesh>
        <Grid
          position={[0, -0.51, 0]}
          args={[60, 60]}
          cellSize={0.55}
          cellThickness={0.6}
          cellColor="#d3d6dd"
          sectionSize={2.75}
          sectionThickness={1}
          sectionColor="#b9bfc9"
          fadeDistance={26}
          fadeStrength={1.4}
          infiniteGrid
          followCamera={false}
        />
      </group>

      {/* The star of the show */}
      {kind === 'dcmotor' && <DcGearMotor position={[0, 0.03, 0]} running={running} />}
      {kind === 'stepper' && <Nema17Stepper position={[0, 0.03, 0]} running={running} />}
      {kind === 'ultrasonic' && <HcSr04 position={[0, 0.03, 0]} />}
      {kind === 'irsensor' && <IrSensor position={[0, 0.03, 0]} powered={running} />}
      {kind === 'esc' && <EscBoard position={[0, 0.03, 0]} powered={running} />}
      {kind === 'lipo' && <LipoPack position={[0, 0.03, 0]} />}
      {kind === 'strainwave' && <StrainWaveGear position={[0, 0.03, 0]} driven={demo} inputRpm={120} />}
      {kind === 'planetary' && <PlanetaryGear position={[0, 0.03, 0]} driven={demo} inputRpm={120} />}
      {kind === 'ballscrew' && <BallScrew position={[0, 0.03, 0]} driven={demo} inputRpm={90} />}
      {kind === 'screw' && <SmallScrew position={[0, 0.03, 0]} />}
      {kind === 'capacitor' && <Capacitor position={[0, 0.03, 0]} charged={demo} />}
      {kind === 'rotaryact' && <RotaryActuator position={[0, 0.03, 0]} running={demo} />}
      {kind === 'linact' && <LinearActuator position={[0, 0.03, 0]} running={demo} />}
      {kind === 'airpump' && <AirPump position={[0, 0.03, 0]} running={demo} />}
      {kind === 'muscle' && (
        <Cycler>
          {(on) => <PneumaticMuscle position={[0, 0.03, 0]} pressurized={on} />}
        </Cycler>
      )}
      {kind === 'vaneact' && (
        <Cycler period={5200}>
          {(on) => <VaneActuator position={[0, 0.03, 0]} pressurized={on} />}
        </Cycler>
      )}

      {/* Soft contact shadow */}
      <ContactShadows
        position={[0, -0.5, 0]}
        opacity={0.55}
        scale={shadowScale}
        blur={2.4}
        far={4}
        resolution={512}
        color="#18181b"
      />

      <OrbitControls
        makeDefault
        target={frame.target}
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableZoom
        autoRotate={autoRotate}
        autoRotateSpeed={2.4}
        minDistance={1.2}
        maxDistance={26}
        maxPolarAngle={(Math.PI / 2) * 0.985}
      />
    </Canvas>
  )
}
