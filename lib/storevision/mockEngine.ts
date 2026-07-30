// Moteur de vision SIMULÉ.
//
// Il ne fait aucun appel réseau : il dérive une détection plausible et
// DÉTERMINISTE des métadonnées de chaque image (nom, taille, dimensions).
// Déterministe = la même photo produit toujours la même structure, ce qui rend
// l'assistant testable et évite qu'un simple re-rendu change les propositions.
//
// Il implémente exactement le contrat `VisionProvider`, donc le remplacer par un
// vrai modèle (Gemini/OpenAI Vision) ne demande aucune modification de l'UI.

import {
  type AnalyzeOptions, type DetectedFeature, type DetectedRack, type DetectedSector,
  type SourceImage, type VisionAnalysis, type VisionProvider,
} from './types'

/** Générateur pseudo-aléatoire déterministe (xorshift32) semé par une chaîne. */
function seededRandom(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  let s = h >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

/**
 * Secteurs candidats, alignés sur les zones par défaut d'AtlasStock (mêmes
 * codes/noms) : les propositions restent cohérentes avec le reste de l'app.
 */
const SECTOR_CATALOG: { code: string; name: string; type: 'commerciale' | 'logistique' }[] = [
  { code: 'B', name: 'Peinture & Droguerie', type: 'commerciale' },
  { code: 'E', name: 'Électricité', type: 'commerciale' },
  { code: 'F', name: 'Plomberie', type: 'commerciale' },
  { code: 'G', name: 'Quincaillerie', type: 'commerciale' },
  { code: 'J', name: 'Jardinage', type: 'commerciale' },
  { code: 'H', name: 'Sanitaire', type: 'commerciale' },
  { code: 'C', name: 'Outillage manuel', type: 'commerciale' },
  { code: 'D', name: 'Outillage électrique', type: 'commerciale' },
  { code: 'I', name: 'Colles & Chimie', type: 'commerciale' },
  { code: 'M', name: 'Construction', type: 'commerciale' },
]
const STORAGE_SECTOR = { code: 'P', name: 'Réserve / Stockage', type: 'logistique' as const }

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class MockVisionEngine implements VisionProvider {
  readonly id = 'mock-cv-v1'
  readonly label = 'Analyse locale simulée'
  readonly simulated = true

  async analyze(images: SourceImage[], opts?: AnalyzeOptions): Promise<VisionAnalysis> {
    const t0 = Date.now()
    const warnings: string[] = []
    const features: DetectedFeature[] = []
    const racks: DetectedRack[] = []
    const sectors: DetectedSector[] = []

    // Étapes annoncées à l'UI (mêmes intitulés que le futur moteur réel).
    const stages = ['sv_stage_prepare', 'sv_stage_walls', 'sv_stage_fixtures', 'sv_stage_racks', 'sv_stage_sectors']

    if (images.length === 0) {
      return { images, features, racks, sectors, engine: this.meta(), elapsedMs: 0, warnings: ['sv_warn_no_image'] }
    }

    let sectorCursor = 0
    for (let ii = 0; ii < images.length; ii++) {
      const img = images[ii]
      if (img.previewUnavailable) warnings.push('sv_warn_pdf_estimated')

      const rnd = seededRandom(`${img.name}|${img.bytes}|${img.width}x${img.height}`)
      const isPlan = img.kind === 'plan'
      const uid = (k: string, n: number) => `${k}${ii}_${n}`

      // --- Étape 1/5 : préparation ---
      opts?.onProgress?.((ii + 0.1) / images.length, stages[0])
      await sleep(120)
      if (opts?.signal?.aborted) throw new Error('aborted')

      // --- Étape 2/5 : murs et ouvertures ---
      opts?.onProgress?.((ii + 0.25) / images.length, stages[1])
      await sleep(160)
      const wallT = 0.018
      features.push(
        { id: uid('w', 1), kind: 'wall', box: { x: 0, y: 0, w: 1, h: wallT }, confidence: 0.97, imageIndex: ii },
        { id: uid('w', 2), kind: 'wall', box: { x: 0, y: 1 - wallT, w: 1, h: wallT }, confidence: 0.96, imageIndex: ii },
        { id: uid('w', 3), kind: 'wall', box: { x: 0, y: 0, w: wallT, h: 1 }, confidence: 0.95, imageIndex: ii },
        { id: uid('w', 4), kind: 'wall', box: { x: 1 - wallT, y: 0, w: wallT, h: 1 }, confidence: 0.95, imageIndex: ii },
      )
      // L'entrée est cherchée en bas (façade) ; la sortie de secours à l'opposé.
      const entX = 0.12 + rnd() * 0.3
      features.push({ id: uid('en', 1), kind: 'entrance', box: { x: entX, y: 1 - wallT - 0.02, w: 0.14, h: 0.045 }, confidence: 0.9, imageIndex: ii })
      if (isPlan || rnd() > 0.35)
        features.push({ id: uid('ex', 1), kind: 'exit', box: { x: 0.74 + rnd() * 0.14, y: 0, w: 0.1, h: 0.04 }, confidence: 0.82, imageIndex: ii })

      // --- Étape 3/5 : caisses, circulation, palettes ---
      opts?.onProgress?.((ii + 0.45) / images.length, stages[2])
      await sleep(180)
      const nCheckout = 1 + Math.floor(rnd() * 3)
      for (let c = 0; c < nCheckout; c++)
        features.push({ id: uid('ck', c), kind: 'checkout', box: { x: entX + 0.17 + c * 0.11, y: 0.82, w: 0.085, h: 0.09 }, confidence: 0.88, imageIndex: ii })
      features.push({ id: uid('ci', 1), kind: 'circulation', box: { x: 0.04, y: 0.74, w: 0.92, h: 0.08 }, confidence: 0.8, imageIndex: ii })
      features.push({ id: uid('di', 1), kind: 'display', box: { x: 0.06, y: 0.62, w: 0.24, h: 0.1 }, confidence: 0.74, imageIndex: ii })

      // --- Étape 4/5 : rayonnages, allées, réserve ---
      opts?.onProgress?.((ii + 0.7) / images.length, stages[3])
      await sleep(220)

      // Un plan montre plus de rangées qu'une photo prise depuis une allée.
      const aisleCount = isPlan ? 3 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 2)
      const racksPerAisle = isPlan ? 3 + Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 3)
      const bandTop = 0.08, bandH = 0.6
      const aisleH = bandH / aisleCount

      for (let a = 0; a < aisleCount; a++) {
        const y = bandTop + a * aisleH
        features.push({ id: uid(`ai${a}_`, 1), kind: 'aisle', box: { x: 0.05, y: y + aisleH * 0.72, w: 0.9, h: aisleH * 0.24 }, confidence: 0.85, imageIndex: ii })

        // Le secteur change à chaque rangée : chaque allée appartient à un rayon d'activité.
        const cat = SECTOR_CATALOG[sectorCursor % SECTOR_CATALOG.length]
        sectorCursor++
        const sectorId = `s${ii}_${a}`
        const rackIds: string[] = []

        const usable = 0.9
        const rackW = (usable / racksPerAisle) * 0.88
        for (let r = 0; r < racksPerAisle; r++) {
          const rid = `${sectorId}_r${r}`
          rackIds.push(rid)
          const heavy = isPlan && rnd() > 0.86
          // Dimensions estimées. Un « rayonnage » détecté est une TRAVÉE
          // COMPLÈTE (une enfilade de 2,4 à 4,4 m), pas un module isolé : c'est
          // ce qui donne plusieurs étagères par rayon dans la hiérarchie.
          // Hauteurs usuelles : 1,9–2,4 m en vente, 3,6–6 m pour un palettier.
          const widthM = heavy ? 3.6 + rnd() * 2.4 : 2.4 + rnd() * 2.0
          const heightM = heavy ? 3.6 + rnd() * 2.4 : 1.9 + rnd() * 0.5
          const visibleShelves = Math.max(2, Math.round(heightM / (heavy ? 0.95 : 0.42)))
          racks.push({
            id: rid,
            kind: heavy ? 'heavyRack' : 'rack',
            box: { x: 0.05 + (usable / racksPerAisle) * r + rackW * 0.06, y: y + aisleH * 0.08, w: rackW, h: aisleH * 0.58 },
            confidence: 0.78 + rnd() * 0.18,
            imageIndex: ii,
            widthM: Math.round(widthM * 100) / 100,
            heightM: Math.round(heightM * 100) / 100,
            visibleShelves,
            sectorId,
            label: heavy ? 'palettier' : 'rayonnage métallique',
          })
        }

        sectors.push({
          id: sectorId,
          suggestedCode: cat.code,
          suggestedName: cat.name,
          type: cat.type,
          rackIds,
          confidence: 0.7 + rnd() * 0.25,
        })
      }

      // Réserve + palettes, surtout visibles sur un plan.
      if (isPlan || rnd() > 0.5) {
        const sid = `s${ii}_stock`
        features.push({ id: uid('st', 1), kind: 'storage', box: { x: 0.62, y: bandTop, w: 0.33, h: 0.22 }, confidence: 0.76, imageIndex: ii })
        const nPal = 2 + Math.floor(rnd() * 4)
        const palIds: string[] = []
        for (let p = 0; p < nPal; p++) {
          features.push({ id: uid('pl', p), kind: 'pallet', box: { x: 0.64 + (p % 3) * 0.1, y: bandTop + 0.02 + Math.floor(p / 3) * 0.09, w: 0.085, h: 0.075 }, confidence: 0.7, imageIndex: ii })
          const rid = `${sid}_r${p}`
          palIds.push(rid)
          racks.push({
            id: rid, kind: 'heavyRack',
            box: { x: 0.64 + (p % 3) * 0.1, y: bandTop + 0.02 + Math.floor(p / 3) * 0.09, w: 0.085, h: 0.075 },
            confidence: 0.72, imageIndex: ii,
            widthM: 2.7, heightM: 3.6, visibleShelves: 4, sectorId: sid, label: 'rack palette',
          })
        }
        sectors.push({ id: sid, suggestedCode: STORAGE_SECTOR.code, suggestedName: STORAGE_SECTOR.name, type: STORAGE_SECTOR.type, rackIds: palIds, confidence: 0.74 })
      }

      // --- Étape 5/5 : regroupement en secteurs ---
      opts?.onProgress?.((ii + 1) / images.length, stages[4])
      await sleep(140)
    }

    if (racks.length === 0) warnings.push('sv_warn_no_rack')

    return {
      images, features, racks, sectors,
      engine: this.meta(),
      elapsedMs: Date.now() - t0,
      warnings: [...new Set(warnings)],
    }
  }

  private meta() {
    return { id: this.id, label: this.label, simulated: this.simulated }
  }
}
