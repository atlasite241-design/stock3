'use client'

// Explorateur 3D des emplacements — orchestrateur.
// Navigation progressive Zone → Allée → Rayon → Étagère → Niveau → Position :
// chaque clic descend d'un niveau (vol de caméra amorti), Échap / clic dans le
// vide remonte. Fil d'Ariane, recherche d'emplacement, mini-carte, panneau de
// détail et légende des états en surimpression glassmorphism.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import { motion } from 'framer-motion'
import { Boxes, FlaskConical } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { findByCode, useWmsTree } from './data'
import { cameraFor, computeLayout, focusFor } from './layout'
import { FlyRig, SceneLights } from './SceneCore'
import ZoneBlocks from './ZoneBlocks'
import AlleeRacks from './AlleeRacks'
import RayonUnits from './RayonUnits'
import EtagereBays from './EtagereBays'
import NiveauPlanks from './NiveauPlanks'
import { Breadcrumb, DetailPanel, Legend, MiniMap, SearchBar } from './Overlays'
import { levelOf, type PosNode, type Sel } from './types'

export default function Explorer3D({ initialCode }: { initialCode?: string }) {
  const { t } = useLanguage()
  const tree = useWmsTree()
  const layout = useMemo(() => computeLayout(tree), [tree])

  const [sel, setSel] = useState<Sel>({})
  const [panelPos, setPanelPos] = useState<PosNode | null>(null)
  const [pulseId, setPulseId] = useState<string | null>(null)
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lvl = levelOf(sel)
  const focus = useMemo(() => focusFor(sel, layout), [sel, layout])
  const goal = useMemo(() => cameraFor(sel, focus), [sel, focus])
  const maxDist = Math.max(layout.world.w, layout.world.d) * 2 + 24

  // Remonter d'un niveau (Échap / clic dans le vide).
  const goUp = useCallback(() => {
    setSel((s) => {
      if (s.niveau) return { zone: s.zone, allee: s.allee, rayon: s.rayon, etagere: s.etagere }
      if (s.etagere) return { zone: s.zone, allee: s.allee, rayon: s.rayon }
      if (s.rayon) return { zone: s.zone, allee: s.allee }
      if (s.allee) return { zone: s.zone }
      return {}
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (panelPos) setPanelPos(null)
      else goUp()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelPos, goUp])

  // Recherche : sélectionne le chemin, pulse la position, ouvre le panneau.
  const search = useCallback((q: string): boolean => {
    const hit = findByCode(tree, q)
    if (!hit) return false
    setSel({ zone: hit.zone, allee: hit.allee, rayon: hit.rayon, etagere: hit.etagere, niveau: hit.niveau })
    setPanelPos(hit.node)
    setPulseId(hit.node.id)
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => setPulseId(null), 7000)
    return true
  }, [tree])

  const pickPos = useCallback((node: PosNode) => setPanelPos(node), [])

  // Lien profond (?code=…) : vol direct vers la position au premier arbre prêt.
  const appliedCode = useRef<string | null>(null)
  useEffect(() => {
    if (!initialCode || tree.flat.length === 0 || appliedCode.current === initialCode) return
    appliedCode.current = initialCode
    search(initialCode)
  }, [initialCode, tree, search])

  const hintKey = (`x3_hint_${lvl}`) as Parameters<typeof t>[0]

  return (
    <div className="relative h-[calc(100dvh-180px)] min-h-[480px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0b0b12] to-[#12121d] shadow-2xl">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: goal.pos, fov: 46, near: 0.1, far: 600 }}
        onPointerMissed={() => { if (panelPos) setPanelPos(null); else goUp() }}
      >
        <color attach="background" args={['#0b0b12']} />
        <fog attach="fog" args={['#0b0b12', maxDist * 0.55, maxDist * 1.15]} />
        <SceneLights world={layout.world} />
        <FlyRig goal={goal} maxDist={maxDist} />

        {/* Sol */}
        <Grid
          position={[layout.world.x + layout.world.w / 2, -0.01, layout.world.z + layout.world.d / 2]}
          args={[layout.world.w + 40, layout.world.d + 40]}
          cellSize={1}
          cellColor="#1e293b"
          sectionSize={5}
          sectionColor="#334155"
          fadeDistance={maxDist * 0.8}
          fadeStrength={1.5}
        />
        <mesh position={[layout.world.x + layout.world.w / 2, -0.06, layout.world.z + layout.world.d / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[layout.world.w + 60, layout.world.d + 60]} />
          <meshStandardMaterial color="#0e1019" roughness={0.85} metalness={0.2} />
        </mesh>

        {/* Vues par niveau de la hiérarchie */}
        <ZoneBlocks tree={tree} layout={layout} sel={sel} onPick={(zone) => setSel({ zone })} />
        <AlleeRacks tree={tree} layout={layout} sel={sel} onPick={(allee) => setSel((s) => ({ zone: s.zone, allee }))} />
        <RayonUnits tree={tree} layout={layout} sel={sel} onPick={(rayon) => setSel((s) => ({ zone: s.zone, allee: s.allee, rayon }))} />
        <EtagereBays tree={tree} layout={layout} sel={sel} onPick={(etagere) => setSel((s) => ({ zone: s.zone, allee: s.allee, rayon: s.rayon, etagere }))} />
        <NiveauPlanks
          tree={tree}
          layout={layout}
          sel={sel}
          onPickNiveau={(niveau) => setSel((s) => ({ ...s, niveau: s.niveau === niveau ? undefined : niveau }))}
          onPickPos={pickPos}
          pulseId={pulseId}
        />
      </Canvas>

      {/* ---- Overlays ---- */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-start justify-between gap-2">
        <Breadcrumb tree={tree} sel={sel} onNavigate={(s) => { setSel(s); setPanelPos(null) }} />
        <SearchBar onSearch={search} />
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-2">
          {tree.demo && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="pointer-events-auto flex w-fit items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/20 px-2.5 py-1 text-[10px] font-bold text-violet-300 backdrop-blur-xl">
              <FlaskConical className="h-3 w-3" />{t('x3_demo')}
            </motion.div>
          )}
          <Legend tree={tree} />
        </div>
        <div className="flex flex-col items-end gap-2">
          <motion.p key={lvl} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 text-[10px] font-semibold text-zinc-300 backdrop-blur-xl">
            <Boxes className="h-3 w-3 text-amber-400" />{t(hintKey)}
          </motion.p>
          <MiniMap tree={tree} layout={layout} sel={sel} onJump={(zone) => { setSel({ zone }); setPanelPos(null) }} />
        </div>
      </div>

      <DetailPanel pos={panelPos} onClose={() => setPanelPos(null)} />
    </div>
  )
}
