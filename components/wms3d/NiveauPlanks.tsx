'use client'

// Étapes 4 & 5 — Étagère détaillée : vraie étagère métallique dont chaque
// niveau (planche) est cliquable, avec les positions en cubes interactifs
// (survol = halo, clic = panneau). Numéros de cellules affichés quand un
// niveau est sélectionné (≤ 48 cellules pour rester lisible).

import { useMemo } from 'react'
import { GlowBox, InstancedBoxes, Tag, type InstBox } from './SceneCore'
import PositionsInstanced, { type CellItem } from './PositionsInstanced'
import { BASE_Y, NH, PLANK_T, type Layout } from './layout'
import { levelOf, type PosNode, type Sel, type WmsTree } from './types'

export default function NiveauPlanks({ tree, layout, sel, onPickNiveau, onPickPos, pulseId }: {
  tree: WmsTree
  layout: Layout
  sel: Sel
  onPickNiveau: (niveauId: string) => void
  onPickPos: (node: PosNode) => void
  pulseId?: string | null
}) {
  const lvl = levelOf(sel)
  const rayon = tree.zones.find((z) => z.id === sel.zone)
    ?.allees.find((a) => a.id === sel.allee)
    ?.rayons.find((r) => r.id === sel.rayon)
  const etagere = rayon?.etageres.find((e) => e.id === sel.etagere)

  // Cubes interactifs de toute l'étagère sélectionnée.
  const cells = useMemo<CellItem[]>(() => {
    if (!etagere) return []
    const out: CellItem[] = []
    for (const n of etagere.niveaux)
      for (const p of n.positions) {
        const lay = layout.cells.get(p.id)
        if (lay) out.push({ node: p, lay })
      }
    return out
  }, [etagere, layout])

  // Structure : montants latéraux + fond léger, planches dessinées une à une
  // (cliquables), sœurs en fantômes.
  const frame = useMemo<InstBox[]>(() => {
    if (!etagere) return []
    const eb = layout.etageres.get(etagere.id)
    if (!eb) return []
    return [
      { x: eb.x + 0.02, y: eb.h / 2, z: eb.z + eb.d / 2, sx: 0.06, sy: eb.h, sz: eb.d * 0.96 },
      { x: eb.x + eb.w - 0.02, y: eb.h / 2, z: eb.z + eb.d / 2, sx: 0.06, sy: eb.h, sz: eb.d * 0.96 },
      { x: eb.x + eb.w / 2, y: eb.h / 2, z: eb.z + 0.02, sx: eb.w, sy: eb.h, sz: 0.02 }, // fond
    ]
  }, [etagere, layout])

  if (lvl !== 'niveaux' || !rayon || !etagere) return null
  const eb = layout.etageres.get(etagere.id)
  if (!eb) return null

  return (
    <group>
      {/* Étagères sœurs en fantômes (contexte) */}
      {rayon.etageres.filter((e) => e.id !== etagere.id).map((e) => {
        const b = layout.etageres.get(e.id)
        if (!b) return null
        return (
          <GlowBox key={e.id} position={[b.x + b.w / 2, b.h / 2, b.z + b.d / 2]} size={[b.w, b.h, b.d]} color="#64748b" ghost />
        )
      })}

      <InstancedBoxes items={frame} color="#94a3b8" metal={0.7} rough={0.3} />

      {/* Planches = niveaux cliquables */}
      {etagere.niveaux.map((n, ni) => {
        const selected = sel.niveau === n.id
        const py = BASE_Y + ni * NH - PLANK_T / 2
        return (
          <group key={n.id}>
            <GlowBox
              position={[eb.x + eb.w / 2, py, eb.z + eb.d / 2]}
              size={[eb.w - 0.08, PLANK_T, eb.d]}
              color={selected ? '#fbbf24' : '#cbd5e1'}
              opacity={0.96}
              active={selected}
              onClick={() => onPickNiveau(n.id)}
            />
            <Tag position={[eb.x + eb.w + 0.32, py + 0.1, eb.z + eb.d / 2]} small accent={selected} onClick={() => onPickNiveau(n.id)}>
              {n.code}
            </Tag>
            {/* Numéros de cellules du niveau sélectionné */}
            {selected && n.positions.length <= 48 && n.positions.map((p) => {
              const lay = layout.cells.get(p.id)
              if (!lay) return null
              return (
                <Tag key={p.id} position={[lay.x, lay.y + lay.s * 0.9 + 0.05, lay.z]} small>
                  {p.code.replace(/^P0*/, '') || p.code}
                </Tag>
              )
            })}
          </group>
        )
      })}

      <PositionsInstanced cells={cells} interactive onPick={onPickPos} pulseId={pulseId} />
    </group>
  )
}
