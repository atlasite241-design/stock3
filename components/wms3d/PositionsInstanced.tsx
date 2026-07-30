'use client'

// Étape 5 — Les positions : cubes indépendants instanciés (un draw call par
// lot). Couleur = état du stock ; survol = léger agrandissement + halo ;
// clic = panneau de détail ; `pulseId` = animation lumineuse (recherche).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CellLay } from './layout'
import { STATUS_COLOR, type PosNode } from './types'

export interface CellItem { node: PosNode; lay: CellLay }

export default function PositionsInstanced({ cells, interactive = false, onPick, pulseId }: {
  cells: CellItem[]
  /** Survol + clic actifs (vue niveau) ; sinon simple décor. */
  interactive?: boolean
  onPick?: (node: PosNode) => void
  /** Position à faire pulser (résultat de recherche). */
  pulseId?: string | null
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const col = useMemo(() => new THREE.Color(), [])
  const scales = useRef<Float32Array>(new Float32Array(0))

  const pulseIndex = useMemo(() => (pulseId ? cells.findIndex((c) => c.node.id === pulseId) : -1), [cells, pulseId])

  // Matrices + couleurs de base.
  useEffect(() => {
    const m = ref.current
    if (!m) return
    scales.current = new Float32Array(cells.length).fill(1)
    cells.forEach((c, i) => {
      tmp.position.set(c.lay.x, c.lay.y, c.lay.z)
      tmp.scale.setScalar(c.lay.s)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
      m.setColorAt(i, col.set(STATUS_COLOR[c.node.status]))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [cells, tmp, col])

  useEffect(() => {
    if (!interactive) return
    document.body.style.cursor = hovered != null ? 'pointer' : ''
    return () => { document.body.style.cursor = '' }
  }, [hovered, interactive])

  // Animation : échelle amortie du cube survolé + pulsation du cube recherché.
  useFrame((state, dt) => {
    const m = ref.current
    if (!m || cells.length === 0) return
    const t = state.clock.elapsedTime
    let dirty = false
    for (let i = 0; i < cells.length; i++) {
      let target = 1
      if (i === hovered) target = 1.28
      if (i === pulseIndex) target = 1.15 + Math.sin(t * 6) * 0.18
      const cur = scales.current[i] ?? 1
      const next = THREE.MathUtils.damp(cur, target, 14, dt)
      if (Math.abs(next - cur) > 0.0005) {
        scales.current[i] = next
        const c = cells[i]
        tmp.position.set(c.lay.x, c.lay.y, c.lay.z)
        tmp.scale.setScalar(c.lay.s * next)
        tmp.updateMatrix()
        m.setMatrixAt(i, tmp.matrix)
        dirty = true
      }
    }
    if (dirty) m.instanceMatrix.needsUpdate = true
  })

  if (cells.length === 0) return null

  return (
    <group>
      <instancedMesh
        ref={ref}
        args={[undefined, undefined, cells.length]}
        castShadow
        receiveShadow
        onPointerMove={interactive ? (e) => { e.stopPropagation(); setHovered(e.instanceId ?? null) } : undefined}
        onPointerOut={interactive ? () => setHovered(null) : undefined}
        onClick={interactive ? (e) => { e.stopPropagation(); if (e.instanceId != null) onPick?.(cells[e.instanceId].node) } : undefined}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.35} metalness={0.2} />
      </instancedMesh>

      {/* Halo du cube survolé */}
      {interactive && hovered != null && cells[hovered] && (
        <mesh position={[cells[hovered].lay.x, cells[hovered].lay.y, cells[hovered].lay.z]}>
          <sphereGeometry args={[cells[hovered].lay.s * 1.1, 16, 16]} />
          <meshBasicMaterial color={STATUS_COLOR[cells[hovered].node.status]} transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}

      {/* Anneau pulsant du résultat de recherche */}
      {pulseIndex >= 0 && cells[pulseIndex] && (
        <PulseRing x={cells[pulseIndex].lay.x} y={cells[pulseIndex].lay.y} z={cells[pulseIndex].lay.z} s={cells[pulseIndex].lay.s} />
      )}
    </group>
  )
}

function PulseRing({ x, y, z, s }: { x: number; y: number; z: number; s: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const k = 1 + (Math.sin(t * 4) + 1) * 0.35
    if (ref.current) {
      ref.current.scale.setScalar(k)
      const mat = ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.55 - (k - 1) * 0.5
    }
  })
  return (
    <mesh ref={ref} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[s * 0.85, s * 1.1, 32]} />
      <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}
