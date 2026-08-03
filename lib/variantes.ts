'use client'

/**
 * Détection des familles de déclinaisons.
 *
 * Hypothèse à vérifier : une part du catalogue n'est pas constituée de produits
 * différents, mais de TAILLES d'un même produit, saisies comme des fiches
 * indépendantes. « Vis à bois TF Pozi inox 4x40 » et « … 5x60 » sont un seul
 * modèle en deux déclinaisons.
 *
 * La méthode : retirer de la désignation tout ce qui ressemble à une dimension.
 * Ce qui reste est la clé du modèle ; ce qui a été retiré est la déclinaison.
 *
 * C'est une HEURISTIQUE sur du texte libre. Elle propose des regroupements,
 * elle ne les décide pas — d'où le niveau de confiance sur chaque famille.
 */

import type { Product } from './store'

/**
 * Motifs de dimension. L'ordre est significatif :
 *  — « M8x60 » doit être lu comme un filetage avant que « 8x60 » ne soit lu
 *    comme une paire de dimensions, sinon le « m » reste collé au modèle ;
 *  — « 4x40 » doit être capté entier avant que « 40 » ne le soit seul.
 *
 * Aucun motif ne se termine par `\b` : « ² », « ° » et « " » ne sont pas des
 * caractères de mot, une frontière de mot après eux échoue toujours. C'est ce
 * qui tronquait « 2.5mm² » en « 2.5mm ».
 */
const PATTERNS: { re: RegExp; kind: string }[] = [
  // M8, M10x1.5, M8x60 — filetage métrique
  { re: /\bm\s?\d+(?:\.\d+)?(?:\s*[x×*]\s*\d+(?:\.\d+)?)?(?![a-z0-9])/gi, kind: 'filetage' },
  // 4x40, 4 × 40, 40x40x4, 3.5x30mm
  { re: /\b\d+(?:\.\d+)?\s*[x×*]\s*\d+(?:\.\d+)?(?:\s*[x×*]\s*\d+(?:\.\d+)?)?\s*(?:mm|cm)?(?![a-z0-9])/gi, kind: 'dimensions' },
  // Ø25, Ø 4.5 mm
  { re: /[øφ]\s*\d+(?:\.\d+)?\s*(?:mm|cm)?(?![a-z0-9])/gi, kind: 'diametre' },
  // 1/2", 3/4 pouce
  { re: /\b\d+\/\d+\s*(?:"|''|pouces?|po)?/gi, kind: 'pouces' },
  // 2.5mm², 16A, 5L, 500g, 60W, 12V, 30mA, 3m
  { re: /\b\d+(?:\.\d+)?\s*(?:mm²|mm2|cm²|cm2|m²|m2|mm|cm|dm|ml|cl|kg|mg|ah|va|ma|[lgwvak]|m)(?![a-z0-9²³])/gi, kind: 'mesure' },
  // 12°, 30 %
  { re: /\b\d+(?:\.\d+)?\s*[°%](?![a-z0-9])/gi, kind: 'degre' },
  // T9, taille 42
  { re: /\b(?:t|taille|pointure)\s*\d{1,2}(?![a-z0-9])/gi, kind: 'taille' },
]

/**
 * Normalisation AVANT extraction. Elle doit préserver tout ce dont les motifs
 * ont besoin — Ø, ², °, /, " — et ramener la virgule décimale au point, sinon
 * « 3,5x30 » se coupe en « 3 » et « 5x30 ».
 */
const clean = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/,(?=\s?\d)/g, '.')
    .replace(/[^a-z0-9øφ²³°%/."'×x*+\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export interface Split {
  /** Désignation privée de ses dimensions — la clé de regroupement. */
  modele: string
  /** Les dimensions retirées, dans l'ordre où elles apparaissaient. */
  declinaison: string
  /** Natures des dimensions trouvées (dimensions, filetage, mesure…). */
  kinds: string[]
}

/** Sépare une désignation en « modèle » et « déclinaison ». */
export function splitDesignation(name: string): Split {
  let rest = ` ${clean(name)} `
  const found: { text: string; kind: string; at: number }[] = []

  for (const { re, kind } of PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    const hits: { text: string; at: number }[] = []
    while ((m = re.exec(rest)) !== null) {
      hits.push({ text: m[0].trim(), at: m.index })
      if (m.index === re.lastIndex) re.lastIndex++ // motif vide : évite la boucle infinie
    }
    for (const h of hits) found.push({ ...h, kind })
    // Le retrait se fait après la collecte du motif entier, sinon le motif
    // suivant capterait les fragments du précédent (« 40 » dans « 4x40 »).
    if (hits.length) rest = rest.replace(re, ' ')
  }

  // La clé du modèle ne garde que lettres, chiffres et tirets : les « ² » et
  // « " » orphelins laissés par une extraction empêcheraient deux fiches
  // identiques de se rejoindre.
  const modele = rest
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s-]+|[\s\-+]+$/g, '')
    .trim()
  const declinaison = found
    .sort((a, b) => a.at - b.at)
    .map((f) => f.text)
    .join(' ')

  return { modele, declinaison, kinds: [...new Set(found.map((f) => f.kind))] }
}

