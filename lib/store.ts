'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { bootstrapFromRemote, startSync, syncOnSave } from './sync'
import { syncStatus } from './sync-api'
import { getSession } from './auth'
import { compacterImagesStockees } from './storage-repair'
import {
  PRODUCTS_KEY,
  initProductCache,
  productsGetArray,
  productsRemove,
  productsSetArray,
  storageGet,
  storageSet,
} from './pstore'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface Store {
  id: string
  name: string
  code: string
  address: string
  city: string
  phone: string
  email: string
  manager: string
  logoDataUrl: string
  ice: string
  idFiscal: string
  docPrefix: string
  active: boolean
  createdAt: string
}

export interface Depot {
  id: string
  storeId: string
  name: string
  address: string
  responsable: string
  /** Code court (DEP01…) — segment dépôt du code d'emplacement. */
  code?: string
}

// ---- Emplacements de stockage (WMS) : hiérarchie Zone → Allée → Rayon → Étagère
//      → Niveau → Position. Chaque niveau porte un `code` court (A, 02, 03…) et
//      référence son parent. Le code complet d'emplacement est dérivé de la chaîne.
export interface Zone { id: string; storeId: string; depotId?: string; code: string; name: string; type?: 'commerciale' | 'logistique'; active?: boolean; order?: number }

/** Zones créées automatiquement à l'ouverture d'un magasin (commerciales A-N + logistiques O-U). */
export const DEFAULT_ZONES: { code: string; name: string; type: 'commerciale' | 'logistique' }[] = [
  { code: 'A', name: 'Accueil / Point de vente', type: 'commerciale' },
  { code: 'B', name: 'Peinture', type: 'commerciale' },
  { code: 'C', name: 'Outillage manuel', type: 'commerciale' },
  { code: 'D', name: 'Outillage électrique', type: 'commerciale' },
  { code: 'E', name: 'Électricité', type: 'commerciale' },
  { code: 'F', name: 'Plomberie', type: 'commerciale' },
  { code: 'G', name: 'Quincaillerie', type: 'commerciale' },
  { code: 'H', name: 'Colles et silicones', type: 'commerciale' },
  { code: 'I', name: "Produits d'entretien", type: 'commerciale' },
  { code: 'J', name: 'Jardinage', type: 'commerciale' },
  { code: 'K', name: 'Gaz et sécurité', type: 'commerciale' },
  { code: 'L', name: 'Sanitaire', type: 'commerciale' },
  { code: 'M', name: 'Construction', type: 'commerciale' },
  { code: 'N', name: 'Promotions', type: 'commerciale' },
  { code: 'O', name: 'Déstockage', type: 'logistique' },
  { code: 'P', name: 'Retours clients', type: 'logistique' },
  { code: 'Q', name: 'Réception marchandises', type: 'logistique' },
  { code: 'R', name: 'Préparation de commandes', type: 'logistique' },
  { code: 'S', name: 'Réserve', type: 'logistique' },
  { code: 'T', name: 'Produits dangereux', type: 'logistique' },
  { code: 'U', name: 'Produits volumineux', type: 'logistique' },
]

/**
 * Modèle AtlasStock : structure d'allées nommées proposée automatiquement par
 * zone (code d'allée = numéro à 2 chiffres ; la zone reste un segment distinct
 * du code d'emplacement → MAG01-DEP01-B-01-…). Non codé en dur côté produit :
 * l'utilisateur peut tout modifier ensuite.
 */
export const ZONE_ALLEE_TEMPLATES: Record<string, { code: string; name: string }[]> = {
  B: [
    { code: '01', name: 'Peintures intérieures' }, { code: '02', name: 'Peintures extérieures' },
    { code: '03', name: 'Vernis' }, { code: '04', name: 'Lasures' }, { code: '05', name: 'Diluants et solvants' },
    { code: '06', name: 'Enduits et mastics' }, { code: '07', name: 'Sous-couches et primaires' },
    { code: '08', name: 'Colorants et pigments' }, { code: '09', name: 'Pinceaux et brosses' },
    { code: '10', name: 'Rouleaux et accessoires' }, { code: '11', name: 'Rubans de masquage' },
    { code: '12', name: 'Protection chantier' }, { code: '13', name: 'Aérosols' },
    { code: '14', name: 'Produits spécialisés' }, { code: '15', name: 'Promotions peinture' },
  ],
  C: [
    { code: '01', name: 'Marteaux et masses' }, { code: '02', name: 'Tournevis' },
    { code: '03', name: 'Clés et douilles' }, { code: '04', name: 'Pinces' },
    { code: '05', name: 'Scies manuelles' }, { code: '06', name: 'Limes et râpes' },
    { code: '07', name: 'Ciseaux et burins' }, { code: '08', name: 'Mesure et traçage' },
    { code: '09', name: 'Niveaux et règles' }, { code: '10', name: 'Serrage et étaux' },
    { code: '11', name: 'Couteaux et cutters' }, { code: '12', name: 'Boîtes et servantes' },
    { code: '13', name: "Coffrets d'outils" }, { code: '14', name: 'Accessoires atelier' },
    { code: '15', name: 'Promotions Outillage' },
  ],
  E: [
    { code: '01', name: 'Câbles électriques' }, { code: '02', name: 'Gaines et conduits' },
    { code: '03', name: 'Interrupteurs' }, { code: '04', name: 'Prises électriques' },
    { code: '05', name: 'Disjoncteurs et protections' }, { code: '06', name: 'Tableaux électriques' },
    { code: '07', name: 'Éclairage intérieur' }, { code: '08', name: 'Éclairage extérieur' },
    { code: '09', name: 'Rallonges et multiprises' }, { code: '10', name: 'Connecteurs et bornes' },
    { code: '11', name: 'Minuteries et automatismes' }, { code: '12', name: 'Ventilation' },
    { code: '13', name: "Outils d'électricien" }, { code: '14', name: 'Accessoires électriques' },
    { code: '15', name: 'Promotions Électricité' },
  ],
  F: [
    { code: '01', name: 'Tubes PVC' }, { code: '02', name: 'Tubes cuivre' },
    { code: '03', name: 'Tubes PER / multicouche' }, { code: '04', name: 'Raccords et coudes' },
    { code: '05', name: 'Robinetterie' }, { code: '06', name: 'Mitigeurs et douchettes' },
    { code: '07', name: 'Vannes et clapets' }, { code: '08', name: 'Évacuation et siphons' },
    { code: '09', name: 'Chauffe-eau' }, { code: '10', name: 'Sanitaire (WC, lavabos)' },
    { code: '11', name: 'Joints et étanchéité' }, { code: '12', name: 'Colles et téflon' },
    { code: '13', name: 'Pompes et surpresseurs' }, { code: '14', name: 'Outils de plomberie' },
    { code: '15', name: 'Promotions Plomberie' },
  ],
  G: [
    { code: '01', name: 'Vis' }, { code: '02', name: 'Boulons et écrous' },
    { code: '03', name: 'Clous et pointes' }, { code: '04', name: 'Chevilles' },
    { code: '05', name: 'Rondelles' }, { code: '06', name: 'Serrures et cylindres' },
    { code: '07', name: 'Cadenas' }, { code: '08', name: 'Charnières et paumelles' },
    { code: '09', name: 'Poignées et boutons' }, { code: '10', name: 'Équerres et supports' },
    { code: '11', name: 'Chaînes et câbles' }, { code: '12', name: 'Colliers et attaches' },
    { code: '13', name: 'Roulettes et glissières' }, { code: '14', name: 'Quincaillerie de meuble' },
    { code: '15', name: 'Promotions Quincaillerie' },
  ],
  D: [
    { code: '01', name: 'Perceuses et visseuses' }, { code: '02', name: 'Meuleuses' },
    { code: '03', name: 'Scies électriques' }, { code: '04', name: 'Ponceuses' },
    { code: '05', name: 'Rabots et défonceuses' }, { code: '06', name: 'Marteaux-piqueurs' },
    { code: '07', name: 'Découpe et tronçonnage' }, { code: '08', name: 'Batteries et chargeurs' },
    { code: '09', name: 'Forets et embouts' }, { code: '10', name: 'Disques et lames' },
    { code: '11', name: 'Aspirateurs de chantier' }, { code: '12', name: 'Compresseurs' },
    { code: '13', name: 'Soudure et chalumeaux' }, { code: '14', name: 'Accessoires électroportatif' },
    { code: '15', name: 'Promotions Outillage électrique' },
  ],
  H: [
    { code: '01', name: 'Colles universelles' }, { code: '02', name: 'Colles bois' },
    { code: '03', name: 'Colles PVC' }, { code: '04', name: 'Colles néoprène' },
    { code: '05', name: 'Colles époxy' }, { code: '06', name: 'Silicones sanitaire' },
    { code: '07', name: 'Silicones vitrage' }, { code: '08', name: 'Mastics acryliques' },
    { code: '09', name: 'Mastics polyuréthane' }, { code: '10', name: 'Rubans adhésifs' },
    { code: '11', name: 'Rubans double face' }, { code: '12', name: 'Pistolets à colle' },
    { code: '13', name: 'Fixations chimiques' }, { code: '14', name: 'Décapants et solvants' },
    { code: '15', name: 'Promotions Colles' },
  ],
  I: [
    { code: '01', name: 'Détergents sols' }, { code: '02', name: 'Nettoyants multi-usages' },
    { code: '03', name: 'Javel et désinfectants' }, { code: '04', name: 'Produits vitres' },
    { code: '05', name: 'Produits cuisine' }, { code: '06', name: 'Produits sanitaires' },
    { code: '07', name: 'Déboucheurs' }, { code: '08', name: 'Lessives et adoucissants' },
    { code: '09', name: 'Désodorisants' }, { code: '10', name: 'Insecticides' },
    { code: '11', name: 'Éponges et chiffons' }, { code: '12', name: 'Balais et serpillières' },
    { code: '13', name: 'Seaux et accessoires' }, { code: '14', name: 'Gants et protection' },
    { code: '15', name: 'Promotions Entretien' },
  ],
  J: [
    { code: '01', name: 'Outils à main' }, { code: '02', name: 'Bêches et pelles' },
    { code: '03', name: 'Râteaux et binettes' }, { code: '04', name: 'Sécateurs et cisailles' },
    { code: '05', name: 'Arrosage et tuyaux' }, { code: '06', name: 'Arrosoirs et pulvérisateurs' },
    { code: '07', name: 'Graines et semences' }, { code: '08', name: 'Engrais et terreaux' },
    { code: '09', name: 'Pots et jardinières' }, { code: '10', name: 'Traitements phytosanitaires' },
    { code: '11', name: 'Tondeuses et débroussailleuses' }, { code: '12', name: 'Brouettes' },
    { code: '13', name: 'Mobilier de jardin' }, { code: '14', name: 'Protection et gants' },
    { code: '15', name: 'Promotions Jardinage' },
  ],
  K: [
    { code: '01', name: 'Bouteilles de gaz' }, { code: '02', name: 'Détendeurs' },
    { code: '03', name: 'Tuyaux gaz' }, { code: '04', name: 'Raccords gaz' },
    { code: '05', name: 'Réchauds et brûleurs' }, { code: '06', name: 'Chauffages gaz' },
    { code: '07', name: 'Détecteurs de gaz' }, { code: '08', name: 'Détecteurs de fumée' },
    { code: '09', name: 'Extincteurs' }, { code: '10', name: 'Équipements de protection (EPI)' },
    { code: '11', name: 'Casques et lunettes' }, { code: '12', name: 'Gants de sécurité' },
    { code: '13', name: 'Chaussures de sécurité' }, { code: '14', name: 'Signalisation' },
    { code: '15', name: 'Promotions Sécurité' },
  ],
  L: [
    { code: '01', name: 'WC et abattants' }, { code: '02', name: 'Lavabos et vasques' },
    { code: '03', name: 'Baignoires' }, { code: '04', name: 'Receveurs de douche' },
    { code: '05', name: 'Cabines de douche' }, { code: '06', name: 'Robinetterie sanitaire' },
    { code: '07', name: 'Mitigeurs' }, { code: '08', name: 'Colonnes de douche' },
    { code: '09', name: 'Chauffe-eau' }, { code: '10', name: 'Accessoires salle de bain' },
    { code: '11', name: 'Miroirs' }, { code: '12', name: 'Meubles salle de bain' },
    { code: '13', name: 'Évacuation et bondes' }, { code: '14', name: 'Joints sanitaires' },
    { code: '15', name: 'Promotions Sanitaire' },
  ],
  M: [
    { code: '01', name: 'Ciment' }, { code: '02', name: 'Plâtre et enduits' },
    { code: '03', name: 'Mortier et colle carrelage' }, { code: '04', name: 'Sable et granulats' },
    { code: '05', name: 'Briques et parpaings' }, { code: '06', name: 'Carrelage' },
    { code: '07', name: 'Faïence' }, { code: '08', name: 'Plaques de plâtre' },
    { code: '09', name: 'Isolation' }, { code: '10', name: 'Étanchéité' },
    { code: '11', name: 'Fer à béton et treillis' }, { code: '12', name: 'Bois de construction' },
    { code: '13', name: 'Quincaillerie gros œuvre' }, { code: '14', name: 'Échafaudage et coffrage' },
    { code: '15', name: 'Promotions Construction' },
  ],
  A: [
    { code: '01', name: 'Comptoir / Caisses' }, { code: '02', name: 'Piles et ampoules' },
    { code: '03', name: 'Petit outillage de dépannage' }, { code: '04', name: 'Adhésifs et attaches' },
    { code: '05', name: 'Quincaillerie de dépannage' }, { code: '06', name: 'Articles ménagers pratiques' },
    { code: '07', name: 'Sécurité (masques, gants)' }, { code: '08', name: 'Articles de saison' },
    { code: '09', name: 'Nouveautés' }, { code: '10', name: "Produits d'appel" },
    { code: '11', name: 'Emballage et sacs' }, { code: '12', name: 'Présentoirs promotionnels' },
    { code: '13', name: 'Recharges et consommables' }, { code: '14', name: 'Accessoires divers' },
    { code: '15', name: 'Déstockage caisse' },
  ],
  N: [
    { code: '01', name: 'Promotions Peinture' }, { code: '02', name: 'Promotions Outillage' },
    { code: '03', name: 'Promotions Électricité' }, { code: '04', name: 'Promotions Plomberie' },
    { code: '05', name: 'Promotions Quincaillerie' }, { code: '06', name: 'Promotions Jardinage' },
    { code: '07', name: 'Promotions Sanitaire' }, { code: '08', name: 'Promotions Construction' },
    { code: '09', name: 'Promotions Entretien' }, { code: '10', name: 'Fins de série' },
    { code: '11', name: 'Déstockage' }, { code: '12', name: 'Lots et packs' },
    { code: '13', name: "Produits d'appel" }, { code: '14', name: 'Soldes saisonnières' },
    { code: '15', name: 'Nouveautés en promo' },
  ],
  // ---- Zones logistiques (modèles métier) ----
  O: [
    { code: '01', name: 'Fins de série' }, { code: '02', name: 'Invendus' },
    { code: '03', name: 'Produits abîmés' }, { code: '04', name: 'Retours fournisseurs' },
    { code: '05', name: 'Lots à liquider' }, { code: '06', name: 'Saisonnier à écouler' },
    { code: '07', name: 'Échantillons' }, { code: '08', name: 'À reconditionner' },
  ],
  P: [
    { code: '01', name: 'Retours à contrôler' }, { code: '02', name: 'Retours conformes' },
    { code: '03', name: 'Retours défectueux' }, { code: '04', name: 'Sous garantie' },
    { code: '05', name: 'Avoirs en attente' }, { code: '06', name: 'À remettre en stock' },
    { code: '07', name: 'À détruire' }, { code: '08', name: 'Litiges' },
  ],
  Q: [
    { code: '01', name: 'Quai de déchargement' }, { code: '02', name: 'En attente de contrôle' },
    { code: '03', name: 'Contrôle qualité' }, { code: '04', name: 'Conformes' },
    { code: '05', name: 'Non conformes' }, { code: '06', name: 'À étiqueter' },
    { code: '07', name: 'À ranger' }, { code: '08', name: 'Documents / bons de livraison' },
  ],
  R: [
    { code: '01', name: 'Zone de picking' }, { code: '02', name: 'Commandes en cours' },
    { code: '03', name: 'Commandes prêtes' }, { code: '04', name: 'Emballage' },
    { code: '05', name: 'Étiquetage expédition' }, { code: '06', name: 'Colis en attente' },
    { code: '07', name: 'Livraisons du jour' }, { code: '08', name: 'Transporteurs' },
  ],
  S: [
    { code: '01', name: 'Réserve peinture' }, { code: '02', name: 'Réserve outillage' },
    { code: '03', name: 'Réserve électricité' }, { code: '04', name: 'Réserve plomberie' },
    { code: '05', name: 'Réserve quincaillerie' }, { code: '06', name: 'Réserve construction' },
    { code: '07', name: 'Réserve sanitaire' }, { code: '08', name: 'Réserve jardinage' },
    { code: '09', name: 'Réserve entretien' }, { code: '10', name: 'Stock tampon' },
  ],
  T: [
    { code: '01', name: 'Inflammables' }, { code: '02', name: 'Solvants et diluants' },
    { code: '03', name: 'Peintures et aérosols' }, { code: '04', name: 'Produits corrosifs' },
    { code: '05', name: 'Produits toxiques' }, { code: '06', name: 'Gaz sous pression' },
    { code: '07', name: 'Comburants' }, { code: '08', name: 'Stockage sécurisé (rétention)' },
  ],
  U: [
    { code: '01', name: 'Sacs de ciment' }, { code: '02', name: 'Plaques et panneaux' },
    { code: '03', name: 'Tubes et profilés' }, { code: '04', name: 'Échelles et escabeaux' },
    { code: '05', name: 'Mobilier' }, { code: '06', name: 'Cuves et réservoirs' },
    { code: '07', name: 'Palettes' }, { code: '08', name: 'Charges lourdes' },
  ],
}
/** Allées génériques pour une zone sans modèle spécifique. */
export const GENERIC_ALLEES: { code: string; name: string }[] = [
  { code: '01', name: 'Allée 1' }, { code: '02', name: 'Allée 2' }, { code: '03', name: 'Allée 3' },
  { code: '04', name: 'Allée 4' }, { code: '05', name: 'Allée 5' },
]
export const alleeTemplateForZone = (zoneCode: string) => ZONE_ALLEE_TEMPLATES[zoneCode.toUpperCase()] ?? GENERIC_ALLEES

export interface Allee { id: string; storeId: string; zoneId: string; code: string; name?: string }
export interface Rayon { id: string; storeId: string; alleeId: string; code: string; name?: string }
export interface Etagere { id: string; storeId: string; rayonId: string; code: string; name?: string }
export interface Niveau { id: string; storeId: string; etagereId: string; code: string; name?: string }
export interface Position { id: string; storeId: string; niveauId: string; code: string; name?: string }
// Emplacement = feuille de l'arbre : combinaison résolue + code complet + produit éventuel.
export interface Emplacement {
  id: string
  storeId: string
  positionId: string
  code: string // MAG01-A-02-03-04-02-015
  productId?: string
}

// Code magasin normalisé (MAG01, MAG02…) à partir de l'index du magasin.
export function storeShortCode(index: number): string {
  return 'MAG' + String(index + 1).padStart(2, '0')
}
// Code dépôt normalisé (DEP01, DEP02…) à partir de l'index du dépôt dans son magasin.
export function depotShortCode(index: number): string {
  return 'DEP' + String(index + 1).padStart(2, '0')
}

/**
 * Garantit un code unique par dépôt au sein de chaque magasin. Corrige les
 * données anciennes (dépôt principal créé avant le champ `code`, ou codes en
 * double). Réassigne DEP01, DEP02… par ordre de création (le tableau est
 * « plus récent d'abord », donc l'ancien = en fin de liste → DEP01).
 */
export function normalizeDepotCodes(list: Depot[]): { list: Depot[]; changed: boolean } {
  const groups = new Map<string, Depot[]>()
  list.forEach((d) => { const g = groups.get(d.storeId); if (g) g.push(d); else groups.set(d.storeId, [d]) })
  const fix = new Map<string, string>()
  groups.forEach((deps) => {
    const codes = deps.map((d) => (d.code || '').toUpperCase())
    const nonEmpty = codes.filter(Boolean)
    const hasEmpty = codes.some((c) => !c)
    const hasDup = new Set(nonEmpty).size !== nonEmpty.length
    if (!hasEmpty && !hasDup) return
    ;[...deps].reverse().forEach((d, i) => {
      const code = depotShortCode(i)
      if ((d.code || '') !== code) fix.set(d.id, code)
    })
  })
  if (fix.size === 0) return { list, changed: false }
  return { list: list.map((d) => (fix.has(d.id) ? { ...d, code: fix.get(d.id) } : d)), changed: true }
}

// Assemble le code complet d'emplacement à partir des codes de chaque niveau.
// Format : MAG01-DEP01-A-02-03-04-02-015 (le segment dépôt est optionnel).
export function buildEmplacementCode(parts: {
  storeCode: string; depot?: string; zone?: string; allee?: string; rayon?: string; etagere?: string; niveau?: string; position?: string
}): string {
  return [parts.storeCode, parts.depot, parts.zone, parts.allee, parts.rayon, parts.etagere, parts.niveau, parts.position]
    .filter((p) => p != null && String(p).trim() !== '')
    .join('-')
}

export interface Product {
  id: string
  name: string
  barcode: string
  category: string
  subcategory?: string
  brand: string
  unit: string
  price: number
  cost: number
  stock: number
  minStock: number
  image?: string
  storeId?: string
  /** Quantity locked by validated (not-yet-shipped) transfers. available = stock - reserved. */
  reserved?: number
  lot?: string
  serial?: string
  /** Date de péremption (AAAA-MM-JJ). Utilisée par Stock › Contrôle › Produits expirés. */
  expiryDate?: string
  // Localisation (WMS) : chaîne d'emplacement + code complet auto (MAG01-A-02-…).
  zoneId?: string
  alleeId?: string
  rayonId?: string
  etagereId?: string
  niveauId?: string
  positionId?: string
  emplacementComplet?: string
  /**
   * Codes-barres absorbés lors d'une fusion de doublons.
   *
   * Une fiche fusionnée n'en garde qu'un ; les autres restent pourtant imprimés
   * sur des étiquettes de rayon et connus des fournisseurs. Les conserver ici
   * permet à la caisse de continuer à les reconnaître — sans quoi la fusion
   * rendrait des étiquettes illisibles au scanner.
   */
  altBarcodes?: string[]
  /**
   * Conditionnements de vente en plus de l'unité de stock. Permet d'acheter au
   * carton et de vendre à la pièce, au sachet ou à la boîte.
   */
  saleUnits?: SaleUnit[]
  /**
   * Article vendu en quantité fractionnée : câble au mètre, peinture au litre,
   * sable au kilo. Sans ce drapeau la caisse n'accepte que des entiers — ce qui
   * est LA bonne règle pour une vis : une caisse qui accepte « 2,5 vis »
   * produit un inventaire faux.
   */
  decimalQty?: boolean
}

/** Unités qui appellent naturellement des quantités fractionnées. */
const UNITES_DIVISIBLES = /^(m|m2|m²|m3|m³|ml|cm|metre|mètre|kg|g|gr|gramme|l|litre|kilo)$/i

/** Proposition par défaut à la saisie : le vendeur reste libre de la changer. */
export const uniteDivisible = (unit: string): boolean => UNITES_DIVISIBLES.test((unit || '').trim())

/** Arrondi des quantités à trois décimales : coupe le bruit du binaire (0,1 + 0,2). */
export const roundQty = (n: number): number => Math.round(n * 1000) / 1000

/**
 * Arrondi au centime. Les avoirs se consomment par soustractions successives :
 * sans arrondi, un reste de 1e-13 laisse un avoir « presque soldé » qu'aucun
 * total ne rattrape jamais.
 */
export const roundMoney = (n: number): number => Math.round(n * 100) / 100

/** Physical stock minus quantities reserved by pending transfers. */
export const availableStock = (p: Product) => Math.max(0, p.stock - (p.reserved ?? 0))

/**
 * Conditionnement de vente d'un produit — « Sachet de 10 », « Boîte », « Carton ».
 *
 * Le stock reste tenu dans UNE seule unité, la plus petite vendable (`unit`).
 * Chaque conditionnement porte son facteur vers cette unité de base, et son
 * PROPRE prix : un carton de 2 000 vis ne se vend pas 2 000 × le prix pièce,
 * la dégressivité est une décision commerciale, pas une multiplication.
 */
export interface SaleUnit {
  id: string
  name: string
  /** Nombre d'unités de stock contenues. « Boîte de 100 » → 100. */
  factor: number
  /** Prix de vente de ce conditionnement entier. */
  price: number
  /** Code-barres du carton ou de la boîte, distinct de celui de la pièce. */
  barcode?: string
}

export interface SaleItem {
  productId: string
  name: string
  price: number
  /** Quantité DANS l'unité choisie (3 boîtes, pas 300 vis). */
  qty: number
  /** Conditionnement vendu. Absent = unité de stock. */
  unitName?: string
  /** Facteur du conditionnement. Absent ou 1 = unité de stock. */
  unitFactor?: number
}

/** Facteur d'une ligne d'achat vers l'unité de stock. 1 par défaut. */
export const purchaseFactor = (i: Pick<PurchaseItem, 'unitFactor'>) =>
  i.unitFactor && i.unitFactor > 0 ? i.unitFactor : 1

/** Quantité en unités de STOCK que représente une ligne de vente. */
export const baseQty = (i: Pick<SaleItem, 'qty' | 'unitFactor'>) =>
  Math.round(i.qty * (i.unitFactor && i.unitFactor > 0 ? i.unitFactor : 1) * 1000) / 1000

export interface Sale {
  id: string
  date: string
  /**
   * Numéro de facture, POSÉ à l'encaissement et jamais recalculé.
   *
   * Il suit le format des réglages (préfixe + année + numéro de départ). Le
   * conserver sur la vente est ce qui garantit qu'une facture déjà remise à
   * un client ne change plus de numéro — supprimer une vente ne doit pas
   * décaler la numérotation de toutes les précédentes.
   */
  invoiceNo?: string
  items: SaleItem[]
  total: number
  profit: number
  payment: 'especes' | 'carte' | 'credit' | 'mixte'
  clientId?: string
  clientName?: string
  storeId?: string
  /** Vendeur ayant encaissé — renseigné depuis la session au moment de la vente. */
  userId?: string
  userName?: string
}

export interface Client {
  id: string
  code?: string
  name: string
  phone: string
  email: string
  address: string
  city: string
  cin: string
  clientType: 'Particulier' | 'Professionnel' | 'VIP'
  creditLimit: number
  notes: string
  creditDueDate?: string
  discountBalance: number
  credit: number
  totalSpent: number
  points: number
  creditAllowed?: boolean
  paymentTermDays?: number
  image?: string
}

export interface ClientPayment {
  id: string
  date: string
  clientId: string
  clientName: string
  amount: number
  method: 'especes' | 'carte' | 'virement' | 'cheque'
  note: string
  storeId?: string
}

export interface CreditInstalment {
  id: string
  date: string
  amount: number
  method: 'especes' | 'carte' | 'virement' | 'cheque'
  note: string
}

export interface Credit {
  id: string
  ref: string
  date: string
  clientId: string
  clientName: string
  saleId: string
  invoiceRef: string
  items: SaleItem[]
  amount: number
  paid: number
  dueDate: string
  payments: CreditInstalment[]
  storeId?: string
}

export type CreditStatus = 'paye' | 'partiel' | 'retard' | 'non_paye'

export function creditStatus(c: Credit, now: Date = new Date()): CreditStatus {
  const remaining = c.amount - c.paid
  if (remaining <= 0.001) return 'paye'
  if (c.dueDate && new Date(c.dueDate) < now) return 'retard'
  if (c.paid > 0) return 'partiel'
  return 'non_paye'
}

export function daysLate(c: Credit, now: Date = new Date()): number {
  if (c.amount - c.paid <= 0.001 || !c.dueDate) return 0
  const due = new Date(c.dueDate)
  if (due >= now) return 0
  return Math.floor((now.getTime() - due.getTime()) / 86400000)
}

export interface LoyaltyMovement {
  id: string
  date: string
  clientId: string
  clientName: string
  type: 'gain' | 'utilisation'
  points: number
  note: string
  storeId?: string
}

export interface SupplierPayment {
  id: string
  date: string
  supplierId: string
  supplierName: string
  amount: number
  method: 'especes' | 'carte' | 'virement' | 'cheque'
  note: string
  storeId?: string
}

export interface Supplier {
  id: string
  name: string
  phone: string
  address: string
  balance: number
  totalPurchased: number
}

export interface StockMovement {
  id: string
  date: string
  productId: string
  productName: string
  type: 'entree' | 'reappro' | 'sortie' | 'ajustement' | 'vente' | 'reception' | 'retour' | 'inventaire' | 'transfert_out' | 'transfert_in' | 'stock_initial'
  qty: number
  note: string
  storeId?: string
  /** Dépôt concerné (optionnel) — utilisé pour la ventilation du stock par dépôt. */
  depotId?: string
  /** Qui a fait le geste. Sans lui, « qui a sorti 50 pièces ? » est sans réponse. */
  user?: string
}

/**
 * LOT : une entrée de stock datée, consommée en FIFO ou FEFO.
 *
 * Le stock de la fiche reste l'AUTORITÉ (une seule unité, comme partout) ;
 * les lots sont la couche de traçabilité en dessous : d'où vient chaque
 * quantité, depuis quand, avec quelle DLC. La somme des restants d'un
 * produit doit suivre son stock — l'inventaire réconcilie les dérives.
 */
export interface Lot {
  id: string
  productId: string
  productName: string
  /** Quantité entrée, en unités de base. */
  qty: number
  /** Quantité restante — décrémentée par les sorties, dans l'ordre FIFO/FEFO. */
  remaining: number
  /** Coût d'une unité de base à l'entrée. */
  cost: number
  /** Date d'entrée (ISO). */
  date: string
  /** DLC (AAAA-MM-JJ) — le moteur FEFO s'appuie dessus. */
  expiryDate?: string
  /** Provenance : réf BC/BR, « Stock initial », « Retour vente … », note. */
  ref: string
  /** Lot créé pour tracer un stock ANTÉRIEUR au suivi par lots. */
  ouverture?: boolean
  storeId?: string
  depotId?: string
}

/**
 * Ordre de consommation des lots.
 * FEFO : la DLC la plus proche d'abord, les lots sans DLC en dernier.
 * FIFO : l'entrée la plus ancienne d'abord.
 * Les lots d'ouverture passent avant à égalité : ils représentent le stock
 * le plus ancien, même si leur date de création est récente.
 */
export function ordreConsommation(a: Lot, b: Lot, fefo: boolean): number {
  if (fefo) {
    if (a.expiryDate && b.expiryDate && a.expiryDate !== b.expiryDate) return a.expiryDate < b.expiryDate ? -1 : 1
    if (a.expiryDate && !b.expiryDate) return -1
    if (!a.expiryDate && b.expiryDate) return 1
  }
  if (!!a.ouverture !== !!b.ouverture) return a.ouverture ? -1 : 1
  return a.date.localeCompare(b.date)
}

