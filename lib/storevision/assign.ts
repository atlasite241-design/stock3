// Affectation du catalogue aux emplacements créés.
//
// Principe : chaque CATÉGORIE de produit est appariée à une ZONE (par nom, avec
// tolérance aux accents/pluriels), puis les produits de cette catégorie sont
// répartis dans les positions LIBRES de la zone, en suivant l'ordre physique
// (allée → rayon → étagère → niveau → position) pour que le rangement soit
// cohérent avec le parcours du magasinier.
//
// Tout est pur : on calcule un PLAN, l'écran l'affiche, et seule la validation
// écrit en base. Un plan peut donc être recalculé sans risque.

import type { Product } from '@/lib/store'

/** Normalise pour comparer des libellés : sans accents, minuscules, sans pluriel. */
export function norm(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/s\b/g, '')
}

/**
 * Score de proximité entre deux libellés (0 = rien, 3 = identique).
 * L'inclusion n'est retenue que si les DEUX chaînes font au moins 4 caractères :
 * sinon un code de zone d'une lettre (« E ») serait « contenu » dans presque
 * toute catégorie (« peinturE ») et rattacherait tout à la même zone.
 */
function similarity(a: string, b: string): number {
  const x = norm(a), y = norm(b)
  if (!x || !y) return 0
  if (x === y) return 3
  if (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x))) return 2
  // Mots en commun (≥ 4 lettres) : « Peinture & Droguerie » ≈ « Peinture ».
  const wa = new Set(x.split(' ').filter((w) => w.length >= 4))
  const wb = y.split(' ').filter((w) => w.length >= 4)
  return wb.some((w) => wa.has(w)) ? 1 : 0
}

/** Le code de zone ne vaut correspondance que s'il est STRICTEMENT égal. */
function codeMatch(category: string, code: string): number {
  return norm(category) === norm(code) ? 3 : 0
}

export interface ZoneRef { id: string; code: string; name: string }

/** Emplacement libre, avec son chemin complet (ordre de parcours conservé). */
export interface FreeSlot {
  positionId: string
  zoneId: string
  alleeId: string
  rayonId: string
  etagereId: string
  niveauId: string
  code: string
}

/** Correspondance catégorie → zone, éditable par l'utilisateur. */
export interface Mapping {
  category: string
  productCount: number
  zoneId: string | null
  /** Vrai si la correspondance vient d'une détection automatique fiable. */
  auto: boolean
  score: number
}

export interface AssignPlanRow {
  productId: string
  productName: string
  category: string
  positionId: string
  code: string
}

export interface AssignPlan {
  rows: AssignPlanRow[]
  /** Produits qu'on n'a pas pu placer, avec la raison. */
  unplaced: { productId: string; productName: string; category: string; reason: 'no_zone' | 'no_space' }[]
  /** Positions restées libres par zone. */
  freeLeft: Record<string, number>
}

/** Propose une correspondance catégorie → zone pour chaque catégorie du catalogue. */
export function buildMappings(products: Product[], zones: ZoneRef[]): Mapping[] {
  const counts = new Map<string, number>()
  for (const p of products) {
    const c = (p.category || '').trim()
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, productCount]) => {
      let best: ZoneRef | null = null
      let score = 0
      for (const z of zones) {
        const s = Math.max(similarity(category, z.name), codeMatch(category, z.code))
        if (s > score) { score = s; best = z }
      }
      return { category, productCount, zoneId: score >= 1 ? best!.id : null, auto: score >= 2, score }
    })
}

/**
 * Construit le plan d'affectation.
 * @param strategy 'fill' = un produit par position ; 'spread' = répartit les
 *                 produits sur toute la zone en laissant des trous (réassort).
 */
export function buildPlan(
  products: Product[],
  mappings: Mapping[],
  freeSlots: FreeSlot[],
  strategy: 'fill' | 'spread' = 'fill'
): AssignPlan {
  const zoneOf = new Map(mappings.map((m) => [m.category, m.zoneId]))
  const byZone = new Map<string, FreeSlot[]>()
  for (const s of freeSlots) {
    const l = byZone.get(s.zoneId) ?? []
    l.push(s)
    byZone.set(s.zoneId, l)
  }

  const rows: AssignPlanRow[] = []
  const unplaced: AssignPlan['unplaced'] = []
  const cursor = new Map<string, number>()

  // Produits groupés par catégorie, triés par nom : les articles voisins dans
  // le catalogue se retrouvent voisins dans le rayon.
  const byCat = new Map<string, Product[]>()
  for (const p of products) {
    const c = (p.category || '').trim()
    const l = byCat.get(c) ?? []
    l.push(p)
    byCat.set(c, l)
  }

  for (const [category, list] of byCat) {
    const zoneId = zoneOf.get(category) ?? null
    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    if (!zoneId) {
      for (const p of sorted) unplaced.push({ productId: p.id, productName: p.name, category, reason: 'no_zone' })
      continue
    }
    const slots = byZone.get(zoneId) ?? []
    // En mode « spread », on saute des positions pour laisser de la place.
    const step = strategy === 'spread' && sorted.length > 0
      ? Math.max(1, Math.floor(slots.length / sorted.length))
      : 1

    let i = cursor.get(zoneId) ?? 0
    for (const p of sorted) {
      if (i >= slots.length) {
        unplaced.push({ productId: p.id, productName: p.name, category, reason: 'no_space' })
        continue
      }
      const slot = slots[i]
      rows.push({ productId: p.id, productName: p.name, category, positionId: slot.positionId, code: slot.code })
      i += step
    }
    cursor.set(zoneId, i)
  }

  const freeLeft: Record<string, number> = {}
  for (const [zid, slots] of byZone) freeLeft[zid] = Math.max(0, slots.length - (cursor.get(zid) ?? 0))

  return { rows, unplaced, freeLeft }
}
