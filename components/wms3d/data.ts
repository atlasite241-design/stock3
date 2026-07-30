'use client'

// Construction de l'arbre WMS pour l'explorateur 3D.
// Données réelles du magasin actif (zones → positions + produits affectés) ;
// si le magasin n'a aucune position, une structure de démonstration est
// générée pour montrer le rendu (badge « démo » affiché).

import { useMemo } from 'react'
import { availableStock, buildEmplacementCode, depotShortCode, storeShortCode, useDroguerie, type Product } from '@/lib/store'
import { type FlatPos, type PosNode, type PosStatus, type WmsTree, zoneColor } from './types'

function statusOf(p: Product | undefined, disabled: boolean, reserved: boolean): PosStatus {
  if (disabled) return 'off'
  if (!p) return 'empty'
  if (reserved) return 'reserved'
  const s = availableStock(p)
  if (s <= 0) return 'out'
  if (s <= (p.minStock ?? 0)) return 'low'
  return 'ok'
}

/** Arbre issu des collections réelles du magasin actif. */
function buildRealTree(d: ReturnType<typeof useDroguerie>): WmsTree {
  const sid = d.activeStoreId
  const zs = d.zones.filter((z) => z.storeId === sid && (z.active ?? true)).sort((a, b) => a.code.localeCompare(b.code, 'fr'))
  const byZone = new Map<string, typeof d.allees>()
  for (const a of d.allees) { if (a.storeId !== sid) continue; const l = byZone.get(a.zoneId) ?? []; l.push(a); byZone.set(a.zoneId, l) }
  const byAllee = new Map<string, typeof d.rayons>()
  for (const r of d.rayons) { if (r.storeId !== sid) continue; const l = byAllee.get(r.alleeId) ?? []; l.push(r); byAllee.set(r.alleeId, l) }
  const byRayon = new Map<string, typeof d.etageres>()
  for (const e of d.etageres) { if (e.storeId !== sid) continue; const l = byRayon.get(e.rayonId) ?? []; l.push(e); byRayon.set(e.rayonId, l) }
  const byEtagere = new Map<string, typeof d.niveaux>()
  for (const n of d.niveaux) { if (n.storeId !== sid) continue; const l = byEtagere.get(n.etagereId) ?? []; l.push(n); byEtagere.set(n.etagereId, l) }
  const byNiveau = new Map<string, typeof d.positions>()
  for (const p of d.positions) { if (p.storeId !== sid) continue; const l = byNiveau.get(p.niveauId) ?? []; l.push(p); byNiveau.set(p.niveauId, l) }

  // Produit affecté par position (premier trouvé ; les produits portent positionId).
  const prodByPos = new Map<string, Product>()
  for (const p of d.products) {
    if (sid && p.storeId && p.storeId !== sid) continue
    if (p.positionId && !prodByPos.has(p.positionId)) prodByPos.set(p.positionId, p)
  }

  const storeCode = storeShortCode(Math.max(0, d.stores.findIndex((s) => s.id === sid)))
  const storeDepots = d.depots.filter((x) => x.storeId === sid)

  const flat: FlatPos[] = []
  const sortC = <T extends { code: string }>(l: T[] | undefined) => (l ?? []).slice().sort((a, b) => a.code.localeCompare(b.code, 'fr'))

  const zones = zs.map((z, zi) => {
    const dep = (z.depotId && storeDepots.find((x) => x.id === z.depotId)) || storeDepots[0]
    const depCode = dep?.code || depotShortCode(Math.max(0, storeDepots.findIndex((x) => x.id === dep?.id)))
    return {
      id: z.id, code: z.code, name: z.name, color: zoneColor(zi),
      allees: sortC(byZone.get(z.id)).map((a) => ({
        id: a.id, code: a.code, name: a.name,
        rayons: sortC(byAllee.get(a.id)).map((r) => ({
          id: r.id, code: r.code, name: (r as { name?: string }).name,
          etageres: sortC(byRayon.get(r.id)).map((e) => ({
            id: e.id, code: e.code,
            niveaux: sortC(byEtagere.get(e.id)).map((n) => ({
              id: n.id, code: n.code,
              positions: sortC(byNiveau.get(n.id)).map((po) => {
                const prod = prodByPos.get(po.id)
                const node: PosNode = {
                  id: po.id, code: po.code,
                  full: prod?.emplacementComplet || buildEmplacementCode({ storeCode, depot: depCode, zone: z.code, allee: a.code, rayon: r.code, etagere: e.code, niveau: n.code, position: po.code }),
                  status: statusOf(prod, false, false),
                  productId: prod?.id, productName: prod?.name, barcode: prod?.barcode,
                  stock: prod ? availableStock(prod) : 0, minStock: prod?.minStock ?? 0,
                }
                flat.push({ zone: z.id, allee: a.id, rayon: r.id, etagere: e.id, niveau: n.id, node })
                return node
              }),
            })),
          })),
        })),
      })),
    }
  })
  return { zones, demo: false, flat }
}

