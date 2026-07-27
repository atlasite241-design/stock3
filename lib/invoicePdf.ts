import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

/**
 * Imprime une facture en PDF en capturant fidèlement l'aperçu écran
 * (le rendu HTML déjà mis en forme), puis en l'insérant dans un PDF A4.
 *
 * Avantage : mise en page IDENTIQUE à l'aperçu (en-tête ambré, logo, cachet…)
 * et, comme on imprime un PDF, AUCUN en-tête/pied de page du navigateur.
 */
async function renderPdf(node: HTMLElement): Promise<jsPDF> {
  const canvas = await html2canvas(node, {
    scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  })
  const img = canvas.toDataURL('image/jpeg', 0.95)

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const PW = 210, PH = 297
  const M = 8 // marge autour de la facture
  const availW = PW - M * 2
  const imgH = (canvas.height * availW) / canvas.width

  if (imgH <= PH - M * 2) {
    // Tient sur une page.
    pdf.addImage(img, 'JPEG', M, M, availW, imgH, undefined, 'FAST')
  } else {
    // Trop haut : découpe sur plusieurs pages.
    let heightLeft = imgH
    let position = M
    pdf.addImage(img, 'JPEG', M, position, availW, imgH, undefined, 'FAST')
    heightLeft -= PH - M
    while (heightLeft > 0) {
      pdf.addPage()
      position = M - (imgH - heightLeft)
      pdf.addImage(img, 'JPEG', M, position, availW, imgH, undefined, 'FAST')
      heightLeft -= PH
    }
  }
  return pdf
}

/** Génère puis imprime la facture (PDF isolé → aucun en-tête/pied du navigateur). */
export async function printInvoicePdf(node: HTMLElement | null) {
  if (!node) return
  const pdf = await renderPdf(node)
  const blobUrl = pdf.output('bloburl') as unknown as string
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  iframe.src = blobUrl
  document.body.appendChild(iframe)
  iframe.onload = () => {
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print() }
      catch { window.open(blobUrl, '_blank') }
      setTimeout(() => iframe.remove(), 60000)
    }, 250)
  }
}

/** Télécharge la facture en PDF. */
export async function downloadInvoicePdf(node: HTMLElement | null, fileName = 'facture.pdf') {
  if (!node) return
  const pdf = await renderPdf(node)
  pdf.save(fileName)
}