export interface PurchaseItem {
  productId: string
  name: string
  barcode?: string
  sku?: string
  /** Coût d'UNE unité d'achat : d'une bobine si l'on achète à la bobine. */
  cost: number
  /** Quantité dans l'unité d'ACHAT (3 bobines, pas 300 mètres). */
  qty: number
  /**
   * Conditionnement d'achat. Absent = l'unité de stock.
   *
   * Sans lui, acheter « 3 bobines de 100 m à 700 DH » entrait 3 mètres en stock
   * et fixait le coût du mètre à 700 DH. La quantité comme le prix doivent être
   * ramenés à l'unité de stock au moment de la réception.
   */
  unitName?: string
  unitFactor?: number
  discount?: number
  tva?: number
  deliveredQty?: number
  receivedQty?: number
  receptionState?: 'conforme' | 'manquant' | 'endommage' | 'different'
  receptionNote?: string
}

export interface Purchase {
  id: string
  ref: string
  date: string
  supplierId: string
  supplierName: string
  supplierRef?: string
  expectedDate?: string
  note?: string
  globalDiscount?: number
  items: PurchaseItem[]
  total: number
  paid: number
  status: 'en_attente' | 'partiellement_recue' | 'recue' | 'retournee'
  blRef?: string
  blDate?: string
  blCarrier?: string
  blNote?: string
  brRef?: string
  brDate?: string
  brEmployee?: string
  brDepot?: string
  storeId?: string
}

export interface Quote {
  id: string
  ref: string
  date: string
  clientName: string
  items: SaleItem[]
  total: number
  status: 'en_attente' | 'accepte' | 'refuse' | 'converti'
  storeId?: string
}

/* ------------------------------ Demandes d'achat --------------------------- */

/**
 * DEMANDE D'ACHAT (DA) : le document INTERNE en amont du bon de commande.
 * Un utilisateur demande, un responsable approuve, la conversion fabrique un
 * ou plusieurs BC (un par fournisseur) sans ressaisie.
 *
 *   brouillon -> soumise -> approuvee -> convertie -> cloturee
 *                         \-> refusee
 */
export type PurchaseRequestStatus = 'brouillon' | 'soumise' | 'approuvee' | 'refusee' | 'convertie' | 'cloturee'

export interface PurchaseRequestItem {
  productId: string
  name: string
  barcode?: string
  /** Quantite dans l'unite d'ACHAT choisie (3 cartons, pas 6000 pieces). */
  qty: number
  unitName?: string
  unitFactor?: number
  note?: string
  /** Fournisseur suggere - pre-remplit la ventilation a la conversion. */
  supplierId?: string
}

export interface PurchaseRequestEvent {
  date: string
  action: string
  user: string
  comment?: string
}

export interface PurchaseRequest {
  id: string
  ref: string
  date: string
  requesterId?: string
  requesterName: string
  /** Date a laquelle la marchandise est souhaitee. */
  neededBy?: string
  motif?: string
  items: PurchaseRequestItem[]
  status: PurchaseRequestStatus
  history: PurchaseRequestEvent[]
  /** Motif de la decision (approbation ou refus). */
  decisionNote?: string
  /** BC issus de la conversion. */
  purchaseIds?: string[]
  storeId?: string
}

/* ------------------------- Demandes de prix (consultation) ----------------- */

/**
 * DEMANDE DE PRIX : l'étape qui manquait entre la demande d'achat et le bon de
 * commande. On consulte plusieurs fournisseurs sur une même liste d'articles,
 * on saisit leurs offres, on compare, puis on retient un fournisseur — c'est ce
 * qui JUSTIFIE le choix, et la trace reste dans le document.
 *
 * Le prix proposé est stocké PAR fournisseur ET PAR ligne : un fournisseur peut
 * être le moins cher sur un article et le plus cher sur un autre, un prix global
 * masquerait cet arbitrage.
 */
export type RfqStatus = 'brouillon' | 'envoyee' | 'depouillee' | 'attribuee' | 'annulee'

export interface RfqItem {
  productId: string
  name: string
  barcode?: string
  qty: number
  unitName?: string
  unitFactor?: number
}

export interface RfqOffer {
  supplierId: string
  supplierName: string
  /** Prix unitaire proposé par ligne : clé = productId. */
  prices: Record<string, number>
  /** Délai annoncé, en jours. */
  leadDays?: number
  note?: string
  receivedAt?: string
}

export interface Rfq {
  id: string
  ref: string
  date: string
  /** Demande d'achat à l'origine de la consultation, s'il y en a une. */
  requestId?: string
  requestRef?: string
  items: RfqItem[]
  offers: RfqOffer[]
  status: RfqStatus
  /** Fournisseur retenu au dépouillement. */
  awardedSupplierId?: string
  awardedSupplierName?: string
  /** BC issu de l'attribution. */
  purchaseId?: string
  note?: string
  neededBy?: string
  storeId?: string
  createdAt: string
  createdBy?: string
  awardedAt?: string
  awardedBy?: string
}

