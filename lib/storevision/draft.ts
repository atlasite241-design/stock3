// Brouillon de structure : construction depuis l'analyse, mutations de
// l'éditeur, totaux et conversion vers l'arbre de l'explorateur 3D.
//
// Toutes les fonctions sont PURES (elles renvoient un nouveau brouillon), ce qui
// rend l'éditeur prévisible et permettrait d'ajouter annuler/refaire sans
// toucher au reste.

import type { DetectedRack, DraftAllee, DraftRayon, DraftTotals, DraftZone, StructureDraft, VisionAnalysis } from './types'
import type { WmsTree, ZoneNode } from '@/components/wms3d/types'
import { zoneColor } from '@/components/wms3d/types'

let seq = 0
const nid = (p: string) => `${p}${(++seq).toString(36)}${Math.floor(performance.now() % 1000).toString(36)}`
const p2 = (n: number) => String(n).padStart(2, '0')
const p3 = (n: number) => String(n).padStart(3, '0')

/* --------------------------- Dimensionnement ----------------------------- */

/**
 * Traduit les dimensions estimées d'un rayonnage en comptes de sous-éléments.
 * Hypothèses métier (droguerie) :
 *   - une travée (étagère) mesure ~1,00 m de large ;
 *   - un niveau utile fait ~40 cm de haut (95 cm sur un palettier) ;
 *   - une position occupe ~25 cm de linéaire.
 * Le nombre de tablettes réellement visibles prime sur le calcul théorique
 * quand il est cohérent : c'est une mesure, pas une estimation.
 */
export function sizeRack(rack: Pick<DetectedRack, 'widthM' | 'heightM' | 'visibleShelves' | 'kind'>): {
  etageres: number; niveaux: number; positions: number
} {
  const heavy = rack.kind === 'heavyRack'
  const bayW = heavy ? 2.7 : 1.0
  const levelH = heavy ? 0.95 : 0.4
  const slotW = heavy ? 0.8 : 0.25

  const etageres = Math.max(1, Math.min(12, Math.round(rack.widthM / bayW)))
  const theoretical = Math.max(1, Math.round(rack.heightM / levelH))
  // On retient la mesure si elle reste dans une fourchette crédible.
  const niveaux = Math.max(1, Math.min(10, rack.visibleShelves > 0 && Math.abs(rack.visibleShelves - theoretical) <= 3 ? rack.visibleShelves : theoretical))
  const positions = Math.max(1, Math.min(40, Math.round(bayW / slotW)))
  return { etageres, niveaux, positions }
}

/* ------------------------- Construction initiale ------------------------- */

/** Construit le brouillon proposé à partir d'une analyse d'images. */
export function draftFromAnalysis(analysis: VisionAnalysis, storeName: string): StructureDraft {
  const byId = new Map(analysis.racks.map((r) => [r.id, r]))

  // Un secteur → une zone. Les rayonnages d'un secteur sont répartis en allées
  // par bande horizontale (leur position Y) : deux racks sur la même rangée
  // appartiennent à la même allée.
  const usedCodes = new Set<string>()
  const zones: DraftZone[] = []

  for (const sector of analysis.sectors) {
    const racks = sector.rackIds.map((id) => byId.get(id)).filter((r): r is DetectedRack => !!r)
    if (racks.length === 0) continue

    // Code de zone unique (B, B2, B3… si le secteur revient sur une autre photo).
    let code = sector.suggestedCode
    let n = 2
    while (usedCodes.has(code)) code = `${sector.suggestedCode}${n++}`
    usedCodes.add(code)

    // Regroupement en allées : on trie par Y puis on coupe dès que l'écart
    // vertical dépasse la demi-hauteur d'un rack (nouvelle rangée).
    const sorted = [...racks].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
    const bands: DetectedRack[][] = []
    for (const r of sorted) {
      const last = bands[bands.length - 1]
      const ref = last?.[0]
      if (ref && Math.abs(r.box.y - ref.box.y) <= Math.max(0.02, ref.box.h * 0.6)) last.push(r)
      else bands.push([r])
    }

    const allees: DraftAllee[] = bands.map((band, ai) => ({
      id: nid('a'),
      code: p2(ai + 1),
      name: undefined,
      rayons: [...band]
        .sort((a, b) => a.box.x - b.box.x)
        .map((rack, ri) => {
          const s = sizeRack(rack)
          return { id: nid('r'), code: 'R' + p2(ri + 1), etageres: s.etageres, niveaux: s.niveaux, positions: s.positions, rackId: rack.id } satisfies DraftRayon
        }),
    }))

    zones.push({ id: nid('z'), code, name: sector.suggestedName, type: sector.type, allees, sectorId: sector.id })
  }

  return {
    zones,
    storeName,
    source: { engine: analysis.engine.id, simulated: analysis.engine.simulated, imageCount: analysis.images.length },
  }
}

