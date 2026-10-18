'use client'

/**
 * AssemblyStage — the "Assembly Lab" scene.
 *
 * Composes the REUSABLE ServoMotor component with the MechanismRig through
 * the connection contract:
 *
 *   - The servo drops through the deck pocket; its mount ports (mount-r1/l1)
 *     land exactly on the deck's bolt holes.
 *   - `liveAngleRef` streams the servo's true shaft angle into the rig's
 *     four-bar solver every frame — no React re-renders, no duplicated
 *     motion code.
 *   - The enlarged grab volume (grabRadius) makes the whole crank draggable.
 */

import { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Environment, Lightformer, Grid } from '@react-three/drei'
import { ServoMotor } from './ServoMotor'
import { MechanismRig, type RigTelemetry } from './MechanismRig'

export interface AssemblyStageProps {
  angle: number
  speed?: number
  showLabels?: boolean
  showPorts?: boolean
  autoRotate?: boolean
  onAngleChange?: (angle: number) => void
  onDragStateChange?: (dragging: boolean) => void
  /** Ref the stage wires up: servo → rig telemetry sink. */
  telemetryRef?: { current: RigTelemetry }
}

const EMPTY_TELEMETRY: RigTelemetry = { crank: 90, rocker: 0, rod: 0, effX: 0, effZ: 0 }

export default function AssemblyStage({
  angle,
  speed = 320,
  showLabels = false,
  showPorts = false,
  autoRotate = false,
  onAngleChange,
  onDragStateChange,
  telemetryRef,
}: AssemblyStageProps) {
  // The servo publishes its true angle here; the rig consumes it.
  const liveAngle = useRef(90)
  // Fallback telemetry sink when the caller doesn't provide one.
  const internalTelemetry = useRef<RigTelemetry>(EMPTY_TELEMETRY)
  const telemetry = telemetryRef ?? internalTelemetry

  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [11.5, 8.5, 14.5], fov: 30 }}
    >
      <Suspense fallback={null}>
        {/* Lights */}
        <ambientLight intensity={0.42} />
        <directionalLight
          position={[8, 14, 7]}
          intensity={2.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
          shadow-camera-near={1}
          shadow-camera-far={45}
          shadow-bias={-0.0003}
          shadow-normalBias={0.02}
        />
        <directionalLight position={[-9, 6, -7]} intensity={0.6} />

        {/* Procedural studio environment */}
        <Environment resolution={256} frames={1} environmentIntensity={0.6}>
          <Lightformer form="rect" intensity={3} position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} color="#ffffff" />
          <Lightformer form="rect" intensity={1.8} position={[8, 4, 5]} rotation-y={-Math.PI / 3} scale={[7, 4, 1]} color="#fff2df" />
          <Lightformer form="rect" intensity={1.8} position={[-8, 3, -4]} rotation-y={Math.PI / 2.5} scale={[6, 4, 1]} color="#eef2f8" />
        </Environment>

        {/* Ground grid */}
        <Grid
          position={[0, -0.02, 0]}
          args={[80, 80]}
          cellSize={0.55}
          cellThickness={0.6}
          cellColor="#d3d6dd"
          sectionSize={2.75}
          sectionThickness={1}
          sectionColor="#b9bfc9"
          fadeDistance={34}
          fadeStrength={1.4}
          infiniteGrid
          followCamera={false}
        />

        {/* The reusable servo component — same component as the detail page */}
        <ServoMotor
          angle={angle}
          speed={speed}
          position={[0, 0, 0]}
          showHorn={false}
          showCable={false}
          showPorts={showPorts}
          interactive
          grabRadius={3.8}
          grabY={5.5}
          liveAngleRef={liveAngle}
          onAngleChange={onAngleChange}
          onDragStateChange={onDragStateChange}
        />

        {/* The mechanism, driven by the servo's live angle */}
        <MechanismRig liveAngleRef={liveAngle} telemetryRef={telemetry} showLabels={showLabels} />

        {/* Soft contact shadow under the whole rig */}
        <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={26} blur={2.6} far={5} resolution={512} color="#18181b" />

        <OrbitControls
          makeDefault
          target={[0.8, 4.2, 3.0]}
          enableDamping
          dampingFactor={0.08}
          autoRotate={autoRotate}
          autoRotateSpeed={1.8}
          minDistance={7}
          maxDistance={32}
          maxPolarAngle={(Math.PI / 2) * 0.985}
        />
      </Suspense>
    </Canvas>
  )
}
