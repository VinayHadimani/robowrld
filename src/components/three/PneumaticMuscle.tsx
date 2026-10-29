'use client'

/**
 * PneumaticMuscle — an exact procedural replica of a McKibben pneumatic
 * artificial muscle (Ø20 mm × 90 mm class) at 1 unit = 10 mm.
 *
 * Real anatomy: a rubber tube inside a braided POLYESTER/STEEL mesh
 * sleeve (the diamond-pattern braid), crimped into aluminium collars at
 * both ends. One end is blind; the other carries the brass push-in air
 * fitting. Inflate it and the braid's angle forces the muscle to expand
 * radially and CONTRACT axially — it shortens and pulls, exactly like a
 * biological muscle.
 *
 * Physics on the playground: connect the mini pump's outlet and the
 * muscle visibly contracts ~15 % and thickens as pressure arrives.
 */

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { M, makeLabelTexture } from './kit'

export interface PneumaticMuscleProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** True while live air arrives at the fitting. */
  pressurized?: boolean
  scale?: number
}

/** Ø20 mm braid, 90 mm between collars (1 unit = 10 mm). */
export const MUSCLE_DIMS = { od: 2.0, length: 9.0 }
/** Fractional contraction at working pressure (visible). */
export const MUSCLE_CONTRACTION = 0.15

/** Where the tubing clips (local coordinates). */
export const MUSCLE_ANCHORS = {
  /** The brass air inlet stub tip. */
  port: [5.15, 1.0, 0] as [number, number, number],
}

/** The diamond braid: two families of diagonal strands over dark rubber. */
function drawBraid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#141519'
  ctx.fillRect(0, 0, w, h)
  const strand = (x0: number, y0: number, x1: number, y1: number, col: string, lw: number) => {
    ctx.strokeStyle = col
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }
  const period = 26
  for (let x = -h; x < w + h; x += period) {
    // rising and falling diagonals — the braid's two strand families
    for (let k = 0; k < 3; k++) {
      const off = k * period * (1 / 3)
      strand(x + off, 0, x + off + h, h, '#585d66', 5)
      strand(x + off, h, x + off + h, 0, '#43474f', 5)
    }
  }
  // sparse highlight threads so the weave catches the light
  for (let x = -h; x < w + h; x += period * 3) {
    strand(x, 0, x + h, h, '#8b919a', 2)
    strand(x, h, x + h, 0, '#787e88', 2)
  }
}

export function PneumaticMuscle({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  pressurized = false,
  scale = 1,
}: PneumaticMuscleProps) {
  const sleeve = useRef<THREE.Group>(null)
  const collarA = useRef<THREE.Group>(null)
  const collarB = useRef<THREE.Group>(null)
  const fit = useRef<THREE.Group>(null)
  const k = useRef(0) // 0 = relaxed, 1 = contracted

  const braidTex = useMemo(() => {
    const t = makeLabelTexture(512, 256, drawBraid)
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
    t.repeat.set(3, 2)
    return t
  }, [])

  useFrame((_, dt) => {
    const target = pressurized ? 1 : 0
    k.current += THREE.MathUtils.clamp(target - k.current, -dt * 1.4, dt * 1.4)
    const c = k.current
    // Contract axially, expand radially — the McKibben behavior. The
    // sleeve's half-length is 3.2, so each end pulls in by 3.2 × 15 %.
    if (sleeve.current) {
      sleeve.current.scale.set(1 - MUSCLE_CONTRACTION * c, 1 + 0.12 * c, 1 + 0.12 * c)
    }
    const pull = 3.2 * MUSCLE_CONTRACTION * c
    if (collarA.current) collarA.current.position.x = 3.45 - pull
    if (collarB.current) collarB.current.position.x = -3.45 + pull
    if (fit.current) fit.current.position.x = 4.0 - pull
  })

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ---- braided sleeve over the rubber tube ---- */}
      <group ref={sleeve} position={[0, 1.0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[1.0, 1.0, 6.4, 40, 1, true]} />
          <meshStandardMaterial
            map={braidTex}
            bumpMap={braidTex}
            bumpScale={0.35}
            roughness={0.72}
            metalness={0.25}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* ---- crimped aluminium collars (they hold the braid ends) ---- */}
      <group ref={collarA} position={[3.45, 1.0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[1.13, 1.13, 0.7, 32]} />
          <meshStandardMaterial {...M.alu} />
        </mesh>
        {[0.18, 0, -0.18].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[1.16, 1.16, 0.09, 32]} />
            <meshStandardMaterial color="#7f858d" metalness={0.85} roughness={0.4} />
          </mesh>
        ))}
        {/* rubber end + steel pull lug on the blind end */}
        <mesh position={[0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.88, 0.88, 0.16, 28]} />
          <meshStandardMaterial color="#191a1e" roughness={0.6} />
        </mesh>
        <mesh position={[0.62, 0, 0]} castShadow>
          <torusGeometry args={[0.32, 0.09, 10, 24]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
      </group>

      <group ref={collarB} position={[-3.45, 1.0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[1.13, 1.13, 0.7, 32]} />
          <meshStandardMaterial {...M.alu} />
        </mesh>
        {[0.18, 0, -0.18].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[1.16, 1.16, 0.09, 32]} />
            <meshStandardMaterial color="#7f858d" metalness={0.85} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[-0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.88, 0.88, 0.16, 28]} />
          <meshStandardMaterial color="#191a1e" roughness={0.6} />
        </mesh>
      </group>

      {/* ---- brass push-in air fitting (the inlet) ---- */}
      <group ref={fit} position={[4.0, 1.0, 0]}>
        <mesh position={[0.35, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.55, 6]} />
          <meshStandardMaterial {...M.brass} />
        </mesh>
        <mesh position={[0.66, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.5, 0.5, 0.22, 20]} />
          <meshStandardMaterial color="#1f4fa8" roughness={0.45} metalness={0.05} />
        </mesh>
        <mesh position={[0.95, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.14, 0.14, 0.6, 14]} />
          <meshStandardMaterial {...M.brass} />
        </mesh>
      </group>
    </group>
  )
}

export default PneumaticMuscle
