'use client'

// Étape 3 — Vue des rayons : les rayons de l'allée choisie, en meubles de
// rayonnage réels (montants métalliques + planches). Cliquer un rayon zoome
// et ouvre ses étagères ; les rayons sœurs restent en fantômes.

import { useMemo } from 'react'
import { GlowBox, InstancedBoxes, Tag, type InstBox } from './SceneCore'
import { BASE_Y, NH, PLANK_T, type Layout } from './layout'
import { levelOf, rayonColor, type Sel, type WmsTree } from './types'

export default function RayonUnits({ tree, layout, sel, onPick }: {
  tree: WmsTree
  layout: Layout
  sel: Sel
  onPick: (rayonId: string) => void
}) {
  const lvl = levelOf(sel)
  const zone = tree.zones.find((z) => z.id === sel.zone)
  const allee = zone?.allees.find((a) => a.id === sel.allee)
  const atRayons = lvl === 'rayons'

  // Structure métallique de tous les rayons visibles : montants + planches,
  // instanciés en 2 draw calls.
  const { posts, planks } = useMemo(() => {
    const posts: InstBox[] = []
    const planks: InstBox[] = []
    if (!allee || !atRayons) return { posts, planks }
    for (const r of allee.rayons) {
      const rb = layout.rayons.get(r.id)
      if (!rb) continue
      // montants aux frontières de travées
      posts.push({ x: rb.x + 0.03, y: rb.h / 2, z: rb.z + rb.d / 2, sx: 0.06, sy: rb.h, sz: rb.d * 0.94 })
      for (const e of r.etageres) {
        const eb = layout.etageres.get(e.id)
        if (!eb) continue
        posts.push({ x: eb.x + eb.w + 0.06, y: rb.h / 2, z: rb.z + rb.d / 2, sx: 0.06, sy: rb.h, sz: rb.d * 0.94 })
        // planches des niveaux
        e.niveaux.forEach((_, ni) => {
          planks.push({ x: eb.x + eb.w / 2, y: BASE_Y + ni * NH - PLANK_T / 2, z: eb.z + eb.d / 2, sx: eb.w, sy: PLANK_T, sz: eb.d })
        })
      }
    }
    return { posts, planks }
  }, [allee, layout, atRayons])

  if (!allee || lvl === 'zones' || lvl === 'allees') return null

  return (
    <group>
      {allee.rayons.map((r, ri) => {
        const rb = layout.rayons.get(r.id)
        if (!rb) return null
        const selected = sel.rayon === r.id
        const ghost = !atRayons && !selected
        if (!atRayons && selected) return null // remplacé par les étagères détaillées
        return (
          <group key={r.id}>
            {/* Volume cliquable du rayon (verre teinté) */}
            <GlowBox
              position={[rb.x + rb.w / 2, rb.h / 2, rb.z + rb.d / 2]}
              size={[rb.w, rb.h, rb.d]}
              color={rayonColor(ri)}
              opacity={0.3}
              ghost={ghost}
              active={selected && atRayons}
              onClick={() => onPick(r.id)}
            />
            {atRayons && (
              <Tag position={[rb.x + rb.w / 2, rb.h + 0.45, rb.z + rb.d / 2]} onClick={() => onPick(r.id)}>
                R{r.code}{r.name ? ` · ${r.name}` : ''}
              </Tag>
            )}
          </group>
        )
      })}
      <InstancedBoxes items={posts} color="#94a3b8" metal={0.7} rough={0.3} />
      <InstancedBoxes items={planks} color="#cbd5e1" metal={0.5} rough={0.4} />
    </group>
  )
}
