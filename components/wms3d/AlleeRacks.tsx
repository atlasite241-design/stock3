'use client'

// Étape 2 — Vue des allées : les allées de la zone choisie, sous forme de
// rayonnages simplifiés (bloc + montants suggérés). Cliquer une allée zoome
// et affiche ses rayons ; les allées sœurs restent en fantômes.

import { useMemo } from 'react'
import { GlowBox, InstancedBoxes, Tag, type InstBox } from './SceneCore'
import type { Layout } from './layout'
import { levelOf, type Sel, type WmsTree } from './types'

export default function AlleeRacks({ tree, layout, sel, onPick }: {
  tree: WmsTree
  layout: Layout
  sel: Sel
  onPick: (alleeId: string) => void
}) {
  const lvl = levelOf(sel)
  const zone = tree.zones.find((z) => z.id === sel.zone)
  const atAllees = lvl === 'allees'

  // Montants décoratifs : un par frontière de rayon, pour toutes les allées visibles.
  const posts = useMemo<InstBox[]>(() => {
    if (!zone || !atAllees) return []
    const list: InstBox[] = []
    for (const a of zone.allees) {
      const b = layout.allees.get(a.id)
      if (!b) continue
      let x = b.x
      for (const r of a.rayons) {
        const rb = layout.rayons.get(r.id)
        if (!rb) continue
        list.push({ x, y: b.h / 2, z: b.z + b.d / 2, sx: 0.05, sy: b.h, sz: b.d * 0.96 })
        x = rb.x + rb.w
      }
      list.push({ x, y: b.h / 2, z: b.z + b.d / 2, sx: 0.05, sy: b.h, sz: b.d * 0.96 })
    }
    return list
  }, [zone, layout, atAllees])

  if (!zone || lvl === 'zones') return null

  return (
    <group>
      {zone.allees.map((a) => {
        const b = layout.allees.get(a.id)
        if (!b) return null
        const selected = sel.allee === a.id
        const ghost = !atAllees && !selected
        if (!atAllees && selected) return null // remplacée par les rayons détaillés
        return (
          <group key={a.id}>
            <GlowBox
              position={[b.x + b.w / 2, b.h / 2, b.z + b.d / 2]}
              size={[b.w, b.h, b.d]}
              color={zone.color}
              opacity={0.55}
              ghost={ghost}
              active={selected && atAllees}
              onClick={() => onPick(a.id)}
            />
            {atAllees && (
              <Tag position={[b.x + b.w / 2, b.h + 0.55, b.z + b.d / 2]} onClick={() => onPick(a.id)}>
                {a.code}{a.name ? ` · ${a.name}` : ''}
              </Tag>
            )}
          </group>
        )
      })}
      <InstancedBoxes items={posts} color="#64748b" metal={0.6} rough={0.35} />
    </group>
  )
}
