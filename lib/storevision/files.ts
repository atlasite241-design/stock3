'use client'

// Lecture des fichiers importés → `SourceImage`.
//
// Les photos sont RÉDUITES avant d'être conservées en mémoire : une photo de
// téléphone (12 Mpx) pèse ~30 Mo en data URL, et l'assistant peut en recevoir
// plusieurs. On plafonne donc le grand côté et on réencode en JPEG.

import type { SourceImage } from './types'

const MAX_SIDE = 1600
const JPEG_QUALITY = 0.82

const uid = () => `img_${Math.random().toString(36).slice(2, 9)}`

/** Un plan est reconnu par son type PDF ou par un indice dans le nom. */
function kindOf(file: File): 'photo' | 'plan' {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'plan'
  return /plan|layout|schema|schéma|blueprint|masse/i.test(file.name) ? 'plan' : 'photo'
}

/** Charge un fichier image et le réduit ; renvoie null si illisible. */
async function readImage(file: File): Promise<SourceImage | null> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode'))
      el.src = url
    })
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)
    return {
      id: uid(),
      name: file.name,
      dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY),
      width: w,
      height: h,
      bytes: file.size,
      kind: kindOf(file),
    }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Un PDF n'est pas rasterisé (cela demanderait pdf.js, une dépendance lourde) :
 * il est accepté comme plan, analysé sur ses métadonnées, mais sans aperçu.
 * Le jour où pdf.js est ajouté, seule cette fonction change.
 */
function readPdf(file: File): SourceImage {
  return {
    id: uid(),
    name: file.name,
    width: 1191, // A3 paysage @150 dpi — hypothèse raisonnable pour un plan
    height: 842,
    bytes: file.size,
    kind: 'plan',
    previewUnavailable: true,
  }
}

export const ACCEPTED = '.png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf'

/** Convertit une sélection de fichiers en images source exploitables. */
export async function loadSourceImages(files: FileList | File[]): Promise<{ images: SourceImage[]; rejected: string[] }> {
  const images: SourceImage[] = []
  const rejected: string[] = []
  for (const file of Array.from(files)) {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    if (isPdf) { images.push(readPdf(file)); continue }
    if (!/^image\//.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) { rejected.push(file.name); continue }
    const img = await readImage(file)
    if (img) images.push(img)
    else rejected.push(file.name)
  }
  return { images, rejected }
}