/* ------------------------------- Totaux ---------------------------------- */

export function computeTotals(draft: StructureDraft): DraftTotals {
  let allees = 0, rayons = 0, etageres = 0, niveaux = 0, positions = 0
  for (const z of draft.zones) {
    allees += z.allees.length
    for (const a of z.allees) {
      rayons += a.rayons.length
      for (const r of a.rayons) {
        etageres += r.etageres
        niveaux += r.etageres * r.niveaux
        positions += r.etageres * r.niveaux * r.positions
      }
    }
  }
  const zones = draft.zones.length
  return { zones, allees, rayons, etageres, niveaux, positions, total: zones + allees + rayons + etageres + niveaux + positions }
}

/* ------------------------------ Mutations -------------------------------- */

const mapZones = (d: StructureDraft, fn: (z: DraftZone) => DraftZone): StructureDraft => ({ ...d, zones: d.zones.map(fn) })

export function renameZone(d: StructureDraft, zoneId: string, patch: Partial<Pick<DraftZone, 'name' | 'code' | 'type'>>): StructureDraft {
  return mapZones(d, (z) => (z.id === zoneId ? { ...z, ...patch } : z))
}

export function removeZone(d: StructureDraft, zoneId: string): StructureDraft {
  return { ...d, zones: d.zones.filter((z) => z.id !== zoneId) }
}

export function addZone(d: StructureDraft): StructureDraft {
  const used = new Set(d.zones.map((z) => z.code))
  let code = 'A'
  for (let i = 0; i < 26 && used.has(code); i++) code = String.fromCharCode(65 + i)
  if (used.has(code)) code = `Z${d.zones.length + 1}`
  return { ...d, zones: [...d.zones, { id: nid('z'), code, name: '', type: 'commerciale', allees: [] }] }
}

/** Renumérote les allées d'une zone (01, 02, 03…) après ajout/suppression/déplacement. */
const renumberAllees = (allees: DraftAllee[]): DraftAllee[] => allees.map((a, i) => ({ ...a, code: p2(i + 1) }))
/** Renumérote les rayons d'une allée (R01, R02…). */
const renumberRayons = (rayons: DraftRayon[]): DraftRayon[] => rayons.map((r, i) => ({ ...r, code: 'R' + p2(i + 1) }))

export function addAllee(d: StructureDraft, zoneId: string): StructureDraft {
  return mapZones(d, (z) => (z.id !== zoneId ? z : {
    ...z,
    allees: renumberAllees([...z.allees, { id: nid('a'), code: '', rayons: [{ id: nid('r'), code: 'R01', etageres: 4, niveaux: 5, positions: 4 }] }]),
  }))
}

export function removeAllee(d: StructureDraft, zoneId: string, alleeId: string): StructureDraft {
  return mapZones(d, (z) => (z.id !== zoneId ? z : { ...z, allees: renumberAllees(z.allees.filter((a) => a.id !== alleeId)) }))
}

export function renameAllee(d: StructureDraft, zoneId: string, alleeId: string, name: string): StructureDraft {
  return mapZones(d, (z) => (z.id !== zoneId ? z : { ...z, allees: z.allees.map((a) => (a.id === alleeId ? { ...a, name } : a)) }))
}

export function addRayon(d: StructureDraft, zoneId: string, alleeId: string): StructureDraft {
  return mapZones(d, (z) => (z.id !== zoneId ? z : {
    ...z,
    allees: z.allees.map((a) => (a.id !== alleeId ? a : {
      ...a,
      rayons: renumberRayons([...a.rayons, { id: nid('r'), code: '', etageres: 4, niveaux: 5, positions: 4 }]),
    })),
  }))
}

export function removeRayon(d: StructureDraft, zoneId: string, alleeId: string, rayonId: string): StructureDraft {
  return mapZones(d, (z) => (z.id !== zoneId ? z : {
    ...z,
    allees: z.allees.map((a) => (a.id !== alleeId ? a : { ...a, rayons: renumberRayons(a.rayons.filter((r) => r.id !== rayonId)) })),
  }))
}

/** Modifie les compteurs d'un rayon (étagères / niveaux / positions). */
export function setRayonCounts(d: StructureDraft, rayonId: string, patch: Partial<Pick<DraftRayon, 'etageres' | 'niveaux' | 'positions' | 'name'>>): StructureDraft {
  const clamp = (v: unknown, max: number) => Math.max(1, Math.min(max, Math.round(Number(v) || 1)))
  return mapZones(d, (z) => ({
    ...z,
    allees: z.allees.map((a) => ({
      ...a,
      rayons: a.rayons.map((r) => {
        if (r.id !== rayonId) return r
        return {
          ...r,
          name: patch.name !== undefined ? patch.name : r.name,
          etageres: patch.etageres !== undefined ? clamp(patch.etageres, 20) : r.etageres,
          niveaux: patch.niveaux !== undefined ? clamp(patch.niveaux, 12) : r.niveaux,
          positions: patch.positions !== undefined ? clamp(patch.positions, 60) : r.positions,
        }
      }),
    })),
  }))
}

