// Types du navigateur 3D des emplacements (WMS Explorer).
// Arbre immuable dérivé des collections du store (ou d'une démo), consommé
// par le layout et les vues. Chaque nœud garde l'id d'origine pour naviguer.

export type PosStatus = 'empty' | 'ok' | 'low' | 'out' | 'reserved' | 'off'

/** Couleurs d'état des positions (cahier des charges). */
export const STATUS_COLOR: Record<PosStatus, string> = {
  empty: '#3b82f6',    // bleu — emplacement vide
  ok: '#10b981',       // vert — stock normal
  low: '#f59e0b',      // orange — stock faible
  out: '#ef4444',      // rouge — rupture
  reserved: '#a855f7', // violet — produit réservé
  off: '#6b7280',      // gris — emplacement désactivé
}

export interface PosNode {
  id: string
  code: string
  /** Code d'emplacement complet (MAG01-DEP01-B-01-R01-E01-N01-P001). */
  full: string
  status: PosStatus
  productId?: string
  productName?: string
  barcode?: string
  stock: number
  minStock: number
}

export interface NiveauNode { id: string; code: string; positions: PosNode[] }
export interface EtagereNode { id: string; code: string; niveaux: NiveauNode[] }
export interface RayonNode { id: string; code: string; name?: string; etageres: EtagereNode[] }
export interface AlleeNode { id: string; code: string; name?: string; rayons: RayonNode[] }
export interface ZoneNode { id: string; code: string; name?: string; color: string; allees: AlleeNode[] }

export interface WmsTree {
  zones: ZoneNode[]
  /** Vrai si structure de démonstration (magasin sans emplacements). */
  demo: boolean
  /** Index plat des positions pour la recherche. */
  flat: FlatPos[]
}

/** Position aplatie : chemin complet d'ids + nœud. */
export interface FlatPos {
  zone: string; allee: string; rayon: string; etagere: string; niveau: string
  node: PosNode
}

/** Sélection courante (chemin). Le niveau affiché = profondeur du chemin. */
export interface Sel {
  zone?: string
  allee?: string
  rayon?: string
  etagere?: string
  niveau?: string
}

export type Level = 'zones' | 'allees' | 'rayons' | 'etageres' | 'niveaux'

/** Niveau d'affichage déduit de la sélection. */
export function levelOf(sel: Sel): Level {
  if (sel.etagere) return 'niveaux'
  if (sel.rayon) return 'etageres'
  if (sel.allee) return 'rayons'
  if (sel.zone) return 'allees'
  return 'zones'
}

/** Couleur déterministe d'une zone par index (teintes bien séparées). */
export function zoneColor(i: number): string {
  return `hsl(${(i * 47 + 18) % 360}, 68%, 55%)`
}

/** Couleur d'un rayon par index (réutilise la roue, décalée). */
export function rayonColor(i: number): string {
  return `hsl(${(i * 63 + 200) % 360}, 60%, 58%)`
}
