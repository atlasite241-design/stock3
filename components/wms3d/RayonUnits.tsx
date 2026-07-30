'use client'

// Étape 3 — Vue des rayons : les rayons de l'allée choisie, en meubles de
// rayonnage réels (montants métalliques + planches). Cliquer un rayon zoome
// et ouvre ses étagères ; les rayons sœurs restent en fantômes.

import { useMemo } from 'react'
import { GlowBox, InstancedBoxes, SignPlate, Tag, type InstBox } from './SceneCore'
import { BASE_Y, NH, PLANK_T, type Layout } from './layout'
import { cartonColor, MAT } from './materials'
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
  const { posts, planks, cartons } = useMemo(() => {
    const posts: InstBox[] = []
    const planks: InstBox[] = []
    const cartons: InstBox[] = []
    if (!allee || !atRayons) return { posts, planks, cartons }
    for (const r of allee.rayons) {
      const rb = layout.rayons.get(r.id)
      if (!rb) continue
      // Montants (échelles) aux frontières de travées
      posts.push({ x: rb.x + 0.03, y: rb.h / 2, z: rb.z + rb.d / 2, sx: 0.07, sy: rb.h, sz: rb.d * 0.94 })
      for (const e of r.etageres) {
        const eb = layout.etageres.get(e.id)
        if (!eb) continue
        posts.push({ x: eb.x + eb.w + 0.06, y: rb.h / 2, z: rb.z + rb.d / 2, sx: 0.07, sy: rb.h, sz: rb.d * 0.94 })
        // Tablettes + cartons posés dessus
        e.niveaux.forEach((_, ni) => {
          const y = BASE_Y + ni * NH
          planks.push({ x: eb.x + eb.w / 2, y: y - PLANK_T / 2, z: eb.z + eb.d / 2, sx: eb.w, sy: PLANK_T, sz: eb.d })
          const per = 2 + (ni % 2)
          const cw = (eb.w - 0.16) / per
          for (let c = 0; c < per; c++) {
            if ((ni * 7 + c * 3) % 5 === 0) continue // tablettes partiellement vides
            const hh = 0.2 + ((ni + c) % 3) * 0.06
            cartons.push({
              x: eb.x + 0.08 + c * cw + cw / 2, y: y + hh / 2 + 0.005, z: eb.z + eb.d / 2,
              sx: cw * 0.82, sy: hh, sz: eb.d * 0.7, color: cartonColor(ni * 3 + c),
            })
          }
        })
      }
    }
    return { posts, planks, cartons }
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
              <>
                <SignPlate position={[rb.x + rb.w / 2, rb.h + 0.34, rb.z + rb.d / 2]} code={r.code} onClick={() => onPick(r.id)} />
                {r.name && (
                  <Tag position={[rb.x + rb.w / 2, rb.h + 0.62, rb.z + rb.d / 2]} onClick={() => onPick(r.id)}>{r.name}</Tag>
                )}
              </>
            )}
          </group>
        )
      })}
      <InstancedBoxes items={posts} color={MAT.upright} metal={0.55} rough={0.42} />
      <InstancedBoxes items={planks} color={MAT.shelf} metal={0.65} rough={0.35} />
      <InstancedBoxes items={cartons} color="#ffffff" metal={0.05} rough={0.85} />
    </group>
  )
}
