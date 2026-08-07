'use client'

/**
 * Conversion des fiches « lot » en fiches « pièce + conditionnement ».
 *
 * Une fiche nommée « Cheville Ingco 100 pcs » avec 64 en stock à 57,38 DH ne
 * décrit pas 64 chevilles : elle décrit 64 BOÎTES. Telle quelle, on ne peut pas
 * vendre une cheville. La conversion la transforme en 6 400 pièces à 0,5738 DH,
 * plus un conditionnement « Boîte de 100 » au prix de la boîte.
 *
 * L'opération multiplie le stock par 100. Une détection erronée est donc
 * DESTRUCTRICE : tous les motifs exigent un mot-clé explicite, et la
 * proposition se valide ligne par ligne.
 */

import type { Product, SaleUnit } from './store'

/** Mot-clé + nombre. Aucun motif ne repose sur le seul nombre. */
const MOTIFS: { re: RegExp; label: (n: number) => string }[] = [
  // « boîte de 100 », « boite 100 »
  { re: /\bbo[iî]tes?\s*(?:de\s*)?(\d{1,5})\b/i, label: (n) => `Boîte de ${n}` },
  { re: /\bsachets?\s*(?:de\s*)?(\d{1,5})\b/i, label: (n) => `Sachet de ${n}` },
  { re: /\b(?:paquets?|packs?)\s*(?:de\s*)?(\d{1,5})\b/i, label: (n) => `Paquet de ${n}` },
  { re: /\blots?\s*(?:de\s*)?(\d{1,5})\b/i, label: (n) => `Lot de ${n}` },
  { re: /\bcartons?\s*(?:de\s*)?(\d{1,5})\b/i, label: (n) => `Carton de ${n}` },
  { re: /\bblisters?\s*(?:de\s*)?(\d{1,5})\b/i, label: (n) => `Blister de ${n}` },
  { re: /\b(?:jeux?|sets?)\s*(?:de\s*)?(\d{1,5})\b/i, label: (n) => `Jeu de ${n}` },
  // « 100 pcs », « 50 pièces », « 25 u »
  { re: /\b(\d{1,5})\s*(?:pcs?|pi[eè]ces?|pieces?|unit[eé]s?|u)\b/i, label: (n) => `Boîte de ${n}` },
  // « x100 » isolé : le caractère qui précède ne doit PAS être un chiffre,
  // sinon « 4x40 » (une dimension de vis) passerait pour un lot de 40.
  { re: /(?:^|[^\d])x\s?(\d{2,5})\b/i, label: (n) => `Lot de ${n}` },
]

/** Facteur en deçà duquel on ne convertit pas : le gain ne vaut pas le risque. */
const FACTEUR_MIN = 2
const FACTEUR_MAX = 10000

export interface Conversion {
  id: string
  /** Nom actuel, conditionnement compris. */
  nomActuel: string
  /** Nom proposé, conditionnement retiré. */
  nomPropose: string
  /** Libellé du conditionnement créé. */
  conditionnement: string
  facteur: number
  stockAvant: number
  stockApres: number
  coutAvant: number
  coutApres: number
  prixAvant: number
  prixApres: number
  /** Valeur du stock avant et après : doit être identique. */
  valeurAvant: number
  valeurApres: number
}

const round4 = (n: number) => Math.round(n * 10000) / 10000
const round2 = (n: number) => Math.round(n * 100) / 100

/** Détecte un conditionnement dans une désignation. */
export function detecterLot(name: string): { facteur: number; label: string; reste: string } | null {
  for (const m of MOTIFS) {
    const hit = m.re.exec(name)
    if (!hit) continue
    const n = Number(hit[1])
    if (!Number.isFinite(n) || n < FACTEUR_MIN || n > FACTEUR_MAX) continue
    const reste = name
      .replace(m.re, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/[\s,;·\-–]+$/, '')
      .replace(/^[\s,;·\-–]+/, '')
      .trim()
    // Un reste trop court ne serait plus un nom de produit : « 100 pcs » seul
    // deviendrait une fiche sans désignation.
    if (reste.length < 3) continue
    return { facteur: n, label: m.label(n), reste }
  }
  return null
}

/**
 * Construit le plan de conversion. Rien n'est modifié ici : la fonction
 * propose, l'écran fait valider, et seule l'application écrit.
 */
