'use client'

/**
 * ServoStage — presentation wrapper for the reusable ServoMotor.
 *
 * Provides a small "studio": key + fill lights, a procedural environment map
 * (no network HDRIs), a display pedestal, a fading ground grid, contact
 * shadows and orbit controls. `variant="mini"` renders a lightweight version
 * for list thumbnails (auto-rotating camera + self-contained sweep).
 */

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Environment, Lightformer, Grid } from '@react-three/drei'
import { ServoMotor, type HornType } from './ServoMotor'

export interface ServoStageProps {
  variant?: 'full' | 'mini'
  angle?: number
  speed?: number
  bodyColor?: string
  hornType?: HornType
  showCable?: boolean
  showLabels?: boolean
  showPorts?: boolean
  interactive?: boolean
  autoRotate?: boolean
  autoSweep?: { min: number; max: number; speed: number } | false
  onAngleChange?: (angle: number) => void
  onDragStateChange?: (dragging: boolean) => void
}

export default function ServoStage({
  variant = 'full',
  angle = 90,
  speed = 400,
  bodyColor = '#1c56b2',
  hornType = 'single',
  showCable = true,
  showLabels = false,
  showPorts = false,
  interactive = false,
  autoRotate = false,
  autoSweep = false,
  onAngleChange,
  onDragStateChange,
}: ServoStageProps) {
  const mini = variant === 'mini'

  return (
    <Canvas
      dpr={mini ? [1, 1.5] : [1, 2]}
      shadows={!mini}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: mini ? [6.6, 5, 9] : [7.6, 5.6, 9.8], fov: mini ? 32 : 34 }}
    >
      <Suspense fallback={null}>
        {/* Lights */}
        <ambientLight intensity={mini ? 0.7 : 0.42} />
        <directionalLight
          position={[5, 9, 6]}
          intensity={mini ? 1.7 : 2.3}
          castShadow={!mini}
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
        <Environment resolution={mini ? 128 : 256} frames={1} environmentIntensity={0.62}>
          <Lightformer form="rect" intensity={3} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[9, 9, 1]} color="#ffffff" />
          <Lightformer form="rect" intensity={1.8} position={[6, 3, 4]} rotation-y={-Math.PI / 3} scale={[6, 3, 1]} color="#fff2df" />
          <Lightformer form="rect" intensity={1.8} position={[-6, 2, -3]} rotation-y={Math.PI / 2.5} scale={[5, 3, 1]} color="#eef2f8" />
        </Environment>

        {/* Display pedestal + ground grid (full view only) */}
        {!mini && (
          <group>
            <mesh position={[0, -0.26, 0]} receiveShadow>
              <cylinderGeometry args={[4.6, 4.6, 0.5, 72]} />
              <meshStandardMaterial color="#e7e5df" roughness={0.65} metalness={0.04} />
            </mesh>
            <mesh position={[0, -0.43, 0]}>
              <cylinderGeometry args={[4.82, 4.82, 0.16, 72]} />
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
        )}

        {/* The star of the show */}
        <ServoMotor
          position={[0, 0.03, 0]}
          angle={angle}
          speed={speed}
          bodyColor={bodyColor}
          hornType={hornType}
          showCable={showCable}
          showLabels={showLabels}
          showPorts={showPorts}
          interactive={interactive}
          autoSweep={autoSweep}
          onAngleChange={onAngleChange}
          onDragStateChange={onDragStateChange}
        />

        {/* Soft contact shadow */}
        <ContactShadows
          position={[0, mini ? 0.02 : -0.5, 0]}
          opacity={mini ? 0.42 : 0.55}
          scale={mini ? 11 : 17}
          blur={2.4}
          far={4}
          resolution={mini ? 256 : 512}
          color="#18181b"
        />

        <OrbitControls
          makeDefault
          target={[0, mini ? 2.3 : 1.7, 0]}
          enableDamping
          dampingFactor={0.08}
          enablePan={!mini}
          enableZoom={!mini}
          autoRotate={autoRotate || mini}
          autoRotateSpeed={2.4}
          minDistance={5}
          maxDistance={22}
          maxPolarAngle={(Math.PI / 2) * 0.985}
        />
      </Suspense>
    </Canvas>
  )
}