export const RFQ_STATUS_META: Record<RfqStatus, { chip: string }> = {
  brouillon: { chip: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300' },
  envoyee: { chip: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400' },
  depouillee: { chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400' },
  attribuee: { chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400' },
  annulee: { chip: 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400' },
}

/** Total d'une offre : somme des prix proposés × quantités demandées. Les lignes non chiffrées comptent pour zéro. */
export function rfqOfferTotal(rfq: Rfq, offer: RfqOffer): number {
  let s = 0
  for (const it of rfq.items) s += (offer.prices[it.productId] ?? 0) * it.qty
  return s
}

/** Une offre n'est comparable que si toutes les lignes sont chiffrées. */
export function rfqOfferComplete(rfq: Rfq, offer: RfqOffer): boolean {
  return rfq.items.every((it) => typeof offer.prices[it.productId] === 'number' && offer.prices[it.productId] > 0)
}

/* --------------------------------- AVOIRS --------------------------------- */

/**
 * AVOIR (note de crédit), client ou fournisseur.
 *
 * Une seule entité pour les deux sens : le statut, la consommation partielle,
 * le remboursement et l'annulation obéissent aux mêmes règles, seul le tiers
 * change. Deux entités auraient signifié deux fois la même logique d'argent.
 *
 * L'avoir est SÉPARÉ du retour, et c'est délibéré : le retour porte le
 * mouvement de stock, l'avoir porte l'argent. Retourner de la marchandise sans
 * établir d'avoir (échange) ou établir un avoir sans retour (erreur de
 * facturation) sont deux cas réels — les lier de force interdirait les deux.
 */
export type CreditNoteKind = 'client' | 'fournisseur'

/**
 * brouillon → controle → valide → (partiel) → solde
 * `annule` est une sortie possible avant consommation. Un avoir n'est JAMAIS
 * supprimé : il justifie un mouvement d'argent.
 */
export type CreditNoteStatus = 'brouillon' | 'controle' | 'valide' | 'partiel' | 'solde' | 'annule'

export type CreditNoteReason =
  | 'retour_marchandise'
  | 'produit_defectueux'
  | 'erreur_facturation'
  | 'geste_commercial'
  | 'autre'

/** Consommation d'un avoir : sur une vente/un achat, ou remboursé en argent. */
export interface CreditNoteUse {
  id: string
  date: string
  amount: number
  /** Vente (client) ou achat (fournisseur) sur laquelle l'avoir a été imputé. */
  targetId?: string
  targetRef?: string
  /** Remboursement en argent plutôt qu'imputation. */
  refund?: { method: 'especes' | 'virement' | 'cheque'; note?: string }
  user?: string
}

export interface CreditNoteLine {
  productId: string
  name: string
  ref?: string
  qty: number
  /** Prix unitaire HORS TAXE — la remise est déjà déduite en amont. */
  puHT: number
  tvaPct: number
}

export interface CreditNote {
  id: string
  ref: string
  kind: CreditNoteKind
  status: CreditNoteStatus
  date: string
  /** Tiers concerné. `partyId` peut manquer sur une vente au comptoir. */
  partyId?: string
  partyName: string
  /** Document d'origine — un avoir n'existe jamais seul. */
  originId: string
  originRef: string
  originDate?: string
  /** Retour à l'origine de l'avoir, s'il y en a un (le stock vient de LUI). */
  returnId?: string
  /** Références fournisseur : sa facture, son bon de livraison. */
  supplierInvoiceRef?: string
  supplierBlRef?: string
  reason: CreditNoteReason
  note?: string
  lines: CreditNoteLine[]
  totalHT: number
  totalTVA: number
  totalTTC: number
  /** Imputations et remboursements successifs. Le reste s'en déduit. */
  uses: CreditNoteUse[]
  createdBy?: string
  validatedBy?: string
  validatedAt?: string
  cancelledBy?: string
  cancelledAt?: string
  cancelReason?: string
  storeId?: string
}

export const CREDIT_NOTE_META: Record<CreditNoteStatus, { chip: string }> = {
  brouillon: { chip: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300' },
  controle: { chip: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400' },
  valide: { chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400' },
  partiel: { chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400' },
  solde: { chip: 'border-gray-300 bg-gray-100 text-gray-600 dark:border-white/10 dark:bg-white/10 dark:text-zinc-400' },
  annule: { chip: 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400' },
}

/** Montant déjà consommé (imputations + remboursements). */
export const creditNoteUsed = (a: CreditNote) =>
  roundMoney(a.uses.reduce((s, u) => s + u.amount, 0))

/** Ce qui reste disponible. Un avoir annulé ne vaut plus rien. */
export const creditNoteRemaining = (a: CreditNote) =>
  a.status === 'annule' ? 0 : roundMoney(Math.max(0, a.totalTTC - creditNoteUsed(a)))

/** Avoirs réellement mobilisables par un tiers donné. */
export const usableCreditNotes = (list: CreditNote[], kind: CreditNoteKind, partyId?: string) =>
  list.filter(
    (a) =>
      a.kind === kind &&
      (a.status === 'valide' || a.status === 'partiel') &&
      creditNoteRemaining(a) > 0.001 &&
      (!partyId || a.partyId === partyId)
  )

export interface SaleReturn {
  /**
   * Numéro d'avoir, posé à l'enregistrement du retour et jamais recalculé —
   * même règle que le numéro de facture.
   */
  creditNo?: string
  id: string
  date: string
  saleId: string
  clientName: string
  items: SaleItem[]
  total: number
  method: 'especes' | 'avoir'
  storeId?: string
}

/**
 * QUANTITÉS DÉJÀ RETOURNÉES d'une vente, par produit.
 *
 * Rien n'empêchait de retourner deux fois la même vente : le stock était
 * ré-incrémenté à chaque fois et le client remboursé autant de fois — constaté
 * avec trois avoirs pour une seule vente. Ces deux fonctions sont la mémoire
 * qui manquait.
 *
 * Les lignes sont agrégées par produit : une même référence peut apparaître
 * deux fois dans une vente, comparer ligne à ligne laisserait passer l'excédent.
 */
export function returnedQtyBySale(saleId: string, returns: SaleReturn[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of returns) {
    if (r.saleId !== saleId) continue
    for (const i of r.items) m.set(i.productId, roundQty((m.get(i.productId) ?? 0) + i.qty))
  }
  return m
}

/** Ce qui RESTE retournable d'une vente, par produit (unité de vente). */
export function returnableQty(sale: Sale, returns: SaleReturn[]): Map<string, number> {
  const deja = returnedQtyBySale(sale.id, returns)
  const vendu = new Map<string, number>()
  for (const it of sale.items) vendu.set(it.productId, roundQty((vendu.get(it.productId) ?? 0) + it.qty))
  const reste = new Map<string, number>()
  vendu.forEach((q, pid) => reste.set(pid, roundQty(Math.max(0, q - (deja.get(pid) ?? 0)))))
  return reste
}

/** Vrai si plus rien n'est retournable sur cette vente. */
export function saleFullyReturned(sale: Sale, returns: SaleReturn[]): boolean {
  let reste = 0
  returnableQty(sale, returns).forEach((q) => { reste += q })
  return reste <= 0
}

/**
 * RETOURS EN TROP : les avoirs qui font dépasser, pour une vente, la quantité
 * réellement vendue. C'est une CERTITUDE arithmétique, pas une supposition —
 * on ne peut pas rendre plus qu'on n'a acheté. Les plus récents sont désignés
 * en premier : le premier retour est presque toujours le bon.
 */
export function retoursExcedentaires(sales: Sale[], returns: SaleReturn[]): SaleReturn[] {
  const trop: SaleReturn[] = []
  const parVente = new Map<string, SaleReturn[]>()
  for (const r of returns) {
    const l = parVente.get(r.saleId)
    if (l) l.push(r)
    else parVente.set(r.saleId, [r])
  }
  parVente.forEach((liste, saleId) => {
    const sale = sales.find((s) => s.id === saleId)
    if (!sale) return
    const vendu = new Map<string, number>()
    for (const it of sale.items) vendu.set(it.productId, roundQty((vendu.get(it.productId) ?? 0) + it.qty))
    // Du plus ancien au plus récent : on garde ce qui tenait dans la vente.
    const chrono = [...liste].sort((a, b) => a.date.localeCompare(b.date))
    const cumul = new Map<string, number>()
    for (const r of chrono) {
      const depasse = r.items.some((i) => {
        const apres = roundQty((cumul.get(i.productId) ?? 0) + i.qty)
        return apres > (vendu.get(i.productId) ?? 0) + 0.0001
      })
      if (depasse) trop.push(r)
      else for (const i of r.items) cumul.set(i.productId, roundQty((cumul.get(i.productId) ?? 0) + i.qty))
    }
  })
  return trop
}

/**
 * VENTES SUSPECTES DE DOUBLON : même client, même contenu, même total, à la
 * même minute. C'est un SOUPÇON, pas une preuve — deux clients peuvent acheter
 * la même chose en même temps. Rien n'est donc supprimé automatiquement : on
 * présente les groupes et l'utilisateur désigne ce qu'il annule.
 */
export function ventesDupliquees(sales: Sale[]): Sale[][] {
  const empreinte = (s: Sale) =>
    [
      s.clientId ?? s.clientName ?? '',
      s.date.slice(0, 16), // à la minute
      s.total.toFixed(2),
      [...s.items].map((i) => `${i.productId}x${i.qty}`).sort().join('|'),
    ].join('#')
  const groupes = new Map<string, Sale[]>()
  for (const s of sales) {
    const k = empreinte(s)
    const l = groupes.get(k)
    if (l) l.push(s)
    else groupes.set(k, [s])
  }
  return [...groupes.values()]
    .filter((g) => g.length > 1)
    .map((g) => [...g].sort((a, b) => a.date.localeCompare(b.date)))
    .sort((a, b) => b.length - a.length)
}

export interface CashEntry {
  id: string
  date: string
  type: 'depense' | 'recette'
  label: string
  amount: number
  storeId?: string
}

export interface SessionSummary {
  salesEspeces: number
  salesCarte: number
  salesVirement: number
  salesCredit: number
  otherCashIn: number
  depenses: number
  retraits: number
}

export interface RegisterSession {
  id: string
  openedAt: string
  openingAmount: number
  closedAt?: string
  closingAmount?: number
  expectedAmount?: number
  summary?: SessionSummary
  storeId?: string
}

const isBankTransfer = (label: string) => label.startsWith('Transfert') || label.startsWith('تحويل')

/** End-of-day breakdown for a register session (window = openedAt → closedAt|now). */
export function computeSessionSummary(
  session: RegisterSession,
  sales: Sale[],
  cash: CashEntry[],
  clientPayments: ClientPayment[]
): SessionSummary {
  const since = session.openedAt
  const until = session.closedAt ?? new Date().toISOString()
  const inW = (d: string) => d >= since && d <= until
  const modeTotal = (m: Sale['payment']) => sales.filter((s) => inW(s.date) && s.payment === m).reduce((a, s) => a + s.total, 0)
  const sCash = cash.filter((c) => inW(c.date))
  return {
    salesEspeces: modeTotal('especes') + modeTotal('mixte'),
    salesCarte: modeTotal('carte'),
    salesVirement: clientPayments.filter((p) => inW(p.date) && p.method === 'virement').reduce((a, p) => a + p.amount, 0),
    salesCredit: modeTotal('credit'),
    otherCashIn: sCash.filter((c) => c.type === 'recette').reduce((a, c) => a + c.amount, 0),
    depenses: sCash.filter((c) => c.type === 'depense' && !isBankTransfer(c.label)).reduce((a, c) => a + c.amount, 0),
    retraits: sCash.filter((c) => c.type === 'depense' && isBankTransfer(c.label)).reduce((a, c) => a + c.amount, 0),
  }
}

export function sessionExpected(session: RegisterSession, s: SessionSummary): number {
  return session.openingAmount + s.salesEspeces + s.otherCashIn - s.depenses - s.retraits
}

export interface AppUser {
  id: string
  name: string
  phone: string
  role: 'Administrateur' | 'Gérant' | 'Comptable' | 'Acheteur' | 'Magasinier' | 'Caissier' | 'Vendeur'
  active: boolean
  /** Override individuel des permissions (clés du catalogue). Si défini, remplace les permissions du rôle. */
  permissions?: string[]
  storeId?: string
  storeIds?: string[]
  email?: string
  passwordHash?: string
  pinHash?: string
  /** Demande de compte en attente d'approbation par un administrateur. */
  pendingApproval?: boolean
  /** Mot de passe temporaire : changement obligatoire à la prochaine connexion. */
  mustChangePassword?: boolean
  /** Clé de la question de sécurité choisie à l'inscription (q1…q5). */
  securityQuestion?: string
  /** Hash de la réponse de sécurité (récupération de mot de passe). */
  securityAnswerHash?: string
}

export const USER_ROLES: AppUser['role'][] = ['Administrateur', 'Gérant', 'Comptable', 'Acheteur', 'Magasinier', 'Caissier', 'Vendeur']

/** Store ids a user may access. Administrators see all stores. */
export function userStoreAccess(user: AppUser | null | undefined, stores: Store[]): string[] {
  if (!user || user.role === 'Administrateur') return stores.map((s) => s.id)
  const ids = user.storeIds && user.storeIds.length ? user.storeIds : user.storeId ? [user.storeId] : []
  return ids.filter((id) => stores.some((s) => s.id === id))
}

export function canSwitchStore(user: AppUser | null | undefined, stores: Store[]): boolean {
  return userStoreAccess(user, stores).length > 1
}

export interface ActivityLog {
  id: string
  date: string
  user: string
  action: string
  /** Magasin où l'action a eu lieu. */
  storeId?: string
  storeName?: string
  /** Élément concerné (ex. nom du produit, du rôle, de l'utilisateur). */
  target?: string
  /** Ancienne / nouvelle valeur (audit détaillé). */
  oldValue?: string
  newValue?: string
  /**
   * Nature de l'événement, indépendante de la langue du libellé. Sans cela, le
   * rapport « Connexions » devrait filtrer sur du texte français — il casserait
   * en arabe et à la moindre reformulation.
   */
  kind?: ActivityKind
}
export type ActivityKind = 'login' | 'logout'
export interface AuditMeta {
  target?: string
  oldValue?: string
  newValue?: string
  base?: ActivityLog[]
  kind?: ActivityKind
}

export interface Attribute {
  id: string
  name: string
}

export interface Settings {
  storeName: string
  phone: string
  address: string
  tva: number
  currency: string
  ticketMessage: string
  pointsPerAmount: number
  pointValueDH: number
  opexBudget: number
  printFormat: 'ticket58' | 'ticket80' | 'a4'
  cnss: string
  idFiscal: string
  rcNo: string
  ice: string
  taxePro: string
  slogan: string
  email: string
  logoDataUrl: string
  legalForm: 'SARL' | 'SA' | 'Auto-Entrepreneur' | 'SNC'
  city: string
  website: string
  logoLightDataUrl: string
  invoicePrefix: string
  invoiceStartNumber: number
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD'
  invoiceTerms: string
  signatureDataUrl: string
  /** Début d'exercice : le tableau de bord ne compte que l'activité postérieure à cette date ISO. */
  statsResetAt?: string
  /** Permissions éditables par rôle : { role: [clés de permission] }. */
  rolePermissions?: Record<string, string[]>
  /** Dimensions de l'étiquette (mm) pour l'impression Zebra. */
  labelWidthMm?: number
  labelHeightMm?: number
  /** Champs enrichis (assistant de configuration). */
  activity?: string
  country?: string
  timezone?: string
  roundingMode?: '0.01' | '0.05' | '0.10' | '1'
  /** Modes de paiement activés (clés). */
  paymentModes?: string[]
  /** État de l'assistant de configuration (Setup Wizard). */
  setup?: { completed?: boolean; step?: number; done?: string[] }
  /**
   * Autoriser le stock à passer sous zéro. Par défaut NON : la caisse bloque
   * au plafond du disponible. À OUI, la vente passe et le stock devient
   * négatif — l'anomalie reste VISIBLE au lieu d'être rognée en silence.
   */
  allowNegativeStock?: boolean
  /**
   * Catégories consommées en FEFO (DLC la plus proche d'abord) : ce qui
   * périme — colles, peintures, silicones… Les autres suivent FIFO.
   */
  fefoCategories?: string[]
}

export interface Expense {
  id: string
  date: string
  category: string
  label: string
  amount: number
  status: 'payee' | 'a_payer' | 'retard'
  dueDate?: string
  note: string
  storeId?: string
  /** Budget OPEX auquel cette dépense s'impute (module Finance). Optionnel : une dépense hors budget reste valide. */
  budgetId?: string
}

export const EXPENSE_CATEGORIES = ['Loyer', 'Électricité', 'Internet', 'Fournitures', 'Assurance', 'Bureau', 'Transport', 'Autre']

export interface Revenue {
  id: string
  date: string
  category: string
  label: string
  amount: number
  note: string
  storeId?: string
}

export const REVENUE_CATEGORIES = ['Ventes comptoir', 'Vente en gros', 'Prestations', 'Encaissement client', 'Remboursement', 'Subvention', 'Autre']

export interface MoneyTransfer {
  id: string
  date: string
  route: string
  label: string
  amount: number
  note: string
  storeId?: string
}

export const TRANSFER_ROUTES = ['Caisse → Banque', 'Banque → Caisse', 'Caisse → Coffre', 'Coffre → Caisse', 'Caisse → Magasin', 'Magasin → Caisse', 'Autre']

export interface HeldSale {
  id: string
  date: string
  items: SaleItem[]
  clientId: string
  label: string
}

// ------------------------------------------------------------------
// Stock transfers (between stores / depots)
// ------------------------------------------------------------------

export type TransferStatus = 'brouillon' | 'valide' | 'expedie' | 'recu' | 'termine'

export interface TransferItem {
  productId: string
  barcode: string
  sku?: string
  name: string
  cost: number
  lot?: string
  serial?: string
  requestedQty: number
  transferredQty: number
  receivedQty?: number
}

export interface TransferEvent {
  id: string
  date: string
  action: TransferStatus | 'creation' | 'modification'
  user: string
  comment: string
}

export interface Transfer {
  id: string
  ref: string
  date: string
  sourceStoreId: string
  sourceDepotId?: string
  destStoreId: string
  destDepotId?: string
  user: string
  note: string
  items: TransferItem[]
  status: TransferStatus
  history: TransferEvent[]
  hasDiscrepancy?: boolean
}

export const TRANSFER_FLOW: TransferStatus[] = ['brouillon', 'valide', 'expedie', 'recu', 'termine']

export const transferQty = (items: TransferItem[], key: 'requestedQty' | 'transferredQty' | 'receivedQty') =>
  items.reduce((a, i) => a + (Number(i[key]) || 0), 0)

/** Value of a transfer at purchase cost (shipped qty, falling back to requested). */
export const transferValue = (t: Transfer) =>
  t.items.reduce((a, i) => a + i.cost * (i.transferredQty || i.requestedQty), 0)

export const TRANSFER_META: Record<TransferStatus, { chip: string }> = {
  brouillon: { chip: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300' },
  valide: { chip: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400' },
  expedie: { chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400' },
  recu: { chip: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-400' },
  termine: { chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400' },
}

// ------------------------------------------------------------------
// Inventaires (physique + tournant)
// ------------------------------------------------------------------

export type InventoryKind = 'physique' | 'tournant'
/**
 * Workflow imposé : brouillon (création + comptage) → controle (comptage clos,
 * en attente de validation) → valide (écarts appliqués au stock, IMMUABLE).
 * `annule` est une sortie de secours avant validation — un inventaire validé
 * ne se supprime ni ne s'annule jamais : c'est lui qui justifie les mouvements.
 */
export type InventoryStatus = 'brouillon' | 'controle' | 'valide' | 'annule'

export interface InventoryLine {
  productId: string
  /** Dénormalisé : l'historique doit rester lisible même si la fiche disparaît. */
  productName: string
  barcode?: string
  category?: string
  /** Stock théorique FIGÉ au moment du comptage — pas recalculé ensuite. */
  theoretical: number
  counted: number
  /** Motif de l'écart (clé i18n des motifs d'ajustement, ou texte libre). */
  reason?: string
  countedAt?: string
  countedBy?: string
}

export interface InventoryScope {
  categories?: string[]
  subcategories?: string[]
  brands?: string[]
  /** Préfixe d'emplacement (« Z01 », « Z01-A02 »…), comme l'inventaire par emplacement. */
  emplacementPrefix?: string
  /** Liste d'articles choisis un à un. */
  productIds?: string[]
  /** Priorité par rotation (unités vendues 90 j) ou par valeur de stock (qté × coût). */
  priority?: 'rotation' | 'valeur'
  /** Nombre maximum d'articles générés pour un tournant. */
  limit?: number
}

export type InventoryFrequency = 'quotidien' | 'hebdomadaire' | 'mensuel' | 'personnalise'

export interface Inventory {
  id: string
  ref: string
  kind: InventoryKind
  status: InventoryStatus
  date: string
  depotId?: string
  scope?: InventoryScope
  frequency?: InventoryFrequency
  /** Fréquence en jours (dérivée ou personnalisée) — sert aussi de fenêtre « déjà compté récemment ». */
  frequencyDays?: number
  /**
   * Seules les lignes RÉELLEMENT comptées sont stockées : un inventaire
   * physique affiche tout le catalogue mais n'écrit qu'un document, jamais
   * une ligne par référence (quota Turso).
   */
  lines: InventoryLine[]
  note?: string
  createdBy?: string
  updatedBy?: string
  submittedBy?: string
  submittedAt?: string
  validatedBy?: string
  validatedAt?: string
  cancelledBy?: string
  cancelledAt?: string
  storeId?: string
}

export const INVENTORY_META: Record<InventoryStatus, { chip: string }> = {
  brouillon: { chip: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300' },
  controle: { chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400' },
  valide: { chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400' },
  annule: { chip: 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400' },
}

export const INVENTORY_FREQUENCY_DAYS: Record<Exclude<InventoryFrequency, 'personnalise'>, number> = {
  quotidien: 1,
  hebdomadaire: 7,
  mensuel: 30,
}

/** Écarts d'un inventaire : uniquement les lignes comptées dont compté ≠ théorique. */
export const inventoryDiffs = (inv: Inventory) => inv.lines.filter((l) => l.counted !== l.theoretical)

// ------------------------------------------------------------------
// Finance : exercices, budgets OPEX, investissements CAPEX
// ------------------------------------------------------------------

/** Exercice financier (année de gestion). Un budget appartient à un exercice. */
export interface FiscalYear {
  id: string
  year: number
  startDate: string
  endDate: string
  closed?: boolean
}

/**
 * Workflow budgétaire : brouillon → soumis → valide → en_cours → cloture.
 * À partir de `valide`, les montants ne sont plus librement modifiables —
 * seuls le statut et les notes bougent encore. Le CONSOMMÉ n'est jamais
 * stocké : il se calcule depuis les dépenses liées (budgetId), la vérité
 * reste dans un seul endroit.
 */
export type BudgetStatus = 'brouillon' | 'soumis' | 'valide' | 'en_cours' | 'cloture'

export interface Budget {
  id: string
  ref: string
  exerciceId: string
  year: number
  category: string
  subcategory?: string
  planned: number
  startDate: string
  endDate: string
  responsable?: string
  status: BudgetStatus
  notes?: string
  storeId?: string
  createdAt: string
  createdBy?: string
  updatedAt?: string
  updatedBy?: string
  validatedAt?: string
  validatedBy?: string
}

export type InvestmentStatus = 'prevu' | 'commande' | 'achete' | 'annule'

/** Investissement CAPEX : dépense d'équipement amortie sur plusieurs années. */
export interface Investment {
  id: string
  ref: string
  designation: string
  category: string
  exerciceId: string
  year: number
  supplierId?: string
  supplierName?: string
  planned: number
  actual?: number
  plannedDate: string
  purchaseDate?: string
  /** Durée d'utilisation prévue, en années. */
  usefulLifeYears?: number
  status: InvestmentStatus
  responsable?: string
  note?: string
  storeId?: string
  createdAt: string
  createdBy?: string
  updatedAt?: string
  updatedBy?: string
}

export const CAPEX_CATEGORIES = ['Rayonnage', 'Matériel informatique', 'Véhicule', 'Machine', 'Équipement', 'Aménagement', 'Travaux', 'Mobilier', 'Sécurité', 'Autre']

export const BUDGET_STATUS_META: Record<BudgetStatus, { chip: string }> = {
  brouillon: { chip: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300' },
  soumis: { chip: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400' },
  valide: { chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400' },
  en_cours: { chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400' },
  cloture: { chip: 'border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-400' },
}

export const INVESTMENT_STATUS_META: Record<InvestmentStatus, { chip: string }> = {
  prevu: { chip: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300' },
  commande: { chip: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400' },
  achete: { chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400' },
  annule: { chip: 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400' },
}

/**
 * Consommation d'un budget : somme des dépenses qui lui sont IMPUTÉES
 * (budgetId), quelle que soit leur date — l'imputation fait foi, pas le
 * calendrier. Seuils d'alerte : 80 % avertissement, 100 % atteint, au-delà
 * dépassement.
 */
export function budgetConsumed(budget: Budget, expenses: Expense[]): number {
  let s = 0
  for (const e of expenses) if (e.budgetId === budget.id) s += e.amount
  return s
}

export function budgetAlert(planned: number, consumed: number): 'ok' | 'warning' | 'reached' | 'over' {
  if (planned <= 0) return 'ok'
  const pct = (consumed / planned) * 100
  if (pct > 100) return 'over'
  if (pct >= 100) return 'reached'
  if (pct >= 80) return 'warning'
  return 'ok'
}

// ------------------------------------------------------------------
// Storage keys / helpers
// ------------------------------------------------------------------

const K = {
  products: 'dp_products',
  sales: 'dp_sales',
  clients: 'dp_clients',
  settings: 'dp_settings',
  movements: 'dp_movements',
  suppliers: 'dp_suppliers',
  purchases: 'dp_purchases',
  quotes: 'dp_quotes',
  returns: 'dp_returns',
  cash: 'dp_cash',
  sessions: 'dp_sessions',
  users: 'dp_users',
  activity: 'dp_activity',
  catAttr: 'dp_attr_categories',
  subcatAttr: 'dp_attr_souscategories',
  brandAttr: 'dp_attr_marques',
  unitAttr: 'dp_attr_unites',
  held: 'dp_held_sales',
  backups: 'dp_backups',
  clientPayments: 'dp_client_payments',
  loyalty: 'dp_loyalty_movements',
  supplierPayments: 'dp_supplier_payments',
  expenses: 'dp_expenses',
  revenues: 'dp_revenues',
  moneyTransfers: 'dp_money_transfers',
  credits: 'dp_credits',
  stores: 'dp_stores',
  depots: 'dp_depots',
  zones: 'dp_zones',
  allees: 'dp_allees',
  rayons: 'dp_rayons',
  etageres: 'dp_etageres',
  niveaux: 'dp_niveaux',
  positions: 'dp_positions',
  emplacements: 'dp_emplacements',
  activeStore: 'dp_active_store',
  transfers: 'dp_transfers',
  lots: 'dp_lots',
  purchaseRequests: 'dp_purchase_requests',
  inventories: 'dp_inventories',
  exercices: 'dp_exercices',
  budgets: 'dp_budgets',
  investments: 'dp_investments',
  rfqs: 'dp_rfqs',
  creditNotes: 'dp_credit_notes',
}

/** Storage keys whose records carry a storeId and must be filtered per active store. */
const SCOPED_KEYS: string[] = [
  K.products,
  K.sales,
  K.movements,
  K.lots,
  K.purchases,
  K.purchaseRequests,
  K.quotes,
  K.returns,
  K.cash,
  K.sessions,
  K.clientPayments,
  K.credits,
  K.loyalty,
  K.supplierPayments,
  K.expenses,
  K.revenues,
  K.moneyTransfers,
  K.users,
  K.inventories,
  K.creditNotes,
  K.budgets,
  K.investments,
  K.rfqs,
]

export const DEFAULT_SETTINGS: Settings = {
  storeName: 'Droguerie Pro',
  phone: '06 61 00 00 00',
  address: 'Casablanca, Maroc',
  tva: 20,
  currency: 'MAD (DH)',
  ticketMessage: 'Merci de votre visite !',
  pointsPerAmount: 50,
  pointValueDH: 1,
  opexBudget: 58000,
  printFormat: 'ticket80',
  cnss: '',
  idFiscal: '',
  rcNo: '',
  ice: '',
  taxePro: '',
  slogan: '',
  email: '',
  logoDataUrl: '',
  legalForm: 'SARL',
  city: 'Casablanca',
  website: '',
  logoLightDataUrl: '',
  invoicePrefix: 'FAC-',
  invoiceStartNumber: 1000,
  dateFormat: 'DD/MM/YYYY',
  invoiceTerms: '',
  signatureDataUrl: '',
}

export const CLIENT_PAYMENT_META: Record<ClientPayment['method'], { label: string }> = {
  especes: { label: 'Espèces' },
  carte: { label: 'Carte bancaire' },
  virement: { label: 'Virement' },
  cheque: { label: 'Chèque' },
}

export const SUPPLIER_PAYMENT_META: Record<SupplierPayment['method'], { label: string }> = {
  especes: { label: 'Espèces' },
  carte: { label: 'Carte bancaire' },
  virement: { label: 'Virement' },
  cheque: { label: 'Chèque' },
}

export const PAYMENT_META: Record<Sale['payment'], { label: string; chip: string }> = {
  especes: { label: 'Espèces', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  carte: { label: 'Carte', chip: 'border-sky-200 bg-sky-50 text-sky-700' },
  credit: { label: 'Crédit', chip: 'border-amber-200 bg-amber-50 text-amber-700' },
  mixte: { label: 'Mixte', chip: 'border-violet-200 bg-violet-50 text-violet-700' },
}

export const MOVEMENT_META: Record<StockMovement['type'], { label: string; chip: string }> = {
  entree: { label: 'Entrée', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  reappro: { label: 'Réapprovisionnement', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  sortie: { label: 'Sortie', chip: 'border-rose-200 bg-rose-50 text-rose-700' },
  ajustement: { label: 'Ajustement', chip: 'border-sky-200 bg-sky-50 text-sky-700' },
  vente: { label: 'Vente', chip: 'border-amber-200 bg-amber-50 text-amber-700' },
  reception: { label: 'Réception', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  retour: { label: 'Retour', chip: 'border-violet-200 bg-violet-50 text-violet-700' },
  inventaire: { label: 'Inventaire', chip: 'border-gray-200 bg-gray-50 text-gray-700' },
  transfert_out: { label: 'Transfert sortant', chip: 'border-orange-200 bg-orange-50 text-orange-700' },
  transfert_in: { label: 'Transfert entrant', chip: 'border-teal-200 bg-teal-50 text-teal-700' },
  stock_initial: { label: 'Stock initial', chip: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
}

/*
 * SYMBOLE DE LA DEVISE. « DH » était écrit en dur, si bien que le réglage
 * Paramètres › Devise n'avait aucun effet sur les montants affichés.
 *
 * `fmtDH` est appelée depuis plus de cent fichiers avec la même signature :
 * lui passer les réglages à chaque appel imposerait de toucher tout le code.
 * Le symbole est donc posé UNE fois, au chargement des réglages et à chaque
 * enregistrement — les deux moments provoquent déjà un rendu.
 *
 * Le réglage est un texte libre, « MAD (DH) » par défaut : on retient ce qui
 * est entre parenthèses quand il y en a, sinon le texte entier.
 */
let deviseSymbole = 'DH'

export function setCurrencySymbol(currency?: string) {
  const brut = (currency ?? '').trim()
  if (!brut) { deviseSymbole = 'DH'; return }
  const entreParentheses = /\(([^)]+)\)/.exec(brut)
  // Sans parenthèses exploitables, on retient le texte débarrassé des siennes :
  // une saisie comme « () » donnerait sinon un symbole fait de ponctuation.
  const symbole = (entreParentheses ? entreParentheses[1] : brut.replace(/[()]/g, '')).trim()
  deviseSymbole = symbole || 'DH'
}

export const fmtDH = (n: number) => `${n.toFixed(2).replace('.', ',')} ${deviseSymbole}`

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

function load<T>(key: string, fallback: T): T {
  try {
    // Produits : si le tableau est encore en mémoire (non sérialisé), on le rend
    // directement — inutile de faire un stringify suivi d'un parse de ~15 Mo.
    if (key === PRODUCTS_KEY) {
      const arr = productsGetArray()
      if (arr) return arr as T
    }
    const raw = storageGet(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  // La clé produits est routée vers IndexedDB (gros catalogues) ; le reste vers localStorage.
  // Pour les produits, la sérialisation est différée (voir pstore) : une vente ne
  // doit pas bloquer la caisse le temps d'un JSON.stringify de ~15 Mo.
  if (key === PRODUCTS_KEY && Array.isArray(value)) {
    productsSetArray(value)
    window.dispatchEvent(new CustomEvent('droguerie-store-change', { detail: key }))
    syncOnSave(key)
    return
  }
  storageSet(key, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent('droguerie-store-change', { detail: key }))
  // Write-through vers Turso (no-op tant que startSync() n'a pas été appelée,
  // ce qui neutralise l'amorçage/seed initial).
  syncOnSave(key)
}

/**
 * Accès générique aux collections, pour les modules qui vivent hors de ce
 * fichier (RH). Même chemin que le reste : localStorage + write-through Turso.
 * Sans cela, chaque module réimplémenterait la persistance et sortirait du
 * moteur de synchronisation.
 */
export const loadCollection = <T,>(key: string, fallback: T): T => load<T>(key, fallback)
export const saveCollection = (key: string, value: unknown) => save(key, value)

// ------------------------------------------------------------------
// Seed data
// ------------------------------------------------------------------

const seedProducts: Omit<Product, 'id'>[] = [
  { name: 'Peinture blanche 5L', barcode: '6111234500017', category: 'Peinture', brand: 'Astral', unit: 'Pièce', price: 185, cost: 140, stock: 24, minStock: 5 },
  { name: 'Ciment colle 25kg', barcode: '6111234500024', category: 'Quincaillerie', brand: 'Générique', unit: 'Sac', price: 65, cost: 48, stock: 40, minStock: 10 },
  { name: 'Ampoule LED 12W', barcode: '6111234500031', category: 'Électricité', brand: 'Schneider', unit: 'Pièce', price: 25, cost: 15, stock: 80, minStock: 20 },
  { name: 'Câble électrique 2.5mm (10m)', barcode: '6111234500048', category: 'Électricité', brand: 'Générique', unit: 'Mètre', price: 95, cost: 70, stock: 35, minStock: 8 },
  { name: 'Robinet mélangeur', barcode: '6111234500055', category: 'Plomberie', brand: 'Générique', unit: 'Pièce', price: 220, cost: 160, stock: 12, minStock: 3 },
  { name: 'Tuyau PVC 32mm (2m)', barcode: '6111234500062', category: 'Plomberie', brand: 'Générique', unit: 'Pièce', price: 45, cost: 30, stock: 50, minStock: 10 },
  { name: 'Marteau 500g', barcode: '6111234500079', category: 'Outillage', brand: 'Stanley', unit: 'Pièce', price: 75, cost: 50, stock: 18, minStock: 5 },
  { name: 'Tournevis set 6 pièces', barcode: '6111234500086', category: 'Outillage', brand: 'Facom', unit: 'Boîte', price: 89, cost: 60, stock: 22, minStock: 5 },
  { name: 'Vis assorties 1kg', barcode: '6111234500093', category: 'Quincaillerie', brand: 'Générique', unit: 'Kg', price: 40, cost: 25, stock: 60, minStock: 15 },
  { name: 'Clous 1kg', barcode: '6111234500109', category: 'Quincaillerie', brand: 'Générique', unit: 'Kg', price: 28, cost: 18, stock: 55, minStock: 15 },
  { name: 'Colle forte 50ml', barcode: '6111234500116', category: 'Quincaillerie', brand: 'Générique', unit: 'Pièce', price: 18, cost: 10, stock: 90, minStock: 20 },
  { name: 'Javel 5L', barcode: '6118000040972', category: 'Droguerie', brand: 'Générique', unit: 'Litre', price: 22, cost: 14, stock: 70, minStock: 20 },
  { name: 'Diluant 1L', barcode: '6111234500130', category: 'Peinture', brand: 'Astral', unit: 'Litre', price: 35, cost: 24, stock: 30, minStock: 8 },
  { name: 'Pinceau 50mm', barcode: '6111234500147', category: 'Peinture', brand: 'Générique', unit: 'Pièce', price: 15, cost: 8, stock: 45, minStock: 10 },
  { name: 'Gants de travail', barcode: '6111234500154', category: 'Sécurité', brand: 'Générique', unit: 'Pièce', price: 20, cost: 12, stock: 65, minStock: 15 },
  { name: 'Serrure 3 clés', barcode: '6111234500161', category: 'Quincaillerie', brand: 'Générique', unit: 'Pièce', price: 130, cost: 95, stock: 10, minStock: 3 },
]

const SEED_CATEGORIES = ['Droguerie', 'Quincaillerie', 'Électricité', 'Plomberie', 'Peinture', 'Jardin', 'Outillage', 'Sanitaire', 'Cuisine', 'Entretien', 'Automobile', 'Sécurité']
const SEED_BRANDS = ['Astral', 'Facom', 'Stanley', 'Bosch', 'Schneider', 'Générique']
const SEED_UNITS = ['Pièce', 'Carton', 'Sac', 'Litre', 'Kg', 'Mètre', 'Boîte']

function seedSales(products: Product[]): Sale[] {
  const sales: Sale[] = []
  const now = new Date()
  for (let d = 13; d >= 0; d--) {
    const count = 2 + Math.floor(Math.random() * 4)
    for (let s = 0; s < count; s++) {
      const items: SaleItem[] = []
      const nItems = 1 + Math.floor(Math.random() * 3)
      let total = 0
      let profit = 0
      for (let it = 0; it < nItems; it++) {
        const p = products[Math.floor(Math.random() * products.length)]
        const qty = 1 + Math.floor(Math.random() * 3)
        items.push({ productId: p.id, name: p.name, price: p.price, qty })
        total += p.price * qty
        profit += (p.price - p.cost) * qty
      }
      const date = new Date(now)
      date.setDate(now.getDate() - d)
      date.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0)
      const r = Math.random()
      sales.push({
        id: uid() + s,
        date: date.toISOString(),
        items,
        total,
        profit,
        payment: r < 0.7 ? 'especes' : r < 0.9 ? 'carte' : 'credit',
      })
    }
  }
  return sales.sort((a, b) => a.date.localeCompare(b.date))
}

function iso(daysAgo: number, h = 10, m = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

/**
 * Jeu de démonstration. DÉSACTIVÉ par défaut : en production, un appareil neuf
 * doit démarrer VIDE et passer par l'assistant de configuration — jamais avec
 * des ventes, clients ou produits fictifs risquant d'être pris pour du réel.
 * Réactivable pour une démonstration commerciale : NEXT_PUBLIC_DEMO_DATA=1.
 */
export const DEMO_DATA = process.env.NEXT_PUBLIC_DEMO_DATA === '1'

// Collections transactionnelles : vides au premier lancement en production.
const EMPTY_ON_FIRST_RUN = [
  'sales', 'clients', 'clientPayments', 'credits', 'loyalty', 'suppliers',
  'supplierPayments', 'expenses', 'purchases', 'movements', 'quotes',
  'returns', 'transfers', 'activity', 'sessions', 'lots', 'purchaseRequests',
] as const

export function ensureSeeded() {
  if (typeof window === 'undefined') return

  // Production : on pose des collections VIDES avant les blocs de démonstration
  // ci-dessous ; ceux-ci ne s'exécutent que si la clé est absente, donc ils sont
  // naturellement ignorés. Aucun autre code n'a besoin d'être modifié.
  if (!DEMO_DATA) {
    for (const name of EMPTY_ON_FIRST_RUN) {
      const key = (K as unknown as Record<string, string>)[name]
      if (key && !localStorage.getItem(key)) save(key, [])
    }
    if (!storageGet(K.products)) save(K.products, [])
    if (!localStorage.getItem(K.users)) {
      // Un seul compte administrateur SANS identifiant : l'assistant de
      // configuration demandera de définir mot de passe et code PIN.
      save(K.users, [{ id: 'u1', name: 'Administrateur', phone: '', role: 'Administrateur', active: true }] satisfies AppUser[])
    }
  }

  if (!storageGet(K.products)) {
    save(K.products, seedProducts.map((p, i) => ({ ...p, id: `p${i + 1}` })))
  }
  const products = load<Product[]>(K.products, [])

  if (!localStorage.getItem(K.sales)) save(K.sales, seedSales(products))
  if (!localStorage.getItem(K.clients)) {
    save(K.clients, [
      {
        id: 'c1', name: 'Ahmed Bennani', phone: '0661 23 45 67', email: 'ahmed.bennani@gmail.com',
        address: '12 Rue des Orangers', city: 'Casablanca', cin: 'BK123456', clientType: 'Particulier',
        creditLimit: 1000, notes: '', creditDueDate: iso(-5), discountBalance: 0,
        credit: 350, totalSpent: 4820, points: 96,
      },
      {
        id: 'c2', name: 'Fatima Zahra', phone: '0662 88 99 00', email: 'fatima.zahra@gmail.com',
        address: '5 Avenue Hassan II', city: 'Casablanca', cin: '', clientType: 'Particulier',
        creditLimit: 500, notes: '', discountBalance: 0,
        credit: 0, totalSpent: 2140, points: 42,
      },
      {
        id: 'c3', name: 'Mohammed Alami', phone: '0663 44 55 66', email: 'contact@alami-btp.ma',
        address: '48 Zone Industrielle Sidi Bernoussi', city: 'Casablanca', cin: '', clientType: 'Professionnel',
        creditLimit: 5000, notes: 'Client BTP — commandes groupées fréquentes', creditDueDate: iso(-2), discountBalance: 0,
        credit: 120, totalSpent: 6375, points: 127,
      },
      {
        id: 'c4', name: 'Karim El Fassi', phone: '0664 11 22 33', email: 'karim.elfassi@gmail.com',
        address: '3 Rue Ibn Sina', city: 'Rabat', cin: 'RB98765', clientType: 'Particulier',
        creditLimit: 300, notes: '', discountBalance: 0,
        credit: 0, totalSpent: 980, points: 19,
      },
    ] satisfies Client[])
  }
  if (!localStorage.getItem(K.clientPayments)) {
    save(K.clientPayments, [
      { id: 'cp1', date: iso(6, 14, 0), clientId: 'c1', clientName: 'Ahmed Bennani', amount: 200, method: 'especes', note: 'Règlement partiel' },
      { id: 'cp2', date: iso(3, 10, 30), clientId: 'c3', clientName: 'Mohammed Alami', amount: 500, method: 'virement', note: 'Règlement partiel' },
    ] satisfies ClientPayment[])
  }
  if (!localStorage.getItem(K.credits)) {
    save(K.credits, [
      {
        id: 'cr1', ref: 'CR-000001', date: iso(20, 11, 0), clientId: 'c1', clientName: 'Ahmed Bennani',
        saleId: 'seed-c1', invoiceRef: 'FCT-000101',
        items: [{ productId: 'p9', name: 'Vis assorties 1kg', price: 40, qty: 10 }, { productId: 'p3', name: 'Ampoule LED 12W', price: 25, qty: 6 }],
        amount: 550, paid: 200, dueDate: iso(-5),
        payments: [{ id: 'ci1', date: iso(6, 14, 0), amount: 200, method: 'especes', note: 'Règlement partiel' }],
      },
      {
        id: 'cr2', ref: 'CR-000002', date: iso(10, 9, 30), clientId: 'c3', clientName: 'Mohammed Alami',
        saleId: 'seed-c3', invoiceRef: 'FCT-000102',
        items: [{ productId: 'p4', name: 'Câble électrique 2.5mm (10m)', price: 95, qty: 4 }, { productId: 'p10', name: 'Clous 1kg', price: 28, qty: 8 }],
        amount: 620, paid: 500, dueDate: iso(-2),
        payments: [{ id: 'ci2', date: iso(3, 10, 30), amount: 500, method: 'virement', note: 'Règlement partiel' }],
      },
    ] satisfies Credit[])
  }
  if (!localStorage.getItem(K.loyalty)) {
    save(K.loyalty, [
      { id: 'lm1', date: iso(6), clientId: 'c1', clientName: 'Ahmed Bennani', type: 'gain', points: 24, note: 'Achat en magasin' },
      { id: 'lm2', date: iso(3), clientId: 'c3', clientName: 'Mohammed Alami', type: 'gain', points: 40, note: 'Achat en magasin' },
    ] satisfies LoyaltyMovement[])
  }
  if (!localStorage.getItem(K.settings)) save(K.settings, DEFAULT_SETTINGS)
  if (!localStorage.getItem(K.catAttr)) save(K.catAttr, SEED_CATEGORIES.map((name, i) => ({ id: `cat${i}`, name })))
  if (!localStorage.getItem(K.brandAttr)) save(K.brandAttr, SEED_BRANDS.map((name, i) => ({ id: `br${i}`, name })))
  if (!localStorage.getItem(K.unitAttr)) save(K.unitAttr, SEED_UNITS.map((name, i) => ({ id: `un${i}`, name })))

  if (!localStorage.getItem(K.suppliers)) {
    save(K.suppliers, [
      { id: 's1', name: 'Comptoir Marocain de Quincaillerie', phone: '0522 30 40 50', address: 'Derb Omar, Casablanca', balance: 2400, totalPurchased: 18600 },
      { id: 's2', name: 'Droguerie Centrale SARL', phone: '0522 61 72 83', address: 'Aïn Sebaâ, Casablanca', balance: 0, totalPurchased: 9400 },
      { id: 's3', name: 'ElectroPlus Distribution', phone: '0537 20 21 22', address: 'Rabat', balance: 860, totalPurchased: 5200 },
    ])
  }
  if (!localStorage.getItem(K.supplierPayments)) {
    save(K.supplierPayments, [
      { id: 'sp1', date: iso(4, 11, 0), supplierId: 's1', supplierName: 'Comptoir Marocain de Quincaillerie', amount: 1600, method: 'virement', note: 'Règlement partiel BC-0001' },
      { id: 'sp2', date: iso(2, 9, 0), supplierId: 's3', supplierName: 'ElectroPlus Distribution', amount: 800, method: 'especes', note: 'Règlement partiel' },
    ] satisfies SupplierPayment[])
  }
  if (!localStorage.getItem(K.expenses)) {
    save(K.expenses, [
      { id: 'ex1', date: iso(9, 9, 0), category: 'Loyer', label: 'Loyer entrepôt principal', amount: 15000, status: 'payee', note: '' },
      { id: 'ex2', date: iso(11, 10, 0), category: 'Électricité', label: 'Facture Lydec — Février', amount: 2450, status: 'a_payer', dueDate: iso(-2, 12, 0), note: '' },
      { id: 'ex3', date: iso(16, 14, 0), category: 'Assurance', label: 'RC Professionnelle AXA', amount: 8200, status: 'retard', dueDate: iso(3, 12, 0), note: '' },
      { id: 'ex4', date: iso(20, 9, 30), category: 'Bureau', label: 'Consommables informatiques', amount: 1200, status: 'payee', note: '' },
      { id: 'ex5', date: iso(6, 11, 0), category: 'Internet', label: 'Abonnement fibre — Mars', amount: 899, status: 'payee', note: '' },
      { id: 'ex6', date: iso(14, 8, 0), category: 'Fournitures', label: 'Sacs et emballages', amount: 1650, status: 'payee', note: '' },
      { id: 'ex7', date: iso(28, 9, 0), category: 'Transport', label: 'Location camionnette livraison', amount: 950, status: 'payee', note: '' },
      { id: 'ex8', date: iso(35, 10, 0), category: 'Loyer', label: 'Loyer entrepôt — mois précédent', amount: 15000, status: 'payee', note: '' },
      { id: 'ex9', date: iso(40, 9, 0), category: 'Électricité', label: 'Facture Lydec — Janvier', amount: 2100, status: 'payee', note: '' },
    ] satisfies Expense[])
  }

  if (!localStorage.getItem(K.purchases)) {
    save(K.purchases, [
      {
        id: 'po1', ref: 'BC-0001', date: iso(6, 9, 30), supplierId: 's1', supplierName: 'Comptoir Marocain de Quincaillerie',
        items: [
          { productId: 'p9', name: 'Vis assorties 1kg', cost: 25, qty: 40 },
          { productId: 'p10', name: 'Clous 1kg', cost: 18, qty: 30 },
        ],
        total: 40 * 25 + 30 * 18, paid: 0, status: 'recue',
      },
      {
        id: 'po2', ref: 'BC-0002', date: iso(1, 11, 0), supplierId: 's3', supplierName: 'ElectroPlus Distribution',
        items: [
          { productId: 'p3', name: 'Ampoule LED 12W', cost: 15, qty: 100 },
          { productId: 'p4', name: 'Câble électrique 2.5mm (10m)', cost: 70, qty: 20 },
        ],
        total: 100 * 15 + 20 * 70, paid: 0, status: 'en_attente',
      },
    ])
  }

  if (!localStorage.getItem(K.movements)) {
    save(K.movements, [
      { id: 'm1', date: iso(6, 9, 45), productId: 'p9', productName: 'Vis assorties 1kg', type: 'reception', qty: 40, note: 'BC-0001' },
      { id: 'm2', date: iso(6, 9, 45), productId: 'p10', productName: 'Clous 1kg', type: 'reception', qty: 30, note: 'BC-0001' },
      { id: 'm3', date: iso(4, 15, 10), productId: 'p1', productName: 'Peinture blanche 5L', type: 'sortie', qty: -1, note: 'Pot endommagé' },
      { id: 'm4', date: iso(2, 10, 5), productId: 'p12', productName: 'Javel 5L', type: 'entree', qty: 24, note: 'Livraison directe' },
    ] satisfies StockMovement[])
  }

  if (!localStorage.getItem(K.quotes)) {
    save(K.quotes, [
      {
        id: 'q1', ref: 'DEV-0001', date: iso(3, 12, 0), clientName: 'Société Atlas Bâtiment',
        items: [
          { productId: 'p1', name: 'Peinture blanche 5L', price: 185, qty: 10 },
          { productId: 'p14', name: 'Pinceau 50mm', price: 15, qty: 12 },
        ],
        total: 185 * 10 + 15 * 12, status: 'en_attente',
      },
    ] satisfies Quote[])
  }

  if (!localStorage.getItem(K.returns)) save(K.returns, [])
  if (!localStorage.getItem(K.cash)) {
    save(K.cash, [
      { id: 'ce1', date: iso(0, 9, 15), type: 'depense', label: 'Transport livraison', amount: 80 },
    ] satisfies CashEntry[])
  }
  if (!localStorage.getItem(K.sessions)) {
    save(K.sessions, [
      { id: 'rs1', openedAt: iso(0, 8, 30), openingAmount: 500 },
    ] satisfies RegisterSession[])
  }
  if (!localStorage.getItem(K.users)) {
    save(K.users, [
      { id: 'u1', name: 'Yassir A.', phone: '0661 00 00 00', role: 'Administrateur', active: true },
      { id: 'u2', name: 'Hamid Tazi', phone: '0662 11 22 33', role: 'Caissier', active: true },
      { id: 'u3', name: 'Sara Mansouri', phone: '0663 44 55 66', role: 'Vendeur', active: false },
    ] satisfies AppUser[])
  }
  if (!localStorage.getItem(K.activity)) {
    save(K.activity, [
      { id: 'a1', date: iso(0, 8, 30), user: 'Yassir A.', action: 'Ouverture de caisse (500,00 DH)' },
    ] satisfies ActivityLog[])
  }

  if (!localStorage.getItem(K.transfers)) save(K.transfers, [])

  ensureStores()
}

/**
 * Multi-store migration. Creates a "Magasin Principal" the first time and stamps
 * every existing scoped record (and users) with its id, so no legacy data is lost.
 * Idempotent: records that already carry a storeId are left untouched.
 */
export function ensureStores() {
  if (typeof window === 'undefined') return

  let stores = load<Store[]>(K.stores, [])
  if (stores.length === 0) {
    const main: Store = {
      id: 'main',
      name: 'Magasin Principal',
      code: 'PR',
      address: load<Partial<Settings>>(K.settings, {}).address ?? 'Casablanca, Maroc',
      city: load<Partial<Settings>>(K.settings, {}).city ?? 'Casablanca',
      phone: load<Partial<Settings>>(K.settings, {}).phone ?? '',
      email: load<Partial<Settings>>(K.settings, {}).email ?? '',
      manager: '',
      logoDataUrl: load<Partial<Settings>>(K.settings, {}).logoDataUrl ?? '',
      ice: load<Partial<Settings>>(K.settings, {}).ice ?? '',
      idFiscal: load<Partial<Settings>>(K.settings, {}).idFiscal ?? '',
      docPrefix: '',
      active: true,
      createdAt: new Date().toISOString(),
    }
    stores = [main]
    save(K.stores, stores)
  }
  const mainId = stores[0].id

  // Stamp every legacy scoped record with the main store id.
  SCOPED_KEYS.forEach((key) => {
    const arr = load<Array<Record<string, unknown>>>(key, [])
    let changed = false
    const next = arr.map((r) => {
      if (r && r.storeId) return r
      changed = true
      return { ...r, storeId: mainId }
    })
    if (changed) save(key, next)
  })

  // Give every legacy user access to the main store.
  const users = load<AppUser[]>(K.users, [])
  if (users.some((u) => !u.storeIds && !u.storeId)) {
    save(
      K.users,
      users.map((u) => (u.storeIds || u.storeId ? u : { ...u, storeId: mainId, storeIds: [mainId] }))
    )
  }

  if (!localStorage.getItem(K.depots)) {
    save(K.depots, [
      { id: uid(), storeId: mainId, name: 'Dépôt principal', address: '', responsable: '' },
    ] satisfies Depot[])
  }
  if (!localStorage.getItem(K.activeStore)) save(K.activeStore, mainId)
}

export function loadStores(): Store[] {
  ensureSeeded()
  return load<Store[]>(K.stores, [])
}

export function getActiveStoreId(): string {
  if (typeof window === 'undefined') return ''
  ensureSeeded()
  const stored = load<string>(K.activeStore, '')
  const stores = load<Store[]>(K.stores, [])
  if (stored && stores.some((s) => s.id === stored)) return stored
  return stores[0]?.id ?? ''
}

export function setActiveStoreId(id: string) {
  save(K.activeStore, id)
}

/** Build a store-prefixed document number, e.g. FAC-TNG-000012. */
/**
 * Numéro de facture d'une vente, au format des réglages : préfixe + année +
 * numéro de départ incrémenté (« FAC-2026-1000 »).
 *
 * Les ventes encaissées AVANT l'existence du champ `invoiceNo` n'en portent
 * pas : leur numéro est alors déduit de leur rang chronologique dans l'année,
 * ce qui donne la même suite lisible. C'est un repli, pas la règle — toute
 * vente nouvelle porte son numéro définitif.
 */
export function saleInvoiceNumber(sale: Sale, allSales: Sale[], settings: Settings): string {
  if (sale.invoiceNo) return sale.invoiceNo
  const annee = new Date(sale.date).getFullYear()
  return `${settings.invoicePrefix}${annee}-${settings.invoiceStartNumber + rangAnnuel(sale, allSales)}`
}

/**
 * Rang chronologique d'un document parmi ceux du même magasin et de la même
 * année — la base commune des numérotations séquentielles.
 */
function rangAnnuel<R extends { id: string; date: string; storeId?: string }>(doc: R, tous: R[]): number {
  const annee = new Date(doc.date).getFullYear()
  const memeAnnee = tous
    .filter((d) => (d.storeId ?? '') === (doc.storeId ?? '') && new Date(d.date).getFullYear() === annee)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  return Math.max(0, memeAnnee.findIndex((d) => d.id === doc.id))
}

/** « FAC-2026-1000 » → « BL-2026-1000 » : on ne change que le préfixe. */
function changerPrefixe(numero: string, prefixe: string): string {
  const suffixe = /(\d{4}-\d+)$/.exec(numero)?.[1]
  return suffixe ? `${prefixe}${suffixe}` : `${prefixe}${numero}`
}

/**
 * Numéro d'avoir : posé à l'enregistrement du retour, sinon déduit du rang.
 */
export function saleReturnNumber(ret: SaleReturn, allReturns: SaleReturn[], settings: Settings): string {
  if (ret.creditNo) return ret.creditNo
  const annee = new Date(ret.date).getFullYear()
  return `AV-${annee}-${settings.invoiceStartNumber + rangAnnuel(ret, allReturns)}`
}

/**
 * Numéro de bon de livraison.
 *
 * Il n'existe pas de document « BL » distinct : le bon se tire d'une vente au
 * moment de l'imprimer. Son numéro reprend donc le RANG de la facture de
 * cette vente, avec son propre préfixe — le BL et la facture d'une même vente
 * se répondent, ce qu'un numéro indépendant ne permettrait pas.
 */
export function deliveryNoteNumber(sale: Sale, allSales: Sale[], settings: Settings): string {
  return changerPrefixe(saleInvoiceNumber(sale, allSales, settings), 'BL-')
}

export function docNumber(base: string, store: Store | null | undefined, seq: number, pad = 6): string {
  const code = (store?.docPrefix || store?.code || '').trim().toUpperCase()
  const num = String(seq).padStart(pad, '0')
  return code ? `${base}-${code}-${num}` : `${base}-${num}`
}

// Normalizers for data created by older versions of the app
const normProduct = (p: Product): Product => ({
  ...p,
  brand: p.brand ?? '',
  unit: p.unit ?? 'Pièce',
})
type LegacyClient = Partial<Client> & Pick<Client, 'id' | 'name' | 'phone' | 'credit' | 'totalSpent' | 'points'>
const normClient = (c: LegacyClient): Client => ({
  email: '',
  address: '',
  city: '',
  cin: '',
  clientType: 'Particulier',
  creditLimit: 0,
  notes: '',
  discountBalance: 0,
  ...c,
  points: c.points ?? 0,
})

export function loadProducts(): Product[] {
  ensureSeeded()
  return load<Product[]>(K.products, []).map(normProduct)
}

export function resetDemoData() {
  Object.values(K).forEach((k) => localStorage.removeItem(k))
  productsRemove() // produits stockés dans IndexedDB
  ensureSeeded()
}

// ------------------------------------------------------------------
// Held sales (POS suspend/resume)
// ------------------------------------------------------------------

export function loadHeldSales(): HeldSale[] {
  return load<HeldSale[]>(K.held, [])
}

export function saveHeldSales(held: HeldSale[]) {
  save(K.held, held)
}

// ------------------------------------------------------------------
// CSV / backup helpers
// ------------------------------------------------------------------

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob(['﻿' + content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export function exportSalesCSV(sales: Sale[]) {
  const rows = [['N°', 'Date', 'Articles', 'Paiement', 'Total DH', 'Profit DH']]
  sales.forEach((s) =>
    rows.push([
      s.id,
      new Date(s.date).toLocaleString('fr-FR'),
      String(s.items.reduce((a, i) => a + i.qty, 0)),
      PAYMENT_META[s.payment].label,
      s.total.toFixed(2),
      s.profit.toFixed(2),
    ])
  )
  downloadFile('ventes-droguerie.csv', rows.map((r) => r.join(';')).join('\n'), 'text/csv;charset=utf-8')
}

const PRODUCT_CSV_HEADER = ['Nom', 'Code-barres', 'Catégorie', 'Sous-catégorie', 'Marque', 'Unité', 'Prix achat', 'Prix vente', 'Stock', 'Stock min']
const productCsvRow = (p: Product) => [p.name, p.barcode, p.category, p.subcategory ?? '', p.brand, p.unit, p.cost.toFixed(2), p.price.toFixed(2), String(p.stock), String(p.minStock)]

export function exportProductsCSV(products: Product[]) {
  const rows = [PRODUCT_CSV_HEADER, ...products.map(productCsvRow)]
  downloadFile('produits-droguerie.csv', rows.map((r) => r.join(';')).join('\n'), 'text/csv;charset=utf-8')
}

/** Export CSV asynchrone par lots, avec progression (0→100), sans figer l'UI. */
export async function exportProductsCSVAsync(products: Product[], onProgress?: (pct: number) => void) {
  const CHUNK = 2000
  const lines: string[] = [PRODUCT_CSV_HEADER.join(';')]
  for (let i = 0; i < products.length; i += CHUNK) {
    const part = products.slice(i, i + CHUNK)
    for (const p of part) lines.push(productCsvRow(p).join(';'))
    onProgress?.(Math.min(100, Math.round(((i + part.length) / Math.max(1, products.length)) * 100)))
    await new Promise((r) => setTimeout(r, 0)) // laisse l'UI se rafraîchir
  }
  onProgress?.(100)
  downloadFile('produits-droguerie.csv', lines.join('\n'), 'text/csv;charset=utf-8')
}

/** Parse a products CSV (semicolon or comma separated, FR headers accepted). Returns parsed rows. */
export function parseProductsCSV(text: string): Omit<Product, 'id'>[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const sep = lines[0].includes(';') ? ';' : ','
  const header = lines[0].split(sep).map((h) => h.trim().toLowerCase())
  const idx = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)))
  const iName = idx('nom', 'name', 'produit')
  const iBarcode = idx('code', 'barcode')
  const iCat = idx('cat')
  // « sous-catégorie » contient aussi « cat » : on la cherche séparément, sinon
  // la sous-catégorie était purement et simplement perdue à l'import.
  const iSub = header.findIndex((h) => h.includes('sous') || h.startsWith('sub'))
  const iBrand = idx('marque', 'brand')
  const iUnit = idx('unit')
  const iCost = idx('achat', 'cost', 'cout', 'coût')
  const iPrice = idx('vente', 'prix vente', 'price')
  const iStock = header.findIndex((h) => h === 'stock' || h.includes('quantit'))
  const iMin = idx('min')
  if (iName < 0) return []
  const num = (v?: string) => parseFloat((v ?? '').replace(',', '.')) || 0
  // Mutualisation des chaînes répétées (catégorie, sous-catégorie, marque, unité) :
  // sur 50 000 lignes il n'existe que ~300 valeurs distinctes. Sans ça, chaque
  // produit détient sa propre copie → 200 000 chaînes au lieu de ~300, ce qui
  // faisait saturer la mémoire de l'onglet pendant l'import (plantage « This page
  // couldn't load »).
  const pool = new Map<string, string>()
  const intern = (v: string) => {
    const hit = pool.get(v)
    if (hit !== undefined) return hit
    pool.set(v, v)
    return v
  }
  const out: Omit<Product, 'id'>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep)
    const name = (cols[iName] ?? '').trim()
    if (!name) continue
    out.push({
      name,
      barcode: iBarcode >= 0 ? (cols[iBarcode] ?? '').trim() : '',
      category: intern((iCat >= 0 && cols[iCat]?.trim()) || 'Divers'),
      subcategory: iSub >= 0 ? intern((cols[iSub] ?? '').trim()) : '',
      brand: iBrand >= 0 ? intern((cols[iBrand] ?? '').trim()) : '',
      unit: intern((iUnit >= 0 && cols[iUnit]?.trim()) || 'Pièce'),
      cost: iCost >= 0 ? num(cols[iCost]) : 0,
      price: iPrice >= 0 ? num(cols[iPrice]) : 0,
      stock: iStock >= 0 ? Math.round(num(cols[iStock])) : 0,
      minStock: iMin >= 0 ? Math.round(num(cols[iMin])) : 5,
    })
  }
  return out
}

export interface Backup {
  id: string
  date: string
  label: string
  data: Record<string, unknown>
}

/**
 * Même empreinte que celle calculée par le serveur (sha256 tronqué), pour
 * pouvoir comparer un ancien repère au format URL avec le nouveau format.
 */
async function sha256Hex(input: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
  } catch {
    return '' // crypto.subtle indisponible (http) : on préfère ne pas conclure
  }
}

export function listBackups(): Backup[] {
  return load<Backup[]>(K.backups, [])
}

export function createBackup(label: string): Backup {
  const data: Record<string, unknown> = {}
  Object.entries(K).forEach(([, key]) => {
    if (key === K.backups) return
    const raw = localStorage.getItem(key)
    if (raw) data[key] = JSON.parse(raw)
  })
  const backup: Backup = { id: uid(), date: new Date().toISOString(), label, data }
  const all = [backup, ...listBackups()].slice(0, 5)
  save(K.backups, all)
  return backup
}

export function restoreBackup(backup: Backup) {
  Object.entries(backup.data).forEach(([key, value]) => save(key, value))
}

export function deleteBackup(id: string) {
  save(K.backups, listBackups().filter((b) => b.id !== id))
}

export function exportAllJSON() {
  const data: Record<string, unknown> = {}
  Object.values(K).forEach((key) => {
    const raw = storageGet(key)
    if (raw) data[key] = JSON.parse(raw)
  })
  downloadFile('droguerie-sauvegarde.json', JSON.stringify(data, null, 2), 'application/json')
}

export function importAllJSON(text: string): boolean {
  try {
    const data = JSON.parse(text)
    if (!data || typeof data !== 'object' || !data[K.products]) return false
    Object.entries(data).forEach(([key, value]) => {
      if (Object.values(K).includes(key)) save(key, value)
    })
    return true
  } catch {
    return false
  }
}

// ------------------------------------------------------------------
// Main hook
// ------------------------------------------------------------------

/**
 * VUE D'UNE COLLECTION LIMITÉE AU MAGASIN ACTIF, MÉMORISÉE.
 *
 * Ce filtrage était refait à CHAQUE rendu du provider, pour une quinzaine de
 * collections dont certaines dépassent les 100 000 lignes — et le moindre
 * changement d'état (une frappe au clavier dans une page, une vente, un toast)
 * rejouait l'ensemble.
 *
 * Le coût du filtre n'était que la moitié du problème : `filter()` renvoyant un
 * nouveau tableau à chaque fois, toutes les pages voyaient leurs dépendances
 * changer et recalculaient leurs propres `useMemo` — l'invalidation se
 * propageait à toute l'application.
 *
 * Une mémorisation PAR collection (et non un seul memo global) est ce qui
 * compte : enregistrer une vente ne doit pas invalider la vue des mouvements,
 * des lots ou des crédits.
 */
function useScopedList<R extends { storeId?: string }>(arr: R[], storeId: string): R[] {
  return useMemo(() => arr.filter((r) => r.storeId === storeId), [arr, storeId])
}

// Hook interne : contient TOUT l'état + les actions. Appelé UNE SEULE FOIS par le
// DroguerieProvider (voir lib/droguerie-provider.tsx). Les pages consomment via le
// contexte partagé `useDroguerie()` → les 55 000 produits ne sont chargés qu'une fois.
export function useDroguerieState() {
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [returns, setReturns] = useState<SaleReturn[]>([])
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [cash, setCash] = useState<CashEntry[]>([])
  const [sessions, setSessions] = useState<RegisterSession[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [categories, setCategories] = useState<Attribute[]>([])
  const [subcategories, setSubcategories] = useState<Attribute[]>([])
  const [brands, setBrands] = useState<Attribute[]>([])
  const [units, setUnits] = useState<Attribute[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([])
  const [credits, setCredits] = useState<Credit[]>([])
  const [loyaltyMovements, setLoyaltyMovements] = useState<LoyaltyMovement[]>([])
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [revenues, setRevenues] = useState<Revenue[]>([])
  const [moneyTransfers, setMoneyTransfers] = useState<MoneyTransfer[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [depots, setDepots] = useState<Depot[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [allees, setAllees] = useState<Allee[]>([])
  const [rayons, setRayons] = useState<Rayon[]>([])
  const [etageres, setEtageres] = useState<Etagere[]>([])
  const [niveaux, setNiveaux] = useState<Niveau[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [emplacements, setEmplacements] = useState<Emplacement[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [exercices, setExercices] = useState<FiscalYear[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [rfqs, setRfqs] = useState<Rfq[]>([])
  const [activeStoreId, setActiveStoreIdState] = useState<string>('')
  const [ready, setReady] = useState(false)
  // Étape de démarrage affichée sous le loader plein écran (diagnostic + confort).
  const [bootPhase, setBootPhase] = useState('')

  // A ref so the memoized persist wrappers always stamp with the current store id.
  const activeStoreRef = useRef('')
  activeStoreRef.current = activeStoreId

  // Ref miroir de `users` : les mutations consécutives (ex. réinitialisation de
  // tous les comptes en boucle) se composent au lieu de repartir d'une liste périmée.
  const usersRef = useRef<AppUser[]>([])
  usersRef.current = users

  useEffect(() => {
    // Lit tout le localStorage dans l'état React. Rejoué quand la synchro
    // rapatrie des changements d'un autre appareil (événement 'droguerie-sync-pull').
    // `only` = collections réellement modifiées par la synchro (undefined au
    // démarrage = tout charger). Recharger les produits coûte un JSON.parse de
    // ~15 Mo + normProduct sur des dizaines de milliers d'objets : on l'évite
    // quand la synchro n'a rapatrié que des ventes, des logs, etc.
    const loadAll = (only?: string[]) => {
      const wants = (name: string) => !only || only.includes(name)
      if (wants('products')) setProducts(load<Product[]>(K.products, []).map(normProduct))
      if (wants('sales')) setSales(load(K.sales, []))
      setClients(load<Client[]>(K.clients, []).map(normClient))
      setSuppliers(load(K.suppliers, []))
      if (wants('movements')) setMovements(load(K.movements, []))
      if (wants('lots')) setLots(load(K.lots, []))
      if (wants('purchaseRequests')) setPurchaseRequests(load(K.purchaseRequests, []))
      setPurchases(load(K.purchases, []))
      setQuotes(load(K.quotes, []))
      setReturns(load(K.returns, []))
      setCash(load(K.cash, []))
      setSessions(load(K.sessions, []))
      setUsers(load(K.users, []))
      setActivity(load(K.activity, []))
      setCategories(load(K.catAttr, []))
      setSubcategories(load(K.subcatAttr, []))
      setBrands(load(K.brandAttr, []))
      setUnits(load(K.unitAttr, []))
      setClientPayments(load(K.clientPayments, []))
      setCredits(load(K.credits, []))
      setLoyaltyMovements(load(K.loyalty, []))
      setSupplierPayments(load(K.supplierPayments, []))
      setExpenses(load(K.expenses, []))
      setRevenues(load(K.revenues, []))
      setMoneyTransfers(load(K.moneyTransfers, []))
      setStores(load(K.stores, []))
      {
        const norm = normalizeDepotCodes(load<Depot[]>(K.depots, []))
        setDepots(norm.list)
        if (norm.changed) save(K.depots, norm.list) // corrige une fois les codes en double/absents
      }
      setZones(load(K.zones, []))
      setAllees(load(K.allees, []))
      setRayons(load(K.rayons, []))
      setEtageres(load(K.etageres, []))
      setNiveaux(load(K.niveaux, []))
      setPositions(load(K.positions, []))
      setEmplacements(load(K.emplacements, []))
      setTransfers(load(K.transfers, []))
      if (wants('inventories')) setInventories(load(K.inventories, []))
      if (wants('creditNotes')) setCreditNotes(load(K.creditNotes, []))
      setExercices(load(K.exercices, []))
      setBudgets(load(K.budgets, []))
      setInvestments(load(K.investments, []))
      setRfqs(load(K.rfqs, []))
      setActiveStoreIdState(getActiveStoreId())
      const reglages = { ...DEFAULT_SETTINGS, ...load<Partial<Settings>>(K.settings, {}) }
      setCurrencySymbol(reglages.currency)
      setSettings(reglages)
      setReady(true)
    }

    const boot = async () => {
      const t0 = performance.now()
      const mark = (phase: string, label: string) => {
        setBootPhase(label)
        console.info(`[boot] ${phase} @ ${Math.round(performance.now() - t0)} ms`)
      }
      // Charge d'abord le cache produits depuis IndexedDB (migre l'ancien localStorage).
      mark('idb', 'Lecture du catalogue local…')
      await initProductCache()

      // Réparation du stockage AVANT toute écriture. Un logo enregistré en
      // pleine résolution peut à lui seul dépasser le plafond de localStorage :
      // tant qu'il n'est pas réduit, plus rien ne peut être enregistré — et
      // surtout pas le rapatriement qui suit.
      try {
        const bilan = await compacterImagesStockees()
        if (bilan.images > 0) {
          console.info(`[boot] stockage: ${bilan.images} image(s) réduite(s), ${Math.round(bilan.octets / 1024)} Ko rendus (${bilan.cles.join(', ')})`)
        }
      } catch { /* la réparation ne doit jamais empêcher le démarrage */ }

      // Détection d'un CHANGEMENT DE BASE Turso (migration de compte/quota). Si la
      // base configurée diffère de celle mémorisée, les données locales appartiennent
      // à l'ancienne base : on les efface pour repartir proprement de la nouvelle
      // (sinon l'appareil re-pousserait son ancien catalogue et regonflerait la
      // nouvelle base). Automatique et sûr pour TOUS les appareils.
      try {
        // L'URL de la base n'est plus connue du navigateur : le serveur renvoie
        // une EMPREINTE stable, suffisante pour détecter un changement de base.
        const dbId = (await syncStatus()).dbId
        if (dbId) {
          const stored = localStorage.getItem('dp_db_id')
          const localHasData = !!storageGet(K.products) || !!localStorage.getItem(K.stores)

          // Les appareils antérieurs ont mémorisé l'URL BRUTE, pas l'empreinte.
          // Sans cette conversion, le simple changement de format ferait croire
          // à un changement de base et effacerait tout le local à tort.
          const isLegacyUrl = !!stored && /^(libsql|https?):\/\//.test(stored)
          const storedId = isLegacyUrl ? await sha256Hex(stored as string) : stored

          // Effacer le local est IRRÉVERSIBLE : on ne le fait que sur un
          // changement de base réellement constaté (deux empreintes connues et
          // différentes), jamais sur une simple absence de repère.
          const switched = !!storedId && storedId !== dbId
          if (switched) {
            mark('dbswitch', 'Nouvelle base : réinitialisation locale…')
            // Filet de sécurité : une copie horodatée avant l'effacement.
            try { createBackup(`Avant changement de base — ${new Date().toLocaleString('fr-FR')}`) } catch {}
            for (const key of Object.values(K)) {
              if (key === K.backups) continue // on garde les sauvegardes locales
              if (key === K.products) productsRemove()
              else localStorage.removeItem(key)
            }
            localStorage.removeItem('dp_sync_cursor')
          } else if (!storedId && localHasData) {
            // Données présentes sans repère : on adopte l'empreinte courante
            // sans rien détruire — l'utilisateur reste maître de ses données.
            console.info('[boot] base inconnue, aucune donnée effacée')
          }
          localStorage.setItem('dp_db_id', dbId)
        }
      } catch { /* ignore : au pire on garde l'ancien local */ }

      // Appareil neuf : on tente de rapatrier les vraies données. L'appel exige
      // une session serveur — au tout premier lancement il échoue (personne n'est
      // encore connecté) et l'app démarre VIDE ; la synchro hydratera l'appareil
      // juste après la connexion. C'est le comportement voulu en production.
      const fresh = !storageGet(K.products) && !localStorage.getItem(K.stores)
      if (fresh) {
        try {
          mark('bootstrap', 'Première synchronisation…')
          const hadRemote = await bootstrapFromRemote()
          if (!hadRemote) ensureSeeded()
        } catch {
          ensureSeeded() // pas de session / hors-ligne : démarrage local
        }
      } else {
        ensureSeeded()
      }
      mark('parse', 'Préparation des données…')
      loadAll()
      mark('ready', '')
      // Active la synchro APRÈS le chargement/seed : les écritures suivantes
      // (actions utilisateur) partiront vers Turso ; le seed initial est ignoré.
      startSync()
    }
    void boot()

    const onPull = (e: Event) => {
      const cols = (e as CustomEvent<{ collections?: string[] }>).detail?.collections
      loadAll(cols)
    }
    window.addEventListener('droguerie-sync-pull', onPull)
    return () => window.removeEventListener('droguerie-sync-pull', onPull)
  }, [])

  const makePersist = <T,>(key: string, setter: (v: T) => void) =>
    (next: T) => {
      setter(next)
      save(key, next)
    }

  // Scoped persist: any record still missing a storeId is stamped with the active store,
  // so every mutation transparently tags its new records to the current store.
  const makeScopedPersist = <R extends { storeId?: string }>(key: string, setter: (v: R[]) => void) =>
    (next: R[]) => {
      const sid = activeStoreRef.current
      const stamped = sid ? next.map((r) => (r && r.storeId ? r : { ...r, storeId: sid })) : next
      setter(stamped)
      save(key, stamped)
    }

  /* eslint-disable react-hooks/exhaustive-deps */
  const persistProducts = useCallback(makeScopedPersist<Product>(K.products, setProducts), [])
  const persistSales = useCallback(makeScopedPersist<Sale>(K.sales, setSales), [])
  const persistClients = useCallback(makePersist<Client[]>(K.clients, setClients), [])
  const persistSuppliers = useCallback(makePersist<Supplier[]>(K.suppliers, setSuppliers), [])
  const persistMovements = useCallback(makeScopedPersist<StockMovement>(K.movements, setMovements), [])
  const persistLots = useCallback(makeScopedPersist<Lot>(K.lots, setLots), [])
  const persistPurchaseRequests = useCallback(makeScopedPersist<PurchaseRequest>(K.purchaseRequests, setPurchaseRequests), [])
  const persistPurchases = useCallback(makeScopedPersist<Purchase>(K.purchases, setPurchases), [])
  const persistQuotes = useCallback(makeScopedPersist<Quote>(K.quotes, setQuotes), [])
  const persistReturns = useCallback(makeScopedPersist<SaleReturn>(K.returns, setReturns), [])
  const persistCreditNotes = useCallback(makeScopedPersist<CreditNote>(K.creditNotes, setCreditNotes), [])
  const persistCash = useCallback(makeScopedPersist<CashEntry>(K.cash, setCash), [])
  const persistSessions = useCallback(makeScopedPersist<RegisterSession>(K.sessions, setSessions), [])
  const persistUsers = useCallback(makePersist<AppUser[]>(K.users, setUsers), [])
  const persistActivity = useCallback(makePersist<ActivityLog[]>(K.activity, setActivity), [])
  const persistCategories = useCallback(makePersist<Attribute[]>(K.catAttr, setCategories), [])
  const persistSubcategories = useCallback(makePersist<Attribute[]>(K.subcatAttr, setSubcategories), [])
  const persistBrands = useCallback(makePersist<Attribute[]>(K.brandAttr, setBrands), [])
  const persistUnits = useCallback(makePersist<Attribute[]>(K.unitAttr, setUnits), [])
  const persistClientPayments = useCallback(makeScopedPersist<ClientPayment>(K.clientPayments, setClientPayments), [])
  const persistCredits = useCallback(makeScopedPersist<Credit>(K.credits, setCredits), [])
  const persistLoyalty = useCallback(makeScopedPersist<LoyaltyMovement>(K.loyalty, setLoyaltyMovements), [])
  const persistSupplierPayments = useCallback(makeScopedPersist<SupplierPayment>(K.supplierPayments, setSupplierPayments), [])
  const persistExpenses = useCallback(makeScopedPersist<Expense>(K.expenses, setExpenses), [])
  const persistRevenues = useCallback(makeScopedPersist<Revenue>(K.revenues, setRevenues), [])
  const persistMoneyTransfers = useCallback(makeScopedPersist<MoneyTransfer>(K.moneyTransfers, setMoneyTransfers), [])
  const persistStores = useCallback(makePersist<Store[]>(K.stores, setStores), [])
  const persistDepots = useCallback(makePersist<Depot[]>(K.depots, setDepots), [])
  const persistZones = useCallback(makePersist<Zone[]>(K.zones, setZones), [])
  const persistAllees = useCallback(makePersist<Allee[]>(K.allees, setAllees), [])
  const persistRayons = useCallback(makePersist<Rayon[]>(K.rayons, setRayons), [])
  const persistEtageres = useCallback(makePersist<Etagere[]>(K.etageres, setEtageres), [])
  const persistNiveaux = useCallback(makePersist<Niveau[]>(K.niveaux, setNiveaux), [])
  const persistPositions = useCallback(makePersist<Position[]>(K.positions, setPositions), [])
  const persistEmplacements = useCallback(makePersist<Emplacement[]>(K.emplacements, setEmplacements), [])
  const persistTransfers = useCallback(makePersist<Transfer[]>(K.transfers, setTransfers), [])
  const persistInventories = useCallback(makeScopedPersist<Inventory>(K.inventories, setInventories), [])
  // Exercices : partagés entre magasins (une seule année de gestion pour l'enseigne).
  const persistExercices = useCallback(makePersist<FiscalYear[]>(K.exercices, setExercices), [])
  const persistBudgets = useCallback(makeScopedPersist<Budget>(K.budgets, setBudgets), [])
  const persistInvestments = useCallback(makeScopedPersist<Investment>(K.investments, setInvestments), [])
  const persistRfqs = useCallback(makeScopedPersist<Rfq>(K.rfqs, setRfqs), [])
  /* eslint-enable react-hooks/exhaustive-deps */

  const saveSettings = useCallback((next: Settings) => {
    // Changer la devise doit se voir immédiatement partout : le symbole est
    // relu ici, avant le rendu déclenché par setSettings.
    setCurrencySymbol(next.currency)
    setSettings(next)
    save(K.settings, next)
  }, [])

  const logActivity = (action: string, metaOrBase?: AuditMeta | ActivityLog[]) => {
    const meta: AuditMeta = Array.isArray(metaOrBase) ? { base: metaOrBase } : (metaOrBase ?? {})
    const sid = activeStoreRef.current
    const store = stores.find((s) => s.id === sid)
    let userName = 'Système'
    try { userName = getSession()?.name || userName } catch {}
    const entry: ActivityLog = {
      id: uid(),
      date: new Date().toISOString(),
      user: userName,
      action,
      storeId: sid || undefined,
      storeName: store?.name,
      target: meta.target,
      oldValue: meta.oldValue,
      newValue: meta.newValue,
      kind: meta.kind,
    }
    persistActivity([entry, ...(meta.base ?? activity)].slice(0, 300))
  }

  // Réinitialisation des statistiques : pose la date de début d'exercice
  // (le tableau de bord repart de 0) et journalise l'opération. Ne supprime
  // AUCUNE donnée.
  const resetStats = (userName: string) => {
    const next: Settings = { ...settings, statsResetAt: new Date().toISOString() }
    setSettings(next)
    save(K.settings, next)
    logActivity(`Réinitialisation des statistiques du tableau de bord${userName ? ' par ' + userName : ''}`)
  }

  // ---- Products ----
  const addProduct = (data: Omit<Product, 'id'>) => {
    persistProducts([{ ...data, id: uid() }, ...products])
    logActivity(`Produit ajouté : ${data.name}`)
  }

  const updateProduct = (id: string, data: Partial<Product>) => {
    const prev = products.find((p) => p.id === id)
    persistProducts(products.map((p) => (p.id === id ? { ...p, ...data } : p)))
    // Audit du changement de prix de vente.
    if (prev && data.price !== undefined && data.price !== prev.price) {
      logActivity('Modification du prix', { target: prev.name, oldValue: fmtDH(prev.price), newValue: fmtDH(data.price) })
    }
  }

  // Déplacement d'emplacement : met à jour la localisation ET journalise le
  // changement dans l'historique (ancien → nouvel emplacement).
  const moveProductLocation = (id: string, patch: Partial<Product>) => {
    const prev = products.find((p) => p.id === id)
    persistProducts(products.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    if (prev) logActivity(`Emplacement modifié : ${prev.name}`, { target: prev.name, oldValue: prev.emplacementComplet || '—', newValue: patch.emplacementComplet || '—' })
  }

  /**
   * Affecte en masse des produits à des positions (assistant d'affectation du
   * catalogue). UNE SEULE écriture pour tout le lot, quel que soit le nombre de
   * produits — le rangement d'un catalogue entier ne doit pas générer des
   * milliers d'écritures de synchro.
   *
   * `rows` porte l'identifiant de position ET le chemin complet déjà résolu,
   * pour éviter de re-parcourir la hiérarchie ici.
   */
  const bulkAssignLocations = (
    rows: { productId: string; zoneId: string; alleeId: string; rayonId: string; etagereId: string; niveauId: string; positionId: string; emplacementComplet: string }[]
  ): number => {
    if (rows.length === 0) return 0
    const byId = new Map(rows.map((r) => [r.productId, r]))
    let n = 0
    const next = products.map((p) => {
      const r = byId.get(p.id)
      if (!r) return p
      n++
      return {
        ...p,
        zoneId: r.zoneId, alleeId: r.alleeId, rayonId: r.rayonId,
        etagereId: r.etagereId, niveauId: r.niveauId, positionId: r.positionId,
        emplacementComplet: r.emplacementComplet,
      }
    })
    persistProducts(next)
    logActivity(`Affectation du catalogue : ${n} produits rangés`)
    return n
  }

  /** Retire l'emplacement des produits d'un magasin (annulation d'affectation). */
  const clearProductLocations = (storeId: string): number => {
    let n = 0
    const next = products.map((p) => {
      if ((p.storeId && p.storeId !== storeId) || !p.emplacementComplet) return p
      n++
      const { zoneId, alleeId, rayonId, etagereId, niveauId, positionId, emplacementComplet, ...rest } = p
      void zoneId; void alleeId; void rayonId; void etagereId; void niveauId; void positionId; void emplacementComplet
      return rest as Product
    })
    if (n > 0) { persistProducts(next); logActivity(`Emplacements retirés de ${n} produits`) }
    return n
  }

  const deleteProduct = (id: string) => {
    const p = products.find((x) => x.id === id)
    persistProducts(products.filter((x) => x.id !== id))
    if (p) logActivity(`Produit supprimé : ${p.name}`)
  }

  /**
   * Suppression groupée (nettoyage de doublons). UNE seule écriture quel que
   * soit le nombre de fiches : supprimer 70 000 produits un par un générerait
   * autant d'écritures de synchro.
   */
  /**
   * FUSIONNE des groupes de doublons au lieu de les supprimer.
   *
   * Supprimer était destructeur : deux fiches en double portent chacune une
   * partie du stock physique (une entrée sur l'une, une entrée sur l'autre).
   * En effacer une faisait disparaître sa quantité pour toujours. Ici les
   * stocks s'additionnent — c'est le même article rangé au même endroit — et
   * les champs vides de la fiche conservée sont complétés par ses jumelles.
   *
   * Une seule écriture pour tout le catalogue : 16 000 groupes traités un par
   * un satureraient le quota de la base.
   */
  const mergeDuplicateProducts = (groups: string[][]): { groupes: number; supprimees: number; stockAvant: number; stockApres: number } => {
    const byId = new Map(products.map((p) => [p.id, p]))
    const aSupprimer = new Set<string>()
    const fusionnees = new Map<string, Product>()
    // Fiche absorbée → fiche survivante : les lots suivent la fusion.
    const versQui = new Map<string, string>()
    let groupes = 0

    for (const ids of groups) {
      const list = ids.map((id) => byId.get(id)).filter((p): p is Product => !!p)
      if (list.length < 2) continue
      groupes++

      // On garde la fiche la plus riche, puis on lui verse ce que les autres
      // détiennent : quantités additionnées, champs vides comblés.
      const keep = list.reduce((a, b) =>
        (b.stock * 1000 + (b.emplacementComplet ? 500 : 0) + (b.price > 0 ? 50 : 0)) >
        (a.stock * 1000 + (a.emplacementComplet ? 500 : 0) + (a.price > 0 ? 50 : 0)) ? b : a
      )
      const merged: Product = { ...keep }
      merged.stock = list.reduce((s, p) => s + (Number(p.stock) || 0), 0)
      merged.reserved = list.reduce((s, p) => s + (Number(p.reserved) || 0), 0) || undefined
      merged.minStock = Math.max(...list.map((p) => Number(p.minStock) || 0))
      const repris = new Set(merged.altBarcodes ?? [])
      for (const p of list) {
        if (p.id === keep.id) continue
        // Le code-barres de la fiche absorbée reste reconnu en caisse.
        if (p.barcode && p.barcode !== merged.barcode) repris.add(p.barcode)
        for (const b of p.altBarcodes ?? []) if (b !== merged.barcode) repris.add(b)
        if (!merged.barcode && p.barcode) merged.barcode = p.barcode
        if (!merged.category && p.category) merged.category = p.category
        if (!merged.subcategory && p.subcategory) merged.subcategory = p.subcategory
        if (!merged.brand && p.brand) merged.brand = p.brand
        if (!merged.emplacementComplet && p.emplacementComplet) {
          merged.emplacementComplet = p.emplacementComplet
          merged.zoneId = p.zoneId; merged.alleeId = p.alleeId; merged.rayonId = p.rayonId
          merged.etagereId = p.etagereId; merged.niveauId = p.niveauId; merged.positionId = p.positionId
        }
        if (!(merged.price > 0) && p.price > 0) merged.price = p.price
        if (!(merged.cost > 0) && p.cost > 0) merged.cost = p.cost
        if (!merged.image && p.image) merged.image = p.image
        aSupprimer.add(p.id)
        versQui.set(p.id, keep.id)
      }
      repris.delete(merged.barcode)
      if (repris.size) merged.altBarcodes = [...repris]
      fusionnees.set(keep.id, merged)
    }

    if (groupes === 0) return { groupes: 0, supprimees: 0, stockAvant: 0, stockApres: 0 }

    const stockAvant = products.reduce((s, p) => s + (Number(p.stock) || 0), 0)
    const next = products
      .filter((p) => !aSupprimer.has(p.id))
      .map((p) => fusionnees.get(p.id) ?? p)
    const stockApres = next.reduce((s, p) => s + (Number(p.stock) || 0), 0)

    persistProducts(next)
    // Les lots des fiches absorbées suivent la survivante : sans ça, leur
    // traçabilité pointerait vers des fiches qui n'existent plus.
    if (versQui.size) {
      let touche = false
      const nextLots = lots.map((l) => {
        const cible = versQui.get(l.productId)
        if (!cible) return l
        touche = true
        return { ...l, productId: cible, productName: fusionnees.get(cible)?.name ?? l.productName }
      })
      if (touche) persistLots(nextLots)
    }
    logActivity(`Fusion des doublons : ${groupes} groupes, ${aSupprimer.size} fiches absorbées`)
    return { groupes, supprimees: aSupprimer.size, stockAvant, stockApres }
  }

  /**
   * Applique des conversions « lot → pièce + conditionnement » en UNE écriture.
   *
   * Le plan est construit et validé côté écran ; ici on se contente de le poser,
   * puis de vérifier que la valeur totale du stock n'a pas bougé. Multiplier un
   * stock par 100 en changeant le coût est juste seulement si le produit des
   * deux reste constant.
   */
  const applyLotConversions = (
    transform: { id: string; facteur?: number; apply: (p: Product) => Product }[]
  ): { converties: number; valeurAvant: number; valeurApres: number } => {
    if (transform.length === 0) return { converties: 0, valeurAvant: 0, valeurApres: 0 }
    const byId = new Map(transform.map((t) => [t.id, t.apply]))
    const valeurAvant = Math.round(products.reduce((s, p) => s + p.stock * p.cost, 0) * 100) / 100
    const next = products.map((p) => {
      const fn = byId.get(p.id)
      return fn ? fn(p) : p
    })
    const valeurApres = Math.round(next.reduce((s, p) => s + p.stock * p.cost, 0) * 100) / 100
    persistProducts(next)
    /*
     * Les lots CHANGENT D'ÉCHELLE avec la fiche : une fiche passée de la boîte
     * à la pièce (×100) a des lots comptés en boîtes — quantités ×100, coût
     * ÷100, même invariant de valeur que la fiche elle-même.
     */
    const facteurs = new Map(transform.filter((t) => t.facteur && t.facteur > 1).map((t) => [t.id, t.facteur as number]))
    if (facteurs.size) {
      let touche = false
      const nextLots = lots.map((l) => {
        const f = facteurs.get(l.productId)
        if (!f) return l
        touche = true
        return {
          ...l,
          qty: roundQty(l.qty * f),
          remaining: roundQty(l.remaining * f),
          cost: Math.round((l.cost / f) * 10000) / 10000,
        }
      })
      if (touche) persistLots(nextLots)
    }
    logActivity(`Conversion en conditionnements : ${transform.length} fiches`)
    return { converties: transform.length, valeurAvant, valeurApres }
  }

  const bulkDeleteProducts = (ids: string[]): number => {
    if (ids.length === 0) return 0
    const set = new Set(ids)
    const next = products.filter((p) => !set.has(p.id))
    const removed = products.length - next.length
    if (removed === 0) return 0
    persistProducts(next)
    // Pas de lots orphelins : la traçabilité d'une fiche part avec elle.
    if (lots.some((l) => set.has(l.productId))) {
      persistLots(lots.filter((l) => !set.has(l.productId)))
    }
    logActivity(`Nettoyage du catalogue : ${removed} fiches supprimées`)
    return removed
  }

  // Ajoute aux collections `categories`/`subcategories` celles présentes dans les
  // produits importés mais absentes — évite que la page Catégories diverge du
  // catalogue réel (sous-catégorie au format « Catégorie › Sous-catégorie »).
  const reconcileAttributes = (rows: Omit<Product, 'id'>[]): number => {
    const catNames = new Set(categories.map((c) => c.name))
    const subNames = new Set(subcategories.map((s) => s.name))
    const brandNames = new Set(brands.map((b) => b.name))
    const unitNames = new Set(units.map((u) => u.name))
    const newCats: Attribute[] = [], newSubs: Attribute[] = [], newBrands: Attribute[] = [], newUnits: Attribute[] = []
    for (const r of rows) {
      const cat = (r.category || '').trim()
      if (cat && !catNames.has(cat)) { catNames.add(cat); newCats.push({ id: uid(), name: cat }) }
      const sub = (r.subcategory || '').trim()
      if (cat && sub) {
        const full = `${cat} › ${sub}`
        if (!subNames.has(full)) { subNames.add(full); newSubs.push({ id: uid(), name: full }) }
      }
      const brand = (r.brand || '').trim()
      if (brand && !brandNames.has(brand)) { brandNames.add(brand); newBrands.push({ id: uid(), name: brand }) }
      const unit = (r.unit || '').trim()
      if (unit && !unitNames.has(unit)) { unitNames.add(unit); newUnits.push({ id: uid(), name: unit }) }
    }
    if (newCats.length) persistCategories([...categories, ...newCats])
    if (newSubs.length) persistSubcategories([...subcategories, ...newSubs])
    if (newBrands.length) persistBrands([...brands, ...newBrands])
    if (newUnits.length) persistUnits([...units, ...newUnits])
    return newCats.length + newSubs.length + newBrands.length + newUnits.length
  }
  // Synchronise les attributs (catégories, sous-catégories, marques, unités) à
  // partir du catalogue actuel — utile après un import qui les a introduits.
  const reconcileAttributesFromProducts = (): number => reconcileAttributes(products)

  const importProducts = (rows: Omit<Product, 'id'>[], replace = false) => {
    // Mode « remplacer » : on repart d'un catalogue vide. Indispensable pour
    // définir un catalogue de démarrage sans garder en mémoire les dizaines de
    // milliers d'anciens produits (fusion + anciens = pic mémoire fatal).
    if (replace) {
      // Id STABLE dérivé du code-barres : réimporter le même catalogue met à jour
      // les mêmes lignes au lieu d'en recréer (ce qui gonflait Turso à chaque
      // import). Dédoublonnage par code-barres au passage (dernier gagne).
      const sid = activeStoreRef.current
      const byBc = new Map<string, Product>()
      const arr: Product[] = []
      for (const r of rows) {
        const bc = (r.barcode || '').trim()
        if (bc) {
          const rec = { ...r, id: 'p_' + bc, storeId: sid }
          const prev = byBc.get(bc)
          if (prev) { Object.assign(prev, rec) } // écrase la version précédente
          else { byBc.set(bc, rec); arr.push(rec) }
        } else {
          arr.push({ ...r, id: uid(), storeId: sid })
        }
      }
      persistProducts(arr)
      reconcileAttributes(rows)
      logActivity(`Import produits (remplacement) : ${arr.length} produits`)
      return { added: arr.length, updated: 0 }
    }
    // O(N) : index par code-barres au lieu d'un .find() dans la boucle (évite le gel sur gros fichiers).
    let added = 0
    let updated = 0
    // Copie de surface (références) : on ne duplique PAS les 55 000 fiches
    // existantes — seules celles réellement modifiées sont recréées. Le clone
    // intégral doublait la mémoire du catalogue et faisait planter l'onglet.
    const arr: Product[] = products.slice()
    const byBarcode = new Map<string, number>()
    arr.forEach((p, i) => { if (p.barcode) byBarcode.set(p.barcode, i) })
    for (const r of rows) {
      const bc = r.barcode
      const idx = bc ? byBarcode.get(bc) : undefined
      if (idx !== undefined) {
        arr[idx] = { ...arr[idx], ...r }
        updated++
      } else {
        if (bc) byBarcode.set(bc, arr.length)
        arr.push({ ...r, id: uid() })
        added++
      }
    }
    persistProducts(arr)
    reconcileAttributes(rows)
    logActivity(`Import produits : ${added} ajoutés, ${updated} mis à jour`)
    return { added, updated }
  }

  // ---- Stock movements ----

  /** Auteur des mouvements de stock — repris de la session, comme les ventes. */
  const mvUser = () => {
    try { return getSession()?.name || undefined } catch { return undefined }
  }

  /**
   * Débit de stock selon la règle de l'enseigne : par défaut on ne descend
   * jamais sous zéro (le rognage éventuel se voit à l'inventaire) ; si le
   * stock négatif est autorisé, l'écart reste visible en négatif.
   */
  const debiterStock = (stock: number, qtyBase: number) =>
    settings.allowNegativeStock ? roundQty(stock - qtyBase) : roundQty(Math.max(0, stock - qtyBase))

  // ---- Moteur de lots (FIFO/FEFO) ----

  /** FEFO pour les catégories cochées dans Paramètres → Administration, FIFO sinon. */
  const estFefo = (category: string) => (settings.fefoCategories ?? []).includes(category)

  /**
   * LOT D'OUVERTURE PARESSEUX. Le stock existant n'a pas de lots : plutôt que
   * d'en créer 19 000 d'un coup (et pousser 19 000 lignes vers Turso), on
   * trace un produit la PREMIÈRE fois qu'il bouge — son stock d'avant devient
   * un lot d'ouverture, consommé en premier puisqu'il est le plus ancien.
   */
  const garantirOuverture = (cur: Lot[], p: Product): Lot[] => {
    if (p.stock <= 0) return cur
    if (cur.some((l) => l.productId === p.id && l.remaining > 0)) return cur
    return [{
      id: uid(), productId: p.id, productName: p.name, qty: p.stock, remaining: p.stock,
      cost: p.cost, date: new Date().toISOString(), expiryDate: p.expiryDate || undefined,
      ref: 'Lot d’ouverture', ouverture: true, storeId: p.storeId ?? activeStoreRef.current,
    }, ...cur]
  }

  /** Entrée : un lot par arrivage. `p.stock` doit être le stock AVANT l'opération. */
  const entreeLot = (cur: Lot[], p: Product, qtyBase: number, extra: { cost?: number; expiryDate?: string; ref: string; depotId?: string }): Lot[] => {
    if (qtyBase <= 0) return cur
    return [{
      id: uid(), productId: p.id, productName: p.name, qty: qtyBase, remaining: qtyBase,
      cost: extra.cost ?? p.cost, date: new Date().toISOString(), expiryDate: extra.expiryDate || undefined,
      ref: extra.ref, storeId: p.storeId ?? activeStoreRef.current, depotId: extra.depotId || undefined,
    }, ...garantirOuverture(cur, p)]
  }

  /**
   * Sortie : consomme les lots ouverts dans l'ordre FIFO/FEFO de la catégorie.
   * `prefRef` fait passer d'abord les lots d'une provenance donnée (retour
   * fournisseur → les lots de CE bon de commande). Si les lots ne couvrent
   * pas tout (dérive), on consomme ce qui existe — l'inventaire réconciliera.
   */
  const sortieLots = (cur: Lot[], p: Product, qtyBase: number, prefRef?: string): Lot[] => {
    if (qtyBase <= 0) return cur
    const base = garantirOuverture(cur, p)
    const fefo = estFefo(p.category)
    const ouverts = base
      .filter((l) => l.productId === p.id && l.remaining > 0)
      .sort((a, b) => {
        if (prefRef) {
          const pa = a.ref.startsWith(prefRef)
          const pb = b.ref.startsWith(prefRef)
          if (pa !== pb) return pa ? -1 : 1
        }
        return ordreConsommation(a, b, fefo)
      })
    let reste = qtyBase
    const conso = new Map<string, number>()
    for (const l of ouverts) {
      if (reste <= 0) break
      const prend = Math.min(l.remaining, reste)
      conso.set(l.id, prend)
      reste = roundQty(reste - prend)
    }
    return conso.size ? base.map((l) => (conso.has(l.id) ? { ...l, remaining: roundQty(l.remaining - (conso.get(l.id) ?? 0)) } : l)) : base
  }

  const addMovement = (
    productId: string,
    type: StockMovement['type'],
    qty: number,
    note = '',
    baseProducts?: Product[],
    baseMovements?: StockMovement[],
    depotId?: string
  ) => {
    const list = baseProducts ?? products
    const p = list.find((x) => x.id === productId)
    if (!p) return
    const nextProducts = list.map((x) =>
      x.id === productId ? { ...x, stock: qty < 0 ? debiterStock(x.stock, -qty) : roundQty(x.stock + qty) } : x
    )
    persistProducts(nextProducts)
    // Traçabilité par lots : une entrée crée un lot, une sortie en consomme.
    const nextLots = qty > 0
      ? entreeLot(lots, p, qty, { ref: note || MOVEMENT_META[type].label, depotId })
      : qty < 0 ? sortieLots(lots, p, -qty) : lots
    if (nextLots !== lots) persistLots(nextLots)
    const mv: StockMovement = {
      id: uid(),
      date: new Date().toISOString(),
      productId,
      productName: p.name,
      type,
      qty,
      note,
      storeId: p.storeId ?? activeStoreRef.current,
      depotId: depotId || undefined,
      user: mvUser(),
    }
    persistMovements([mv, ...(baseMovements ?? movements)])
    return nextProducts
  }

  const adjustStock = (id: string, delta: number, note = 'Ajustement manuel', depotId?: string) => {
    addMovement(id, 'ajustement', delta, note, undefined, undefined, depotId)
  }

  // Réapprovisionnement : entrée de stock (type « entree »), distincte de
  // l'ajustement ±1 — meilleure traçabilité dans les mouvements et rapports.
  const restockProduct = (id: string, qty: number, note = 'Réapprovisionnement', depotId?: string) => {
    if (qty <= 0) return
    addMovement(id, 'reappro', qty, note || 'Réapprovisionnement', undefined, undefined, depotId)
  }

  const applyInventory = (
    counts: { productId: string; counted: number }[],
    // `skipLog` : la validation d'une session d'inventaire journalise elle-même,
    // avec le nombre d'écarts. Deux logActivity consécutifs lisent le même
    // tableau `activity` et le second écraserait le premier.
    opts?: { depotId?: string; ref?: string; skipLog?: boolean }
  ) => {
    const label = opts?.ref ? `Inventaire ${opts.ref}` : 'Inventaire physique'
    const nowIso = new Date().toISOString()
    const who = mvUser()

    /*
     * UNE SEULE PASSE. La version précédente, pour CHAQUE écart, cherchait le
     * produit dans tout le catalogue, en recopiait l'intégralité pour changer
     * une quantité, et recopiait tout le journal des mouvements pour y ajouter
     * une ligne. Sur une validation de masse — un inventaire physique complet
     * peut produire des milliers d'écarts sur des dizaines de milliers de
     * fiches et un journal de plus de 100 000 lignes — cela représentait des
     * centaines de millions de copies : l'onglet gelait au pire moment, juste
     * après des heures de comptage.
     *
     * Ici : un index, une accumulation, puis une seule recopie de chaque
     * collection.
     */
    const byId = new Map(products.map((p) => [p.id, p]))
    const stocksFixes = new Map<string, number>()
    const nouveauxMouvements: StockMovement[] = []
    let curLots = lots

    for (const { productId, counted } of counts) {
      const p = byId.get(productId)
      if (!p) continue
      // Stock effectif avant CETTE ligne : le moteur de lots exige le stock
      // d'avant l'opération, et une même référence peut apparaître deux fois.
      const stockAvant = stocksFixes.get(productId) ?? p.stock
      if (stockAvant === counted) continue
      const delta = counted - stockAvant
      stocksFixes.set(productId, counted)
      const pAvant = stockAvant === p.stock ? p : { ...p, stock: stockAvant }
      // Les lots suivent la réconciliation : surplus = lot d'écart, manque = consommation.
      curLots = delta > 0
        ? entreeLot(curLots, pAvant, delta, { ref: `${label} (écart +${delta})` })
        : sortieLots(curLots, pAvant, -delta)
      nouveauxMouvements.push({
        id: uid(),
        date: nowIso,
        productId,
        productName: p.name,
        type: 'inventaire' as const,
        qty: delta,
        note: `${label} (écart ${delta > 0 ? '+' : ''}${delta})`,
        // Sans storeId/depotId explicites, les écarts d'inventaire restaient
        // invisibles dans « Stock par dépôt » (le solde y est reconstitué
        // depuis le journal, filtré par dépôt).
        storeId: p.storeId ?? (activeStoreRef.current || undefined),
        depotId: opts?.depotId || undefined,
        user: who,
      })
    }

    // Aucun écart réel : ne rien réécrire. Persister à l'identique déclencherait
    // un envoi vers Turso pour rien (quota).
    if (stocksFixes.size > 0) {
      persistProducts(products.map((p) => {
        const q = stocksFixes.get(p.id)
        return q === undefined ? p : { ...p, stock: q }
      }))
      persistMovements([...nouveauxMouvements, ...movements])
      if (curLots !== lots) persistLots(curLots)
    }
    if (!opts?.skipLog) logActivity(`${label} validé`)
  }

  // ---- Inventaires (physique + tournant) ----

  const invUser = () => {
    try { return getSession()?.name || undefined } catch { return undefined }
  }

  const addInventory = (
    kind: InventoryKind,
    init?: Partial<Pick<Inventory, 'depotId' | 'scope' | 'frequency' | 'frequencyDays' | 'note' | 'lines'>>
  ): Inventory => {
    const base = kind === 'physique' ? 'INV' : 'TRN'
    const seq = inventories.filter((i) => i.kind === kind && i.storeId === activeStoreId).length + 1
    const inv: Inventory = {
      id: uid(),
      ref: docNumber(base, stores.find((s) => s.id === activeStoreId) ?? null, seq, 4),
      kind,
      status: 'brouillon',
      date: new Date().toISOString(),
      lines: [],
      createdBy: invUser(),
      ...init,
    }
    persistInventories([inv, ...inventories])
    logActivity(`Inventaire ${inv.ref} créé (${kind})`, { target: inv.ref })
    return inv
  }

  /** Un inventaire validé est IMMUABLE : il justifie des mouvements de stock. */
  const updateInventory = (id: string, patch: Partial<Inventory>) => {
    persistInventories(
      inventories.map((i) =>
        i.id === id && i.status !== 'valide' ? { ...i, ...patch, updatedBy: invUser() } : i
      )
    )
  }

  /** Comptage terminé → étape de contrôle (en attente de validation). */
  const submitInventory = (id: string) => {
    const inv = inventories.find((i) => i.id === id)
    if (!inv || inv.status !== 'brouillon') return
    updateInventory(id, { status: 'controle', submittedBy: invUser(), submittedAt: new Date().toISOString() })
    logActivity(`Inventaire ${inv.ref} envoyé au contrôle`, { target: inv.ref })
  }

  /** Retour au comptage depuis le contrôle (écart suspect à recompter). */
  const reopenInventory = (id: string) => {
    const inv = inventories.find((i) => i.id === id)
    if (!inv || inv.status !== 'controle') return
    updateInventory(id, { status: 'brouillon' })
    logActivity(`Inventaire ${inv.ref} rouvert pour recomptage`, { target: inv.ref })
  }

  /**
   * VALIDATION : applique les écarts au stock (mouvements type « inventaire »,
   * lots réconciliés, dépôt ventilé) puis fige l'inventaire. Le théorique de
   * référence est celui FIGÉ sur chaque ligne au comptage — si le stock a bougé
   * entre-temps (une vente), le compté reste la vérité posée par l'inventaire.
   */
  const validateInventory = (id: string) => {
    const inv = inventories.find((i) => i.id === id)
    if (!inv || inv.status !== 'controle') return { ok: false as const }
    const diffs = inventoryDiffs(inv)
    if (diffs.length) {
      applyInventory(diffs.map((l) => ({ productId: l.productId, counted: l.counted })), { depotId: inv.depotId, ref: inv.ref, skipLog: true })
    }
    persistInventories(
      inventories.map((i) =>
        i.id === id ? { ...i, status: 'valide' as const, validatedBy: invUser(), validatedAt: new Date().toISOString() } : i
      )
    )
    logActivity(`Inventaire ${inv.ref} validé (${diffs.length} écart(s))`, { target: inv.ref })
    return { ok: true as const, adjusted: diffs.length }
  }

  /** Annulation douce avant validation — le document reste dans l'historique. */
  const cancelInventory = (id: string) => {
    const inv = inventories.find((i) => i.id === id)
    if (!inv || inv.status === 'valide' || inv.status === 'annule') return
    updateInventory(id, { status: 'annule', cancelledBy: invUser(), cancelledAt: new Date().toISOString() })
    logActivity(`Inventaire ${inv.ref} annulé`, { target: inv.ref })
  }

  // ---- Finance : exercices, budgets OPEX, investissements CAPEX ----

  /** L'exercice couvrant une année. Créé à la demande (année civile) s'il n'existe pas. */
  const ensureExercice = (year: number): FiscalYear => {
    const found = exercices.find((e) => e.year === year)
    if (found) return found
    const ex: FiscalYear = { id: uid(), year, startDate: `${year}-01-01`, endDate: `${year}-12-31` }
    persistExercices([...exercices, ex].sort((a, b) => a.year - b.year))
    return ex
  }

  const updateExercice = (id: string, patch: Partial<Omit<FiscalYear, 'id'>>) => {
    persistExercices(exercices.map((e) => {
      if (e.id !== id) return e
      const next = { ...e, ...patch }
      // Cohérence : le début doit précéder la fin, sinon la saisie est ignorée.
      return next.startDate < next.endDate ? next : e
    }))
  }

  const addBudget = (
    data: Pick<Budget, 'year' | 'category' | 'planned'> & Partial<Pick<Budget, 'subcategory' | 'startDate' | 'endDate' | 'responsable' | 'notes'>>
  ): Budget | { error: 'dates' } => {
    const ex = ensureExercice(data.year)
    const startDate = data.startDate || ex.startDate
    const endDate = data.endDate || ex.endDate
    // Un budget ne déborde pas de son exercice, et commence avant de finir.
    if (startDate >= endDate || startDate < ex.startDate || endDate > ex.endDate) return { error: 'dates' }
    const seq = budgets.filter((b) => b.year === data.year && b.storeId === activeStoreId).length + 1
    const budget: Budget = {
      id: uid(),
      ref: docNumber(`BUD-${data.year}`, stores.find((s) => s.id === activeStoreId) ?? null, seq, 3),
      exerciceId: ex.id,
      year: data.year,
      category: data.category,
      subcategory: data.subcategory,
      planned: data.planned,
      startDate,
      endDate,
      responsable: data.responsable,
      status: 'brouillon',
      notes: data.notes,
      createdAt: new Date().toISOString(),
      createdBy: invUser(),
    }
    persistBudgets([budget, ...budgets])
    logActivity(`Budget ${budget.ref} créé (${budget.category}, ${fmtDH(budget.planned)})`, { target: budget.ref })
    return budget
  }

  /**
   * Un budget VALIDÉ n'est plus librement modifiable : à partir de `valide`,
   * seuls le statut, les notes et le responsable peuvent encore changer —
   * les montants et le périmètre sont figés, c'est l'engagement pris.
   */
  const updateBudget = (id: string, patch: Partial<Budget>) => {
    persistBudgets(budgets.map((b) => {
      if (b.id !== id) return b
      const locked = b.status === 'valide' || b.status === 'en_cours' || b.status === 'cloture'
      const allowed: Partial<Budget> = locked
        ? { status: patch.status, notes: patch.notes, responsable: patch.responsable }
        : patch
      return { ...b, ...allowed, updatedAt: new Date().toISOString(), updatedBy: invUser() }
    }))
  }

  const BUDGET_FLOW: BudgetStatus[] = ['brouillon', 'soumis', 'valide', 'en_cours', 'cloture']

  /** Avance le budget d'une étape du workflow. La validation est journalisée avec son auteur. */
  const advanceBudget = (id: string) => {
    const b = budgets.find((x) => x.id === id)
    if (!b) return
    const idx = BUDGET_FLOW.indexOf(b.status)
    if (idx < 0 || idx >= BUDGET_FLOW.length - 1) return
    const next = BUDGET_FLOW[idx + 1]
    persistBudgets(budgets.map((x) => (x.id === id
      ? {
          ...x, status: next, updatedAt: new Date().toISOString(), updatedBy: invUser(),
          ...(next === 'valide' ? { validatedAt: new Date().toISOString(), validatedBy: invUser() } : {}),
        }
      : x)))
    logActivity(`Budget ${b.ref} : ${b.status} → ${next}`, { target: b.ref })
  }

  /** Suppression réservée aux brouillons — au-delà, le budget fait partie de l'historique de gestion. */
  const deleteBudget = (id: string) => {
    const b = budgets.find((x) => x.id === id)
    if (!b || b.status !== 'brouillon') return
    persistBudgets(budgets.filter((x) => x.id !== id))
    logActivity(`Budget ${b.ref} supprimé (brouillon)`, { target: b.ref })
  }

  const addInvestment = (
    data: Pick<Investment, 'designation' | 'category' | 'year' | 'planned' | 'plannedDate'> &
      Partial<Pick<Investment, 'supplierId' | 'supplierName' | 'actual' | 'purchaseDate' | 'usefulLifeYears' | 'responsable' | 'note'>>
  ): Investment => {
    const ex = ensureExercice(data.year)
    const seq = investments.filter((i) => i.year === data.year && i.storeId === activeStoreId).length + 1
    const inv: Investment = {
      id: uid(),
      ref: docNumber(`CAP-${data.year}`, stores.find((s) => s.id === activeStoreId) ?? null, seq, 3),
      exerciceId: ex.id,
      status: 'prevu',
      createdAt: new Date().toISOString(),
      createdBy: invUser(),
      ...data,
    }
    persistInvestments([inv, ...investments])
    logActivity(`Investissement ${inv.ref} créé (${inv.designation}, ${fmtDH(inv.planned)})`, { target: inv.ref })
    return inv
  }

  const updateInvestment = (id: string, patch: Partial<Investment>) => {
    persistInvestments(investments.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: new Date().toISOString(), updatedBy: invUser() } : i)))
  }

  /** Un investissement ACHETÉ ne se supprime pas : il s'annule ou reste — c'est une trace comptable. */
  const deleteInvestment = (id: string) => {
    const i = investments.find((x) => x.id === id)
    if (!i || i.status === 'achete') return
    persistInvestments(investments.filter((x) => x.id !== id))
    logActivity(`Investissement ${i.ref} supprimé`, { target: i.ref })
  }

  // ---- Stock initial (mise en service d'un magasin) ----
  /** Vrai si le magasin actif a déjà été initialisé (un mouvement stock_initial existe). */
  const activeStoreInitialized = movements.some((m) => m.type === 'stock_initial' && (m.storeId ?? activeStoreRef.current) === activeStoreRef.current)

  const initializeStock = (entries: { productId: string; qty: number }[], force = false, depotId?: string) => {
    const sid = activeStoreRef.current
    const already = movements.some((m) => m.type === 'stock_initial' && (m.storeId ?? sid) === sid)
    if (already && !force) return { ok: false as const, error: 'already' as const }
    const qtyMap = new Map(entries.filter((e) => e.qty > 0).map((e) => [e.productId, Math.round(e.qty)]))
    if (qtyMap.size === 0) return { ok: false as const, error: 'empty' as const }
    const nowIso = new Date().toISOString()
    const newMovements: StockMovement[] = []
    const newLots: Lot[] = []
    const nextProducts = products.map((p) => {
      const q = qtyMap.get(p.id)
      if (q === undefined || p.storeId !== sid) return p
      newMovements.push({ id: uid(), date: nowIso, productId: p.id, productName: p.name, type: 'stock_initial', qty: q, note: 'Initialisation du stock', storeId: sid, depotId: depotId || undefined, user: mvUser() })
      newLots.push({ id: uid(), productId: p.id, productName: p.name, qty: q, remaining: q, cost: p.cost, date: nowIso, expiryDate: p.expiryDate || undefined, ref: 'Stock initial', storeId: sid, depotId: depotId || undefined })
      return { ...p, stock: q }
    })
    persistProducts(nextProducts)
    persistMovements([...newMovements, ...movements])
    // Le stock initial POSE le stock : les anciens lots de ces produits ne
    // décrivent plus rien — remplacés, pas cumulés.
    persistLots([...newLots, ...lots.filter((l) => !(qtyMap.has(l.productId) && (l.storeId ?? sid) === sid))])
    logActivity('Initialisation du stock', { target: stores.find((s) => s.id === sid)?.name, newValue: `${qtyMap.size} produit(s)` })
    return { ok: true as const, count: qtyMap.size }
  }

  // ---- Sales ----
  const recordSale = (items: SaleItem[], payment: Sale['payment'], client?: Client | null, depotId?: string): Sale => {
    const total = items.reduce((s, i) => s + i.price * i.qty, 0)
    // La marge se calcule sur la quantité de BASE : le coût est celui de l'unité
    // de stock, alors que le prix est celui du conditionnement vendu. Multiplier
    // le coût par le nombre de cartons donnerait une marge grossièrement fausse.
    const profit = items.reduce((s, i) => {
      const p = products.find((x) => x.id === i.productId)
      return s + i.price * i.qty - (p?.cost ?? 0) * baseQty(i)
    }, 0)
    // Le vendeur est repris de la session : sans lui, aucun rapport par
    // vendeur n'est possible — et on ne peut pas le reconstituer après coup.
    const who = (() => { try { return getSession() } catch { return null } })()
    /*
     * Le numéro suit les réglages (préfixe + année + départ) et se pose une
     * fois pour toutes. Le rang est compté sur les ventes du MÊME magasin et
     * de la MÊME année : deux magasins numérotent leurs factures chacun de
     * leur côté, et la suite repart au 1er janvier.
     */
    const nowIso = new Date().toISOString()
    const annee = new Date(nowIso).getFullYear()
    const sid = activeStoreRef.current
    const dejaCetteAnnee = sales.filter(
      (s) => (s.storeId ?? sid) === sid && new Date(s.date).getFullYear() === annee
    ).length

    const sale: Sale = {
      id: uid(),
      date: nowIso,
      invoiceNo: `${settings.invoicePrefix}${annee}-${settings.invoiceStartNumber + dejaCetteAnnee}`,
      items,
      total,
      profit,
      payment,
      clientId: client?.id,
      clientName: client?.name,
      userId: who?.userId,
      userName: who?.name,
    }
    persistSales([...sales, sale])
    persistProducts(
      products.map((p) => {
        // Décrément en unités de STOCK : vendre 3 boîtes de 100 sort 300 pièces.
        const qty = items.filter((i) => i.productId === p.id).reduce((s, i) => s + baseQty(i), 0)
        return qty ? { ...p, stock: debiterStock(p.stock, qty) } : p
      })
    )
    {
      // Consommation des lots, produit par produit (FIFO, ou FEFO si la
      // catégorie est cochée) — la traçabilité suit la vente sans geste.
      const parProduit = new Map<string, number>()
      items.forEach((i) => parProduit.set(i.productId, roundQty((parProduit.get(i.productId) ?? 0) + baseQty(i))))
      let nextLots = lots
      parProduit.forEach((q, pid) => {
        const p = products.find((x) => x.id === pid)
        if (p) nextLots = sortieLots(nextLots, p, q)
      })
      if (nextLots !== lots) persistLots(nextLots)
    }
    persistMovements([
      ...items.map((i) => ({
        id: uid() + i.productId,
        date: sale.date,
        productId: i.productId,
        productName: i.name,
        type: 'vente' as const,
        // Le mouvement est toujours exprimé en unités de stock, sinon
        // l'inventaire et la valorisation deviennent incomparables.
        qty: -baseQty(i),
        note: `Vente ${sale.id.slice(-5)}`,
        storeId: activeStoreRef.current,
        depotId: depotId || undefined,
        user: who?.name,
      })),
      ...movements,
    ])
    if (client) {
      const gained = Math.floor(total / settings.pointsPerAmount)
      persistClients(
        clients.map((c) =>
          c.id === client.id
            ? {
                ...c,
                totalSpent: c.totalSpent + total,
                credit: payment === 'credit' ? c.credit + total : c.credit,
                points: c.points + gained,
              }
            : c
        )
      )
      if (gained > 0) {
        persistLoyalty([
          {
            id: uid(),
            date: sale.date,
            clientId: client.id,
            clientName: client.name,
            type: 'gain',
            points: gained,
            note: `Vente ${sale.id.slice(-5)}`,
          },
          ...loyaltyMovements,
        ])
      }
      // A credit sale automatically opens a credit line (invoice due, nothing paid yet).
      if (payment === 'credit') {
        const term = client.paymentTermDays ?? 30
        const due = new Date(sale.date)
        due.setDate(due.getDate() + term)
        const credit: Credit = {
          id: uid(),
          ref: docNumber('CR', stores.find((s) => s.id === activeStoreId) ?? null, credits.filter((x) => x.storeId === activeStoreId).length + 1),
          date: sale.date,
          clientId: client.id,
          clientName: client.name,
          saleId: sale.id,
          // Le crédit référence la facture par son VRAI numéro : c'est celui
          // que le client a en main quand il vient régler.
          invoiceRef: sale.invoiceNo ?? sale.id.slice(-6).toUpperCase(),
          items,
          amount: total,
          paid: 0,
          dueDate: due.toISOString(),
          payments: [],
        }
        persistCredits([credit, ...credits])
      }
    }
    logActivity(`Vente encaissée : ${fmtDH(total)} (${PAYMENT_META[payment].label})`)
    return sale
  }

  // Pay a single credit line (partial or full). Keeps client.credit and cash in sync.
  const payCredit = (
    creditId: string,
    amount: number,
    method: CreditInstalment['method'] = 'especes',
    note = ''
  ) => {
    const credit = credits.find((c) => c.id === creditId)
    if (!credit || amount <= 0) return
    const applied = Math.min(amount, credit.amount - credit.paid)
    if (applied <= 0) return
    const instal: CreditInstalment = { id: uid(), date: new Date().toISOString(), amount: applied, method, note }
    persistCredits(credits.map((c) => (c.id === creditId ? { ...c, paid: c.paid + applied, payments: [instal, ...c.payments] } : c)))
    persistClients(clients.map((c) => (c.id === credit.clientId ? { ...c, credit: Math.max(0, c.credit - applied) } : c)))
    persistCash([
      { id: uid(), date: instal.date, type: 'recette', label: `Règlement crédit ${credit.ref} — ${credit.clientName}`, amount: applied },
      ...cash,
    ])
    persistClientPayments([
      { id: uid(), date: instal.date, clientId: credit.clientId, clientName: credit.clientName, amount: applied, method, note: note || `Règlement ${credit.ref}` },
      ...clientPayments,
    ])
    logActivity(`Règlement crédit ${credit.ref} (${credit.clientName}) : ${fmtDH(applied)}`)
  }

  // Manually open a credit line (Nouveau crédit).
  const addManualCredit = (clientId: string, amount: number, dueDate: string, note = '') => {
    const client = clients.find((c) => c.id === clientId)
    if (!client || amount <= 0) return
    const credit: Credit = {
      id: uid(),
      ref: docNumber('CR', stores.find((s) => s.id === activeStoreId) ?? null, credits.filter((x) => x.storeId === activeStoreId).length + 1),
      date: new Date().toISOString(),
      clientId,
      clientName: client.name,
      saleId: '',
      invoiceRef: note || '—',
      items: [],
      amount,
      paid: 0,
      dueDate,
      payments: [],
    }
    persistCredits([credit, ...credits])
    persistClients(clients.map((c) => (c.id === clientId ? { ...c, credit: c.credit + amount } : c)))
    logActivity(`Crédit ${credit.ref} ouvert pour ${client.name} : ${fmtDH(amount)}`)
    return credit
  }

  const updateCredit = (id: string, patch: { amount?: number; dueDate?: string; invoiceRef?: string }) => {
    const credit = credits.find((c) => c.id === id)
    if (!credit) return
    const nextAmount = patch.amount ?? credit.amount
    const delta = nextAmount - credit.amount
    persistCredits(credits.map((c) => (c.id === id ? { ...c, ...patch, amount: nextAmount } : c)))
    if (delta !== 0) {
      persistClients(clients.map((c) => (c.id === credit.clientId ? { ...c, credit: Math.max(0, c.credit + delta) } : c)))
    }
  }

  const deleteCredit = (id: string) => {
    const credit = credits.find((c) => c.id === id)
    if (!credit) return
    const remaining = credit.amount - credit.paid
    persistCredits(credits.filter((c) => c.id !== id))
    if (remaining > 0) {
      persistClients(clients.map((c) => (c.id === credit.clientId ? { ...c, credit: Math.max(0, c.credit - remaining) } : c)))
    }
    logActivity(`Crédit ${credit.ref} supprimé`)
  }

  const recordReturn = (sale: Sale, items: SaleItem[], method: SaleReturn['method']) => {
    /*
     * ON NE RETOURNE PAS DEUX FOIS LE MÊME ARTICLE. Sans ce plafond, valider
     * trois fois le même retour créait trois avoirs, remettait trois fois la
     * marchandise en stock et remboursait trois fois le client. Le garde-fou
     * est ICI, et pas seulement dans l'écran : c'est le seul endroit par où
     * tout retour passe.
     */
    const reste = returnableQty(sale, returns)
    const retenus = items
      .map((i) => ({ ...i, qty: roundQty(Math.min(i.qty, reste.get(i.productId) ?? 0)) }))
      .filter((i) => i.qty > 0)
    if (retenus.length === 0) return
    items = retenus
    const total = items.reduce((s, i) => s + i.price * i.qty, 0)
    // Numéro d'avoir séquentiel, posé une fois pour toutes — même règle que
    // la facture : un avoir remis à un client ne se renumérote jamais.
    const retIso = new Date().toISOString()
    const retAnnee = new Date(retIso).getFullYear()
    const retSid = activeStoreRef.current
    const dejaAvoirs = returns.filter(
      (r) => (r.storeId ?? retSid) === retSid && new Date(r.date).getFullYear() === retAnnee
    ).length
    const ret: SaleReturn = {
      id: uid(),
      date: retIso,
      creditNo: `AV-${retAnnee}-${settings.invoiceStartNumber + dejaAvoirs}`,
      saleId: sale.id,
      clientName: sale.clientName ?? '',
      items,
      total,
      method,
    }
    persistReturns([ret, ...returns])
    persistProducts(
      products.map((p) => {
        // Remise en stock en unités de BASE : rendre une boîte de 100 doit
        // remettre 100 pièces, pas une. Le symétrique exact de la vente.
        const qty = items.filter((i) => i.productId === p.id).reduce((s, i) => s + baseQty(i), 0)
        return qty ? { ...p, stock: roundQty(p.stock + qty) } : p
      })
    )
    {
      // Un retour rentre en stock comme un nouveau lot : sa fraîcheur est
      // inconnue, seul l'inventaire pourrait dire mieux.
      const parProduit = new Map<string, number>()
      items.forEach((i) => parProduit.set(i.productId, roundQty((parProduit.get(i.productId) ?? 0) + baseQty(i))))
      let nextLots = lots
      parProduit.forEach((q, pid) => {
        const p = products.find((x) => x.id === pid)
        if (p) nextLots = entreeLot(nextLots, p, q, { ref: `Retour vente ${sale.id.slice(-5)}` })
      })
      if (nextLots !== lots) persistLots(nextLots)
    }
    persistMovements([
      ...items.map((i) => ({
        id: uid() + i.productId,
        date: ret.date,
        productId: i.productId,
        productName: i.name,
        type: 'retour' as const,
        qty: baseQty(i),
        note: `Retour vente ${sale.id.slice(-5)}`,
        user: mvUser(),
      })),
      ...movements,
    ])
    if (method === 'especes') {
      persistCash([
        { id: uid(), date: ret.date, type: 'depense', label: `Remboursement retour ${ret.id.slice(-5)}`, amount: total },
        ...cash,
      ])
    } else if (sale.clientId) {
      persistClients(
        clients.map((c) => (c.id === sale.clientId ? { ...c, credit: Math.max(0, c.credit - total) } : c))
      )
    }
    logActivity(`Retour client : ${fmtDH(total)}`)
    return ret
  }

  /* ---------------- Réparation : annuler une opération erronée --------------- */

  /**
   * ANNULE UN RETOUR et défait TOUT ce qu'il avait fait : la marchandise
   * ressort du stock, ses mouvements et son lot d'entrée disparaissent, le
   * remboursement en caisse est retiré, l'avoir porté au crédit du client est
   * repris. Destiné aux retours saisis en double avant que le garde-fou
   * n'existe — pas à l'usage courant.
   */
  /* ---------------------------------- AVOIRS -------------------------------- */

  /**
   * Numéro d'avoir : AC-2026-000001 côté client, AF-2026-000001 côté
   * fournisseur. Séquence propre à chaque sens, au magasin et à l'ANNÉE — un
   * compteur global aurait fait repartir la facturation d'un magasin au numéro
   * d'un autre, et un compteur perpétuel n'aurait pas suivi l'exercice.
   * Le numéro est posé une fois et n'est jamais recalculé : un avoir remis à un
   * tiers ne change plus de référence.
   */
  const nextCreditNoteRef = (kind: CreditNoteKind, dateIso: string) => {
    const base = kind === 'client' ? 'AC' : 'AF'
    const annee = new Date(dateIso).getFullYear()
    const sid = activeStoreRef.current
    const deja = creditNotes.filter(
      (a) => a.kind === kind && (a.storeId ?? sid) === sid && new Date(a.date).getFullYear() === annee
    ).length
    return `${base}-${annee}-${String(deja + 1).padStart(6, '0')}`
  }

  /**
   * Établit un avoir. Le montant est CALCULÉ depuis les lignes, jamais saisi :
   * un total qui ne correspond pas à son détail est un document invalide.
   *
   * Le plafond — ce qui reste à couvrir sur le document d'origine, avoirs déjà
   * émis déduits — est vérifié ici et pas seulement dans l'écran : c'est le
   * seul chemin par lequel un avoir naît.
   */
  const createCreditNote = (data: {
    kind: CreditNoteKind
    partyId?: string
    partyName: string
    originId: string
    originRef: string
    originDate?: string
    originTotalTTC: number
    returnId?: string
    supplierInvoiceRef?: string
    supplierBlRef?: string
    reason: CreditNoteReason
    note?: string
    lines: CreditNoteLine[]
    /** Le gérant peut dépasser le reste à couvrir, en le sachant. */
    forcer?: boolean
  }): { ok: true; avoir: CreditNote } | { ok: false; raison: 'sans_ligne' | 'depasse'; plafond?: number } => {
    if (!data.lines.length) return { ok: false, raison: 'sans_ligne' }

    const totalHT = roundMoney(data.lines.reduce((s, l) => s + l.puHT * l.qty, 0))
    const totalTVA = roundMoney(data.lines.reduce((s, l) => s + l.puHT * l.qty * (l.tvaPct / 100), 0))
    const totalTTC = roundMoney(totalHT + totalTVA)

    // Ce que les avoirs déjà émis sur CE document couvrent déjà (les annulés ne
    // comptent pas : ils ne valent plus rien).
    const dejaCouvert = roundMoney(
      creditNotes
        .filter((a) => a.originId === data.originId && a.status !== 'annule')
        .reduce((s, a) => s + a.totalTTC, 0)
    )
    const plafond = roundMoney(Math.max(0, data.originTotalTTC - dejaCouvert))
    if (!data.forcer && totalTTC > plafond + 0.001) return { ok: false, raison: 'depasse', plafond }

    const nowIso = new Date().toISOString()
    const avoir: CreditNote = {
      id: uid(),
      ref: nextCreditNoteRef(data.kind, nowIso),
      kind: data.kind,
      status: 'brouillon',
      date: nowIso,
      partyId: data.partyId,
      partyName: data.partyName,
      originId: data.originId,
      originRef: data.originRef,
      originDate: data.originDate,
      returnId: data.returnId,
      supplierInvoiceRef: data.supplierInvoiceRef,
      supplierBlRef: data.supplierBlRef,
      reason: data.reason,
      note: data.note,
      lines: data.lines,
      totalHT,
      totalTVA,
      totalTTC,
      uses: [],
      createdBy: invUser(),
    }
    persistCreditNotes([avoir, ...creditNotes])
    logActivity(
      `Avoir ${avoir.ref} créé sur ${data.originRef} (${fmtDH(totalTTC)})${data.forcer && totalTTC > plafond ? ' — plafond dépassé' : ''}`,
      { target: avoir.ref, newValue: fmtDH(totalTTC) }
    )
    return { ok: true, avoir }
  }

  /** Passe au contrôle, puis valide. Un avoir ne se consomme qu'une fois validé. */
  const submitCreditNote = (id: string) => {
    const a = creditNotes.find((x) => x.id === id)
    if (!a || a.status !== 'brouillon') return
    persistCreditNotes(creditNotes.map((x) => (x.id === id ? { ...x, status: 'controle' as const } : x)))
    logActivity(`Avoir ${a.ref} envoyé au contrôle`, { target: a.ref })
  }

  const validateCreditNote = (id: string) => {
    const a = creditNotes.find((x) => x.id === id)
    if (!a || (a.status !== 'controle' && a.status !== 'brouillon')) return { ok: false as const }
    persistCreditNotes(
      creditNotes.map((x) =>
        x.id === id ? { ...x, status: 'valide' as const, validatedBy: invUser(), validatedAt: new Date().toISOString() } : x
      )
    )
    logActivity(`Avoir ${a.ref} validé (${fmtDH(a.totalTTC)})`, { target: a.ref, newValue: fmtDH(a.totalTTC) })
    return { ok: true as const }
  }

  const reopenCreditNote = (id: string) => {
    const a = creditNotes.find((x) => x.id === id)
    if (!a || a.status !== 'controle') return
    persistCreditNotes(creditNotes.map((x) => (x.id === id ? { ...x, status: 'brouillon' as const } : x)))
    logActivity(`Avoir ${a.ref} rouvert`, { target: a.ref })
  }

  /**
   * Annulation : l'avoir reste dans l'historique — il a pu être remis au tiers.
   * REFUSÉE dès qu'il a servi : on ne retire pas un avoir déjà imputé sur une
   * vente, cela laisserait cette vente payée par de l'argent qui n'existe plus.
   */
  const cancelCreditNote = (id: string, motif: string): { ok: boolean; raison?: 'utilise' | 'introuvable' } => {
    const a = creditNotes.find((x) => x.id === id)
    if (!a || a.status === 'annule') return { ok: false, raison: 'introuvable' }
    if (creditNoteUsed(a) > 0.001) return { ok: false, raison: 'utilise' }
    persistCreditNotes(
      creditNotes.map((x) =>
        x.id === id
          ? { ...x, status: 'annule' as const, cancelledBy: invUser(), cancelledAt: new Date().toISOString(), cancelReason: motif }
          : x
      )
    )
    logActivity(`Avoir ${a.ref} annulé — ${motif}`, { target: a.ref, oldValue: fmtDH(a.totalTTC) })
    return { ok: true }
  }

  /**
   * Consomme un avoir : imputation sur un document, ou remboursement en argent.
   * Le montant est ÉCRÊTÉ au disponible — c'est ce qui interdit d'utiliser deux
   * fois le même avoir, quel que soit l'écran d'où vient la demande.
   *
   * Un remboursement en espèces sort de la caisse ; l'imputation, elle, ne
   * touche pas la caisse : elle réduit ce que le tiers doit payer.
   */
  const useCreditNote = (
    id: string,
    amount: number,
    opts?: { targetId?: string; targetRef?: string; refund?: CreditNoteUse['refund'] }
  ): { ok: boolean; applique: number } => {
    const a = creditNotes.find((x) => x.id === id)
    if (!a || (a.status !== 'valide' && a.status !== 'partiel')) return { ok: false, applique: 0 }
    const applique = roundMoney(Math.min(amount, creditNoteRemaining(a)))
    if (applique <= 0) return { ok: false, applique: 0 }

    const nowIso = new Date().toISOString()
    const use: CreditNoteUse = { id: uid(), date: nowIso, amount: applique, ...opts, user: invUser() }
    const reste = roundMoney(a.totalTTC - creditNoteUsed(a) - applique)
    persistCreditNotes(
      creditNotes.map((x) =>
        x.id === id ? { ...x, uses: [...x.uses, use], status: reste <= 0.001 ? ('solde' as const) : ('partiel' as const) } : x
      )
    )

    if (opts?.refund) {
      // Remboursement d'un avoir CLIENT en espèces : sortie de caisse. Côté
      // fournisseur, c'est lui qui nous rembourse — donc une entrée.
      persistCash([
        {
          id: uid(),
          date: nowIso,
          type: a.kind === 'client' ? ('depense' as const) : ('recette' as const),
          label: `Remboursement avoir ${a.ref} — ${a.partyName}`,
          amount: applique,
        },
        ...cash,
      ])
    }
    logActivity(
      opts?.refund
        ? `Avoir ${a.ref} remboursé : ${fmtDH(applique)}`
        : `Avoir ${a.ref} imputé sur ${opts?.targetRef ?? '—'} : ${fmtDH(applique)}`,
      { target: a.ref, newValue: fmtDH(applique) }
    )
    return { ok: true, applique }
  }

  const annulerRetour = (id: string): boolean => {
    const ret = returns.find((r) => r.id === id)
    if (!ret) return false
    const qteParProduit = new Map<string, number>()
    for (const i of ret.items) qteParProduit.set(i.productId, roundQty((qteParProduit.get(i.productId) ?? 0) + baseQty(i)))

    persistProducts(products.map((p) => {
      const q = qteParProduit.get(p.id)
      return q ? { ...p, stock: roundQty(Math.max(0, p.stock - q)) } : p
    }))
    // Le retour avait créé un lot d'entrée : on reprend la quantité par une sortie.
    {
      let nextLots = lots
      qteParProduit.forEach((q, pid) => {
        const p = products.find((x) => x.id === pid)
        if (p) nextLots = sortieLots(nextLots, p, q)
      })
      if (nextLots !== lots) persistLots(nextLots)
    }
    // Ses mouvements : même date exacte et même note que ceux qu'il avait créés.
    const noteRetour = `Retour vente ${ret.saleId.slice(-5)}`
    persistMovements(movements.filter((m) => !(m.date === ret.date && m.type === 'retour' && m.note === noteRetour)))
    if (ret.method === 'especes') {
      const label = `Remboursement retour ${ret.id.slice(-5)}`
      persistCash(cash.filter((c) => !(c.date === ret.date && c.type === 'depense' && c.label === label)))
    } else {
      // L'avoir avait diminué l'encours du client : on le rétablit.
      const sale = sales.find((s) => s.id === ret.saleId)
      if (sale?.clientId) {
        persistClients(clients.map((c) => (c.id === sale.clientId ? { ...c, credit: c.credit + ret.total } : c)))
      }
    }
    persistReturns(returns.filter((r) => r.id !== id))
    logActivity(`Retour ${ret.creditNo ?? ret.id.slice(-5)} annulé (${fmtDH(ret.total)}) — réparation`, { target: ret.creditNo })
    return true
  }

  /**
   * ANNULE UNE VENTE et défait ses effets : la marchandise revient en stock,
   * ses mouvements partent, le client retrouve son total, ses points et son
   * encours, le crédit ouvert est supprimé.
   *
   * REFUSÉE si la vente a déjà des retours : les annuler d'abord, sinon ces
   * retours deviendraient orphelins et le stock serait corrigé deux fois.
   */
  const annulerVente = (id: string): { ok: boolean; raison?: 'introuvable' | 'retours' } => {
    const sale = sales.find((s) => s.id === id)
    if (!sale) return { ok: false, raison: 'introuvable' }
    if (returns.some((r) => r.saleId === id)) return { ok: false, raison: 'retours' }

    const qteParProduit = new Map<string, number>()
    for (const i of sale.items) qteParProduit.set(i.productId, roundQty((qteParProduit.get(i.productId) ?? 0) + baseQty(i)))

    persistProducts(products.map((p) => {
      const q = qteParProduit.get(p.id)
      return q ? { ...p, stock: roundQty(p.stock + q) } : p
    }))
    {
      let nextLots = lots
      qteParProduit.forEach((q, pid) => {
        const p = products.find((x) => x.id === pid)
        if (p) nextLots = entreeLot(nextLots, p, q, { ref: `Annulation vente ${sale.id.slice(-5)}` })
      })
      if (nextLots !== lots) persistLots(nextLots)
    }
    const noteVente = `Vente ${sale.id.slice(-5)}`
    persistMovements(movements.filter((m) => !(m.date === sale.date && m.type === 'vente' && m.note === noteVente)))
    if (sale.clientId) {
      const gagnes = Math.floor(sale.total / settings.pointsPerAmount)
      persistClients(clients.map((c) => (c.id === sale.clientId
        ? {
            ...c,
            totalSpent: Math.max(0, c.totalSpent - sale.total),
            points: Math.max(0, c.points - gagnes),
            credit: sale.payment === 'credit' ? Math.max(0, c.credit - sale.total) : c.credit,
          }
        : c)))
      if (gagnes > 0) {
        persistLoyalty(loyaltyMovements.filter((l) => !(l.date === sale.date && l.clientId === sale.clientId && l.note === noteVente)))
      }
    }
    if (sale.payment === 'credit') persistCredits(credits.filter((c) => c.saleId !== sale.id))
    persistSales(sales.filter((s) => s.id !== id))
    logActivity(`Vente ${sale.invoiceNo ?? sale.id.slice(-5)} annulée (${fmtDH(sale.total)}) — réparation`, { target: sale.invoiceNo })
    return { ok: true }
  }

  // ---- Clients ----
  /*
   * UN NOM DE CLIENT = UNE FICHE. Deux fiches « Billa » finissent par se
   * partager crédits et points au hasard des saisies — constaté avec trois
   * doublons. La comparaison ignore casse et espaces superflus. Un vrai
   * homonyme se distingue en ajoutant un prénom, la ville ou le téléphone
   * dans le nom.
   */
  const clientNameTaken = (name: string, saufId?: string): Client | undefined => {
    const n = name.trim().toLowerCase().replace(/\s+/g, ' ')
    return clients.find((c) => c.id !== saufId && c.name.trim().toLowerCase().replace(/\s+/g, ' ') === n)
  }

  const addClient = (
    data: Partial<Omit<Client, 'id' | 'credit' | 'totalSpent' | 'points' | 'discountBalance'>> & {
      name: string
      phone: string
    }
  ): Client | { error: 'duplicate'; existing: Client } => {
    const doublon = clientNameTaken(data.name)
    if (doublon) return { error: 'duplicate', existing: doublon }
    const client: Client = {
      id: uid(),
      code: data.code?.trim() || undefined,
      name: data.name,
      phone: data.phone,
      email: data.email ?? '',
      address: data.address ?? '',
      city: data.city ?? '',
      cin: data.cin ?? '',
      clientType: data.clientType ?? 'Particulier',
      creditLimit: data.creditLimit ?? 0,
      notes: data.notes ?? '',
      creditDueDate: data.creditDueDate,
      image: data.image,
      discountBalance: 0,
      credit: 0,
      totalSpent: 0,
      points: 0,
      creditAllowed: data.creditAllowed ?? true,
      paymentTermDays: data.paymentTermDays ?? 30,
    }
    persistClients([client, ...clients])
    return client
  }

  const updateClient = (id: string, data: Partial<Client>) => {
    persistClients(clients.map((c) => (c.id === id ? { ...c, ...data } : c)))
  }

  const deleteClient = (id: string) => {
    persistClients(clients.filter((c) => c.id !== id))
  }

  /**
   * FUSIONNE les fiches clients homonymes (rattrapage des doublons créés
   * avant le verrou « un nom = une fiche »). Supprimer les doublons perdrait
   * leurs crédits, points et historique : ici tout est versé sur la fiche la
   * plus active, et les ventes, règlements, crédits et mouvements de fidélité
   * des fiches absorbées sont re-pointés vers la survivante — sinon leur
   * historique deviendrait orphelin.
   *
   * Une écriture par collection, et seulement si elle contient des références
   * à re-pointer (quota Turso).
   */
  const mergeDuplicateClients = (): { groupes: number; supprimees: number } => {
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
    const parNom = new Map<string, Client[]>()
    for (const c of clients) {
      const n = norm(c.name)
      const list = parNom.get(n)
      if (list) list.push(c)
      else parNom.set(n, [c])
    }

    const aSupprimer = new Set<string>()
    const fusionnees = new Map<string, Client>()
    // Fiche absorbée → fiche survivante : l'historique suit la fusion.
    const versQui = new Map<string, Client>()
    let groupes = 0

    for (const list of parNom.values()) {
      if (list.length < 2) continue
      groupes++

      // On garde la fiche la plus active (achats, puis points, puis crédit),
      // puis on lui verse les soldes des autres et on comble ses champs vides.
      const keep = list.reduce((a, b) =>
        (b.totalSpent * 1000 + b.points * 10 + b.credit) > (a.totalSpent * 1000 + a.points * 10 + a.credit) ? b : a
      )
      const merged: Client = { ...keep }
      for (const c of list) {
        if (c.id === keep.id) continue
        merged.credit += Number(c.credit) || 0
        merged.totalSpent += Number(c.totalSpent) || 0
        merged.points += Number(c.points) || 0
        merged.discountBalance = (Number(merged.discountBalance) || 0) + (Number(c.discountBalance) || 0)
        merged.creditLimit = Math.max(Number(merged.creditLimit) || 0, Number(c.creditLimit) || 0)
        if (c.creditAllowed) merged.creditAllowed = true
        if (!merged.code && c.code) merged.code = c.code
        if (!merged.phone && c.phone) merged.phone = c.phone
        if (!merged.email && c.email) merged.email = c.email
        if (!merged.address && c.address) merged.address = c.address
        if (!merged.city && c.city) merged.city = c.city
        if (!merged.cin && c.cin) merged.cin = c.cin
        if (!merged.notes && c.notes) merged.notes = c.notes
        if (!merged.image && c.image) merged.image = c.image
        if (!merged.creditDueDate && c.creditDueDate) merged.creditDueDate = c.creditDueDate
        if (!merged.paymentTermDays && c.paymentTermDays) merged.paymentTermDays = c.paymentTermDays
        aSupprimer.add(c.id)
        versQui.set(c.id, keep)
      }
      fusionnees.set(keep.id, merged)
    }

    if (groupes === 0) return { groupes: 0, supprimees: 0 }

    persistClients(
      clients.filter((c) => !aSupprimer.has(c.id)).map((c) => fusionnees.get(c.id) ?? c)
    )

    // Re-pointage de l'historique — tous magasins confondus (les états sont
    // les collections complètes, le filtrage par magasin est fait à la lecture).
    const repointe = <R extends { clientId?: string; clientName?: string }>(rows: R[]): { rows: R[]; touche: boolean } => {
      let touche = false
      const next = rows.map((r) => {
        const cible = r.clientId ? versQui.get(r.clientId) : undefined
        if (!cible) return r
        touche = true
        return { ...r, clientId: cible.id, clientName: cible.name }
      })
      return { rows: next, touche }
    }
    const ventes = repointe(sales)
    if (ventes.touche) persistSales(ventes.rows)
    const reglements = repointe(clientPayments)
    if (reglements.touche) persistClientPayments(reglements.rows)
    const credz = repointe(credits)
    if (credz.touche) persistCredits(credz.rows)
    const fidelite = repointe(loyaltyMovements)
    if (fidelite.touche) persistLoyalty(fidelite.rows)

    logActivity(`Fusion de ${aSupprimer.size} fiche(s) client en double (${groupes} nom(s))`)
    return { groupes, supprimees: aSupprimer.size }
  }

  const settleCredit = (id: string, amount: number, method: ClientPayment['method'] = 'especes') => {
    const c = clients.find((x) => x.id === id)
    const nowIso = new Date().toISOString()
    // Allocate the payment across the client's open credits, oldest due first.
    let remaining = amount
    const nextCredits = [...credits]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((cr) => {
        if (cr.clientId !== id || remaining <= 0) return cr
        const due = cr.amount - cr.paid
        if (due <= 0) return cr
        const applied = Math.min(remaining, due)
        remaining -= applied
        return { ...cr, paid: cr.paid + applied, payments: [{ id: uid(), date: nowIso, amount: applied, method, note: 'Règlement solde' }, ...cr.payments] }
      })
    persistCredits(credits.map((cr) => nextCredits.find((n) => n.id === cr.id) ?? cr))
    persistClients(clients.map((x) => (x.id === id ? { ...x, credit: Math.max(0, x.credit - amount) } : x)))
    persistCash([
      { id: uid(), date: nowIso, type: 'recette', label: `Règlement crédit — ${c?.name ?? ''}`, amount },
      ...cash,
    ])
    persistClientPayments([
      { id: uid(), date: nowIso, clientId: id, clientName: c?.name ?? '', amount, method, note: 'Règlement crédit' },
      ...clientPayments,
    ])
    logActivity(`Règlement crédit ${c?.name ?? ''} : ${fmtDH(amount)}`)
  }

  const redeemPoints = (id: string, points: number) => {
    const c = clients.find((x) => x.id === id)
    if (!c || points <= 0 || points > c.points) return
    const discount = points * settings.pointValueDH
    persistClients(
      clients.map((x) =>
        x.id === id ? { ...x, points: x.points - points, discountBalance: x.discountBalance + discount } : x
      )
    )
    persistLoyalty([
      {
        id: uid(),
        date: new Date().toISOString(),
        clientId: id,
        clientName: c.name,
        type: 'utilisation',
        points,
        note: `Converti en ${fmtDH(discount)} de remise`,
      },
      ...loyaltyMovements,
    ])
    logActivity(`${c.name} a converti ${points} points en ${fmtDH(discount)} de remise`)
  }

  // ---- Expenses ----
  const addExpense = (data: Omit<Expense, 'id'>) => {
    const expense: Expense = { ...data, id: uid() }
    persistExpenses([expense, ...expenses])
    if (expense.status === 'payee') {
      persistCash([
        { id: uid(), date: expense.date, type: 'depense', label: `${expense.category} — ${expense.label}`, amount: expense.amount },
        ...cash,
      ])
    }
    logActivity(`Dépense enregistrée : ${expense.label} (${fmtDH(expense.amount)})`)
    return expense
  }

  const markExpensePaid = (id: string) => {
    const e = expenses.find((x) => x.id === id)
    if (!e || e.status === 'payee') return
    persistExpenses(expenses.map((x) => (x.id === id ? { ...x, status: 'payee' } : x)))
    persistCash([
      { id: uid(), date: new Date().toISOString(), type: 'depense', label: `${e.category} — ${e.label}`, amount: e.amount },
      ...cash,
    ])
    logActivity(`Dépense payée : ${e.label} (${fmtDH(e.amount)})`)
  }

  const deleteExpense = (id: string) => {
    persistExpenses(expenses.filter((x) => x.id !== id))
  }

  // ---- Revenues (recettes) ----
  const addRevenue = (data: Omit<Revenue, 'id'>) => {
    const revenue: Revenue = { ...data, id: uid() }
    persistRevenues([revenue, ...revenues])
    persistCash([
      { id: uid(), date: revenue.date, type: 'recette', label: `${revenue.category} — ${revenue.label}`, amount: revenue.amount },
      ...cash,
    ])
    logActivity(`Recette enregistrée : ${revenue.label} (${fmtDH(revenue.amount)})`)
    return revenue
  }

  const deleteRevenue = (id: string) => {
    persistRevenues(revenues.filter((x) => x.id !== id))
  }

  // ---- Money transfers (transferts d'argent) ----
  const addMoneyTransfer = (data: Omit<MoneyTransfer, 'id'>) => {
    const transfer: MoneyTransfer = { ...data, id: uid() }
    persistMoneyTransfers([transfer, ...moneyTransfers])
    // Impact caisse : « Caisse → X » = sortie, « X → Caisse » = entrée, sinon neutre.
    const [from, to] = transfer.route.split('→').map((s) => s.trim().toLowerCase())
    const cashType = from === 'caisse' ? 'depense' : to === 'caisse' ? 'recette' : null
    if (cashType) {
      const desc = `Transfert : ${transfer.route}${transfer.label ? ` — ${transfer.label}` : ''}`
      persistCash([{ id: uid(), date: transfer.date, type: cashType, label: desc, amount: transfer.amount }, ...cash])
    }
    logActivity(`Transfert d'argent : ${transfer.route} — ${fmtDH(transfer.amount)}`)
    return transfer
  }

  const deleteMoneyTransfer = (id: string) => {
    persistMoneyTransfers(moneyTransfers.filter((x) => x.id !== id))
  }

  // ---- Suppliers ----
  const addSupplier = (data: { name: string; phone: string; address: string }) => {
    persistSuppliers([{ ...data, id: uid(), balance: 0, totalPurchased: 0 }, ...suppliers])
  }

  const updateSupplier = (id: string, data: Partial<Supplier>) => {
    persistSuppliers(suppliers.map((s) => (s.id === id ? { ...s, ...data } : s)))
  }

  const deleteSupplier = (id: string) => {
    persistSuppliers(suppliers.filter((s) => s.id !== id))
  }

  const paySupplier = (id: string, amount: number, method: SupplierPayment['method'] = 'especes') => {
    const s = suppliers.find((x) => x.id === id)
    persistSuppliers(
      suppliers.map((x) => (x.id === id ? { ...x, balance: Math.max(0, x.balance - amount) } : x))
    )
    persistCash([
      { id: uid(), date: new Date().toISOString(), type: 'depense', label: `Paiement fournisseur — ${s?.name ?? ''}`, amount },
      ...cash,
    ])
    persistSupplierPayments([
      { id: uid(), date: new Date().toISOString(), supplierId: id, supplierName: s?.name ?? '', amount, method, note: 'Règlement solde' },
      ...supplierPayments,
    ])
    logActivity(`Paiement fournisseur ${s?.name ?? ''} : ${fmtDH(amount)}`)
  }

  // ---- Purchases ----
  const purchaseItemTotal = (i: PurchaseItem) => {
    const base = i.cost * i.qty * (1 - (i.discount ?? 0) / 100)
    return base * (1 + (i.tva ?? 0) / 100)
  }

  const purchaseTotal = (items: PurchaseItem[], globalDiscount?: number) => {
    const sum = items.reduce((a, i) => a + purchaseItemTotal(i), 0)
    return sum * (1 - (globalDiscount ?? 0) / 100)
  }

  const addPurchase = (
    supplierId: string,
    items: PurchaseItem[],
    meta?: { supplierRef?: string; expectedDate?: string; note?: string; globalDiscount?: number }
  ) => {
    const supplier = suppliers.find((s) => s.id === supplierId)
    if (!supplier) return
    const total = purchaseTotal(items, meta?.globalDiscount)
    const storeForDoc = stores.find((s) => s.id === activeStoreId) ?? null
    const po: Purchase = {
      id: uid(),
      ref: docNumber('BC', storeForDoc, purchases.filter((p) => p.storeId === activeStoreId).length + 1),
      date: new Date().toISOString(),
      supplierId,
      supplierName: supplier.name,
      supplierRef: meta?.supplierRef,
      expectedDate: meta?.expectedDate,
      note: meta?.note,
      globalDiscount: meta?.globalDiscount,
      items,
      total,
      paid: 0,
      status: 'en_attente',
    }
    persistPurchases([po, ...purchases])
    logActivity(`Commande fournisseur ${po.ref} créée (${fmtDH(total)})`)
    return po
  }

  // ---- Demandes de prix (consultation fournisseurs) ----

  const addRfq = (
    items: RfqItem[],
    meta?: { requestId?: string; requestRef?: string; neededBy?: string; note?: string }
  ): Rfq | undefined => {
    if (items.length === 0) return
    const seq = rfqs.filter((r) => r.storeId === activeStoreId).length + 1
    const rfq: Rfq = {
      id: uid(),
      ref: docNumber('DP', stores.find((s) => s.id === activeStoreId) ?? null, seq, 4),
      date: new Date().toISOString(),
      items,
      offers: [],
      status: 'brouillon',
      createdAt: new Date().toISOString(),
      createdBy: invUser(),
      ...meta,
    }
    persistRfqs([rfq, ...rfqs])
    logActivity(`Demande de prix ${rfq.ref} créée (${items.length} article(s))`, { target: rfq.ref })
    return rfq
  }

  /** Une consultation attribuée est figée : elle justifie un bon de commande. */
  const updateRfq = (id: string, patch: Partial<Rfq>) => {
    persistRfqs(rfqs.map((r) => (r.id === id && r.status !== 'attribuee' ? { ...r, ...patch } : r)))
  }

  /** Enregistre ou remplace l'offre d'un fournisseur. */
  const setRfqOffer = (id: string, offer: RfqOffer) => {
    const rfq = rfqs.find((r) => r.id === id)
    if (!rfq || rfq.status === 'attribuee' || rfq.status === 'annulee') return
    const autres = rfq.offers.filter((o) => o.supplierId !== offer.supplierId)
    const offers = [...autres, { ...offer, receivedAt: offer.receivedAt ?? new Date().toISOString() }]
    // Dès qu'une offre arrive, la consultation passe au dépouillement.
    persistRfqs(rfqs.map((r) => (r.id === id ? { ...r, offers, status: r.status === 'brouillon' || r.status === 'envoyee' ? 'depouillee' : r.status } : r)))
  }

  const removeRfqOffer = (id: string, supplierId: string) => {
    const rfq = rfqs.find((r) => r.id === id)
    if (!rfq || rfq.status === 'attribuee') return
    persistRfqs(rfqs.map((r) => (r.id === id ? { ...r, offers: r.offers.filter((o) => o.supplierId !== supplierId) } : r)))
  }

  /**
   * ATTRIBUTION : retient un fournisseur et crée le bon de commande à ses prix.
   * Le lien est conservé des deux côtés — le BC porte la référence de la
   * consultation, la consultation garde l'identifiant du BC : c'est ce qui rend
   * le choix du fournisseur justifiable après coup.
   */
  const awardRfq = (id: string, supplierId: string): Purchase | undefined => {
    const rfq = rfqs.find((r) => r.id === id)
    if (!rfq || rfq.status === 'attribuee' || rfq.status === 'annulee') return
    const offer = rfq.offers.find((o) => o.supplierId === supplierId)
    if (!offer) return
    const items: PurchaseItem[] = rfq.items.map((it) => ({
      productId: it.productId,
      name: it.name,
      barcode: it.barcode,
      cost: offer.prices[it.productId] ?? 0,
      qty: it.qty,
      unitName: it.unitName,
      unitFactor: it.unitFactor,
    }))
    const po = addPurchase(supplierId, items, {
      note: `${rfq.ref}${rfq.requestRef ? ` (${rfq.requestRef})` : ''}`,
      expectedDate: rfq.neededBy,
    })
    if (!po) return
    persistRfqs(rfqs.map((r) => (r.id === id
      ? {
          ...r, status: 'attribuee' as const, awardedSupplierId: supplierId,
          awardedSupplierName: offer.supplierName, purchaseId: po.id,
          awardedAt: new Date().toISOString(), awardedBy: invUser(),
        }
      : r)))
    logActivity(`Demande de prix ${rfq.ref} attribuée à ${offer.supplierName} → ${po.ref}`, { target: rfq.ref })
    return po
  }

  const cancelRfq = (id: string) => {
    const rfq = rfqs.find((r) => r.id === id)
    if (!rfq || rfq.status === 'attribuee') return
    persistRfqs(rfqs.map((r) => (r.id === id ? { ...r, status: 'annulee' as const } : r)))
    logActivity(`Demande de prix ${rfq.ref} annulée`, { target: rfq.ref })
  }

  const deleteRfq = (id: string) => {
    const rfq = rfqs.find((r) => r.id === id)
    // Une consultation attribuée a produit un BC : elle reste dans l'historique.
    if (!rfq || rfq.status === 'attribuee') return
    persistRfqs(rfqs.filter((r) => r.id !== id))
  }

  // ---- Demandes d'achat (DA) ----

  const daEvent = (action: string, comment?: string): PurchaseRequestEvent => ({
    date: new Date().toISOString(),
    action,
    user: mvUser() ?? '-',
    comment: comment || undefined,
  })

  const addPurchaseRequest = (data: { items: PurchaseRequestItem[]; neededBy?: string; motif?: string }) => {
    const who = (() => { try { return getSession() } catch { return null } })()
    const storeForDoc = stores.find((st) => st.id === activeStoreId) ?? null
    const req: PurchaseRequest = {
      id: uid(),
      ref: docNumber('DA', storeForDoc, purchaseRequests.filter((r) => r.storeId === activeStoreId).length + 1, 4),
      date: new Date().toISOString(),
      requesterId: who?.userId,
      requesterName: who?.name ?? '-',
      neededBy: data.neededBy || undefined,
      motif: data.motif || undefined,
      items: data.items,
      status: 'brouillon',
      history: [daEvent('creation')],
    }
    persistPurchaseRequests([req, ...purchaseRequests])
    logActivity(`Demande d'achat ${req.ref} creee`)
    return req
  }

  /** Seul un BROUILLON se modifie : apres soumission, le document fait foi. */
  const updatePurchaseRequest = (id: string, patch: Partial<Pick<PurchaseRequest, 'items' | 'neededBy' | 'motif'>>) => {
    persistPurchaseRequests(purchaseRequests.map((r) =>
      r.id === id && r.status === 'brouillon'
        ? { ...r, ...patch, history: [daEvent('modification'), ...r.history] }
        : r
    ))
  }

  const deletePurchaseRequest = (id: string) => {
    const r = purchaseRequests.find((x) => x.id === id)
    if (!r || r.status !== 'brouillon') return
    persistPurchaseRequests(purchaseRequests.filter((x) => x.id !== id))
    logActivity(`Demande d'achat ${r.ref} supprimee`)
  }

  const submitPurchaseRequest = (id: string) => {
    persistPurchaseRequests(purchaseRequests.map((r) =>
      r.id === id && r.status === 'brouillon' && r.items.length > 0
        ? { ...r, status: 'soumise', history: [daEvent('soumission'), ...r.history] }
        : r
    ))
  }

  /** Approbation ou refus - l'auteur de la decision et son motif restent sur le document. */
  const decidePurchaseRequest = (id: string, approuvee: boolean, comment?: string) => {
    const r = purchaseRequests.find((x) => x.id === id)
    persistPurchaseRequests(purchaseRequests.map((x) =>
      x.id === id && x.status === 'soumise'
        ? {
            ...x,
            status: approuvee ? 'approuvee' : 'refusee',
            decisionNote: comment || undefined,
            history: [daEvent(approuvee ? 'approbation' : 'refus', comment), ...x.history],
          }
        : x
    ))
    if (r) logActivity(`Demande d'achat ${r.ref} ${approuvee ? 'approuvee' : 'refusee'}`)
  }

  /**
   * CONVERSION EN BC - un bon de commande PAR FOURNISSEUR, sans ressaisie.
   * Les BC sont crees d'un bloc (les creer un a un ecraserait la liste a
   * chaque appel dans le meme rendu) et la DA garde leurs identifiants.
   */
  const convertPurchaseRequest = (id: string, parFournisseur: { supplierId: string; items: PurchaseItem[] }[]): Purchase[] | undefined => {
    const req = purchaseRequests.find((r) => r.id === id)
    if (!req || req.status !== 'approuvee') return
    const valides = parFournisseur.filter((g) => g.items.length > 0 && suppliers.some((sp) => sp.id === g.supplierId))
    if (valides.length === 0) return
    const storeForDoc = stores.find((st) => st.id === activeStoreId) ?? null
    const base = purchases.filter((p) => p.storeId === activeStoreId).length
    const nowIso = new Date().toISOString()
    const pos: Purchase[] = valides.map((g, k) => {
      const supplier = suppliers.find((sp) => sp.id === g.supplierId)
      return {
        id: uid(),
        ref: docNumber('BC', storeForDoc, base + k + 1),
        date: nowIso,
        supplierId: g.supplierId,
        supplierName: supplier?.name ?? '-',
        note: `DA ${req.ref}`,
        items: g.items,
        total: purchaseTotal(g.items),
        paid: 0,
        status: 'en_attente',
      }
    })
    persistPurchases([...pos, ...purchases])
    persistPurchaseRequests(purchaseRequests.map((r) =>
      r.id === id
        ? {
            ...r,
            status: 'convertie',
            purchaseIds: pos.map((p) => p.id),
            history: [daEvent('conversion', pos.map((p) => p.ref).join(', ')), ...r.history],
          }
        : r
    ))
    logActivity(`Demande d'achat ${req.ref} convertie : ${pos.length} BC (${pos.map((p) => p.ref).join(', ')})`)
    return pos
  }

  const closePurchaseRequest = (id: string) => {
    persistPurchaseRequests(purchaseRequests.map((r) =>
      r.id === id && r.status === 'convertie'
        ? { ...r, status: 'cloturee', history: [daEvent('cloture'), ...r.history] }
        : r
    ))
  }

  const updatePurchase = (id: string, patch: Partial<Purchase>) => {
    persistPurchases(
      purchases.map((p) => {
        if (p.id !== id || p.status !== 'en_attente') return p
        const next = { ...p, ...patch }
        next.total = purchaseTotal(next.items, next.globalDiscount)
        return next
      })
    )
  }

  const deletePurchase = (id: string) => {
    const po = purchases.find((p) => p.id === id)
    if (!po || po.status !== 'en_attente') return
    persistPurchases(purchases.filter((p) => p.id !== id))
    logActivity(`Commande fournisseur ${po.ref} supprimée`)
  }

  const recordDeliveryNote = (
    id: string,
    delivered: { productId: string; deliveredQty: number }[],
    meta?: { carrier?: string; note?: string }
  ) => {
    const po = purchases.find((p) => p.id === id)
    if (!po) return
    const blRef = po.blRef ?? docNumber('BL', stores.find((s) => s.id === po.storeId) ?? null, purchases.filter((p) => p.blRef && p.storeId === po.storeId).length + 1)
    persistPurchases(
      purchases.map((p) =>
        p.id === id
          ? {
              ...p,
              blRef,
              blDate: new Date().toISOString(),
              blCarrier: meta?.carrier ?? p.blCarrier,
              blNote: meta?.note ?? p.blNote,
              items: p.items.map((i) => {
                const d = delivered.find((x) => x.productId === i.productId)
                return d ? { ...i, deliveredQty: d.deliveredQty } : i
              }),
            }
          : p
      )
    )
    logActivity(`Bon de livraison ${blRef} enregistré (${po.ref})`)
  }

  const validateReception = (
    id: string,
    received: { productId: string; receivedQty: number; state: PurchaseItem['receptionState']; note?: string; expiryDate?: string }[],
    meta?: { employee?: string; depot?: string; depotId?: string }
  ) => {
    const po = purchases.find((p) => p.id === id)
    if (!po) return
    const brRef = po.brRef ?? docNumber('BR', stores.find((s) => s.id === po.storeId) ?? null, purchases.filter((p) => p.brRef && p.storeId === po.storeId).length + 1)
    let curProducts = products
    let curMovements = movements
    let curLots = lots
    let receivedValue = 0
    received.forEach((r) => {
      if (r.receivedQty <= 0) return
      const i = po.items.find((x) => x.productId === r.productId)
      if (!i) return
      const p = curProducts.find((x) => x.id === r.productId)
      if (!p) return
      // La quantité reçue est comptée dans l'unité d'ACHAT ; le stock et le
      // coût unitaire, eux, vivent dans l'unité de stock.
      const f = purchaseFactor(i)
      const qBase = roundQty(r.receivedQty * f)
      const coutBase = Math.round((i.cost / f) * 10000) / 10000
      receivedValue += r.receivedQty * i.cost
      // Chaque ligne reçue devient un LOT : date d'entrée, DLC saisie à la
      // réception, coût ramené à l'unité de base, provenance BC/BR.
      curLots = entreeLot(curLots, p, qBase, { cost: coutBase, expiryDate: r.expiryDate, ref: `${po.ref} / ${brRef}`, depotId: meta?.depotId })
      curProducts = curProducts.map((x) => (x.id === r.productId ? { ...x, stock: roundQty(x.stock + qBase), cost: coutBase } : x))
      curMovements = [
        { id: uid() + r.productId, date: new Date().toISOString(), productId: r.productId, productName: i.name, type: 'entree' as const, qty: qBase, note: `${po.ref} / ${brRef}`, storeId: po.storeId, depotId: meta?.depotId || undefined, user: meta?.employee || mvUser() },
        ...curMovements,
      ]
    })
    persistProducts(curProducts)
    persistMovements(curMovements)
    if (curLots !== lots) persistLots(curLots)

    const nextItems = po.items.map((i) => {
      const r = received.find((x) => x.productId === i.productId)
      if (!r) return i
      return {
        ...i,
        receivedQty: (i.receivedQty ?? 0) + r.receivedQty,
        receptionState: r.state ?? i.receptionState,
        receptionNote: r.note ?? i.receptionNote,
      }
    })
    const totalOrdered = nextItems.reduce((a, i) => a + i.qty, 0)
    const totalReceived = nextItems.reduce((a, i) => a + (i.receivedQty ?? 0), 0)
    const nextStatus: Purchase['status'] = totalReceived >= totalOrdered ? 'recue' : totalReceived > 0 ? 'partiellement_recue' : 'en_attente'

    persistPurchases(
      purchases.map((p) =>
        p.id === id
          ? {
              ...p,
              items: nextItems,
              status: nextStatus,
              brRef,
              brDate: new Date().toISOString(),
              brEmployee: meta?.employee ?? p.brEmployee,
              brDepot: meta?.depot ?? p.brDepot,
            }
          : p
      )
    )
    persistSuppliers(
      suppliers.map((s) =>
        s.id === po.supplierId ? { ...s, balance: s.balance + receivedValue, totalPurchased: s.totalPurchased + receivedValue } : s
      )
    )
    logActivity(`Réception ${brRef} — ${po.ref} — stock mis à jour`)
  }

  const payPurchase = (id: string, amount: number, method: SupplierPayment['method'] = 'especes') => {
    const po = purchases.find((p) => p.id === id)
    if (!po) return
    const pay = Math.min(amount, po.total - po.paid)
    persistPurchases(purchases.map((p) => (p.id === id ? { ...p, paid: p.paid + pay } : p)))
    persistSuppliers(
      suppliers.map((s) => (s.id === po.supplierId ? { ...s, balance: Math.max(0, s.balance - pay) } : s))
    )
    persistCash([
      { id: uid(), date: new Date().toISOString(), type: 'depense', label: `Facture ${po.ref} — ${po.supplierName}`, amount: pay },
      ...cash,
    ])
    persistSupplierPayments([
      { id: uid(), date: new Date().toISOString(), supplierId: po.supplierId, supplierName: po.supplierName, amount: pay, method, note: `Facture ${po.ref}` },
      ...supplierPayments,
    ])
    logActivity(`Paiement facture ${po.ref} : ${fmtDH(pay)}`)
  }

  const returnPurchase = (id: string) => {
    const po = purchases.find((p) => p.id === id)
    if (!po || po.status !== 'recue') return
    let curProducts = products
    let curMovements = movements
    let curLots = lots
    po.items.forEach((i) => {
      /*
       * EN UNITÉS DE BASE, comme partout. La version précédente déduisait
       * i.qty tel quel : retourner une commande de « 3 cartons de 2000 »
       * retirait 3 pièces du stock au lieu de 6000. On rend ce qui a été
       * REÇU (receivedQty, accumulé par les réceptions partielles), converti
       * par le facteur d'achat — le symétrique exact de validateReception.
       */
      const qBase = roundQty((i.receivedQty ?? i.qty) * purchaseFactor(i))
      // Les lots de CE bon de commande partent en premier : on rend au
      // fournisseur sa propre marchandise avant d'entamer le reste.
      const prod = curProducts.find((x) => x.id === i.productId)
      if (prod) curLots = sortieLots(curLots, prod, qBase, po.ref)
      curProducts = curProducts.map((x) =>
        x.id === i.productId ? { ...x, stock: debiterStock(x.stock, qBase) } : x
      )
      curMovements = [
        { id: uid() + i.productId, date: new Date().toISOString(), productId: i.productId, productName: i.name, type: 'retour' as const, qty: -qBase, note: `Retour ${po.ref}`, storeId: po.storeId, user: mvUser() },
        ...curMovements,
      ]
    })
    persistProducts(curProducts)
    persistMovements(curMovements)
    if (curLots !== lots) persistLots(curLots)
    persistPurchases(purchases.map((p) => (p.id === id ? { ...p, status: 'retournee' } : p)))
    // Cancels the full order value: the unpaid portion is removed from what we owe,
    // and any portion already paid becomes a credit (avoir) — balance may go negative,
    // meaning the supplier now owes us until offset by a future purchase.
    persistSuppliers(
      suppliers.map((s) => (s.id === po.supplierId ? { ...s, balance: s.balance - po.total } : s))
    )
    if (po.paid > 0) {
      logActivity(`Retour fournisseur ${po.ref} — avoir de ${fmtDH(po.paid)} généré`)
    } else {
      logActivity(`Retour fournisseur ${po.ref}`)
    }
  }

  // ---- Quotes ----
  const addQuote = (clientName: string, items: SaleItem[]) => {
    const total = items.reduce((a, i) => a + i.price * i.qty, 0)
    const q: Quote = {
      id: uid(),
      ref: docNumber('DEV', stores.find((s) => s.id === activeStoreId) ?? null, quotes.filter((x) => x.storeId === activeStoreId).length + 1, 4),
      date: new Date().toISOString(),
      clientName,
      items,
      total,
      status: 'en_attente',
    }
    persistQuotes([q, ...quotes])
    logActivity(`Devis ${q.ref} créé (${fmtDH(total)})`)
    return q
  }

  const setQuoteStatus = (id: string, status: Quote['status']) => {
    persistQuotes(quotes.map((q) => (q.id === id ? { ...q, status } : q)))
  }

  /**
   * MODIFIE un devis existant au lieu d'en créer un second. Sans cela,
   * retoucher un brouillon puis l'enregistrer laissait le premier derrière
   * lui — trois devis identiques pour une seule demande client.
   * Un devis converti est figé : il justifie une vente.
   */
  const updateQuote = (id: string, clientName: string, items: SaleItem[]): Quote | undefined => {
    const q = quotes.find((x) => x.id === id)
    if (!q || q.status === 'converti') return
    const total = items.reduce((a, i) => a + i.price * i.qty, 0)
    const next: Quote = { ...q, clientName, items, total }
    persistQuotes(quotes.map((x) => (x.id === id ? next : x)))
    logActivity(`Devis ${q.ref} modifié (${fmtDH(total)})`, { target: q.ref })
    return next
  }

  /**
   * CONVERSION D'UN DEVIS EN VENTE — une seule fois.
   *
   * L'écran appelait `recordSale` sans jamais marquer le devis converti : le
   * bouton restait actif et chaque clic créait une vente de plus. Constaté avec
   * six ventes identiques issues du même devis, et le stock débité six fois.
   *
   * Le verrou est ici, sur le seul chemin qui convertit : le statut passe à
   * `converti` dans la foulée de la vente, et un devis déjà converti est refusé.
   */
  const convertQuote = (id: string, payment: Sale['payment'] = 'especes'): Sale | undefined => {
    const q = quotes.find((x) => x.id === id)
    if (!q || q.status === 'converti') return
    const client = clients.find((c) => c.name === q.clientName) ?? null
    const sale = recordSale(q.items, payment, client)
    persistQuotes(quotes.map((x) => (x.id === id ? { ...x, status: 'converti' as const } : x)))
    logActivity(`Devis ${q.ref} converti en vente (${fmtDH(q.total)})`, { target: q.ref })
    return sale
  }

  const deleteQuote = (id: string) => {
    persistQuotes(quotes.filter((q) => q.id !== id))
  }

  // ---- Cash register ----
  const addCashEntry = (type: CashEntry['type'], label: string, amount: number) => {
    persistCash([{ id: uid(), date: new Date().toISOString(), type, label, amount }, ...cash])
    logActivity(`${type === 'depense' ? 'Dépense' : 'Recette'} : ${label} (${fmtDH(amount)})`)
  }

  const openSession = (openingAmount: number) => {
    const s: RegisterSession = { id: uid(), openedAt: new Date().toISOString(), openingAmount }
    persistSessions([s, ...sessions])
    logActivity(`Ouverture de caisse (${fmtDH(openingAmount)})`)
  }

  // Only this store's open session drives the register state.
  const currentSession = sessions.find((s) => !s.closedAt && s.storeId === activeStoreId) ?? null

  const expectedCash = (session: RegisterSession) => {
    const since = session.openedAt
    const sid = session.storeId ?? activeStoreId
    const cashSales = sales
      .filter((s) => s.storeId === sid && s.date >= since && (s.payment === 'especes' || s.payment === 'mixte'))
      .reduce((a, s) => a + s.total, 0)
    const dep = cash.filter((c) => c.storeId === sid && c.date >= since && c.type === 'depense').reduce((a, c) => a + c.amount, 0)
    const rec = cash.filter((c) => c.storeId === sid && c.date >= since && c.type === 'recette').reduce((a, c) => a + c.amount, 0)
    return session.openingAmount + cashSales + rec - dep
  }

  const closeSession = (closingAmount: number) => {
    if (!currentSession) return
    const expected = expectedCash(currentSession)
    // Snapshot the end-of-day breakdown (this store only) so the archive stays stable over time.
    const sid = currentSession.storeId ?? activeStoreId
    const summary = computeSessionSummary(
      currentSession,
      sales.filter((s) => s.storeId === sid),
      cash.filter((c) => c.storeId === sid),
      clientPayments.filter((p) => p.storeId === sid)
    )
    persistSessions(
      sessions.map((s) =>
        s.id === currentSession.id
          ? { ...s, closedAt: new Date().toISOString(), closingAmount, expectedAmount: expected, summary }
          : s
      )
    )
    logActivity(`Fermeture de caisse — compté ${fmtDH(closingAmount)}, attendu ${fmtDH(expected)}`)
  }

  // ---- Users ----
  // Toutes les mutations utilisateurs passent par la ref (compositions sûres)
  // puis notifient les autres instances useDroguerie (AuthProvider, pages…)
  // pour qu'elles rechargent la liste immédiatement.
  const commitUsers = (next: AppUser[]) => {
    usersRef.current = next
    persistUsers(next)
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('droguerie-sync-pull'))
  }

  const addUser = (data: Omit<AppUser, 'id'>): AppUser => {
    const u: AppUser = { ...data, id: uid() }
    commitUsers([u, ...usersRef.current])
    return u
  }

  // Réinitialise TOUS les identifiants en une seule écriture.
  const resetAllCredentials = () => {
    commitUsers(usersRef.current.map((u) => ({ ...u, passwordHash: '', pinHash: '', mustChangePassword: false })))
    logActivity('Réinitialisation de tous les identifiants')
  }
  const updateUser = (id: string, data: Partial<AppUser>) =>
    commitUsers(usersRef.current.map((u) => (u.id === id ? { ...u, ...data } : u)))
  const deleteUser = (id: string) => commitUsers(usersRef.current.filter((u) => u.id !== id))

  // ---- Attributes ----
  const attrActions = (list: Attribute[], persist: (v: Attribute[]) => void) => ({
    add: (name: string) => persist([{ id: uid(), name: name.trim() }, ...list]),
    rename: (id: string, name: string) => persist(list.map((a) => (a.id === id ? { ...a, name } : a))),
    remove: (id: string) => persist(list.filter((a) => a.id !== id)),
  })

  // ---- Stores (magasins) ----
  const activeStore = stores.find((s) => s.id === activeStoreId) ?? null

  const addStore = (data: Partial<Omit<Store, 'id' | 'createdAt'>> & { name: string; code: string }): Store => {
    const store: Store = {
      id: uid(),
      name: data.name,
      code: data.code,
      address: data.address ?? '',
      city: data.city ?? '',
      phone: data.phone ?? '',
      email: data.email ?? '',
      manager: data.manager ?? '',
      logoDataUrl: data.logoDataUrl ?? '',
      ice: data.ice ?? '',
      idFiscal: data.idFiscal ?? '',
      docPrefix: (data.docPrefix ?? data.code ?? '').toUpperCase(),
      active: data.active ?? true,
      createdAt: new Date().toISOString(),
    }
    persistStores([...stores, store])
    const mainDepotId = uid()
    persistDepots([{ id: mainDepotId, storeId: store.id, name: 'Dépôt principal', address: store.address, responsable: store.manager, code: depotShortCode(0) }, ...depots])
    // Zones par défaut (commerciales + logistiques), rattachées au dépôt principal.
    persistZones([...zones, ...DEFAULT_ZONES.map((z, i) => ({ id: uid(), storeId: store.id, depotId: mainDepotId, code: z.code, name: z.name, type: z.type, active: true, order: i }))])
    logActivity(`Magasin créé : ${store.name}`)
    return store
  }

  const updateStore = (id: string, data: Partial<Store>) =>
    persistStores(stores.map((s) => (s.id === id ? { ...s, ...data } : s)))

  const switchStore = (id: string) => {
    if (!stores.some((s) => s.id === id)) return
    setActiveStoreId(id)
    setActiveStoreIdState(id)
    if (typeof window !== 'undefined') window.location.reload()
  }

  const deleteStore = (id: string) => {
    if (stores.length <= 1) return
    const next = stores.filter((s) => s.id !== id)
    persistStores(next)
    persistDepots(depots.filter((d) => d.storeId !== id))
    logActivity('Magasin supprimé')
    if (activeStoreId === id) {
      setActiveStoreId(next[0].id)
      if (typeof window !== 'undefined') window.location.reload()
    }
  }

  // ---- Depots ----
  const addDepot = (data: Omit<Depot, 'id'>) => {
    // Premier code DEP libre dans le magasin (évite les doublons).
    const used = new Set(depots.filter((x) => x.storeId === data.storeId).map((x) => (x.code || '').toUpperCase()))
    let n = 0
    while (used.has(depotShortCode(n))) n++
    persistDepots([{ ...data, id: uid(), code: data.code || depotShortCode(n) }, ...depots])
  }
  const updateDepot = (id: string, data: Partial<Depot>) =>
    persistDepots(depots.map((d) => (d.id === id ? { ...d, ...data } : d)))
  const deleteDepot = (id: string) => persistDepots(depots.filter((d) => d.id !== id))

  // ---- Emplacements (WMS) : hiérarchie Zone → Allée → Rayon → Étagère → Niveau
  //      → Position. Intégrité gérée ici (pas de FK SQL) : on empêche de supprimer
  //      un élément qui a des enfants. `locateResult` : { ok } ou { ok:false, error:'children' }.
  const addZone = (data: Omit<Zone, 'id'>): Zone => { const z = { ...data, id: uid() }; persistZones([z, ...zones]); return z }
  // Import en masse de zones (une écriture, anti-doublon par code), rattachées à un dépôt.
  const bulkAddZones = (storeId: string, depotId: string | undefined, rows: { code: string; name?: string; type?: 'commerciale' | 'logistique' }[]): number => {
    const existing = new Set(zones.filter((z) => z.storeId === storeId).map((z) => z.code.toUpperCase()))
    const seen = new Set<string>()
    const clean = rows
      .map((r) => ({ code: String(r.code ?? '').trim().toUpperCase(), name: (r.name ?? '').trim(), type: r.type }))
      .filter((r) => r.code && !/code|zone|nom/i.test(r.code))
      .filter((r) => { if (existing.has(r.code) || seen.has(r.code)) return false; seen.add(r.code); return true })
    if (clean.length === 0) return 0
    const base = zones.filter((z) => z.storeId === storeId).length
    persistZones([...clean.map((r, i) => ({ id: uid(), storeId, depotId, code: r.code, name: r.name || r.code, type: r.type === 'logistique' ? 'logistique' as const : 'commerciale' as const, active: true, order: base + i })), ...zones])
    return clean.length
  }
  // Crée les zones par défaut manquantes pour un magasin existant (idempotent par code).
  const seedDefaultZones = (storeId: string): number => {
    const existing = new Set(zones.filter((z) => z.storeId === storeId).map((z) => z.code.toUpperCase()))
    const missing = DEFAULT_ZONES.filter((z) => !existing.has(z.code))
    if (missing.length === 0) return 0
    const depotId = depots.find((x) => x.storeId === storeId)?.id
    persistZones([...zones, ...missing.map((z, i) => ({ id: uid(), storeId, depotId, code: z.code, name: z.name, type: z.type, active: true, order: existing.size + i }))])
    logActivity(`Zones par défaut créées (${missing.length})`, { target: stores.find((s) => s.id === storeId)?.name })
    return missing.length
  }
  const updateZone = (id: string, data: Partial<Zone>) => persistZones(zones.map((z) => (z.id === id ? { ...z, ...data } : z)))
  const deleteZone = (id: string) => {
    if (allees.some((a) => a.zoneId === id)) return { ok: false as const, error: 'children' as const }
    persistZones(zones.filter((z) => z.id !== id)); return { ok: true as const }
  }

  const addAllee = (data: Omit<Allee, 'id'>): Allee => { const a = { ...data, id: uid() }; persistAllees([a, ...allees]); return a }
  // Modèle AtlasStock : crée les allées nommées d'une zone (ajoute uniquement
  // celles qui manquent — idempotent par code).
  const seedZoneAllees = (zoneId: string, storeId: string, zoneCode: string): number => {
    const existing = new Set(allees.filter((a) => a.zoneId === zoneId).map((a) => a.code.toUpperCase()))
    const tpl = alleeTemplateForZone(zoneCode).filter((a) => !existing.has(a.code.toUpperCase()))
    if (tpl.length === 0) return 0
    persistAllees([...tpl.map((a) => ({ id: uid(), storeId, zoneId, code: a.code, name: a.name })), ...allees])
    return tpl.length
  }

  // Import en masse d'un niveau d'emplacement dans un parent donné (une seule
  // écriture). Ignore les doublons de code au sein du même parent.
  const bulkAddLocations = (
    level: 'allee' | 'rayon' | 'etagere' | 'niveau' | 'position',
    storeId: string,
    parentField: string,
    parentId: string,
    rows: { code: string; name?: string }[]
  ): number => {
    const table = {
      allee: { items: allees, persist: persistAllees },
      rayon: { items: rayons, persist: persistRayons },
      etagere: { items: etageres, persist: persistEtageres },
      niveau: { items: niveaux, persist: persistNiveaux },
      position: { items: positions, persist: persistPositions },
    }[level]
    const existing = new Set(
      (table.items as unknown as { code: string; [k: string]: unknown }[])
        .filter((it) => it[parentField] === parentId)
        .map((it) => it.code.toUpperCase())
    )
    const seen = new Set<string>()
    const toAdd = rows
      .map((r) => ({ code: String(r.code ?? '').trim().toUpperCase(), name: (r.name ?? '').trim() }))
      .filter((r) => r.code && !/code|barre|allee|rayon|etag|niveau|position/i.test(r.code))
      .filter((r) => { if (existing.has(r.code) || seen.has(r.code)) return false; seen.add(r.code); return true })
    if (toAdd.length === 0) return 0
    const items = toAdd.map((r) => ({ id: uid(), storeId, [parentField]: parentId, code: r.code, name: r.name || undefined }))
    ;(table.persist as (v: unknown[]) => void)([...items, ...(table.items as unknown[])])
    return toAdd.length
  }

  // Générateur de sous-structure à la demande : crée sous une allée une grille
  // Rayons × Étagères × Niveaux × Positions. Une SEULE écriture par collection
  // (batch) — le volume total est décidé et confirmé par l'utilisateur.
  const generateSubStructure = (
    alleeId: string,
    storeId: string,
    counts: { rayons: number; etageres: number; niveaux: number; positions: number },
    mode: 'new' | 'merge' | 'replace' = 'new'
  ): { ok: boolean; error?: 'exists' | 'empty'; total?: number; counts?: { rayons: number; etageres: number; niveaux: number; positions: number } } => {
    const R = Math.max(0, Math.floor(counts.rayons))
    const E = Math.max(0, Math.floor(counts.etageres))
    const N = Math.max(0, Math.floor(counts.niveaux))
    const P = Math.max(0, Math.floor(counts.positions))
    if (R === 0) return { ok: false, error: 'empty' }
    const existing = rayons.filter((r) => r.alleeId === alleeId)
    if (mode === 'new' && existing.length > 0) return { ok: false, error: 'exists' }

    // Bases après suppression éventuelle (mode Remplacer), et n° de départ des rayons.
    let baseR = rayons, baseE = etageres, baseN = niveaux, baseP = positions
    let startR = 1
    if (mode === 'replace' && existing.length) {
      const rIds = new Set(existing.map((r) => r.id))
      const eIds = new Set(etageres.filter((e) => rIds.has(e.rayonId as string)).map((e) => e.id))
      const nIds = new Set(niveaux.filter((n) => eIds.has(n.etagereId as string)).map((n) => n.id))
      baseR = rayons.filter((r) => !rIds.has(r.id))
      baseE = etageres.filter((e) => !rIds.has(e.rayonId as string))
      baseN = niveaux.filter((n) => !eIds.has(n.etagereId as string))
      baseP = positions.filter((p) => !nIds.has(p.niveauId as string))
    } else if (mode === 'merge' && existing.length) {
      startR = Math.max(0, ...existing.map((r) => parseInt(r.code.replace(/\D/g, ''), 10) || 0)) + 1
    }

    const p2 = (n: number) => String(n).padStart(2, '0')
    const p3 = (n: number) => String(n).padStart(3, '0')
    const newR: Rayon[] = [], newE: Etagere[] = [], newN: Niveau[] = [], newP: Position[] = []
    for (let r = startR; r < startR + R; r++) {
      const rid = uid(); newR.push({ id: rid, storeId, alleeId, code: 'R' + p2(r) })
      for (let e = 1; e <= E; e++) {
        const eid = uid(); newE.push({ id: eid, storeId, rayonId: rid, code: 'E' + p2(e) })
        for (let n = 1; n <= N; n++) {
          const nid = uid(); newN.push({ id: nid, storeId, etagereId: eid, code: 'N' + p2(n) })
          for (let p = 1; p <= P; p++) newP.push({ id: uid(), storeId, niveauId: nid, code: 'P' + p3(p) })
        }
      }
    }
    persistRayons([...newR, ...baseR])
    persistEtageres([...newE, ...baseE])
    persistNiveaux([...newN, ...baseN])
    persistPositions([...newP, ...baseP])
    const c = { rayons: newR.length, etageres: newE.length, niveaux: newN.length, positions: newP.length }
    const total = c.rayons + c.etageres + c.niveaux + c.positions
    logActivity(`Structure générée (${total} éléments, ${mode})`, { target: allees.find((a) => a.id === alleeId)?.code })
    return { ok: true, total, counts: c }
  }
  /**
   * Écrit d'un coup une arborescence complète Zone → Position (assistant
   * « magasin à partir de photos »). UNE SEULE écriture par collection, quel
   * que soit le volume : indispensable pour ne pas exploser le quota de lignes
   * écrites de la synchro. Les codes de zone déjà présents sont ignorés.
   */
  const commitStructureTree = (
    storeId: string,
    tree: {
      code: string; name: string; type?: 'commerciale' | 'logistique'
      allees: { code: string; name?: string; rayons: { code: string; name?: string; etageres: number; niveaux: number; positions: number }[] }[]
    }[]
  ): { ok: boolean; counts: { zones: number; allees: number; rayons: number; etageres: number; niveaux: number; positions: number }; total: number } => {
    const depotId = depots.find((x) => x.storeId === storeId)?.id
    const taken = new Set(zones.filter((z) => z.storeId === storeId).map((z) => z.code.toUpperCase()))
    const base = zones.filter((z) => z.storeId === storeId).length

    const newZ: Zone[] = [], newA: Allee[] = [], newR: Rayon[] = []
    const newE: Etagere[] = [], newN: Niveau[] = [], newP: Position[] = []
    const p2 = (n: number) => String(n).padStart(2, '0')
    const p3 = (n: number) => String(n).padStart(3, '0')

    tree.forEach((z) => {
      const code = String(z.code ?? '').trim().toUpperCase()
      if (!code || taken.has(code)) return
      taken.add(code)
      const zid = uid()
      newZ.push({
        id: zid, storeId, depotId, code, name: (z.name || code).trim(),
        type: z.type === 'logistique' ? 'logistique' : 'commerciale',
        active: true, order: base + newZ.length,
      })
      z.allees.forEach((a, ai) => {
        const aid = uid()
        newA.push({ id: aid, storeId, zoneId: zid, code: String(a.code || p2(ai + 1)).toUpperCase(), name: a.name?.trim() || undefined })
        a.rayons.forEach((r, ri) => {
          const rid = uid()
          newR.push({ id: rid, storeId, alleeId: aid, code: String(r.code || 'R' + p2(ri + 1)).toUpperCase(), name: r.name?.trim() || undefined })
          const E = Math.max(1, Math.min(20, Math.round(r.etageres)))
          const N = Math.max(1, Math.min(12, Math.round(r.niveaux)))
          const P = Math.max(1, Math.min(60, Math.round(r.positions)))
          for (let e = 1; e <= E; e++) {
            const eid = uid()
            newE.push({ id: eid, storeId, rayonId: rid, code: 'E' + p2(e) })
            for (let n = 1; n <= N; n++) {
              const nid2 = uid()
              newN.push({ id: nid2, storeId, etagereId: eid, code: 'N' + p2(n) })
              for (let p = 1; p <= P; p++) newP.push({ id: uid(), storeId, niveauId: nid2, code: 'P' + p3(p) })
            }
          }
        })
      })
    })

    if (newZ.length === 0) return { ok: false, counts: { zones: 0, allees: 0, rayons: 0, etageres: 0, niveaux: 0, positions: 0 }, total: 0 }

    persistZones([...newZ, ...zones])
    persistAllees([...newA, ...allees])
    persistRayons([...newR, ...rayons])
    persistEtageres([...newE, ...etageres])
    persistNiveaux([...newN, ...niveaux])
    persistPositions([...newP, ...positions])

    const counts = { zones: newZ.length, allees: newA.length, rayons: newR.length, etageres: newE.length, niveaux: newN.length, positions: newP.length }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    logActivity(`Structure créée depuis photos (${total} éléments)`, { target: stores.find((s) => s.id === storeId)?.name })
    return { ok: true, counts, total }
  }

  const updateAllee = (id: string, data: Partial<Allee>) => persistAllees(allees.map((a) => (a.id === id ? { ...a, ...data } : a)))
  const deleteAllee = (id: string) => {
    if (rayons.some((r) => r.alleeId === id)) return { ok: false as const, error: 'children' as const }
    persistAllees(allees.filter((a) => a.id !== id)); return { ok: true as const }
  }

  const addRayon = (data: Omit<Rayon, 'id'>): Rayon => { const r = { ...data, id: uid() }; persistRayons([r, ...rayons]); return r }
  const updateRayon = (id: string, data: Partial<Rayon>) => persistRayons(rayons.map((r) => (r.id === id ? { ...r, ...data } : r)))
  const deleteRayon = (id: string) => {
    if (etageres.some((e) => e.rayonId === id)) return { ok: false as const, error: 'children' as const }
    persistRayons(rayons.filter((r) => r.id !== id)); return { ok: true as const }
  }

  const addEtagere = (data: Omit<Etagere, 'id'>): Etagere => { const e = { ...data, id: uid() }; persistEtageres([e, ...etageres]); return e }
  const updateEtagere = (id: string, data: Partial<Etagere>) => persistEtageres(etageres.map((e) => (e.id === id ? { ...e, ...data } : e)))
  const deleteEtagere = (id: string) => {
    if (niveaux.some((n) => n.etagereId === id)) return { ok: false as const, error: 'children' as const }
    persistEtageres(etageres.filter((e) => e.id !== id)); return { ok: true as const }
  }

  const addNiveau = (data: Omit<Niveau, 'id'>): Niveau => { const n = { ...data, id: uid() }; persistNiveaux([n, ...niveaux]); return n }
  const updateNiveau = (id: string, data: Partial<Niveau>) => persistNiveaux(niveaux.map((n) => (n.id === id ? { ...n, ...data } : n)))
  const deleteNiveau = (id: string) => {
    if (positions.some((p) => p.niveauId === id)) return { ok: false as const, error: 'children' as const }
    persistNiveaux(niveaux.filter((n) => n.id !== id)); return { ok: true as const }
  }

  const addPosition = (data: Omit<Position, 'id'>): Position => { const p = { ...data, id: uid() }; persistPositions([p, ...positions]); return p }
  const updatePosition = (id: string, data: Partial<Position>) => persistPositions(positions.map((p) => (p.id === id ? { ...p, ...data } : p)))
  const deletePosition = (id: string) => {
    if (emplacements.some((e) => e.positionId === id)) return { ok: false as const, error: 'children' as const }
    persistPositions(positions.filter((p) => p.id !== id)); return { ok: true as const }
  }

  const addEmplacement = (data: Omit<Emplacement, 'id'>): Emplacement => { const e = { ...data, id: uid() }; persistEmplacements([e, ...emplacements]); return e }
  const updateEmplacement = (id: string, data: Partial<Emplacement>) => persistEmplacements(emplacements.map((e) => (e.id === id ? { ...e, ...data } : e)))
  const deleteEmplacement = (id: string) => persistEmplacements(emplacements.filter((e) => e.id !== id))

  // Résout la chaîne d'emplacement d'un produit (codes + noms) pour l'affichage
  // (recherche, scan, réappro, inventaire). Retourne null si non localisé.
  const resolveLocation = (p?: Product | null) => {
    if (!p) return null
    const z = zones.find((x) => x.id === p.zoneId)
    const a = allees.find((x) => x.id === p.alleeId)
    const r = rayons.find((x) => x.id === p.rayonId)
    const e = etageres.find((x) => x.id === p.etagereId)
    const n = niveaux.find((x) => x.id === p.niveauId)
    const po = positions.find((x) => x.id === p.positionId)
    // Dépôt : celui de la zone, sinon le dépôt principal du magasin (repli migration).
    const dep = (z?.depotId && depots.find((x) => x.id === z.depotId))
      || depots.find((x) => x.storeId === (p.storeId ?? activeStoreRef.current))
      || null
    if (!z && !p.emplacementComplet) return null
    return { code: p.emplacementComplet ?? '', depot: dep, zone: z, allee: a, rayon: r, etagere: e, niveau: n, position: po }
  }
  // Clé de tri « parcours physique » : les produits non localisés en dernier.
  const locationSortKey = (p: Product) => p.emplacementComplet || '~~~~~~'

  // ---- Stock transfers ----
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? ''

  const evt = (action: TransferEvent['action'], user: string, comment = ''): TransferEvent => ({
    id: uid(),
    date: new Date().toISOString(),
    action,
    user,
    comment,
  })

  const addTransfer = (data: {
    sourceStoreId: string
    sourceDepotId?: string
    destStoreId: string
    destDepotId?: string
    user: string
    note?: string
    items: TransferItem[]
  }): Transfer | { error: string } => {
    // Business rule: no transfer to the same store/depot.
    if (data.sourceStoreId === data.destStoreId && (data.sourceDepotId ?? '') === (data.destDepotId ?? '')) {
      return { error: 'same_location' }
    }
    const src = stores.find((s) => s.id === data.sourceStoreId) ?? null
    const transfer: Transfer = {
      id: uid(),
      ref: docNumber('TR', src, transfers.filter((x) => x.sourceStoreId === data.sourceStoreId).length + 1),
      date: new Date().toISOString(),
      sourceStoreId: data.sourceStoreId,
      sourceDepotId: data.sourceDepotId,
      destStoreId: data.destStoreId,
      destDepotId: data.destDepotId,
      user: data.user,
      note: data.note ?? '',
      items: data.items.map((i) => ({ ...i, transferredQty: 0 })),
      status: 'brouillon',
      history: [evt('creation', data.user)],
    }
    persistTransfers([transfer, ...transfers])
    logActivity(`Transfert ${transfer.ref} créé (${storeName(data.sourceStoreId)} → ${storeName(data.destStoreId)})`)
    return transfer
  }

  const updateTransfer = (id: string, patch: { items?: TransferItem[]; note?: string; user?: string }) => {
    persistTransfers(
      transfers.map((tr) => {
        if (tr.id !== id || tr.status !== 'brouillon') return tr
        return {
          ...tr,
          ...(patch.items ? { items: patch.items.map((i) => ({ ...i, transferredQty: 0 })) } : {}),
          ...(patch.note !== undefined ? { note: patch.note } : {}),
          history: [evt('modification', patch.user ?? tr.user), ...tr.history],
        }
      })
    )
  }

  const deleteTransfer = (id: string) => {
    const tr = transfers.find((x) => x.id === id)
    if (!tr) return
    // Release any reservation before removing a validated draft.
    if (tr.status === 'valide') {
      persistProducts(
        products.map((p) => {
          const q = tr.items.filter((i) => i.productId === p.id).reduce((a, i) => a + i.requestedQty, 0)
          return q ? { ...p, reserved: Math.max(0, (p.reserved ?? 0) - q) } : p
        })
      )
    }
    if (tr.status === 'brouillon' || tr.status === 'valide') {
      persistTransfers(transfers.filter((x) => x.id !== id))
      logActivity(`Transfert ${tr.ref} supprimé`)
    }
  }

  // Validation: reserve the requested quantities in the source store.
  const validateTransfer = (id: string, user: string, comment = ''): { ok: boolean; error?: string } => {
    const tr = transfers.find((x) => x.id === id)
    if (!tr || tr.status !== 'brouillon') return { ok: false, error: 'status' }
    // Check availability (physical stock minus already-reserved).
    for (const it of tr.items) {
      const p = products.find((x) => x.id === it.productId)
      if (!p || it.requestedQty > availableStock(p)) return { ok: false, error: 'insufficient' }
    }
    persistProducts(
      products.map((p) => {
        const q = tr.items.filter((i) => i.productId === p.id).reduce((a, i) => a + i.requestedQty, 0)
        return q ? { ...p, reserved: (p.reserved ?? 0) + q } : p
      })
    )
    persistTransfers(transfers.map((x) => (x.id === id ? { ...x, status: 'valide', history: [evt('valide', user, comment), ...x.history] } : x)))
    logActivity(`Transfert ${tr.ref} validé`)
    return { ok: true }
  }

  // Shipping: decrement source stock, release the reservation, log an outbound movement.
  const shipTransfer = (id: string, user: string, comment = ''): { ok: boolean; error?: string } => {
    const tr = transfers.find((x) => x.id === id)
    if (!tr || tr.status !== 'valide') return { ok: false, error: 'status' }
    let curProducts = products
    let curLots = lots
    const newMovements: StockMovement[] = []
    for (const it of tr.items) {
      // L'expédition consomme les lots de la source (FIFO/FEFO), comme une vente.
      const prod = curProducts.find((p) => p.id === it.productId)
      if (prod) curLots = sortieLots(curLots, prod, it.requestedQty)
      curProducts = curProducts.map((p) =>
        p.id === it.productId
          ? { ...p, stock: Math.max(0, p.stock - it.requestedQty), reserved: Math.max(0, (p.reserved ?? 0) - it.requestedQty) }
          : p
      )
      newMovements.push({
        id: uid() + it.productId,
        date: new Date().toISOString(),
        productId: it.productId,
        productName: it.name,
        type: 'transfert_out',
        qty: -it.requestedQty,
        note: `Transfert ${tr.ref} → ${storeName(tr.destStoreId)}`,
        storeId: tr.sourceStoreId,
        depotId: tr.sourceDepotId || undefined,
        user,
      })
    }
    persistProducts(curProducts)
    persistMovements([...newMovements, ...movements])
    if (curLots !== lots) persistLots(curLots)
    persistTransfers(
      transfers.map((x) =>
        x.id === id
          ? { ...x, status: 'expedie', items: x.items.map((i) => ({ ...i, transferredQty: i.requestedQty })), history: [evt('expedie', user, comment), ...x.history] }
          : x
      )
    )
    logActivity(`Transfert ${tr.ref} expédié`)
    return { ok: true }
  }

  // Reception: add stock to the destination store (creating the product if missing),
  // log an inbound movement, compute discrepancies, and finalize.
  const receiveTransfer = (
    id: string,
    received: { productId: string; receivedQty: number }[],
    user: string,
    comment = ''
  ): { ok: boolean; error?: string } => {
    const tr = transfers.find((x) => x.id === id)
    if (!tr || tr.status !== 'expedie') return { ok: false, error: 'status' }
    let curProducts = products
    let curLots = lots
    const newMovements: StockMovement[] = []
    tr.items.forEach((it) => {
      const rq = received.find((r) => r.productId === it.productId)?.receivedQty ?? 0
      if (rq <= 0) return
      // Match the destination product by barcode within the destination store, else create it.
      const existing = curProducts.find(
        (p) => p.storeId === tr.destStoreId && ((it.barcode && p.barcode === it.barcode) || p.name === it.name)
      )
      if (existing) {
        // Le lot naît à destination — `existing` porte encore le stock d'AVANT,
        // comme l'exige entreeLot pour tracer l'antériorité.
        curLots = entreeLot(curLots, existing, rq, { cost: it.cost, ref: `Transfert ${tr.ref}` })
        curProducts = curProducts.map((p) => (p.id === existing.id ? { ...p, stock: p.stock + rq } : p))
      } else {
        const cree: Product = {
          id: uid(),
          name: it.name,
          barcode: it.barcode,
          category: 'Divers',
          brand: '',
          unit: 'Pièce',
          price: it.cost,
          cost: it.cost,
          stock: rq,
          minStock: 0,
          reserved: 0,
          lot: it.lot,
          serial: it.serial,
          storeId: tr.destStoreId,
        }
        curProducts = [cree, ...curProducts]
        // Fiche neuve : son premier lot est le transfert lui-même (stock
        // antérieur nul, donc pas de lot d'ouverture à tracer).
        curLots = [{
          id: uid(), productId: cree.id, productName: cree.name, qty: rq, remaining: rq,
          cost: it.cost, date: new Date().toISOString(), ref: `Transfert ${tr.ref}`,
          storeId: tr.destStoreId, depotId: tr.destDepotId || undefined,
        }, ...curLots]
      }
      newMovements.push({
        id: uid() + it.productId,
        date: new Date().toISOString(),
        productId: it.productId,
        productName: it.name,
        type: 'transfert_in',
        qty: rq,
        note: `Transfert ${tr.ref} ← ${storeName(tr.sourceStoreId)}`,
        storeId: tr.destStoreId,
        depotId: tr.destDepotId || undefined,
        user,
      })
    })
    persistProducts(curProducts)
    persistMovements([...newMovements, ...movements])
    if (curLots !== lots) persistLots(curLots)

    const nextItems = tr.items.map((it) => ({
      ...it,
      receivedQty: received.find((r) => r.productId === it.productId)?.receivedQty ?? 0,
    }))
    const hasDiscrepancy = nextItems.some((i) => (i.receivedQty ?? 0) !== i.transferredQty)
    const history = [evt('termine', user, comment), evt('recu', user, comment), ...tr.history]
    persistTransfers(transfers.map((x) => (x.id === id ? { ...x, status: 'termine', items: nextItems, hasDiscrepancy, history } : x)))
    logActivity(`Transfert ${tr.ref} réceptionné${hasDiscrepancy ? ' (écart constaté)' : ''}`)
    return { ok: true }
  }

  /*
   * Vues limitées au magasin actif, servies à toutes les pages (les mutations,
   * elles, continuent d'opérer sur les tableaux complets). Chacune est
   * mémorisée séparément — voir useScopedList : le filtrage de collections de
   * plusieurs dizaines de milliers de lignes ne doit pas être rejoué à chaque
   * rendu, et les références doivent rester stables pour ne pas invalider les
   * calculs des pages.
   */
  const scopedProducts = useScopedList(products, activeStoreId)
  const scopedSales = useScopedList(sales, activeStoreId)
  const scopedMovements = useScopedList(movements, activeStoreId)
  const scopedLots = useScopedList(lots, activeStoreId)
  const scopedPurchases = useScopedList(purchases, activeStoreId)
  const scopedPurchaseRequests = useScopedList(purchaseRequests, activeStoreId)
  const scopedQuotes = useScopedList(quotes, activeStoreId)
  const scopedReturns = useScopedList(returns, activeStoreId)
  const scopedCash = useScopedList(cash, activeStoreId)
  const scopedSessions = useScopedList(sessions, activeStoreId)
  const scopedClientPayments = useScopedList(clientPayments, activeStoreId)
  const scopedCredits = useScopedList(credits, activeStoreId)
  const scopedLoyalty = useScopedList(loyaltyMovements, activeStoreId)
  const scopedSupplierPayments = useScopedList(supplierPayments, activeStoreId)
  const scopedExpenses = useScopedList(expenses, activeStoreId)
  const scopedInventories = useScopedList(inventories, activeStoreId)
  const scopedCreditNotes = useScopedList(creditNotes, activeStoreId)
  const scopedBudgets = useScopedList(budgets, activeStoreId)
  const scopedInvestments = useScopedList(investments, activeStoreId)
  const scopedRfqs = useScopedList(rfqs, activeStoreId)

  return {
    ready,
    bootPhase,
    // Store-scoped views (filtered to the active store).
    products: scopedProducts,
    sales: scopedSales,
    movements: scopedMovements,
    lots: scopedLots,
    purchases: scopedPurchases,
    purchaseRequests: scopedPurchaseRequests,
    quotes: scopedQuotes,
    returns: scopedReturns,
    cash: scopedCash,
    sessions: scopedSessions,
    clientPayments: scopedClientPayments,
    credits: scopedCredits,
    loyaltyMovements: scopedLoyalty,
    supplierPayments: scopedSupplierPayments,
    expenses: scopedExpenses,
    // Shared master data (not scoped per store).
    clients,
    suppliers,
    users,
    activity,
    logActivity,
    categories,
    subcategories,
    brands,
    units,
    settings,
    // Cross-store raw datasets for consolidated dashboards / stock par magasin.
    allProducts: products,
    allSales: sales,
    allMovements: movements,
    allLots: lots,
    allPurchases: purchases,
    addPurchaseRequest,
    updatePurchaseRequest,
    deletePurchaseRequest,
    submitPurchaseRequest,
    decidePurchaseRequest,
    convertPurchaseRequest,
    closePurchaseRequest,
    allCredits: credits,
    allCash: cash,
    allExpenses: expenses,
    revenues,
    moneyTransfers,
    allSessions: sessions,
    // Magasins.
    stores,
    depots,
    activeStoreId,
    activeStore,
    addStore,
    updateStore,
    deleteStore,
    switchStore,
    addDepot,
    updateDepot,
    deleteDepot,
    // Emplacements (WMS) — listes brutes (filtrées par storeId dans les pages) + actions.
    zones, allees, rayons, etageres, niveaux, positions, emplacements,
    addZone, updateZone, deleteZone, seedDefaultZones, bulkAddZones,
    addAllee, updateAllee, deleteAllee, seedZoneAllees, generateSubStructure, bulkAddLocations, commitStructureTree,
    bulkAssignLocations, clearProductLocations,
    addRayon, updateRayon, deleteRayon,
    addEtagere, updateEtagere, deleteEtagere,
    addNiveau, updateNiveau, deleteNiveau,
    addPosition, updatePosition, deletePosition,
    addEmplacement, updateEmplacement, deleteEmplacement,
    resolveLocation, locationSortKey,
    // Transferts (cross-store: not filtered — pages match source or dest).
    transfers,
    addTransfer,
    updateTransfer,
    deleteTransfer,
    validateTransfer,
    shipTransfer,
    receiveTransfer,
    currentSession,
    expectedCash,
    addProduct,
    updateProduct,
    moveProductLocation,
    deleteProduct,
    bulkDeleteProducts,
    mergeDuplicateProducts,
    applyLotConversions,
    importProducts,
    addMovement,
    initializeStock,
    activeStoreInitialized,
    adjustStock,
    restockProduct,
    applyInventory,
    // Inventaires (physique + tournant) — vues scopées magasin + workflow complet.
    inventories: scopedInventories,
    allInventories: inventories,
    // Finance (budgets scopés magasin ; exercices partagés).
    exercices,
    budgets: scopedBudgets,
    allBudgets: budgets,
    investments: scopedInvestments,
    allInvestments: investments,
    ensureExercice,
    updateExercice,
    addBudget,
    updateBudget,
    advanceBudget,
    deleteBudget,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    // Demandes de prix (consultation fournisseurs)
    rfqs: scopedRfqs,
    addRfq,
    updateRfq,
    setRfqOffer,
    removeRfqOffer,
    awardRfq,
    cancelRfq,
    deleteRfq,
    addInventory,
    updateInventory,
    submitInventory,
    reopenInventory,
    validateInventory,
    cancelInventory,
    recordSale,
    recordReturn,
    // Réparation des données (écran Paramètres › Réparation).
    annulerRetour,
    annulerVente,
    addClient,
    clientNameTaken,
    updateClient,
    deleteClient,
    mergeDuplicateClients,
    settleCredit,
    payCredit,
    addManualCredit,
    updateCredit,
    deleteCredit,
    redeemPoints,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    paySupplier,
    addPurchase,
    updatePurchase,
    deletePurchase,
    recordDeliveryNote,
    validateReception,
    payPurchase,
    returnPurchase,
    // Avoirs (clients et fournisseurs) — vue scopee magasin + workflow complet.
    creditNotes: scopedCreditNotes,
    allCreditNotes: creditNotes,
    createCreditNote,
    submitCreditNote,
    validateCreditNote,
    reopenCreditNote,
    cancelCreditNote,
    useCreditNote,
    addQuote,
    setQuoteStatus,
    updateQuote,
    convertQuote,
    deleteQuote,
    addCashEntry,
    openSession,
    closeSession,
    addUser,
    updateUser,
    deleteUser,
    resetAllCredentials,
    addExpense,
    markExpensePaid,
    deleteExpense,
    addRevenue,
    deleteRevenue,
    addMoneyTransfer,
    deleteMoneyTransfer,
    categoryActions: attrActions(categories, persistCategories),
    subcategoryActions: attrActions(subcategories, persistSubcategories),
    brandActions: attrActions(brands, persistBrands),
    unitActions: attrActions(units, persistUnits),
    reconcileAttributesFromProducts,
    saveSettings,
    resetStats,
  }
}

// Contexte partagé : l'état est calculé UNE fois par le DroguerieProvider et
// distribué à toutes les pages (au lieu d'un rechargement par page).
export type DroguerieValue = ReturnType<typeof useDroguerieState>
export const DroguerieContext = createContext<DroguerieValue | null>(null)

export function useDroguerie(): DroguerieValue {
  const ctx = useContext(DroguerieContext)
  if (!ctx) throw new Error('useDroguerie doit être utilisé dans <DroguerieProvider>')
  return ctx
}