/**
 * Déplace un rayon vers une autre allée (glisser-déposer). `beforeRayonId`
 * permet d'insérer à une position précise ; sinon on ajoute à la fin.
 */
export function moveRayon(
  d: StructureDraft,
  rayonId: string,
  target: { zoneId: string; alleeId: string; beforeRayonId?: string }
): StructureDraft {
  // 1. Extraction du rayon déplacé.
  let moved: DraftRayon | null = null
  const without = d.zones.map((z) => ({
    ...z,
    allees: z.allees.map((a) => {
      if (!a.rayons.some((r) => r.id === rayonId)) return a
      moved = a.rayons.find((r) => r.id === rayonId) ?? null
      return { ...a, rayons: a.rayons.filter((r) => r.id !== rayonId) }
    }),
  }))
  if (!moved) return d

  // 2. Insertion dans l'allée cible, puis renumérotation des deux allées.
  const zones = without.map((z) => {
    if (z.id !== target.zoneId) return { ...z, allees: z.allees.map((a) => ({ ...a, rayons: renumberRayons(a.rayons) })) }
    return {
      ...z,
      allees: z.allees.map((a) => {
        if (a.id !== target.alleeId) return { ...a, rayons: renumberRayons(a.rayons) }
        const idx = target.beforeRayonId ? a.rayons.findIndex((r) => r.id === target.beforeRayonId) : -1
        const next = [...a.rayons]
        next.splice(idx < 0 ? next.length : idx, 0, moved as DraftRayon)
        return { ...a, rayons: renumberRayons(next) }
      }),
    }
  })
  return { ...d, zones }
}

/** Applique un facteur global aux compteurs (curseurs de l'écran de validation). */
export function applyGlobalCounts(d: StructureDraft, counts: { etageres?: number; niveaux?: number; positions?: number }): StructureDraft {
  return mapZones(d, (z) => ({
    ...z,
    allees: z.allees.map((a) => ({
      ...a,
      rayons: a.rayons.map((r) => ({
        ...r,
        etageres: counts.etageres ?? r.etageres,
        niveaux: counts.niveaux ?? r.niveaux,
        positions: counts.positions ?? r.positions,
      })),
    })),
  }))
}

/* ------------------------- Aperçu 3D (WmsTree) --------------------------- */

/**
 * Matérialise le brouillon en arbre pour l'explorateur 3D existant.
 * Les positions sont vides (aucun produit n'est encore affecté) → statut
 * « empty ». On borne le volume pour que l'aperçu reste fluide même sur un
 * brouillon très large.
 */
export function draftToWmsTree(draft: StructureDraft, cap = 60000): WmsTree {
  const flat: WmsTree['flat'] = []
  let count = 0
  let truncated = false

  const zones: ZoneNode[] = draft.zones.map((z, zi) => ({
    id: z.id, code: z.code, name: z.name || z.code, color: zoneColor(zi),
    allees: z.allees.map((a) => ({
      id: a.id, code: a.code, name: a.name,
      rayons: a.rayons.map((r) => ({
        id: r.id, code: r.code, name: r.name,
        etageres: Array.from({ length: r.etageres }, (_, ei) => {
          const eid = `${r.id}e${ei}`
          return {
            id: eid, code: 'E' + p2(ei + 1),
            niveaux: Array.from({ length: r.niveaux }, (_, ni) => {
              const nidv = `${eid}n${ni}`
              return {
                id: nidv, code: 'N' + p2(ni + 1),
                positions: Array.from({ length: r.positions }, (_, pi) => {
                  if (count >= cap) { truncated = true; return null }
                  count++
                  const node = {
                    id: `${nidv}p${pi}`, code: 'P' + p3(pi + 1),
                    full: `${z.code}-${a.code}-${r.code}-E${p2(ei + 1)}-N${p2(ni + 1)}-P${p3(pi + 1)}`,
                    status: 'empty' as const, stock: 0, minStock: 0,
                  }
                  flat.push({ zone: z.id, allee: a.id, rayon: r.id, etagere: eid, niveau: nidv, node })
                  return node
                }).filter((p): p is NonNullable<typeof p> => p !== null),
              }
            }),
          }
        }),
      })),
    })),
  }))

  void truncated
  return { zones, demo: false, flat }
}
