// Assistant « Créer un magasin à partir de photos » — modèle de données.
//
// Deux couches distinctes, volontairement découplées :
//   1. ANALYSE   : ce que la vision par ordinateur voit sur les images
//                  (VisionAnalysis) — indépendant d'AtlasStock.
//   2. BROUILLON : la hiérarchie proposée puis éditée par l'utilisateur
//                  (StructureDraft) — converti en entités AtlasStock au commit.
//
// Cette séparation permet de brancher n'importe quel moteur de vision
// (Gemini Vision, OpenAI Vision, service interne…) sans toucher à l'éditeur,
// à l'aperçu 3D ni au commit.

/* ------------------------------ 1. Analyse ------------------------------- */

/** Catégories d'éléments détectables sur une photo ou un plan. */
export type FeatureKind =
  | 'wall'          // mur / cloison
  | 'entrance'      // entrée
  | 'exit'          // sortie / sortie de secours
  | 'checkout'      // caisse
  | 'rack'          // rayonnage (meuble de vente)
  | 'aisle'         // allée
  | 'circulation'   // espace de circulation
  | 'storage'       // zone de stockage / réserve
  | 'display'       // zone d'exposition
  | 'pallet'        // palette
  | 'heavyRack'     // rack lourd (palettier)

/** Boîte englobante normalisée (0→1) : indépendante de la résolution. */
export interface BBox { x: number; y: number; w: number; h: number }

export interface DetectedFeature {
  id: string
  kind: FeatureKind
  box: BBox
  /** Confiance du modèle, 0→1. */
  confidence: number
  /** Index de l'image source dans la liste importée. */
  imageIndex: number
  /** Libellé libre éventuel renvoyé par le modèle (ex. « rack métallique »). */
  label?: string
}

/**
 * Rayonnage détecté, enrichi des estimations dimensionnelles nécessaires au
 * dimensionnement de la structure (nombre d'étagères, de niveaux…).
 */
export interface DetectedRack extends DetectedFeature {
  kind: 'rack' | 'heavyRack'
  /** Largeur estimée en mètres (déduite de la perspective / du plan). */
  widthM: number
  /** Hauteur estimée en mètres. */
  heightM: number
  /** Nombre de tablettes visibles (comptage des lignes horizontales). */
  visibleShelves: number
  /** Identifiant du secteur de regroupement (voir DetectedSector). */
  sectorId: string
}

/**
 * Secteur = groupe de rayonnages voisins, proposé comme future Zone.
 * Le nom est une suggestion : l'utilisateur peut le renommer.
 */
export interface DetectedSector {
  id: string
  /** Code de zone suggéré (aligné sur les zones par défaut d'AtlasStock). */
  suggestedCode: string
  /** Nom suggéré (ex. « Peinture »). */
  suggestedName: string
  /** Vocation : surface de vente ou réserve. */
  type: 'commerciale' | 'logistique'
  rackIds: string[]
  confidence: number
}

/** Image (ou page de plan) soumise à l'analyse. */
export interface SourceImage {
  id: string
  name: string
  /** Data URL affichable ; absente pour un PDF non rasterisé. */
  dataUrl?: string
  width: number
  height: number
  bytes: number
  kind: 'photo' | 'plan'
  /** Vrai si le fichier n'a pas pu être prévisualisé (PDF). */
  previewUnavailable?: boolean
}

export interface VisionAnalysis {
  images: SourceImage[]
  features: DetectedFeature[]
  racks: DetectedRack[]
  sectors: DetectedSector[]
  /** Identité du moteur ayant produit l'analyse (traçabilité + UI). */
  engine: { id: string; label: string; simulated: boolean }
  /** Durée d'analyse en millisecondes. */
  elapsedMs: number
  /** Avertissements destinés à l'utilisateur (fichier ignoré, doute…). */
  warnings: string[]
}

/* ----------------------------- 2. Brouillon ------------------------------ */

/**
 * Hiérarchie proposée. Les feuilles (étagères → niveaux → positions) ne sont
 * pas matérialisées une par une : on ne stocke que leurs COMPTEURS, pour
 * rester léger à l'édition (un rayon = 3 nombres, pas 500 objets). Les entités
 * réelles sont créées au commit uniquement.
 */
export interface DraftRayon {
  id: string
  code: string
  name?: string
  etageres: number
  niveaux: number
  positions: number
  /** Rayonnage détecté à l'origine de ce rayon (traçabilité). */
  rackId?: string
}

export interface DraftAllee {
  id: string
  code: string
  name?: string
  rayons: DraftRayon[]
}

export interface DraftZone {
  id: string
  code: string
  name: string
  type: 'commerciale' | 'logistique'
  allees: DraftAllee[]
  /** Secteur détecté à l'origine de cette zone. */
  sectorId?: string
}

export interface StructureDraft {
  zones: DraftZone[]
  /** Nom de magasin suggéré (repris de la validation finale). */
  storeName: string
  source: { engine: string; simulated: boolean; imageCount: number }
}

export interface DraftTotals {
  zones: number
  allees: number
  rayons: number
  etageres: number
  niveaux: number
  positions: number
  total: number
}

/* ------------------------- 3. Contrat du moteur -------------------------- */

/**
 * Contrat que doit respecter tout moteur de vision.
 * Implémentations : `MockVisionProvider` (simulé, par défaut) et
 * `RemoteVisionProvider` (appelle /api/vision/analyze — à activer quand une
 * clé Gemini/OpenAI Vision est configurée côté serveur).
 */
export interface VisionProvider {
  readonly id: string
  readonly label: string
  readonly simulated: boolean
  /** Analyse les images et renvoie les éléments détectés. */
  analyze(images: SourceImage[], opts?: AnalyzeOptions): Promise<VisionAnalysis>
}

export interface AnalyzeOptions {
  /** Progression 0→1 avec un libellé d'étape, pour l'UI. */
  onProgress?: (ratio: number, stage: string) => void
  /** Permet d'annuler une analyse longue. */
  signal?: AbortSignal
}

/** Couleurs d'affichage des détections (overlay + légende). */
export const FEATURE_COLOR: Record<FeatureKind, string> = {
  wall: '#94a3b8',
  entrance: '#22c55e',
  exit: '#ef4444',
  checkout: '#f59e0b',
  rack: '#6366f1',
  aisle: '#0ea5e9',
  circulation: '#64748b',
  storage: '#a855f7',
  display: '#ec4899',
  pallet: '#eab308',
  heavyRack: '#8b5cf6',
}

/** Clés i18n des libellés de détection (préfixe sv_f_). */
export const FEATURE_LABEL_KEY: Record<FeatureKind, string> = {
  wall: 'sv_f_wall',
  entrance: 'sv_f_entrance',
  exit: 'sv_f_exit',
  checkout: 'sv_f_checkout',
  rack: 'sv_f_rack',
  aisle: 'sv_f_aisle',
  circulation: 'sv_f_circulation',
  storage: 'sv_f_storage',
  display: 'sv_f_display',
  pallet: 'sv_f_pallet',
  heavyRack: 'sv_f_heavyRack',
}
