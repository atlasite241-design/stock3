'use client'

import JsBarcode from 'jsbarcode'
import type { BonPapier } from './store'

/**
 * Impression de l'étiquette d'un BON PAPIER.
 *
 * Même mécanisme éprouvé que les étiquettes clients / codes-barres produits :
 * une page à la taille EXACTE du format d'étiquette (réglages), @page margin 0,
 * dans un iframe caché → aucun en-tête/pied de navigateur sur une imprimante
 * d'étiquettes (Zebra & co.). Une imprimante A4 standard fonctionne aussi : le
 * navigateur place la petite étiquette en haut de la feuille.
 *
 * Contenu (cf. cahier des charges) :
 *
 *   CLIENT : CLIENT ABC
 *   N° CLIENT : CL-001245
 *   BON N° : B-2026-000587
 *   [ CODE-BARRES de B-2026-000587 ]
 */

// SVG (chaîne) d'un code-barres CODE128 — alphanumérique, adapté aux réfs « B-… ».
function barcodeSvg(value: string, height = 40): string {
  try {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    JsBarcode(el, value, { format: 'CODE128', height, width: 1.4, fontSize: 12, displayValue: true, margin: 0, background: '#ffffff', lineColor: '#000000' })
    return el.outerHTML
  } catch {
    return ''
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export interface BonLabelOptions {
  storeName?: string
  widthMm?: number
  heightMm?: number
  copies?: number
  /** Libellés traduits (fr/ar) fournis par l'appelant via t(). */
  labels?: { client?: string; clientNo?: string; bonNo?: string }
  /** Champs optionnels à imprimer (réglés dans Paramètres › Société). */
  show?: { date?: boolean; vendeur?: boolean; phone?: boolean }
  /** Téléphone du client, résolu par l'appelant (absent du bon). */
  clientPhone?: string
}

const d2 = (n: number) => String(n).padStart(2, '0')
function fmtDateTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d2(d.getDate())}/${d2(d.getMonth() + 1)}/${d.getFullYear()} ${d2(d.getHours())}:${d2(d.getMinutes())}`
}

export function printBonLabel(
  bon: Pick<BonPapier, 'ref' | 'clientName' | 'clientCode'> & Partial<Pick<BonPapier, 'date' | 'vendeurName'>>,
  opts: BonLabelOptions = {}
) {
  if (typeof window === 'undefined') return
  const w = Math.max(10, opts.widthMm ?? 40)
  const h = Math.max(10, opts.heightMm ?? 30)
  const bcH = Math.min(60, Math.round(h * 1.1))
  const copies = Math.max(1, opts.copies ?? 1)
  const L = { client: 'CLIENT', clientNo: 'N° CLIENT', bonNo: 'BON N°', ...opts.labels }
  const store = escapeHtml(opts.storeName || 'Droguerie Pro')
  const show = opts.show ?? {}

  const phoneRow = show.phone && opts.clientPhone ? `<div class="sub">${escapeHtml(opts.clientPhone)}</div>` : ''
  const vendeurRow = show.vendeur && bon.vendeurName ? `<div class="sub">${escapeHtml(bon.vendeurName)}</div>` : ''
  const dateRow = show.date && bon.date ? `<div class="sub">${escapeHtml(fmtDateTime(bon.date))}</div>` : ''

  const cell = `
    <div class="label">
      <div class="store">${store}</div>
      <div class="row"><span class="k">${escapeHtml(L.client!)}</span><span class="v">${escapeHtml(bon.clientName || '—')}</span></div>
      ${phoneRow}
      <div class="row"><span class="k">${escapeHtml(L.clientNo!)}</span><span class="v">${escapeHtml(bon.clientCode || '—')}</span></div>
      ${vendeurRow}
      ${dateRow}
      <div class="bon">${escapeHtml(L.bonNo!)} <b>${escapeHtml(bon.ref)}</b></div>
      <div class="bc">${barcodeSvg(bon.ref, bcH)}</div>
    </div>`
  const cells = Array.from({ length: copies }, () => cell).join('')

  const html = `<!doctype html><html><head><meta charset="utf-8"><title></title><style>
    @page { size: ${w}mm ${h}mm; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
    html, body { color: #000; background: #fff; }
    .label { width: ${w}mm; height: ${h}mm; display: flex; flex-direction: column;
             align-items: center; justify-content: center; gap: 0.4mm; padding: 1mm;
             text-align: center; overflow: hidden; page-break-after: always; }
    .label:last-child { page-break-after: auto; }
    .store { font-size: 5.5pt; font-weight: 700; text-transform: uppercase; line-height: 1; opacity: .8; }
    .row { display: flex; gap: 1mm; align-items: baseline; justify-content: center; width: 100%; }
    .k { font-size: 5pt; font-weight: 700; text-transform: uppercase; opacity: .65; }
    .v { font-size: 7pt; font-weight: 600; line-height: 1.05; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .sub { font-size: 5.5pt; line-height: 1.05; opacity: .8; }
    .bon { font-size: 6.5pt; margin-top: 0.3mm; }
    .bon b { font-size: 8pt; letter-spacing: .3px; }
    .bc { margin-top: 0.4mm; }
    svg { max-width: 100%; height: auto; }
  </style></head><body>${cells}</body></html>`

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) { document.body.removeChild(iframe); return }
  doc.open(); doc.write(html); doc.close()
  setTimeout(() => {
    try { iframe.contentWindow?.focus(); iframe.contentWindow?.print() } catch {}
    setTimeout(() => { try { document.body.removeChild(iframe) } catch {} }, 1000)
  }, 300)
}
