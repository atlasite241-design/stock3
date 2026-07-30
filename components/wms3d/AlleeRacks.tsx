'use client'

// Étape 2 — Vue des allées : rendu « entrepôt réel ».
// Chaque allée est une enfilade de rayonnages métalliques (montants bleus,
// tablettes claires, cartons posés dessus) séparés par des couloirs de
// circulation, avec une plaque de repérage jaune en tête d'allée.
// Toute la quincaillerie est instanciée (3 draw calls) pour rester fluide.

import { useMemo } from 'react'
import { GlowBox, InstancedBoxes, SignPlate, type InstBox } from './SceneCore'
import { BASE_Y, NH, PLANK_T, type Layout } from './layout'
import { cartonColor, MAT } from './materials'
import { levelOf, type Sel, type WmsTree } from './types'

/** Au-delà, on n'ajoute plus de cartons (le décor ne doit pas coûter des FPS). */
const CARTON_CAP = 4000

export default function AlleeRacks({ tree, layout, sel, onPick }: {
  tree: WmsTree
  layout: Layout
  sel: Sel
  onPick: (alleeId: string) => void
}) {
  const lvl = levelOf(sel)
  const zone = tree.zones.find((z) => z.id === sel.zone)
  const atAllees = lvl === 'allees'

  // Quincaillerie de toutes les allées visibles : montants, tablettes, cartons.
  const { uprights, shelves, cartons } = useMemo(() => {
    const uprights: InstBox[] = []
    const shelves: InstBox[] = []
    const cartons: InstBox[] = []
    if (!zone || !atAllees) return { uprights, shelves, cartons }

    let cartonCount = 0
    for (const a of zone.allees) {
      const ab = layout.allees.get(a.id)
      if (!ab) continue

      for (const r of a.rayons) {
        const rb = layout.rayons.get(r.id)
        if (!rb) continue

        // Montants : un à chaque extrémité de travée (les « échelles »).
        uprights.push({ x: rb.x + 0.03, y: rb.h / 2, z: rb.z + rb.d / 2, sx: 0.07, sy: rb.h, sz: rb.d * 0.95 })

        for (const e of r.etageres) {
          const eb = layout.etageres.get(e.id)
          if (!eb) continue
          uprights.push({ x: eb.x + eb.w + 0.05, y: rb.h / 2, z: eb.z + eb.d / 2, sx: 0.07, sy: rb.h, sz: eb.d * 0.95 })

          e.niveaux.forEach((_n, ni) => {
            const y = BASE_Y + ni * NH
            // Tablette pleine largeur de travée.
            shelves.push({ x: eb.x + eb.w / 2, y: y - PLANK_T / 2, z: eb.z + eb.d / 2, sx: eb.w - 0.06, sy: PLANK_T, sz: eb.d })

            // Cartons posés : 2 à 3 par tablette, taille déterministe.
            if (cartonCount < CARTON_CAP) {
              const per = 2 + (ni % 2)
              const cw = (eb.w - 0.16) / per
              for (let c = 0; c < per; c++) {
                // Une tablette sur cinq reste vide : un entrepôt n'est jamais plein.
                if ((ni * 7 + c * 3) % 5 === 0) continue
                const hh = 0.2 + ((ni + c) % 3) * 0.06
                cartons.push({
                  x: eb.x + 0.08 + c * cw + cw / 2,
                  y: y + hh / 2 + 0.005,
                  z: eb.z + eb.d / 2,
                  sx: cw * 0.82, sy: hh, sz: eb.d * 0.7,
                  color: cartonColor(ni * 3 + c),
                })
                cartonCount++
              }
            }
          })
        }
      }
    }
    return { uprights, shelves, cartons }
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
            {/* Volume cliquable, quasi transparent : ce sont les rayonnages
                instanciés qui portent le rendu, pas cette boîte. */}
            <GlowBox
              position={[b.x + b.w / 2, b.h / 2, b.z + b.d / 2]}
              size={[b.w, b.h, b.d]}
              color={zone.color}
              opacity={atAllees ? 0.1 : 0.5}
              ghost={ghost}
              active={selected && atAllees}
              onClick={() => onPick(a.id)}
            />
            {atAllees && (
              <>
                {/* Plaque de repérage en tête d'allée, côté couloir. */}
                <SignPlate position={[b.x - 0.45, b.h + 0.3, b.z + b.d / 2]} code={a.code} onClick={() => onPick(a.id)} />
                {a.name && (
                  <SignPlate position={[b.x + b.w / 2, b.h + 0.62, b.z + b.d / 2]} code={a.name} onClick={() => onPick(a.id)} />
                )}
              </>
            )}
          </group>
        )
      })}

      {/* Un draw call par matériau */}
      <InstancedBoxes items={uprights} color={MAT.upright} metal={0.55} rough={0.42} />
      <InstancedBoxes items={shelves} color={MAT.shelf} metal={0.65} rough={0.35} />
      <InstancedBoxes items={cartons} color="#ffffff" metal={0.05} rough={0.85} />
    </group>
  )
}