export function planifierConversions(products: Product[]): Conversion[] {
  const out: Conversion[] = []
  for (const p of products) {
    // Une fiche qui a déjà des conditionnements a été traitée : ne pas
    // multiplier son stock une seconde fois.
    if (p.saleUnits && p.saleUnits.length > 0) continue
    const d = detecterLot(p.name)
    if (!d) continue

    const stockApres = round4(p.stock * d.facteur)
    // Le coût garde quatre décimales : arrondir 57,38 ÷ 100 à 0,57 ferait
    // perdre 24 DH de valeur sur 64 boîtes.
    const coutApres = round4(p.cost / d.facteur)
    const prixApres = round2(p.price / d.facteur)

    out.push({
      id: p.id,
      nomActuel: p.name,
      nomPropose: d.reste,
      conditionnement: d.label,
      facteur: d.facteur,
      stockAvant: p.stock,
      stockApres,
      coutAvant: p.cost,
      coutApres,
      prixAvant: p.price,
      prixApres,
      valeurAvant: round2(p.stock * p.cost),
      valeurApres: round2(stockApres * coutApres),
    })
  }
  return out.sort((a, b) => b.valeurAvant - a.valeurAvant)
}

/**
 * Unités qui désignent un CONTENANT. Une fiche tenue dans l'une d'elles sans
 * nombre dans le nom (« Vis à bois Ingco 4×40 », unité « Boîte ») échappe à la
 * détection automatique : le contenu n'est écrit nulle part. Ces fiches sont
 * proposées à la conversion manuelle — l'humain saisit le facteur.
 */
const UNITES_LOT = /^(bo[iî]tes?|cartons?|sachets?|lots?|paquets?|packs?|coffrets?|jeux?|sets?|blisters?)$/i

export function estUniteLot(unit: string): boolean {
  return UNITES_LOT.test((unit || '').trim())
}

/** Fiches en contenant dont le nom ne dit pas le contenu, triées par valeur de
 *  stock décroissante — les plus lourdes d'abord, comme le plan automatique. */
export function candidatsSansFacteur(products: Product[]): Product[] {
  return products
    .filter((p) => (!p.saleUnits || p.saleUnits.length === 0) && estUniteLot(p.unit) && !detecterLot(p.name))
    .sort((a, b) => b.stock * b.cost - a.stock * a.cost)
}

/**
 * Conversion bâtie depuis un facteur saisi à la main — même arithmétique que
 * la détection, mais le nom ne change pas : il n'y a rien à en retirer.
 */
export function conversionManuelle(p: Product, facteur: number): Conversion | null {
  const n = Math.round(facteur)
  if (!Number.isFinite(n) || n < FACTEUR_MIN || n > FACTEUR_MAX) return null

  const contenant = (p.unit || 'Boîte').trim()
  const label = contenant.charAt(0).toUpperCase() + contenant.slice(1).toLowerCase() + ` de ${n}`
  const stockApres = round4(p.stock * n)
  const coutApres = round4(p.cost / n)
  const prixApres = round2(p.price / n)

  return {
    id: p.id,
    nomActuel: p.name,
    nomPropose: p.name,
    conditionnement: label,
    facteur: n,
    stockAvant: p.stock,
    stockApres,
    coutAvant: p.cost,
    coutApres,
    prixAvant: p.price,
    prixApres,
    valeurAvant: round2(p.stock * p.cost),
    valeurApres: round2(stockApres * coutApres),
  }
}

/** Applique une conversion à une fiche. Le code-barres actuel est celui du
 *  conditionnement : il est reporté dessus, et conservé sur la fiche pour que
 *  la recherche par code continue de fonctionner. */
export function appliquer(p: Product, c: Conversion, unitId: string): Product {
  const unit: SaleUnit = {
    id: unitId,
    name: c.conditionnement,
    factor: c.facteur,
    price: c.prixAvant,
    barcode: p.barcode || undefined,
  }
  return {
    ...p,
    name: c.nomPropose,
    stock: c.stockApres,
    cost: c.coutApres,
    price: c.prixApres,
    // Le seuil de réapprovisionnement suit la même échelle, sinon une alerte
    // réglée sur 5 boîtes se déclencherait à 5 pièces.
    minStock: Math.round(p.minStock * c.facteur),
    unit: 'Pièce',
    saleUnits: [unit],
  }
}
