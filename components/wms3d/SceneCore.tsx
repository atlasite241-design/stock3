'use client'

// Briques 3D partagées de l'explorateur : vol de caméra amorti (FlyRig),
// boîte cliquable avec halo (GlowBox), lots de boîtes instanciées
// (InstancedBoxes) et étiquettes DOM ancrées (Tag).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges, Html, OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { easing } from 'maath'
import * as THREE from 'three'

/* ------------------------------- FlyRig ---------------------------------- */

export interface CamGoal { pos: [number, number, number]; tgt: [number, number, number] }

/**
 * Caméra pilotée : à chaque changement de `goal`, vol amorti (position +
 * cible) puis rend la main à OrbitControls (rotation/zoom/pan utilisateur).
 */
export function FlyRig({ goal, maxDist }: { goal: CamGoal; maxDist: number }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const flying = useRef(true)
  const key = goal.pos.join(',') + '|' + goal.tgt.join(',')
  const lastKey = useRef('')

  useEffect(() => {
    if (key !== lastKey.current) { lastKey.current = key; flying.current = true }
  }, [key])

  useFrame((state, dt) => {
    const c = controls.current
    if (!c) return
    if (flying.current) {
      const m1 = easing.damp3(state.camera.position, goal.pos, 0.34, dt)
      const m2 = easing.damp3(c.target, goal.tgt, 0.34, dt)
      c.update()
      if (!m1 && !m2) flying.current = false
    }
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minPolarAngle={0.1}
      maxPolarAngle={1.42}
      minDistance={0.5}
      maxDistance={maxDist}
    />
  )
}

/* ------------------------------- GlowBox ---------------------------------- */

export function GlowBox({
  position, size, color, opacity = 0.92, active = false, ghost = false,
  onClick, cursor = true, radiusTop = false, onHoverChange,
}: {
  position: [number, number, number]
  size: [number, number, number]
  color: string
  opacity?: number
  /** Sélectionné : halo permanent. */
  active?: boolean
  /** Fantôme : très transparent, non interactif. */
  ghost?: boolean
  onClick?: () => void
  cursor?: boolean
  radiusTop?: boolean
  /** Notifie le parent du survol (étiquettes contextuelles). */
  onHoverChange?: (hovered: boolean) => void
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const mesh = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)

  useEffect(() => {
    if (!cursor) return
    document.body.style.cursor = hover ? 'pointer' : ''
    return () => { document.body.style.cursor = '' }
  }, [hover, cursor])

  useFrame((_, dt) => {
    if (mat.current) {
      easing.damp(mat.current, 'emissiveIntensity', active ? 0.5 : hover ? 0.32 : 0.04, 0.12, dt)
      easing.damp(mat.current, 'opacity', ghost ? 0.1 : opacity, 0.2, dt)
    }
    if (mesh.current) {
      const s = hover && !ghost ? 1.025 : 1
      easing.damp3(mesh.current.scale, [s, s, s], 0.1, dt)
    }
  })

  return (
    <mesh
      ref={mesh}
      position={position}
      castShadow={!ghost}
      receiveShadow
      onClick={ghost ? undefined : (e) => { e.stopPropagation(); onClick?.() }}
      onPointerOver={ghost ? undefined : (e) => { e.stopPropagation(); setHover(true); onHoverChange?.(true) }}
      onPointerOut={ghost ? undefined : () => { setHover(false); onHoverChange?.(false) }}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        ref={mat}
        color={color}
        emissive={color}
        emissiveIntensity={0.04}
        transparent
        opacity={opacity}
        roughness={0.38}
        metalness={0.15}
      />
      {/* THREE.Color n'accepte pas l'alpha en hex : couleur opaque + opacité du matériau. */}
      {!ghost && <Edges scale={radiusTop ? 1.0001 : 1.001} color={hover || active ? '#fbbf24' : '#1f2937'} />}
    </mesh>
  )
}

/* ---------------------------- InstancedBoxes ------------------------------ */

export interface InstBox { x: number; y: number; z: number; sx: number; sy: number; sz: number; color?: string }

/** Lot de boîtes statiques en un seul draw call (montants, planches…). */
export function InstancedBoxes({ items, color, opacity = 1, metal = 0.3, rough = 0.45 }: {
  items: InstBox[]
  color: string
  opacity?: number
  metal?: number
  rough?: number
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const colTmp = useMemo(() => new THREE.Color(), [])

  useEffect(() => {
    const m = ref.current
    if (!m) return
    items.forEach((b, i) => {
      tmp.position.set(b.x, b.y, b.z)
      tmp.scale.set(b.sx, b.sy, b.sz)
      tmp.rotation.set(0, 0, 0)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
      if (b.color) m.setColorAt(i, colTmp.set(b.color))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [items, tmp, colTmp])

  if (items.length === 0) return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} roughness={rough} metalness={metal} />
    </instancedMesh>
  )
}

/* --------------------------------- Tag ------------------------------------ */

/** Étiquette DOM ancrée dans la scène (chip glassmorphism). */
export function Tag({ position, children, accent = false, small = false, onClick }: {
  position: [number, number, number]
  children: React.ReactNode
  accent?: boolean
  small?: boolean
  onClick?: () => void
}) {
  return (
    <Html position={position} center zIndexRange={[40, 0]} style={{ pointerEvents: onClick ? 'auto' : 'none' }}>
      <div
        onClick={onClick}
        className={`select-none whitespace-nowrap rounded-md border backdrop-blur-md transition ${small ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[11px]'} font-bold shadow-lg ${
          accent
            ? 'border-amber-400/60 bg-amber-500/85 text-white'
            : 'border-white/15 bg-black/60 text-white'
        } ${onClick ? 'cursor-pointer hover:bg-black/80' : ''}`}
      >
        {children}
      </div>
    </Html>
  )
}

/* ------------------------------ SignPlate --------------------------------- */

/**
 * Plaque de repérage suspendue en tête d'allée, comme dans un entrepôt réel
 * (fond jaune, code en gros caractères noirs).
 */
export function SignPlate({ position, code, onClick }: {
  position: [number, number, number]
  code: string
  onClick?: () => void
}) {
  return (
    <Html position={position} center zIndexRange={[45, 0]} style={{ pointerEvents: onClick ? 'auto' : 'none' }}>
      <div
        onClick={onClick}
        className={`select-none rounded-[3px] border-2 border-amber-700/60 bg-[#f5c518] px-2 py-0.5 text-center font-mono text-[13px] font-extrabold leading-tight tracking-widest text-black shadow-lg ${onClick ? 'cursor-pointer hover:brightness-110' : ''}`}
      >
        {code}
      </div>
    </Html>
  )
}

/* ------------------------------ SceneLights ------------------------------- */

export function SceneLights({ world }: { world: { x: number; z: number; w: number; d: number } }) {
  const cx = world.x + world.w / 2, cz = world.z + world.d / 2
  const span = Math.max(world.w, world.d)
  return (
    <>
      <hemisphereLight intensity={0.55} color="#dbeafe" groundColor="#1e1b2e" />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[cx + span * 0.4, span * 0.8 + 6, cz + span * 0.35]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-left={-span * 0.75}
        shadow-camera-right={span * 0.75}
        shadow-camera-top={span * 0.75}
        shadow-camera-bottom={-span * 0.75}
        shadow-camera-near={1}
        shadow-camera-far={span * 2.5 + 20}
        target-position={[cx, 0, cz]}
      />
      <directionalLight position={[cx - span * 0.5, span * 0.3, cz - span * 0.4]} intensity={0.3} color="#a5b4fc" />
    </>
  )
}
