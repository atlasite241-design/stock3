'use client'

// Étape 4 — Vue des étagères : le rayon choisi s'ouvre en travées métalliques
// réelles (montants + planches par niveau + cubes de positions en décor).
// Cliquer une étagère zoome sur elle ; les sœurs restent en fantômes quand on
// descend au niveau suivant.

import { useMemo } from 'react'
import { GlowBox, InstancedBoxes, Tag, type InstBox } from './SceneCore'
import PositionsInstanced, { type CellItem } from './PositionsInstanced'
import { BASE_Y, NH, PLANK_T, type Layout } from './layout'
import { levelOf, type Sel, type WmsTree } from './types'

export default function EtagereBays({ tree, layout, sel, onPick }: {
  tree: WmsTree
  layout: Layout
  sel: Sel
  onPick: (etagereId: string) => void
}) {
  const lvl = levelOf(sel)
  const rayon = tree.zones.find((z) => z.id === sel.zone)
    ?.allees.find((a) => a.id === sel.allee)
    ?.rayons.find((r) => r.id === sel.rayon)
  const atEtageres = lvl === 'etageres'

  // Structure métallique + petits cubes de positions (décor, non interactifs).
  const { posts, planks, cells } = useMemo(() => {
    const posts: InstBox[] = []
    const planks: InstBox[] = []
    const cells: CellItem[] = []
    if (!rayon || !atEtageres) return { posts, planks, cells }
    const rb = layout.rayons.get(rayon.id)
    if (rb) posts.push({ x: rb.x + 0.03, y: rb.h / 2, z: rb.z + rb.d / 2, sx: 0.06, sy: rb.h, sz: rb.d * 0.94 })
    for (const e of rayon.etageres) {
      const eb = layout.etageres.get(e.id)
      if (!eb) continue
      posts.push({ x: eb.x + eb.w + 0.06, y: eb.h / 2, z: eb.z + eb.d / 2, sx: 0.06, sy: eb.h, sz: eb.d * 0.94 })
      e.niveaux.forEach((n, ni) => {
        planks.push({ x: eb.x + eb.w / 2, y: BASE_Y + ni * NH - PLANK_T / 2, z: eb.z + eb.d / 2, sx: eb.w, sy: PLANK_T, sz: eb.d })
        for (const p of n.positions) {
          const lay = layout.cells.get(p.id)
          if (lay) cells.push({ node: p, lay })
        }
      })
    }
    return { posts, planks, cells }
  }, [rayon, layout, atEtageres])

  if (!rayon || !atEtageres) return null

  return (
    <group>
      {rayon.etageres.map((e) => {
        const eb = layout.etageres.get(e.id)
        if (!eb) return null
        return (
          <group key={e.id}>
            {/* Volume cliquable de la travée */}
            <GlowBox
              position={[eb.x + eb.w / 2, eb.h / 2, eb.z + eb.d / 2]}
              size={[eb.w, eb.h, eb.d]}
              color="#38bdf8"
              opacity={0.12}
              onClick={() => onPick(e.id)}
            />
            <Tag position={[eb.x + eb.w / 2, eb.h + 0.35, eb.z + eb.d / 2]} onClick={() => onPick(e.id)}>
              {e.code}
            </Tag>
          </group>
        )
      })}
      <InstancedBoxes items={posts} color="#94a3b8" metal={0.7} rough={0.3} />
      <InstancedBoxes items={planks} color="#cbd5e1" metal={0.5} rough={0.4} />
      <PositionsInstanced cells={cells} />
    </group>
  )
}
