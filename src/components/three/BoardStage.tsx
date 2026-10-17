'use client'

/**
 * BoardStage — presentation wrapper for the reusable ArduinoUno.
 *
 * A small "studio": key + fill lights, a procedural environment map (no
 * network HDRIs), a display pedestal, a fading ground grid, contact
 * shadows and orbit controls with a slow turntable so the headers, the
 * VIN jack and the ON LED are visible from every angle.
 */

import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Environment, Lightformer, Grid } from '@react-three/drei'
import { ArduinoUno } from './ArduinoUno'

export interface BoardStageProps {
  /** Light the ON LED (used when previewing the "powered" state). */
  ledOn?: boolean
  /** Slow camera turntable. */
  autoRotate?: boolean
}

export default function BoardStage({ ledOn = false, autoRotate = true }: BoardStageProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [6.4, 5.6, 8.2], fov: 34 }}
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
          <cylinderGeometry args={[4.2, 4.2, 0.5, 72]} />
          <meshStandardMaterial color="#e7e5df" roughness={0.65} metalness={0.04} />
        </mesh>
        <mesh position={[0, -0.43, 0]}>
          <cylinderGeometry args={[4.4, 4.4, 0.16, 72]} />
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
      <ArduinoUno position={[0, 0.03, 0]} ledOn={ledOn} />

      {/* Soft contact shadow */}
      <ContactShadows
        position={[0, -0.5, 0]}
        opacity={0.55}
        scale={16}
        blur={2.4}
        far={4}
        resolution={512}
        color="#18181b"
      />

      <OrbitControls
        makeDefault
        target={[0, 0.5, 0]}
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableZoom
        autoRotate={autoRotate}
        autoRotateSpeed={2.4}
        minDistance={4}
        maxDistance={22}
        maxPolarAngle={(Math.PI / 2) * 0.985}
      />
    </Canvas>
  )
}
