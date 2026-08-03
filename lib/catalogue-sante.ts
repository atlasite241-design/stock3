'use client'

/**
 * État d'exploitabilité du catalogue.
 *
 * « 86 686 fiches incomplètes » est un chiffre paralysant et faux comme
 * indicateur de travail. Une fiche sans emplacement, sans stock et jamais
 * vendue ne coûte rien ; la même fiche sur un article vendu chaque jour bloque
 * le comptoir.
 *
 * Ce module mesure donc chaque critère DEUX FOIS : sur tout le catalogue, et
 * sur les seules fiches qui comptent — celles qui ont du stock ou qui se sont
 * vendues. C'est cette seconde colonne qui donne la charge de travail réelle.
 */

import type { Product, Sale } from './store'

export type CritereId =
  | 'prix_vente' | 'prix_achat' | 'marge' | 'code_barres'
  | 'emplacement' | 'categorie' | 'seuil' | 'stock_sain'

export interface Critere {
  id: CritereId
  /** Bloque la vente au comptoir, ou seulement le pilotage ? */
  gravite: 'bloquant' | 'important' | 'confort'
  /** La fiche satisfait-elle le critère ? */
  ok: (p: Product) => boolean
}

export const CRITERES: Critere[] = [
  // Sans prix de vente, l'article ne peut littéralement pas être encaissé.
  { id: 'prix_vente', gravite: 'bloquant', ok: (p) => p.price > 0 },
  // Sans prix d'achat, toute marge affichée est fausse.
  { id: 'prix_achat', gravite: 'bloquant', ok: (p) => p.cost > 0 },
  // Vendre sous le prix d'achat : perte à chaque passage en caisse.
  { id: 'marge', gravite: 'bloquant', ok: (p) => p.cost <= 0 || p.price > p.cost },
  { id: 'code_barres', gravite: 'important', ok: (p) => !!(p.barcode || '').trim() },
  { id: 'emplacement', gravite: 'important', ok: (p) => !!(p.emplacementComplet || '').trim() },
  { id: 'categorie', gravite: 'important', ok: (p) => !!(p.category || '').trim() },
  // Sans seuil, aucune alerte de réapprovisionnement ne se déclenchera jamais.
  { id: 'seuil', gravite: 'confort', ok: (p) => p.minStock > 0 },
  { id: 'stock_sain', gravite: 'important', ok: (p) => p.stock >= 0 },
]

export interface Mesure {
  id: CritereId
  gravite: Critere['gravite']
  /** Fiches en défaut, sur tout le catalogue. */
  manquantTotal: number
  /** Fiches en défaut parmi celles qui comptent — la charge de travail réelle. */
  manquantActif: number
  /** Valeur de stock immobilisée derrière ce défaut. */
  valeurConcernee: number
}

export interface EtatCatalogue {
  total: number
  /** Fiches avec du stock ou au moins une vente sur la période observée. */
  actifs: number
  /**
   * Ventilation de `actifs`. Un catalogue importé pose souvent une quantité par
   * défaut sur tout : « stock > 0 » cesse alors de signifier « article réel ».
   * Seul le nombre de fiches VENDUES est à l'abri de cet artefact.
   */
  vendues: number
  stockSeul: number
  dormants: number
  mesures: Mesure[]
  /** Part des fiches ACTIVES sans aucun défaut bloquant. */
  scoreComptoir: number
  /** Part des fiches actives sans aucun défaut, toutes gravités confondues. */
  scoreComplet: number
  /** Fiches actives à corriger en priorité, les plus vendues d'abord. */
  chantier: {
    id: string
    name: string
    ventes: number
    valeur: number
    manques: CritereId[]
  }[]
}

/**
 * @param jours Fenêtre d'observation des ventes. 180 jours : au-delà, un article
 *              non vendu relève du déstockage, pas de la mise en ordre.
 */
export function etatCatalogue(products: Product[], sales: Sale[], jours = 180): EtatCatalogue {
  const depuis = Date.now() - jours * 86400000
  const ventesParProduit = new Map<string, number>()

  for (const s of sales) {
    if (new Date(s.date).getTime() < depuis) continue
    for (const it of s.items ?? []) {
      if (!it.productId) continue
      ventesParProduit.set(it.productId, (ventesParProduit.get(it.productId) ?? 0) + (Number(it.qty) || 0))
    }
  }

  const compteurs = new Map<CritereId, { total: number; actif: number; valeur: number }>()
  for (const c of CRITERES) compteurs.set(c.id, { total: 0, actif: 0, valeur: 0 })

  let actifs = 0
  let vendues = 0
  let stockSeul = 0
  let sansDefautBloquant = 0
  let sansAucunDefaut = 0
  const chantier: EtatCatalogue['chantier'] = []

  for (const p of products) {
    const ventes = ventesParProduit.get(p.id) ?? 0
    // « Compte » = il y a du stock dessus, ou il s'est vendu. Le reste est
    // du catalogue mort : le corriger ne rapporte rien aujourd'hui.
    const compte = p.stock > 0 || ventes > 0
    if (compte) {
      actifs++
      if (ventes > 0) vendues++
      else stockSeul++
    }

    const manques: CritereId[] = []
    for (const c of CRITERES) {
      if (c.ok(p)) continue
      manques.push(c.id)
      const e = compteurs.get(c.id)!
      e.total++
      if (compte) {
        e.actif++
        e.valeur += Math.max(0, p.stock) * p.cost
      }
    }

    if (compte) {
      const bloquants = manques.filter((m) => CRITERES.find((c) => c.id === m)!.gravite === 'bloquant')
      if (bloquants.length === 0) sansDefautBloquant++
      if (manques.length === 0) sansAucunDefaut++
      if (manques.length > 0) {
        chantier.push({
          id: p.id,
          name: p.name,
          ventes,
          valeur: Math.max(0, p.stock) * p.cost,
          manques,
        })
      }
    }
  }

  // Priorité : ce qui se vend le plus, puis ce qui immobilise le plus.
  chantier.sort((a, b) => b.ventes - a.ventes || b.valeur - a.valeur)

  return {
    total: products.length,
    actifs,
    vendues,
    stockSeul,
    dormants: products.length - actifs,
    mesures: CRITERES.map((c) => {
      const e = compteurs.get(c.id)!
      return {
        id: c.id,
        gravite: c.gravite,
        manquantTotal: e.total,
        manquantActif: e.actif,
        valeurConcernee: e.valeur,
      }
    }).sort((a, b) => b.manquantActif - a.manquantActif),
    scoreComptoir: actifs ? Math.round((sansDefautBloquant / actifs) * 100) : 100,
    scoreComplet: actifs ? Math.round((sansAucunDefaut / actifs) * 100) : 100,
    chantier,
  }
}
