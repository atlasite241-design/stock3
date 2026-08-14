'use client'

import React, { useEffect, useRef, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import JsBarcode from 'jsbarcode'
import { CreditCard, Eye, FileText, Gavel, Globe, Info, Mail, PackageCheck, Phone, Printer, Receipt, Save, ScrollText, Send, Store, Tag, Truck, UploadCloud } from 'lucide-react'
import AppShell from '@/components/AppShell'
import InvoiceDocument from '@/components/InvoiceDocument'
import Barcode128 from '@/components/Barcode128'
import EAN13 from '@/components/EAN13'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { compresserImage } from '@/lib/image'
import { fmtDH, useDroguerie, type Settings } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, settings, saveSettings, products, sales, clients, suppliers } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [form, setForm] = useState(settings)
  const [previewTab, setPreviewTab] = useState<'facture' | 'devis' | 'bc' | 'br' | 'bl' | 'etiquette' | 'etiquette_client' | 'ticket'>('facture')
  const logoInputRef = useRef<HTMLInputElement>(null)
  const signatureInputRef = useRef<HTMLInputElement>(null)

  // Produit d'exemple pour prévisualiser l'étiquette Zebra.
  const sampleLabel = { name: 'Peinture blanche 5L', price: 185, barcode: '6111234500017' }
  // Client d'exemple : le code « CLT-… » est alphanumérique, donc CODE128 et
  // non EAN-13. Ces étiquettes se génèrent en série depuis Caisse › Vente rapide.
  const sampleClient = { name: 'Billa', code: 'CLT-00001' }
  const labelW = Math.max(10, form.labelWidthMm ?? 40)
  const labelH = Math.max(10, form.labelHeightMm ?? 30)

  // Vente d'exemple pour prévisualiser le ticket de caisse.
  const ticketItems = [
    { name: 'Peinture blanche 5L', qty: 2, price: 185 },
    { name: 'Diluant 1L', qty: 1, price: 35 },
  ]
  const ticketTotal = ticketItems.reduce((a, i) => a + i.price * i.qty, 0)
  const ticketHT = ticketTotal / (1 + (form.tva || 0) / 100)
  const ticketTVA = ticketTotal - ticketHT
  const ticketWidth = form.printFormat === 'ticket80' ? 300 : 230

  useEffect(() => {
    if (ready) setForm(settings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  if (!ready) {
    return <Loader />
  }

  const save = () => {
    saveSettings({
      ...form,
      storeName: form.storeName.trim() || 'Droguerie Pro',
      currency: form.currency.trim() || 'MAD (DH)',
      tva: Math.max(0, Number(form.tva) || 0),
    })
    toast(`✓ ${t('set_toast_saved')}`)
  }

  const cancel = () => setForm(settings)

  const onLogoChange = async (e: React.ChangeEvent<HTMLInputElement>, key: 'logoDataUrl' | 'logoLightDataUrl' | 'signatureDataUrl') => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    // Réduction AVANT stockage. Une photo de téléphone non réduite pèse plus que
    // le quota entier de localStorage : elle saturait le navigateur et bloquait
    // toute autre écriture — réglages, ventes en attente, catalogue.
    const data = await compresserImage(file)
    const next = { ...form, [key]: data }
    setForm(next)
    // Persistance immédiate : une image est lourde, on ne veut pas la perdre
    // si l'utilisateur rafraîchit sans cliquer « Enregistrer ».
    try {
      saveSettings({
        ...next,
        storeName: next.storeName.trim() || 'Droguerie Pro',
        currency: next.currency.trim() || 'MAD (DH)',
        tva: Math.max(0, Number(next.tva) || 0),
      })
      toast(`✓ ${t('soc_logo_saved')}`)
    } catch {
      toast(t('soc_logo_too_large'), 'error')
    }
  }

  /*
   * Code-barres CODE128 en balisage brut. Le composant Barcode128 dessine dans
   * un effet React : rendu hors du navigateur (impression), il ne produirait
   * qu'un <svg> vide. On appelle donc JsBarcode sur un élément détaché.
   */
  const code128Markup = (value: string, height: number): string => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    try {
      JsBarcode(svg, value, {
        format: 'CODE128', height, width: 1.4, fontSize: 11,
        displayValue: true, margin: 0, background: '#ffffff', lineColor: '#000000',
      })
    } catch {
      return ''
    }
    return svg.outerHTML
  }

  // Impression d'une étiquette de test (iframe isolé, mêmes réglages que la Zebra).
  const printLabel = async (kind: 'produit' | 'client' = 'produit') => {
    const w = labelW, h = labelH
    const bcH = Math.min(60, Math.round(h * 1.5))
    const { renderToStaticMarkup } = await import('react-dom/server')
    const body = kind === 'client'
      ? `<div class="zlabel">
           <div style="font-size:6pt;font-weight:700;text-transform:uppercase;line-height:1">${form.storeName}</div>
           <div class="zname" style="font-size:8pt;font-weight:700;line-height:1.05">${sampleClient.name}</div>
           ${code128Markup(sampleClient.code, bcH)}
         </div>`
      : renderToStaticMarkup(
        <div className="zlabel">
          <div style={{ fontSize: '6pt', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1 }}>{form.storeName}</div>
          <div className="zname" style={{ fontSize: '7pt', fontWeight: 600, lineHeight: 1.05 }}>{sampleLabel.name}</div>
          <EAN13 code={sampleLabel.barcode} height={bcH} moduleWidth={1.1} />
          <div style={{ fontSize: '10pt', fontWeight: 800, lineHeight: 1 }}>{fmtDH(sampleLabel.price)}</div>
        </div>
      )
    const doc = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: ${w}mm ${h}mm; margin: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
      .zlabel { width: ${w}mm; height: ${h}mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5mm; padding: 1mm; text-align: center; overflow: hidden; }
      .zname { max-height: 5mm; overflow: hidden; }
      svg { max-width: 100%; height: auto; }
    </style></head><body>${body}</body></html>`
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
    document.body.appendChild(iframe)
    const idoc = iframe.contentWindow?.document
    if (!idoc) { iframe.remove(); return }
    idoc.open(); idoc.write(doc); idoc.close()
    setTimeout(() => { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); setTimeout(() => iframe.remove(), 2000) }, 350)
  }

  // Impression d'un ticket de caisse test (iframe isolé, largeur 58/80 mm).
  const printTicket = async () => {
    const w = form.printFormat === 'ticket80' ? 80 : 58
    const { renderToStaticMarkup } = await import('react-dom/server')
    const row = { display: 'flex', justifyContent: 'space-between' } as const
    const dash = { borderTop: '1px dashed #999', margin: '5px 0' } as const
    const msg = form.ticketMessage?.trim() || t('posr_thanks').replace(/\*\*/g, '')
    const body = renderToStaticMarkup(
      <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#000', lineHeight: 1.25 }}>
        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '15px' }}>{form.storeName}</div>
        <div style={{ textAlign: 'center', fontSize: '8px', letterSpacing: '2px', color: '#555' }}>- MARKET -</div>
        <div style={dash} />
        <div style={{ textAlign: 'center' }}>{form.address}</div>
        <div style={{ textAlign: 'center' }}>{form.phone}</div>
        <div style={{ textAlign: 'center', fontWeight: 700, marginTop: '4px' }}>{t('soc_ticket_sale')}</div>
        <div style={dash} />
        {ticketItems.map((i, idx) => (
          <div key={idx} style={row}>
            <span>{i.qty.toFixed(2)} {i.name}</span>
            <span>{(i.price * i.qty).toFixed(2)}</span>
          </div>
        ))}
        <div style={dash} />
        <div style={{ ...row, fontWeight: 800, fontSize: '13px' }}><span>{t('posr_total_ttc')}</span><span>{fmtDH(ticketTotal)}</span></div>
        <div style={dash} />
        <div style={row}><span>{t('posr_stamp_duty')}</span><span>0,00 DH</span></div>
        <div style={{ ...row, fontWeight: 700 }}><span>{t('pos_pay_especes').toUpperCase()}</span><span>{fmtDH(ticketTotal)}</span></div>
        <div style={row}><span>{t('posr_change')}</span><span>0,00</span></div>
        <div style={dash} />
        <div style={{ fontWeight: 700 }}>{t('posr_vat_breakdown')}</div>
        <div style={row}><span>{t('posr_vat_rate')}</span><span>{t('posr_vat_ht')}</span><span>{t('posr_vat_tva')}</span><span>{t('posr_vat_ttc')}</span></div>
        <div style={row}><span>{form.tva}%</span><span>{ticketHT.toFixed(2)}</span><span>{ticketTVA.toFixed(2)}</span><span>{ticketTotal.toFixed(2)}</span></div>
        <div style={dash} />
        <div style={{ textAlign: 'center', fontWeight: 700, marginTop: '4px' }}>{msg}</div>
      </div>
    )
    const doc = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: ${w}mm auto; margin: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { background: #fff; }
      body { width: ${w}mm; padding: 2mm; }
    </style></head><body>${body}</body></html>`
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
    document.body.appendChild(iframe)
    const idoc = iframe.contentWindow?.document
    if (!idoc) { iframe.remove(); return }
    idoc.open(); idoc.write(doc); idoc.close()
    setTimeout(() => { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); setTimeout(() => iframe.remove(), 2000) }, 300)
  }

  const invoicePreviewNumber = `${form.invoicePrefix}${new Date().getFullYear()}-${form.invoiceStartNumber}`

  const initials = (form.storeName || 'DP')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('psub_company_title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('psub_company_subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={cancel} className="btn-secondary">
            {t('set_cancel')}
          </button>
          <button onClick={save} className="btn-primary">
            <Save className="h-4 w-4" />
            {t('set_save_settings')}
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Form column */}
        <div className="space-y-6 lg:col-span-8">
          {/* Identity & logo */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500">
                <Store className="h-5 w-5" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('soc_identity_title')}</h2>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="field-label">{t('soc_company_name')}</label>
                  <input type="text" value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} className="input-field" />
                </div>
                {/* Le slogan existait dans les réglages et s'imprimait sur les
                    documents, mais AUCUN écran ne permettait de le saisir : la
                    ligne d'activités restait donc vide sur toutes les factures. */}
                <div>
                  <label className="field-label">{t('soc_slogan')}</label>
                  <input
                    type="text"
                    value={form.slogan}
                    onChange={(e) => setForm({ ...form, slogan: e.target.value })}
                    placeholder={t('soc_slogan_placeholder')}
                    className="input-field"
                  />
                  <p className="mt-1 text-[11px] text-gray-400 dark:text-zinc-500">{t('soc_slogan_hint')}</p>
                </div>
                <div>
                  <label className="field-label">{t('soc_legal_form')}</label>
                  <Select
                    value={form.legalForm}
                    onChange={(v) => setForm({ ...form, legalForm: v as Settings['legalForm'] })}
                    options={[
                      { value: 'SARL', label: 'SARL' },
                      { value: 'SA', label: 'SA' },
                      { value: 'Auto-Entrepreneur', label: 'Auto-Entrepreneur' },
                      { value: 'SNC', label: 'SNC' },
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">{t('soc_logo_dark')}</label>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="group flex h-[132px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/15 bg-gray-900/90 p-3 transition-colors hover:border-amber-300"
                  >
                    {form.logoDataUrl ? (
                      <img src={form.logoDataUrl} alt="logo" className="max-h-16 max-w-full object-contain" />
                    ) : (
                      <>
                        <UploadCloud className="h-5 w-5 text-amber-400 transition-transform group-hover:scale-110" />
                        <span className="text-center text-[11px] font-semibold text-zinc-200">{initials}</span>
                      </>
                    )}
                  </button>
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg" onChange={(e) => onLogoChange(e, 'logoDataUrl')} className="hidden" />
                </div>
                <div>
                  <label className="field-label">{t('soc_signature')}</label>
                  <button
                    type="button"
                    onClick={() => signatureInputRef.current?.click()}
                    className="group flex h-[132px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/15 bg-white p-3 transition-colors hover:border-amber-300"
                  >
                    {form.signatureDataUrl ? (
                      <img src={form.signatureDataUrl} alt="signature" className="max-h-16 max-w-full object-contain" />
                    ) : (
                      <>
                        <UploadCloud className="h-5 w-5 text-amber-500 transition-transform group-hover:scale-110" />
                        <span className="text-center text-[11px] font-semibold text-gray-500">{t('soc_signature')}</span>
                      </>
                    )}
                  </button>
                  <input ref={signatureInputRef} type="file" accept="image/png,image/jpeg" onChange={(e) => onLogoChange(e, 'signatureDataUrl')} className="hidden" />
                </div>
                <p className="col-span-2 text-center text-xs text-gray-400 dark:text-zinc-500">{t('soc_logo_hint')}</p>
              </div>
            </div>
          </motion.div>

          {/* Legal info */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400">
                <Gavel className="h-5 w-5" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('soc_legal_title')}</h2>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">{t('soc_ice_label')}</label>
                <input type="text" value={form.ice} onChange={(e) => setForm({ ...form, ice: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="field-label">{t('soc_if_label')}</label>
                <input type="text" value={form.idFiscal} onChange={(e) => setForm({ ...form, idFiscal: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="field-label">{t('soc_rc_label')}</label>
                <input type="text" value={form.rcNo} onChange={(e) => setForm({ ...form, rcNo: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="field-label">{t('soc_tp_label')}</label>
                <input type="text" value={form.taxePro} onChange={(e) => setForm({ ...form, taxePro: e.target.value })} className="input-field" />
              </div>
            </div>
          </motion.div>

          {/* Contact */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }} className="glass-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
                <Phone className="h-5 w-5" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('soc_contact_title')}</h2>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">{t('soc_phone_label')}</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field pl-10" />
                </div>
              </div>
              <div>
                <label className="field-label">{t('soc_email_label')}</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field pl-10" />
                </div>
              </div>
              <div>
                <label className="field-label">{t('soc_city')}</label>
                <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="field-label">{t('soc_website')}</label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
                  <input type="text" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="www.exemple.ma" className="input-field pl-10" />
                </div>
              </div>
            </div>
            <div className="mt-4">
              <label className="field-label">{t('soc_address_label')}</label>
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={3}
                className="input-field resize-none"
              />
            </div>
          </motion.div>

          {/* Billing & documents */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} className="glass-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-500 dark:text-violet-400">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('soc_billing_title')}</h2>
                <p className="text-xs text-gray-500 dark:text-zinc-400">{t('soc_billing_desc')}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('soc_numbering')}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">{t('soc_invoice_prefix')}</label>
                    <input type="text" value={form.invoicePrefix} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="field-label">{t('soc_invoice_start')}</label>
                    <input
                      type="number"
                      min="0"
                      value={form.invoiceStartNumber}
                      onChange={(e) => setForm({ ...form, invoiceStartNumber: Math.max(0, Number(e.target.value) || 0) })}
                      className="input-field"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">{t('set_currency')}</label>
                    <input type="text" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="field-label">{t('set_tva')}</label>
                    <input type="number" min="0" value={form.tva} onChange={(e) => setForm({ ...form, tva: Number(e.target.value) })} className="input-field" />
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/5 p-4">
                  <p className="text-xs italic text-gray-500 dark:text-zinc-400">{t('soc_number_preview')}</p>
                  <p className="mt-1 font-mono text-lg font-bold text-amber-600 dark:text-amber-400">{invoicePreviewNumber}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('soc_terms_title')}</p>
                <textarea
                  value={form.invoiceTerms}
                  onChange={(e) => setForm({ ...form, invoiceTerms: e.target.value })}
                  rows={9}
                  placeholder={t('soc_terms_placeholder')}
                  className="input-field h-auto resize-none py-3 leading-relaxed"
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Preview column */}
        <div className="space-y-6 lg:col-span-4 lg:sticky lg:top-24">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-white/10 bg-amber-50/60 dark:bg-amber-500/10 px-4 py-3">
              <Eye className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('soc_preview_title')}</span>
            </div>

            {/* Onglets d'aperçu — en grille 2×2 : « Bon de commande » ne tient
                pas sur une ligne de quatre dans cette colonne. */}
            <div className="grid grid-cols-2 gap-1 border-b border-gray-100 p-2 dark:border-white/10">
              {([
                // Les cinq documents commerciaux d'abord, les étiquettes et le
                // ticket ensuite : on règle un en-tête, puis des formats à part.
                ['facture', Receipt, t('soc_tab_invoice'), false],
                ['devis', FileText, t('soc_tab_quote'), false],
                ['bc', Truck, t('soc_tab_po'), false],
                ['br', PackageCheck, t('soc_tab_receipt'), false],
                ['bl', Send, t('soc_tab_delivery'), false],
                ['etiquette', Tag, t('soc_tab_label'), false],
                ['etiquette_client', CreditCard, t('soc_tab_label_client'), false],
                ['ticket', ScrollText, t('soc_tab_ticket'), true],
              ] as const).map(([key, Icon, label, pleineLargeur]) => (
                <button
                  key={key}
                  onClick={() => setPreviewTab(key)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition ${pleineLargeur ? 'col-span-2' : ''} ${previewTab === key ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-white/10'}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>

            {previewTab === 'facture' ? (
              <div className="p-4">
                {/* Une facture de vente s'adresse à un CLIENT : l'aperçu
                    annonçait « Fournisseur » au-dessus d'un nom de client. */}
                <div className="rounded-xl border border-gray-100 shadow-lg" style={{ zoom: 0.55 } as React.CSSProperties}>
                  <InvoiceDocument
                    title={t('fdoc_invoice')}
                    docNumber={invoicePreviewNumber}
                    number="BC-000042"
                    date={new Date().toISOString()}
                    partyLabel={t('fdoc_client')}
                    partyName={t('soc_preview_client_sample')}
                    settingsOverride={form}
                    lines={[{ label: t('soc_preview_sample_item'), qty: 2, puHT: 1200, tvaPct: form.tva }]}
                    paid={2400 * (1 + form.tva / 100)}
                    showBalance
                  />
                </div>
                <p className="mt-3 text-center text-[11px] italic text-gray-400 dark:text-zinc-500">{t('soc_preview_note')}</p>
              </div>
            ) : previewTab === 'devis' ? (
              <div className="p-4">
                {/* Un devis PROPOSE : il ne « arrête » aucune facture et ne
                    porte pas de règlement — d'où le montant en lettres retiré. */}
                <div className="rounded-xl border border-gray-100 shadow-lg" style={{ zoom: 0.55 } as React.CSSProperties}>
                  <InvoiceDocument
                    title={t('quote_prefix')}
                    number="DEV-2026-0031"
                    date={new Date().toISOString()}
                    partyLabel={t('fdoc_client')}
                    partyName={t('soc_preview_client_sample')}
                    settingsOverride={form}
                    showAmountInWords={false}
                    infos={[
                      { label: t('dvc_validity'), value: new Date(Date.now() + 15 * 86400000).toLocaleDateString('fr-FR') },
                      { label: t('fdoc_seller'), value: t('soc_preview_seller_sample') },
                    ]}
                    lines={[
                      { label: t('soc_preview_sample_item'), qty: 2, puHT: 1200, tvaPct: form.tva },
                      { label: t('soc_preview_sample_item2'), qty: 5, puHT: 46.5, tvaPct: form.tva },
                    ]}
                  />
                </div>
                <p className="mt-3 text-center text-[11px] italic text-gray-400 dark:text-zinc-500">{t('soc_preview_note')}</p>
              </div>
            ) : previewTab === 'br' ? (
              <div className="p-4">
                {/* Bon de réception : ce qui est ENTRÉ en stock. Les prix y
                    figurent pour le contrôle facture, pas pour un règlement. */}
                <div className="rounded-xl border border-gray-100 shadow-lg" style={{ zoom: 0.55 } as React.CSSProperties}>
                  <InvoiceDocument
                    title={t('soc_tab_receipt')}
                    number="BR-2026-0014"
                    date={new Date().toISOString()}
                    partyLabel={t('fdoc_supplier')}
                    partyName={t('soc_preview_supplier_sample')}
                    partyAddress={t('soc_preview_supplier_address')}
                    settingsOverride={form}
                    showAmountInWords={false}
                    infos={[
                      { label: t('po_supplier_ref_label'), value: 'BC-2026-0007' },
                      { label: t('fdoc_date_label'), value: new Date().toLocaleDateString('fr-FR') },
                    ]}
                    lines={[
                      { label: t('soc_preview_sample_item'), qty: 3, unit: 'Carton', puHT: 980, tvaPct: form.tva },
                      { label: t('soc_preview_sample_item2'), qty: 12, puHT: 46.5, tvaPct: form.tva },
                    ]}
                  />
                </div>
                <p className="mt-3 text-center text-[11px] italic text-gray-400 dark:text-zinc-500">{t('soc_preview_note')}</p>
              </div>
            ) : previewTab === 'bl' ? (
              <div className="p-4">
                {/* Bon de livraison : il accompagne la marchandise. L'emplacement
                    y figure — c'est le document du préparateur. */}
                <div className="rounded-xl border border-gray-100 shadow-lg" style={{ zoom: 0.55 } as React.CSSProperties}>
                  <InvoiceDocument
                    title={t('soc_tab_delivery')}
                    number="BL-2026-0058"
                    date={new Date().toISOString()}
                    partyLabel={t('fdoc_client')}
                    partyName={t('soc_preview_client_sample')}
                    settingsOverride={form}
                    showAmountInWords={false}
                    showEmplacement
                    infos={[
                      { label: t('fdoc_date_label'), value: new Date().toLocaleDateString('fr-FR') },
                      { label: t('fdoc_seller'), value: t('soc_preview_seller_sample') },
                    ]}
                    lines={[
                      { label: t('soc_preview_sample_item'), qty: 2, puHT: 1200, tvaPct: form.tva, emplacement: 'Z01-A02-R3-E2' },
                      { label: t('soc_preview_sample_item2'), qty: 5, puHT: 46.5, tvaPct: form.tva, emplacement: 'Z02-A01-R1-E4' },
                    ]}
                  />
                </div>
                <p className="mt-3 text-center text-[11px] italic text-gray-400 dark:text-zinc-500">{t('soc_preview_note')}</p>
              </div>
            ) : previewTab === 'bc' ? (
              <div className="p-4">
                {/* Même document que l'impression réelle d'un bon de commande :
                    ce qu'on voit ici est ce que recevra le fournisseur. */}
                <div className="rounded-xl border border-gray-100 shadow-lg" style={{ zoom: 0.55 } as React.CSSProperties}>
                  <InvoiceDocument
                    title={t('po_doc_title')}
                    number="BC-2026-0007"
                    date={new Date().toISOString()}
                    partyLabel={t('fdoc_supplier')}
                    partyName={t('soc_preview_supplier_sample')}
                    partyAddress={t('soc_preview_supplier_address')}
                    settingsOverride={form}
                    showAmountInWords={false}
                    infos={[
                      { label: t('po_supplier_ref_label'), value: 'BL-4471' },
                      { label: t('po_expected_date_label'), value: new Date(Date.now() + 7 * 86400000).toLocaleDateString('fr-FR') },
                    ]}
                    lines={[
                      { label: t('soc_preview_sample_item'), qty: 3, unit: 'Carton', puHT: 980, tvaPct: form.tva },
                      { label: t('soc_preview_sample_item2'), qty: 12, puHT: 46.5, tvaPct: form.tva },
                    ]}
                  />
                </div>
                <p className="mt-3 text-center text-[11px] italic text-gray-400 dark:text-zinc-500">{t('soc_preview_note')}</p>
              </div>
            ) : previewTab === 'etiquette' ? (
              <div className="p-4">
                {/* Dimensions modifiables (mm) — partagées avec l'impression Zebra */}
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{t('soc_label_width')}</span>
                    <input type="number" min={10} value={form.labelWidthMm ?? 40} onChange={(e) => setForm({ ...form, labelWidthMm: Math.max(10, Number(e.target.value) || 0) })} className="input-field !h-9" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{t('soc_label_height')}</span>
                    <input type="number" min={10} value={form.labelHeightMm ?? 30} onChange={(e) => setForm({ ...form, labelHeightMm: Math.max(10, Number(e.target.value) || 0) })} className="input-field !h-9" />
                  </label>
                </div>

                {/* Aperçu de l'étiquette (proportions réelles) */}
                <div className="mt-4 flex justify-center rounded-xl bg-gray-100 p-4 dark:bg-white/5">
                  <div
                    className="flex flex-col items-center justify-center gap-1 overflow-hidden rounded border border-dashed border-gray-400 bg-white p-2 text-center text-black dark:border-white/30"
                    style={{ width: `${labelW * 3.4}px`, height: `${labelH * 3.4}px` }}
                  >
                    <div className="w-full truncate text-[9px] font-bold uppercase leading-none">{form.storeName}</div>
                    <div className="w-full truncate text-[10px] font-semibold leading-tight">{sampleLabel.name}</div>
                    <EAN13 code={sampleLabel.barcode} height={Math.min(44, labelH * 1.3)} moduleWidth={1.1} />
                    <div className="text-[12px] font-extrabold leading-none">{fmtDH(sampleLabel.price)}</div>
                  </div>
                </div>

                <button onClick={() => printLabel('produit')} className="btn-secondary mt-4 w-full">
                  <Printer className="h-4 w-4" />{t('soc_label_print_test')}
                </button>
                <p className="mt-3 text-center text-[11px] italic text-gray-400 dark:text-zinc-500">{t('soc_label_note')}</p>
              </div>
            ) : previewTab === 'etiquette_client' ? (
              <div className="p-4">
                {/* Même support physique que l'étiquette produit : les
                    dimensions sont partagées, c'est la même imprimante. */}
                <div className="flex justify-center rounded-xl bg-gray-100 p-4 dark:bg-white/5">
                  <div
                    className="flex flex-col items-center justify-center gap-1 overflow-hidden rounded border border-dashed border-gray-400 bg-white p-2 text-center text-black dark:border-white/30"
                    style={{ width: `${labelW * 3.4}px`, height: `${labelH * 3.4}px` }}
                  >
                    <div className="w-full truncate text-[9px] font-bold uppercase leading-none">{form.storeName}</div>
                    <div className="w-full truncate text-[11px] font-bold leading-tight">{sampleClient.name}</div>
                    <Barcode128 value={sampleClient.code} height={Math.min(40, labelH * 1.2)} width={1.3} fontSize={11} />
                  </div>
                </div>

                <button onClick={() => printLabel('client')} className="btn-secondary mt-4 w-full">
                  <Printer className="h-4 w-4" />{t('soc_label_print_test')}
                </button>
                <p className="mt-3 text-center text-[11px] italic leading-relaxed text-gray-400 dark:text-zinc-500">
                  {t('soc_label_client_note')}
                </p>
              </div>
            ) : (
              <div className="p-4">
                {/*
                  Message de bas de ticket, modifiable ICI : c'est le seul
                  réglage du ticket dont on voit l'effet en direct juste en
                  dessous. Il vit dans le même objet de réglages que le reste
                  de la page — le bouton « Enregistrer » du haut le sauve.
                */}
                <div className="mb-4 space-y-3 rounded-xl border border-gray-100 p-3 dark:border-white/10">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('psub_ticket_section')}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t('psub_ticket_hint')}</p>
                  </div>
                  {/* La largeur du rouleau change l'aperçu juste en dessous. */}
                  <div>
                    <span className="field-label">{t('psub_print_format_label')}</span>
                    <div className="grid grid-cols-2 gap-2">
                      {([['ticket58', t('psub_print_ticket58')], ['ticket80', t('psub_print_ticket80')]] as const).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setForm({ ...form, printFormat: key })}
                          className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                            form.printFormat === key
                              ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-amber-300 dark:border-white/10 dark:bg-[#12121a] dark:text-zinc-400'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block">
                    <span className="field-label">{t('set_ticket_message')}</span>
                    <input
                      type="text"
                      value={form.ticketMessage}
                      onChange={(e) => setForm({ ...form, ticketMessage: e.target.value })}
                      placeholder={t('posr_thanks').replace(/\*\*/g, '')}
                      className="input-field"
                    />
                  </label>
                </div>

                {/* Aperçu du ticket de caisse (reflète les réglages en direct) */}
                <div className="flex justify-center rounded-xl bg-gray-100 p-4 dark:bg-white/5">
                  <div className="bg-white px-3 py-4 font-mono text-[11px] leading-tight text-black shadow-lg" style={{ width: `${ticketWidth}px` }}>
                    <p className="text-center text-base font-black tracking-tight">{form.storeName}</p>
                    <p className="text-center text-[9px] uppercase tracking-widest text-gray-500">- Market -</p>
                    <div className="my-2 border-t border-dashed border-gray-300" />
                    <p className="text-center">{form.address}</p>
                    <p className="text-center">{form.phone}</p>
                    <p className="mt-2 text-center font-bold">{t('soc_ticket_sale')}</p>
                    <div className="my-2 border-t border-dashed border-gray-300" />
                    <div className="flex justify-between font-bold">
                      <span>{t('posr_col_qty')}</span><span className="flex-1 px-2">{t('posr_col_articles')}</span><span>{t('posr_col_pt')}</span>
                    </div>
                    {ticketItems.map((i, idx) => (
                      <div key={idx} className="flex justify-between gap-1">
                        <span className="w-6 shrink-0">{i.qty.toFixed(2)}</span>
                        <span className="min-w-0 flex-1 truncate px-1">{i.name}</span>
                        <span className="shrink-0 tabular-nums">{(i.price * i.qty).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="my-2 border-t border-dashed border-gray-300" />
                    <div className="flex justify-between text-sm font-black"><span>{t('posr_total_ttc')}</span><span className="tabular-nums">{fmtDH(ticketTotal)}</span></div>
                    <div className="my-2 border-t border-dashed border-gray-300" />
                    <div className="flex justify-between text-gray-600"><span>{t('posr_stamp_duty')}</span><span>0,00 DH</span></div>
                    <div className="flex justify-between font-bold uppercase text-amber-600"><span>{t('pos_pay_especes')}</span><span className="tabular-nums">{fmtDH(ticketTotal)}</span></div>
                    <div className="flex justify-between text-gray-600"><span>{t('posr_change')}</span><span>0,00</span></div>
                    <div className="my-2 border-t border-dashed border-gray-300" />
                    <p className="font-bold uppercase">{t('posr_vat_breakdown')}</p>
                    <div className="flex justify-between font-bold"><span className="w-8">{t('posr_vat_rate')}</span><span className="flex-1 text-right">{t('posr_vat_ht')}</span><span className="flex-1 text-right">{t('posr_vat_tva')}</span><span className="flex-1 text-right">{t('posr_vat_ttc')}</span></div>
                    <div className="flex justify-between"><span className="w-8 tabular-nums">{form.tva}%</span><span className="flex-1 text-right tabular-nums">{ticketHT.toFixed(2)}</span><span className="flex-1 text-right tabular-nums">{ticketTVA.toFixed(2)}</span><span className="flex-1 text-right tabular-nums">{ticketTotal.toFixed(2)}</span></div>
                    <div className="my-2 border-t border-dashed border-gray-300" />
                    <p className="mt-2 text-center font-semibold">{form.ticketMessage?.trim() || t('posr_thanks').replace(/\*\*/g, '')}</p>
                  </div>
                </div>
                <button onClick={printTicket} className="btn-secondary mt-4 w-full">
                  <Printer className="h-4 w-4" />{t('soc_ticket_print_test')}
                </button>
                <p className="mt-3 text-center text-[11px] italic text-gray-400 dark:text-zinc-500">{t('soc_ticket_note')}</p>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="glass-card flex gap-3 p-5"
          >
            <Info className="h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">{t('soc_legal_reminder_title')}</h4>
              <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">{t('soc_legal_reminder_desc')}</p>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-zinc-400">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('set_app_name_version')}</h2>
            <p className="text-xs tabular-nums text-gray-500 dark:text-zinc-400">
              {products.length.toLocaleString('fr-FR')} {t('set_products_count')} · {sales.length.toLocaleString('fr-FR')} {t('set_sales_count')} ·{' '}
              {clients.length.toLocaleString('fr-FR')} {t('set_clients_count')} · {suppliers.length.toLocaleString('fr-FR')} {t('set_suppliers_count')}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-gray-500 dark:text-zinc-400">
          {t('set_about_text')}{' '}
          <span className="font-semibold text-gray-900 dark:text-white">
            {fmtDH(sales.reduce((a, s) => a + s.total, 0))}
          </span>
          . {t('set_about_footer')}
        </p>
      </motion.div>
    </>
  )
}

export default function ParametresSocietePage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
