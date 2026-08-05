'use client'

import { recompresserSiLourde } from './image'

/**
 * Récupération du stockage saturé par des images.
 *
 * Les logos et signatures étaient enregistrés en base64 à leur résolution
 * d'origine. Un seul fichier de 5 Mo dans `dp_settings` dépasse à lui seul le
 * plafond de localStorage (~5 Mo pour TOUTE l'origine) : le navigateur refuse
 * alors CHAQUE écriture suivante — réglages, ventes en attente, catalogue
 * rapatrié depuis le serveur. La panne est silencieuse et totale.
 *
 * Compresser les nouveaux envois ne suffit pas : ce qui est déjà stocké occupe
 * la place, et l'écriture qui le remplacerait échoue elle aussi. On répare donc
 * l'existant au démarrage, AVANT toute autre écriture.
 */

/** Au-delà, une image stockée est recompressée. 120 Ko suffisent à un logo. */
const SEUIL_KO = 120

/** Remplace récursivement les data URL trop lourdes. Renvoie le nombre traité. */
async function compacter(valeur: unknown, compte: { n: number }): Promise<unknown> {
  if (typeof valeur === 'string') {
    if (!valeur.startsWith('data:image/') || valeur.length <= SEUIL_KO * 1024) return valeur
    const reduit = await recompresserSiLourde(valeur, SEUIL_KO)
    if (reduit !== valeur) compte.n++
    return reduit
  }
  if (Array.isArray(valeur)) {
    const out = await Promise.all(valeur.map((v) => compacter(v, compte)))
    return out
  }
  if (valeur && typeof valeur === 'object') {
    const src = valeur as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(src)) out[k] = await compacter(src[k], compte)
    return out
  }
  return valeur
}

export interface Compactage {
  /** Images réduites. */
  images: number
  /** Octets rendus à localStorage. */
  octets: number
  /** Clés modifiées, pour le journal. */
  cles: string[]
}

export async function compacterImagesStockees(): Promise<Compactage> {
  const bilan: Compactage = { images: 0, octets: 0, cles: [] }
  if (typeof localStorage === 'undefined' || typeof document === 'undefined') return bilan

  // On ne parcourt que les clés qui contiennent réellement une image et pèsent
  // plus que le seuil : inutile de désérialiser tout le stockage à chaque
  // démarrage. (Le catalogue produits vit dans IndexedDB et n'est pas concerné.)
  const candidates: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k) continue
    const raw = localStorage.getItem(k)
    if (!raw || raw.length <= SEUIL_KO * 1024) continue
    if (!raw.includes('data:image/')) continue
    candidates.push(k)
  }

  for (const k of candidates) {
    const avant = localStorage.getItem(k)
    if (!avant) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(avant)
    } catch {
      continue // pas du JSON : on n'y touche pas
    }
    const compte = { n: 0 }
    const apres = JSON.stringify(await compacter(parsed, compte))
    if (compte.n === 0 || apres.length >= avant.length) continue
    try {
      // Libérer AVANT d'écrire : sur un stockage déjà plein, remplacer une
      // grande valeur par une plus petite peut échouer si le navigateur
      // provisionne la nouvelle avant de rendre l'ancienne.
      localStorage.removeItem(k)
      localStorage.setItem(k, apres)
      bilan.images += compte.n
      bilan.octets += (avant.length - apres.length) * 2 // UTF-16
      bilan.cles.push(k)
    } catch {
      // Échec d'écriture : on remet la valeur d'origine plutôt que de perdre
      // le logo de l'utilisateur.
      try { localStorage.setItem(k, avant) } catch { /* perdu pour perdu */ }
    }
  }
  return bilan
}
