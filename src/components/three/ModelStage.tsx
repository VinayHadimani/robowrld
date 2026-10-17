'use client'

/**
 * ModelStage — the studio canvas for uploaded model files.
 *
 * Same presentation language as ServoStage (procedural environment, key +
 * fill lights, display pedestal, fading grid, contact shadows, orbit
 * controls) but hosting a GltfModel from the Supabase `models` bucket
 * instead of procedural geometry.
 *
 * IMPORTANT: the Canvas stays mounted for the lifetime of the view — only
 * the model inside is re-keyed on url change. Re-mounting the Canvas itself
 * (key on the stage) races React's renderer with R3F's root teardown
 * ("Attempted to synchronously unmount a root…") and leaves a dead, blank
 * canvas. The reset-view button therefore drives OrbitControls imperatively
 * through a signal prop instead of re-mounting anything.
 */

import { Suspense, useEffect } from 'react'
import * as React from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Grid, Html, Lightformer, OrbitControls } from '@react-three/drei'
import { GltfModel, type ModelFileKind, type ModelStats } from './GltfModel'

export interface ModelStageProps {
  url: string
  kind: ModelFileKind
  wireframe?: boolean
  autoRotate?: boolean
  /** Bump to reset the camera to its home framing. */
  resetSignal?: number
  onStats?: (stats: ModelStats) => void
}

class ModelErrorBoundary extends React.Component<
  { children: React.ReactNode; fallbackRender: (error: Error) => React.ReactElement },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    return this.state.error ? this.props.fallbackRender(this.state.error) : this.props.children
  }
}

/** Calls controls.reset() whenever the signal changes (camera home). */
function CameraReset({ signal }: { signal: number }) {
  const controls = useThree((s) => s.controls) as { reset?: () => void } | null
  useEffect(() => {
    controls?.reset?.()
  }, [signal, controls])
  return null
}

export default function ModelStage({
  url,
  kind,
  wireframe = false,
  autoRotate = false,
  resetSignal = 0,
  onStats,
}: ModelStageProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [6.4, 4.8, 8.6], fov: 34 }}
    >
      {/* Scene chrome renders immediately — only the model suspends, so the
          studio (pedestal, grid, lights) is never blanked while a file loads. */}
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

      {/* Soft contact shadow */}
      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.55}
        scale={12}
        blur={2.4}
        far={4}
        resolution={512}
        color="#18181b"
      />

      <CameraReset signal={resetSignal} />
      <OrbitControls
        makeDefault
        target={[0, 1.8, 0]}
        enableDamping
        dampingFactor={0.08}
        autoRotate={autoRotate}
        autoRotateSpeed={2.2}
        minDistance={4}
        maxDistance={22}
        maxPolarAngle={(Math.PI / 2) * 0.985}
      />

      {/* The uploaded model — the ONLY suspending subtree. The key swaps
          ONLY the model, never the canvas; the boundary is keyed too so a
          failed load never sticks. NOTE: keep Suspense fallback null — a
          drei <Html> fallback here races R3F root teardown on mount. */}
      <Suspense fallback={null}>
        <ModelErrorBoundary
          key={url}
          fallbackRender={() => (
            <Html center>
              <div className="max-w-[260px] rounded-lg border bg-white/95 p-4 text-center shadow-lg dark:bg-zinc-900/95">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Could not load this model</p>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  If this is a .gltf that references external .bin or texture files, re-export it as a
                  self-contained .glb and upload again.
                </p>
              </div>
            </Html>
          )}
        >
          <GltfModel key={url} url={url} kind={kind} wireframe={wireframe} onStats={onStats} />
        </ModelErrorBoundary>
      </Suspense>
    </Canvas>
  )
}
