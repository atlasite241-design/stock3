'use client'

import React, { useEffect, useRef, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Eye, Gavel, Globe, Info, Mail, Phone, Receipt, Save, Store, UploadCloud } from 'lucide-react'
import AppShell from '@/components/AppShell'
import InvoiceDocument from '@/components/InvoiceDocument'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { useDroguerie, type Settings } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, settings, saveSettings } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [form, setForm] = useState(settings)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const signatureInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ready) setForm(settings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  if (!ready) {
    return <Loader />
  }

  const save = () => {
    saveSettings({ ...form, storeName: form.storeName.trim() || 'Droguerie Pro' })
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
