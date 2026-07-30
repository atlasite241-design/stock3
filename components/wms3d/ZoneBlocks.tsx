'use client'

// Étape 1 — Vue générale : toutes les zones en dalles colorées.
// Cliquer une zone zoome dessus et masque les autres ; la dalle de la zone
// sélectionnée reste visible aux niveaux inférieurs (elle sert de sol).

import { GlowBox, Tag } from './SceneCore'
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
            />
            {atZones && (
              <Tag position={[r.x + r.w / 2, 1.15, r.z + r.d / 2]} onClick={() => onPick(z.id)}>
                {z.code}{z.name ? ` · ${z.name}` : ''}
              </Tag>
            )}
            {/* Rainures des allées, en aperçu sur la dalle */}
            {atZones && z.allees.map((a) => {
              const b = layout.allees.get(a.id)
              if (!b) return null
              return (
                <mesh key={a.id} position={[b.x + b.w / 2, slabH + 0.012, b.z + b.d / 2]} receiveShadow>
                  <boxGeometry args={[b.w, 0.02, b.d]} />
                  <meshStandardMaterial color="#0f172a" transparent opacity={0.35} roughness={0.8} />
                </mesh>
              )
            })}
          </group>
        )
      })}
    </group>
  )
}
