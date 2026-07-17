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
