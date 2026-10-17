'use client'

/**
 * GltfModel — renders an uploaded 3D file (GLB / glTF / STL) from a URL.
 *
 * This is the "display in your app" half of the upload pipeline: whatever
 * lands in the Supabase `models` bucket gets fetched by the browser and
 * rendered here. Uploaded geometry is auto-fitted to the studio frame
 * (scaled + centered + seated on the ground plane) because model files
 * come in arbitrary unit systems — a 0.4 mm servo and a 400 mm gantry
 * both present at a comparable size.
 *
 * STL files carry geometry only (no materials/normals), so they get a
 * neutral engineering-grey material with computed normals.
 */

import { useEffect, useMemo } from 'react'
import * as React from 'react'
import { useGLTF } from '@react-three/drei'
import { useLoader } from '@react-three/fiber'
import { Box3, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

export type ModelFileKind = 'gltf' | 'stl'

export interface ModelStats {
  meshes: number
  triangles: number
  vertices: number
}

export interface GltfModelProps {
  url: string
  kind: ModelFileKind
  wireframe?: boolean
  /** Mesh/triangle/vertex counts of the loaded asset (for the inspector UI). */
  onStats?: (stats: ModelStats) => void
}

/** World-units the longest model dimension is normalized to. */
const TARGET_SIZE = 4.2

function countSceneStats(root: Object3D): ModelStats {
  let meshes = 0
  let triangles = 0
  let vertices = 0
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    meshes += 1
    const pos = mesh.geometry.attributes?.position
    if (pos) {
      vertices += pos.count
      triangles += mesh.geometry.index ? mesh.geometry.index.count / 3 : pos.count / 3
    }
  })
  return { meshes, triangles: Math.round(triangles), vertices }
}

/* ------------------------------------------------------------------ */
/* GLB / glTF                                                          */
/* ------------------------------------------------------------------ */

function GlbGltfModel({ url, wireframe = false, onStats }: GltfModelProps) {
  // Draco-compressed GLBs decode via the hosted decoder; plain ones load directly.
  const { scene } = useGLTF(url, true)

  const { scale, position, stats } = useMemo(() => {
    scene.traverse((obj) => {
      const mesh = obj as Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    const box = new Box3().setFromObject(scene)
    if (box.isEmpty()) {
      return { scale: 1, position: new Vector3(0, 0, 0), stats: countSceneStats(scene) }
    }
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const fit = TARGET_SIZE / maxDim
    // Seat the model on the ground plane and center it horizontally.
    const pos = new Vector3(-center.x * fit, -box.min.y * fit, -center.z * fit)
    return { scale: fit, position: pos, stats: countSceneStats(scene) }
  }, [scene])

  useEffect(() => {
    onStats?.(stats)
  }, [stats, onStats])

  useEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as Mesh
      if (mesh.isMesh && mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const m of mats) {
          if ('wireframe' in m) (m as MeshStandardMaterial).wireframe = wireframe
        }
      }
    })
  }, [scene, wireframe])

  return (
    <group scale={scale} position={position}>
      <primitive object={scene} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* STL                                                                 */
/* ------------------------------------------------------------------ */

function StlModel({ url, wireframe = false, onStats }: GltfModelProps) {
  const geometry = useLoader(STLLoader, url)

  const { scale, yOffset, stats } = useMemo(() => {
    geometry.computeVertexNormals()
    geometry.center() // origin at mid-body; we lift by half height below
    geometry.computeBoundingBox()
    const size = geometry.boundingBox?.getSize(new Vector3()) ?? new Vector3(1, 1, 1)
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const vertices = geometry.attributes.position?.count ?? 0
    const triangles = geometry.index ? geometry.index.count / 3 : vertices / 3
    const s = TARGET_SIZE / maxDim
    return {
      scale: s,
      yOffset: (size.y * s) / 2, // seat on the ground plane
      stats: { meshes: 1, triangles: Math.round(triangles), vertices },
    }
  }, [geometry])

  useEffect(() => {
    onStats?.(stats)
  }, [stats, onStats])

  return (
    <mesh geometry={geometry} scale={scale} position={[0, yOffset, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#8d99ae" metalness={0.32} roughness={0.48} wireframe={wireframe} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Public component                                                    */
/* ------------------------------------------------------------------ */

export function GltfModel(props: GltfModelProps) {
  return props.kind === 'stl' ? <StlModel {...props} /> : <GlbGltfModel {...props} />
}

export default GltfModel
