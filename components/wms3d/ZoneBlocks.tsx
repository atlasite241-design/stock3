'use client'

// Étape 1 — Vue générale : toutes les zones en dalles colorées.
// Cliquer une zone zoome dessus et masque les autres ; la dalle de la zone
// sélectionnée reste visible aux niveaux inférieurs (elle sert de sol).

import { useState } from 'react'
import { GlowBox, Tag } from './SceneCore'
import { MAT } from './materials'
import type { Layout } from './layout'
import { levelOf, type Sel, type WmsTree } from './types'

export default function ZoneBlocks({ tree, layout, sel, onPick }: {
  tree: WmsTree
  layout: Layout
  sel: Sel
  onPick: (zoneId: string) => void
}) {
  const lvl = levelOf(sel)
  const atZones = lvl === 'zones'
  // Au-delà de 8 zones, les noms complets se chevauchent : on n'affiche que le
  // code, et le nom apparaît au survol de la zone.
  const [hover, setHover] = useState<string | null>(null)
  const dense = tree.zones.length > 8

  return (
    <group>
      {tree.zones.map((z) => {
        const r = layout.zones.get(z.id)
        if (!r) return null
        const selected = sel.zone === z.id
        if (!atZones && !selected) return null // masquer les autres zones
        const slabH = atZones ? 0.34 : 0.1
        return (
          <group key={z.id}>
            <GlowBox
              position={[r.x + r.w / 2, slabH / 2, r.z + r.d / 2]}
              size={[r.w, slabH, r.d]}
              color={z.color}
              opacity={atZones ? 0.92 : 0.3}
              active={selected && atZones}
              onClick={() => onPick(z.id)}
              onHoverChange={atZones ? (h) => setHover(h ? z.id : null) : undefined}
            />
            {atZones && (
              <Tag position={[r.x + r.w / 2, 1.15, r.z + r.d / 2]} accent={hover === z.id} onClick={() => onPick(z.id)}>
                {dense && hover !== z.id ? z.code : `${z.code}${z.name ? ` · ${z.name}` : ''}`}
              </Tag>
            )}
            {/* Rangées de rayonnages vues du dessus : la zone se lit comme un
                plan d'entrepôt (blocs bleus = racks, vides = couloirs). */}
            {atZones && z.allees.map((a) => {
              const b = layout.allees.get(a.id)
              if (!b) return null
              return (
                <mesh key={a.id} position={[b.x + b.w / 2, slabH + 0.09, b.z + b.d / 2]} castShadow receiveShadow>
                  <boxGeometry args={[b.w, 0.18, b.d]} />
                  <meshStandardMaterial color={MAT.upright} roughness={0.45} metalness={0.5} />
                </mesh>
              )
            })}
          </group>
        )
      })}
    </group>
  )
}
