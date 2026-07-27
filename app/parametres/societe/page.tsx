'use client'

import React, { useEffect, useRef, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Eye, Gavel, Globe, Info, Mail, Phone, Printer, Receipt, Save, Store, Tag, UploadCloud } from 'lucide-react'
import AppShell from '@/components/AppShell'
import InvoiceDocument from '@/components/InvoiceDocument'
import EAN13 from '@/components/EAN13'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { fmtDH, useDroguerie, type Settings } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, settings, saveSettings } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [form, setForm] = useState(settings)
  const [previewTab, setPreviewTab] = useState<'facture' | 'etiquette'>('facture')
  const logoInputRef = useRef<HTMLInputElement>(null)
  const signatureInputRef = useRef<HTMLInputElement>(null)

  // Produit d'exemple pour prévisualiser l'étiquette Zebra.
  const sampleLabel = { name: 'Peinture blanche 5L', price: 185, barcode: '6111234500017' }
  const labelW = Math.max(10, form.labelWidthMm ?? 40)
  const labelH = Math.max(10, form.labelHeightMm ?? 30)

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

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>, key: 'logoDataUrl' | 'logoLightDataUrl' | 'signatureDataUrl') => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, [key]: String(reader.result) }))
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Impression d'une étiquette de test (iframe isolé, mêmes réglages que la Zebra).
  const printLabel = async () => {
    const w = labelW, h = labelH
    const bcH = Math.min(60, Math.round(h * 1.5))
    const { renderToStaticMarkup } = await import('react-dom/server')
    const body = renderToStaticMarkup(
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
                <div>
                  <label className="field-label">{t('soc_slogan')}</label>
                  <input
                    type="text"
                    value={form.slogan}
                    onChange={(e) => setForm({ ...form, slogan: e.target.value })}
                    placeholder={t('soc_slogan_placeholder')}
                    className="input-field"
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
                <div>
                  <label className="field-label">{t('soc_date_format')}</label>
                  <Select
                    value={form.dateFormat}
                    onChange={(v) => setForm({ ...form, dateFormat: v as Settings['dateFormat'] })}
                    options={[
                      { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                      { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                    ]}
                  />
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

            {/* Onglets Facture / Étiquette */}
            <div className="flex gap-1 border-b border-gray-100 p-2 dark:border-white/10">
              {([['facture', Receipt, t('soc_tab_invoice')], ['etiquette', Tag, t('soc_tab_label')]] as const).map(([key, Icon, label]) => (
                <button
                  key={key}
                  onClick={() => setPreviewTab(key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${previewTab === key ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-white/10'}`}
                >
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </div>

            {previewTab === 'facture' ? (
              <div className="p-4">
                <div className="rounded-xl border border-gray-100 shadow-lg" style={{ zoom: 0.55 } as React.CSSProperties}>
                  <InvoiceDocument
                    title={t('fdoc_invoice')}
                    docNumber={invoicePreviewNumber}
                    number="BC-000042"
                    date={new Date().toISOString()}
                    partyLabel={t('fdoc_supplier')}
                    partyName={t('soc_preview_client_sample')}
                    settingsOverride={form}
                    lines={[{ label: t('soc_preview_sample_item'), qty: 2, puHT: 1200, tvaPct: form.tva }]}
                    paid={2400 * (1 + form.tva / 100)}
                    showBalance
                  />
                </div>
                <p className="mt-3 text-center text-[11px] italic text-gray-400 dark:text-zinc-500">{t('soc_preview_note')}</p>
              </div>
            ) : (
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

                <button onClick={printLabel} className="btn-secondary mt-4 w-full">
                  <Printer className="h-4 w-4" />{t('soc_label_print_test')}
                </button>
                <p className="mt-3 text-center text-[11px] italic text-gray-400 dark:text-zinc-500">{t('soc_label_note')}</p>
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
