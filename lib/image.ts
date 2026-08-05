'use client'

/**
 * Makes near-white pixels of an image transparent (client-side, via canvas).
 * Useful to turn product photos shot on a white studio background into
 * cut-outs that sit cleanly on a dark POS card.
 *
 * @param dataUrl   source image (data URL)
 * @param threshold luminance cutoff (0-255); pixels with r,g,b all above it become transparent
 */
export function removeWhiteBackground(dataUrl: string, threshold = 236): Promise<string> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(dataUrl)
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(dataUrl)
        ctx.drawImage(img, 0, 0)
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const d = imgData.data
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i]
          const g = d[i + 1]
          const b = d[i + 2]
          if (r >= threshold && g >= threshold && b >= threshold) {
            d[i + 3] = 0
          } else if (r >= threshold - 18 && g >= threshold - 18 && b >= threshold - 18) {
            // feather near-white edges to avoid a hard halo
            d[i + 3] = Math.round(d[i + 3] * 0.4)
          }
        }
        ctx.putImageData(imgData, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

/**
 * Compression des images avant stockage.
 *
 * Les logos, signatures et photos d'articles étaient enregistrés tels quels, en
 * base64, par un simple `FileReader.readAsDataURL`. Une photo de téléphone de
 * 4 Mo devient ainsi une chaîne de 5,4 Mo — à comparer au plafond de ~5 Mo de
 * localStorage pour TOUTE l'origine. Un seul logo suffisait donc à saturer le
 * stockage du navigateur, et plus rien ne pouvait être écrit : ni les réglages,
 * ni les ventes en attente, ni le catalogue rapatrié depuis Turso.
 *
 * Aucun de ces usages n'a besoin de la pleine résolution : un logo s'imprime sur
 * un ticket de 58 mm et s'affiche dans une vignette de 80 px. On redimensionne
 * donc à la source, une fois pour toutes.
 */

/** Côté le plus long, en pixels, après réduction. Large pour une facture A4. */
export const MAX_PX = 640

/** Charge une image (fichier ou data URL) en bitmap dessinable. */
function charger(src: Blob | string): Promise<HTMLImageElement> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src)
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    const fin = () => { if (typeof src !== 'string') URL.revokeObjectURL(url) }
    img.onload = () => { fin(); resolve(img) }
    img.onerror = () => { fin(); reject(new Error('image illisible')) }
    img.src = url
  })
}

/** L'image contient-elle des pixels transparents ? Détermine le format de sortie. */
function aDeLaTransparence(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const d = ctx.getImageData(0, 0, w, h).data
    for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true
  } catch {
    // Canvas « teinté » : on suppose la transparence, le PNG ne dégradera rien.
    return true
  }
  return false
}

function lireBrut(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('lecture impossible'))
    r.readAsDataURL(b)
  })
}

/**
 * Réduit une image et la renvoie en data URL.
 *
 * Renvoie la source inchangée si la compression ne gagne rien (icône déjà
 * optimisée) ou si le navigateur ne sait pas la décoder — mieux vaut une image
 * lourde qu'une image perdue.
 */
export async function compresserImage(src: Blob | string, maxPx = MAX_PX, qualite = 0.82): Promise<string> {
  const original = typeof src === 'string' ? src : null

  // Le SVG est vectoriel et déjà minuscule : le rasteriser le dégraderait.
  if (original?.startsWith('data:image/svg')) return original
  if (typeof src !== 'string' && src.type === 'image/svg+xml') return lireBrut(src)

  const source = original ?? (await lireBrut(src as Blob))

  let img: HTMLImageElement
  try {
    img = await charger(src)
  } catch {
    return source
  }

  const facteur = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * facteur))
  const h = Math.max(1, Math.round(img.naturalHeight * facteur))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return source
  ctx.drawImage(img, 0, 0, w, h)

  const alpha = aDeLaTransparence(ctx, w, h)

  // WebP conserve la transparence ET compresse comme du JPEG. Un navigateur qui
  // ne le connaît pas renvoie silencieusement du PNG : on le détecte, et on
  // retombe alors sur le format adapté au contenu.
  let out = canvas.toDataURL('image/webp', qualite)
  if (!out.startsWith('data:image/webp')) {
    out = alpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', qualite)
  }

  return out.length < source.length ? out : source
}

/**
 * Recompresse une data URL DÉJÀ stockée, si elle dépasse le seuil.
 *
 * Sert à réparer l'existant : les images enregistrées avant cette correction
 * occupent le quota et empêchent toute écriture — y compris celle qui les
 * remplacerait. Chaîne vide et petites images sont renvoyées telles quelles.
 */
export async function recompresserSiLourde(dataUrl: string, seuilKo = 120, maxPx = MAX_PX): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return dataUrl
  if (dataUrl.length <= seuilKo * 1024) return dataUrl
  try {
    return await compresserImage(dataUrl, maxPx)
  } catch {
    return dataUrl
  }
}
