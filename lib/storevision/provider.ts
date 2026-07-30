// Sélection du moteur de vision.
//
// L'application ne connaît QUE l'interface `VisionProvider`. Aujourd'hui c'est
// le moteur simulé qui répond ; pour brancher un vrai modèle, il suffit de :
//
//   1. créer la route serveur `app/api/vision/analyze/route.ts` qui appelle
//      Gemini Vision / OpenAI Vision avec une clé gardée CÔTÉ SERVEUR
//      (jamais dans le navigateur) et renvoie un `VisionAnalysis` ;
//   2. définir `NEXT_PUBLIC_VISION_PROVIDER=remote` dans l'environnement.
//
// Aucun autre fichier n'a besoin d'être modifié : l'assistant, l'éditeur,
// l'aperçu 3D et le commit consomment le même contrat.

import { MockVisionEngine } from './mockEngine'
import type { AnalyzeOptions, SourceImage, VisionAnalysis, VisionProvider } from './types'

/** Format attendu de la réponse serveur (identique au type d'analyse). */
export class RemoteVisionProvider implements VisionProvider {
  readonly id = 'remote-vision'
  readonly label = 'Vision par ordinateur (serveur)'
  readonly simulated = false

  constructor(private endpoint = '/api/vision/analyze') {}

  async analyze(images: SourceImage[], opts?: AnalyzeOptions): Promise<VisionAnalysis> {
    opts?.onProgress?.(0.05, 'sv_stage_upload')
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // On n'envoie que ce dont le modèle a besoin ; les data URL sont lourdes,
      // le serveur peut aussi recevoir des URL signées à la place.
      body: JSON.stringify({ images }),
      signal: opts?.signal,
    })
    opts?.onProgress?.(0.75, 'sv_stage_sectors')
    if (!res.ok) throw new Error(`vision: HTTP ${res.status}`)
    const data = (await res.json()) as VisionAnalysis
    opts?.onProgress?.(1, 'sv_stage_sectors')
    return data
  }
}

let cached: VisionProvider | null = null

/** Moteur actif (mémoïsé). Bascule via NEXT_PUBLIC_VISION_PROVIDER=remote. */
export function getVisionProvider(): VisionProvider {
  if (cached) return cached
  const want = (process.env.NEXT_PUBLIC_VISION_PROVIDER ?? 'mock').toLowerCase()
  cached = want === 'remote' ? new RemoteVisionProvider() : new MockVisionEngine()
  return cached
}

/** Permet aux tests d'injecter un moteur. */
export function setVisionProvider(p: VisionProvider | null): void {
  cached = p
}
