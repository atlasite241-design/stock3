import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { montantEnLettres } from '@/components/InvoiceDocument'
import { fmtDH, type Settings, type Store } from '@/lib/store'
import { type TKey } from '@/lib/i18n'

export interface PdfLine {
  label: string
  qty: number
  unit?: string
  puHT: number
  tvaPct: number
}

export interface InvoicePdfOptions {
  title: string
  number?: string
  docNumber?: string
  date: string
  partyLabel: string
  partyName: string
  partyAddress?: string
  lines: PdfLine[]
  paid?: number
  showBalance?: boolean
  settings: Settings
  store?: Store | null
  t: (k: TKey) => string
  fileName?: string
}

// Couleurs (RGB) alignées sur le rendu écran.
const AMBER: [number, number, number] = [251, 191, 36]
const INK: [number, number, number] = [17, 24, 39]
const GRAY6: [number, number, number] = [75, 85, 99]
const GRAY4: [number, number, number] = [156, 163, 175]
const LINE: [number, number, number] = [229, 231, 235]

function imgFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return /^data:image\/jpe?g/i.test(dataUrl) ? 'JPEG' : 'PNG'
}

/** Construit le PDF vectoriel de la facture (identique à l'aperçu écran). */
export function generateInvoicePdf(o: InvoicePdfOptions): jsPDF {
  const { t } = o
  // Fusion des coordonnées du magasin actif (comme InvoiceDocument).
  const s: Settings = o.store
    ? {
        ...o.settings,
        storeName: o.store.name || o.settings.storeName,
        address: o.store.address || o.settings.address,
        phone: o.store.phone || o.settings.phone,
        email: o.store.email || o.settings.email,
        logoDataUrl: o.store.logoDataUrl || o.settings.logoDataUrl,
        ice: o.store.ice || o.settings.ice,
        idFiscal: o.store.idFiscal || o.settings.idFiscal,
      }
    : o.settings

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const PW = 210
  const L = 12
  const R = PW - 12 // 198
  const totalHT = o.lines.reduce((a, l) => a + l.puHT * l.qty, 0)
  const totalTVA = o.lines.reduce((a, l) => a + l.puHT * l.qty * (l.tvaPct / 100), 0)
  const totalTTC = totalHT + totalTVA
  const city = (s.address || '').split(',')[0].trim()
  const dateStr = new Date(o.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  // ---- En-tête : logo (gauche) + encadré société (droite) ----
  let y = 14
  if (s.logoDataUrl) {
    try { doc.addImage(s.logoDataUrl, imgFormat(s.logoDataUrl), L, y, 15, 15) } catch {}
  } else {
    doc.setFillColor(17, 24, 39); doc.roundedRect(L, y, 15, 15, 1.5, 1.5, 'F')
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(13)
    doc.text((s.storeName || 'DP').slice(0, 2).toUpperCase(), L + 7.5, y + 10, { align: 'center' })
  }

  // Encadré société (droite), texte aligné à droite.
  const boxLines: { txt: string; bold?: boolean }[] = [{ txt: s.storeName || '', bold: true }]
  if (o.partyAddress === undefined && s.address) boxLines.push({ txt: s.address })
  if (s.email) boxLines.push({ txt: s.email })
  if (s.phone) boxLines.push({ txt: s.phone })
  const boxW = 62, boxX = R - boxW, boxPadX = 3
  let by = y + 4
  doc.setDrawColor(AMBER[0], AMBER[1], AMBER[2]); doc.setLineWidth(0.5)
  const boxTop = y
  boxLines.forEach((bl, i) => {
    doc.setFont('helvetica', bl.bold ? 'bold' : 'normal')
    doc.setFontSize(bl.bold ? 9.5 : 8)
    doc.setTextColor(bl.bold ? INK[0] : GRAY6[0], bl.bold ? INK[1] : GRAY6[1], bl.bold ? INK[2] : GRAY6[2])
    if (bl.bold) doc.text(bl.txt.toUpperCase(), R - boxPadX, by + i * 4.2, { align: 'right' })
    else doc.text(bl.txt, R - boxPadX, by + i * 4.2, { align: 'right' })
  })
  const boxH = boxLines.length * 4.2 + 3
  doc.roundedRect(boxX, boxTop, boxW, boxH, 1, 1, 'S')

  // ---- Titre + date ----
  y = 40
  doc.setTextColor(INK[0], INK[1], INK[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(24)
  doc.text(o.title, L, y)
  const titleW = doc.getTextWidth(o.title)
  if (o.docNumber) {
    doc.setFontSize(15); doc.setTextColor(GRAY6[0], GRAY6[1], GRAY6[2])
    doc.text(' ' + o.docNumber, L + titleW, y)
  }
  if (o.number) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(GRAY6[0], GRAY6[1], GRAY6[2])
    doc.text(`${t('fdoc_number')} ${o.number}`, L, y + 5)
  }
  // Date (droite, italique)
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(GRAY6[0], GRAY6[1], GRAY6[2])
  doc.text(`${city ? city + ' ' : ''}${t('fdoc_at_le')} ${dateStr}`, R, y - 2, { align: 'right' })
  doc.text(t('fdoc_page'), R, y + 2, { align: 'right' })

  // ---- Bloc tiers (client/fournisseur) ----
  y += 12
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(GRAY4[0], GRAY4[1], GRAY4[2])
  doc.text(o.partyLabel.toUpperCase(), L, y)
  doc.setFontSize(10); doc.setTextColor(INK[0], INK[1], INK[2])
  doc.text(o.partyName || '', L, y + 5)
  if (o.partyAddress) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(GRAY6[0], GRAY6[1], GRAY6[2])
    doc.text(o.partyAddress, L, y + 9.5)
  }

  // ---- Tableau ----
  const emptyRows = Math.max(0, 6 - o.lines.length)
  const body: string[][] = [
    ...o.lines.map((l) => [l.label, String(l.qty), l.unit || '-', fmtDH(l.puHT), `${l.tvaPct.toFixed(2)} %`, fmtDH(l.puHT * l.qty)]),
    ...Array.from({ length: emptyRows }, () => ['', '', '', '', '', '']),
  ]
  autoTable(doc, {
    startY: y + 14,
    margin: { left: L, right: 12 },
    head: [[t('fdoc_col_products'), t('fdoc_col_qty'), t('fdoc_col_unit'), t('fdoc_col_pu_ht'), t('fdoc_col_tva'), t('fdoc_col_total_ht')]],
    body,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.6, lineColor: LINE, lineWidth: 0.2, textColor: INK, minCellHeight: 6 },
    headStyles: { fillColor: AMBER, textColor: [255, 255, 255], fontStyle: 'bolditalic', lineColor: [245, 158, 11], halign: 'left' },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 16 },
      2: { halign: 'center', cellWidth: 18, textColor: GRAY6 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'center', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
    },
  })

  // ---- Totaux ----
  const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
  const fy: number = (lastTable?.finalY ?? y + 40) + 6
  // Montant en lettres (gauche)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(GRAY6[0], GRAY6[1], GRAY6[2])
  doc.text(t('fdoc_amount_words'), L, fy)
  doc.setTextColor(INK[0], INK[1], INK[2])
  const words = doc.splitTextToSize(montantEnLettres(totalTTC) + '.', 92)
  doc.text(words, L, fy + 4.5)

  // Bloc totaux (droite)
  const tx = R - 64, tv = R
  const rowY = (i: number) => fy + i * 5
  const put = (label: string, val: string, i: number, bold = false, big = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(big ? 11 : 8.5)
    doc.setTextColor(bold ? INK[0] : GRAY6[0], bold ? INK[1] : GRAY6[1], bold ? INK[2] : GRAY6[2])
    doc.text(label, tx, rowY(i)); doc.text(val, tv, rowY(i), { align: 'right' })
  }
  put(t('fdoc_total_ht'), fmtDH(totalHT), 0)
  put(t('fdoc_total_tva'), fmtDH(totalTVA), 1)
  doc.setDrawColor(209, 213, 219); doc.setLineWidth(0.3); doc.line(tx, rowY(1) + 1.6, tv, rowY(1) + 1.6)
  put(t('fdoc_total_ttc'), fmtDH(totalTTC), 2, true, true)
  let idx = 3
  if (o.paid !== undefined) { put(t('fdoc_paid'), fmtDH(o.paid), idx++); }
  if (o.showBalance && o.paid !== undefined) { put(t('fdoc_remaining'), fmtDH(Math.max(0, totalTTC - o.paid)), idx++, true); }

  // ---- Signature (droite) ----
  const sigY = Math.max(fy + 24, 235)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(GRAY6[0], GRAY6[1], GRAY6[2])
  doc.text(t('fdoc_signature'), R - 20, sigY, { align: 'center' })
  if (s.signatureDataUrl) {
    try { doc.addImage(s.signatureDataUrl, imgFormat(s.signatureDataUrl), R - 40, sigY + 1.5, 40, 16) } catch {}
  } else {
    doc.setDrawColor(209, 213, 219); doc.line(R - 40, sigY + 14, R, sigY + 14)
  }

  // ---- Pied de page ----
  const legal = [
    s.phone && `TÉL : ${s.phone}`,
    s.email && `EMAIL : ${s.email}`,
    s.taxePro && `PATENTE : ${s.taxePro}`,
    s.rcNo && `RC : ${s.rcNo}`,
    s.idFiscal && `IF : ${s.idFiscal}`,
    s.ice && `ICE : ${s.ice}`,
    s.cnss && `CNSS : ${s.cnss}`,
  ].filter(Boolean) as string[]
  let footY = 283
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.setLineWidth(0.2); doc.line(L, footY - 4, R, footY - 4)
  if (legal.length) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(GRAY6[0], GRAY6[1], GRAY6[2])
    doc.text(legal.join('   |   '), PW / 2, footY, { align: 'center' })
  }
  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(8.5); doc.setTextColor(GRAY6[0], GRAY6[1], GRAY6[2])
  doc.text(t('fdoc_thanks'), PW / 2, footY + 4.5, { align: 'center' })

  return doc
}

/** Génère puis imprime la facture (PDF isolé → aucun en-tête/pied du navigateur). */
export function printInvoicePdf(o: InvoicePdfOptions) {
  const doc = generateInvoicePdf(o)
  const blobUrl = doc.output('bloburl') as unknown as string
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
export function downloadInvoicePdf(o: InvoicePdfOptions) {
  generateInvoicePdf(o).save(o.fileName || 'facture.pdf')
}