export type Confiance = 'haute' | 'moyenne' | 'a_verifier'

export interface Famille {
  id: string
  /** Clé de regroupement : modèle + catégorie + marque. */
  modele: string
  categorie: string
  marque: string
  membres: { id: string; name: string; declinaison: string; stock: number }[]
  kinds: string[]
  confiance: Confiance
  /** Deux fiches portant la même déclinaison : doublon probable, pas déclinaison. */
  collisions: number
}

export interface Analyse {
  familles: Famille[]
  /** Fiches qui restent seules — de vrais produits distincts. */
  isolees: number
  total: number
  /** Fiches appartenant à une famille de 2 membres ou plus. */
  regroupables: number
  /** Taille du catalogue après repli : familles + fiches isolées. */
  catalogueReplie: number
  parKind: { kind: string; familles: number; fiches: number }[]
}

/**
 * Regroupe le catalogue. `minMembres` évite de compter comme « famille » deux
 * fiches qui se ressemblent par hasard.
 */
export function analyserDeclinaisons(products: Product[], minMembres = 2): Analyse {
  const groups = new Map<string, Famille>()
  let isolees = 0

  for (const p of products) {
    const s = splitDesignation(p.name)

    // Sans dimension détectée, ou avec un reste trop court pour être un nom de
    // produit (« vis », « x »), on ne regroupe pas : le risque de faux
    // rapprochement dépasse le gain.
    if (!s.declinaison || s.modele.length < 4) {
      isolees++
      continue
    }

    const cat = (p.category ?? '').trim()
    const marque = (p.brand ?? '').trim()
    const key = `${s.modele}|${cat}|${marque}`
    const g = groups.get(key)
    const membre = { id: p.id, name: p.name, declinaison: s.declinaison, stock: p.stock ?? 0 }

    if (g) {
      g.membres.push(membre)
      for (const k of s.kinds) if (!g.kinds.includes(k)) g.kinds.push(k)
    } else {
      groups.set(key, {
        id: key,
        modele: s.modele,
        categorie: cat,
        marque,
        membres: [membre],
        kinds: [...s.kinds],
        confiance: 'haute',
        collisions: 0,
      })
    }
  }

  const familles: Famille[] = []
  for (const g of groups.values()) {
    if (g.membres.length < minMembres) {
      isolees += g.membres.length
      continue
    }
    // Deux membres avec la même déclinaison ne sont pas deux tailles : c'est un
    // doublon. Le signaler plutôt que de le fondre dans la famille.
    const vues = new Set<string>()
    for (const m of g.membres) {
      if (vues.has(m.declinaison)) g.collisions++
      vues.add(m.declinaison)
    }
    g.confiance =
      g.collisions > 0 ? 'a_verifier'
      : !g.categorie || !g.marque ? 'moyenne'
      : 'haute'
    familles.push(g)
  }

  familles.sort((a, b) => b.membres.length - a.membres.length)

  const regroupables = familles.reduce((a, f) => a + f.membres.length, 0)
  const byKind = new Map<string, { familles: number; fiches: number }>()
  for (const f of familles) {
    for (const k of f.kinds) {
      const e = byKind.get(k) ?? { familles: 0, fiches: 0 }
      e.familles++
      e.fiches += f.membres.length
      byKind.set(k, e)
    }
  }

  return {
    familles,
    isolees,
    total: products.length,
    regroupables,
    catalogueReplie: familles.length + isolees,
    parKind: [...byKind.entries()]
      .map(([kind, v]) => ({ kind, ...v }))
      .sort((a, b) => b.fiches - a.fiches),
  }
}