/** Structure de démonstration (3 zones × 3 allées × 4 rayons × 3 étagères × 4 niveaux × 12 positions). */
function buildDemoTree(): WmsTree {
  const PRODUCTS = [
    'Peinture Satin Blanc 5L', 'Diluant universel 1L', 'Enduit de rebouchage', 'Rouleau anti-goutte 180 mm',
    'Vis agglo 4×40 (boîte 200)', 'Cheville nylon 8 mm', 'Colle PVC 250 ml', 'Ruban téflon 12 m',
    'Ampoule LED E27 9W', 'Câble H07V-U 2,5 mm²', 'Interrupteur va-et-vient', 'Multiprise 5 ports',
    'Javel 5 L', 'Savon noir 1 L', 'Gants ménagers T9', 'Éponge double face ×6',
  ]
  const ZONES = [
    { code: 'B', name: 'Peinture & Droguerie' },
    { code: 'E', name: 'Électricité' },
    { code: 'J', name: 'Entretien & Nettoyage' },
  ]
  // Générateur pseudo-aléatoire déterministe (le rendu ne doit pas changer à chaque frame).
  let seed = 7
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  const flat: FlatPos[] = []
  const zones = ZONES.map((z, zi) => ({
    id: `dz${zi}`, code: z.code, name: z.name, color: zoneColor(zi),
    allees: Array.from({ length: 3 }, (_, ai) => ({
      id: `dz${zi}a${ai}`, code: String(ai + 1).padStart(2, '0'), name: undefined as string | undefined,
      rayons: Array.from({ length: 4 }, (_, ri) => ({
        id: `dz${zi}a${ai}r${ri}`, code: String(ri + 1).padStart(2, '0'), name: undefined as string | undefined,
        etageres: Array.from({ length: 3 }, (_, ei) => ({
          id: `dz${zi}a${ai}r${ri}e${ei}`, code: `E${String(ei + 1).padStart(2, '0')}`,
          niveaux: Array.from({ length: 4 }, (_, ni) => ({
            id: `dz${zi}a${ai}r${ri}e${ei}n${ni}`, code: `N${String(ni + 1).padStart(2, '0')}`,
            positions: Array.from({ length: 12 }, (_, pi) => {
              const roll = rnd()
              const hasProd = roll > 0.32
              const stock = hasProd ? Math.floor(rnd() * 40) : 0
              const min = 5
              const status: PosStatus = !hasProd ? 'empty'
                : roll > 0.96 ? 'off' : roll > 0.9 ? 'reserved'
                : stock <= 0 ? 'out' : stock <= min ? 'low' : 'ok'
              const node: PosNode = {
                id: `dz${zi}a${ai}r${ri}e${ei}n${ni}p${pi}`,
                code: `P${String(pi + 1).padStart(3, '0')}`,
                full: `MAG01-DEP01-${z.code}-${String(ai + 1).padStart(2, '0')}-R${String(ri + 1).padStart(2, '0')}-E${String(ei + 1).padStart(2, '0')}-N${String(ni + 1).padStart(2, '0')}-P${String(pi + 1).padStart(3, '0')}`,
                status,
                productName: hasProd && status !== 'off' ? PRODUCTS[Math.floor(rnd() * PRODUCTS.length)] : undefined,
                barcode: hasProd ? `611${String(Math.floor(rnd() * 1e10)).padStart(10, '0')}` : undefined,
                stock, minStock: min,
              }
              const zid = `dz${zi}`, aid = `dz${zi}a${ai}`, rid = `dz${zi}a${ai}r${ri}`, eid = `dz${zi}a${ai}r${ri}e${ei}`, nid = `dz${zi}a${ai}r${ri}e${ei}n${ni}`
              flat.push({ zone: zid, allee: aid, rayon: rid, etagere: eid, niveau: nid, node })
              return node
            }),
          })),
        })),
      })),
    })),
  }))
  return { zones, demo: true, flat }
}

/** Arbre WMS (réel, sinon démo) mémoïsé. */
export function useWmsTree(): WmsTree {
  const d = useDroguerie()
  return useMemo(() => {
    const hasStructure = d.positions.some((p) => p.storeId === d.activeStoreId)
    const real = hasStructure ? buildRealTree(d) : null
    if (real && real.flat.length > 0) return real
    return buildDemoTree()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.ready, d.activeStoreId, d.zones, d.allees, d.rayons, d.etageres, d.niveaux, d.positions, d.products, d.depots, d.stores])
}

/** Recherche d'un emplacement par code (complet ou suffixe). */
export function findByCode(tree: WmsTree, query: string): FlatPos | null {
  const q = query.trim().toUpperCase().replace(/\s+/g, '')
  if (!q) return null
  const exact = tree.flat.find((f) => f.node.full.toUpperCase() === q)
  if (exact) return exact
  const suffix = tree.flat.find((f) => f.node.full.toUpperCase().endsWith(q))
  if (suffix) return suffix
  return tree.flat.find((f) => f.node.full.toUpperCase().includes(q)) ?? null
}
