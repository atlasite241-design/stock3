'use client'

import React, { useEffect, useRef, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import {
  Cloud,
  Database,
  FileDown,
  FileSpreadsheet,
  FileUp,
  Info,
  RefreshCcw,
  RotateCcw,
  Save,
  Store,
  Trash2,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import {
  createBackup,
  deleteBackup,
  exportAllJSON,
  exportProductsCSV,
  fmtDH,
  importAllJSON,
  listBackups,
  parseProductsCSV,
  resetDemoData,
  restoreBackup,
  useDroguerie,
  type Backup,
} from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, sales, clients, suppliers, settings, importProducts, saveSettings } =
    useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [form, setForm] = useState(settings)
  const [resetOpen, setResetOpen] = useState(false)
  const [backups, setBackups] = useState<Backup[]>([])
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null)
  const jsonInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ready) {
      setForm(settings)
      setBackups(listBackups())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  if (!ready) {
    return <Loader />
  }

  const saveForm = () => {
    saveSettings({
      ...form,
      storeName: form.storeName.trim() || 'Droguerie Pro',
      tva: Math.max(0, Number(form.tva) || 0),
    })
    toast(`✓ ${t('set_toast_saved')}`)
  }

  const doBackup = () => {
    createBackup(`${t('set_backup_date_prefix')} ${new Date().toLocaleString('fr-FR')}`)
    setBackups(listBackups())
    toast(`✓ ${t('set_toast_backup_created')}`)
  }

  const doRestore = () => {
    if (!restoreTarget) return
    restoreBackup(restoreTarget)
    toast(`✓ ${t('set_toast_restored')}`)
    setRestoreTarget(null)
    setTimeout(() => window.location.reload(), 600)
  }

  const onImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (importAllJSON(String(reader.result))) {
        toast(`✓ ${t('set_toast_imported')}`)
        setTimeout(() => window.location.reload(), 600)
      } else {
        toast(t('set_toast_invalid_backup'), 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const onImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const rows = parseProductsCSV(String(reader.result))
      if (rows.length === 0) {
        toast(t('set_toast_no_valid_product'), 'error')
        return
      }
      const { added, updated } = importProducts(rows)
      toast(`✓ ${t('set_toast_import_added')} ${added} ${t('set_toast_import_added_suffix')} ${updated} ${t('set_toast_import_updated_suffix')}`)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const confirmReset = () => {
    resetDemoData()
    window.location.reload()
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('set_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('set_subtitle')}</p>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Store info */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('set_my_store')}</h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{t('set_shown_on_receipts')}</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="field-label">{t('set_store_name')}</label>
              <input
                type="text"
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">{t('set_phone')}</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="field-label">{t('set_tva')}</label>
                <input
                  type="number"
                  min="0"
                  value={form.tva}
                  onChange={(e) => setForm({ ...form, tva: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
            </div>
            <div>
              <label className="field-label">{t('set_address')}</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">{t('set_currency')}</label>
                <input
                  type="text"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="field-label">{t('set_ticket_message')}</label>
                <input
                  type="text"
                  value={form.ticketMessage}
                  onChange={(e) => setForm({ ...form, ticketMessage: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>
            <button onClick={saveForm} className="btn-primary w-full">
              <Save className="h-4 w-4" />
              {t('set_save_settings')}
            </button>
          </div>
        </motion.div>

        <div className="space-y-6">
          {/* Import / Export */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('set_import_export')}</h2>
                <p className="text-xs text-gray-500 dark:text-zinc-400">{t('set_excel_csv')}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => exportProductsCSV(products)} className="btn-secondary">
                <FileDown className="h-4 w-4" />
                {t('set_export_products_csv')}
              </button>
              <button onClick={() => csvInputRef.current?.click()} className="btn-secondary">
                <FileUp className="h-4 w-4" />
                {t('set_import_products_csv')}
              </button>
              <button onClick={exportAllJSON} className="btn-secondary">
                <Database className="h-4 w-4" />
                {t('set_export_json')}
              </button>
              <button onClick={() => jsonInputRef.current?.click()} className="btn-secondary">
                <FileUp className="h-4 w-4" />
                {t('set_import_json')}
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-400 dark:text-zinc-500">
              {t('set_csv_import_note')}
            </p>
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={onImportCSV} className="hidden" />
            <input ref={jsonInputRef} type="file" accept=".json,application/json" onChange={onImportJSON} className="hidden" />
          </motion.div>

          {/* Backups */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
                  <Cloud className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('set_backups')}</h2>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{backups.length}/5 {t('set_local_backups')}</p>
                </div>
              </div>
              <button onClick={doBackup} className="btn-primary !h-9 text-xs">
                <Save className="h-3.5 w-3.5" />
                {t('set_backup_now')}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {backups.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-xl bg-gray-50/60 dark:bg-white/5 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-[#12121a] text-emerald-500 dark:text-emerald-400">
                    <Database className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800 dark:text-zinc-100">
                    {new Date(b.date).toLocaleString('fr-FR')}
                  </span>
                  <button
                    onClick={() => setRestoreTarget(b)}
                    className="rounded-lg p-1.5 text-gray-400 dark:text-zinc-500 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-400"
                    title={t('set_restore')}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      deleteBackup(b.id)
                      setBackups(listBackups())
                    }}
                    className="rounded-lg p-1.5 text-gray-400 dark:text-zinc-500 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {backups.length === 0 && (
                <p className="py-4 text-center text-xs text-gray-400 dark:text-zinc-500">{t('set_no_local_backup')}</p>
              )}
            </div>

            <button onClick={() => setResetOpen(true)} className="btn-danger mt-4 w-full">
              <RefreshCcw className="h-4 w-4" />
              {t('set_reset_demo')}
            </button>
          </motion.div>
        </div>
      </div>

      {/* Stats + about */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-zinc-400">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('set_app_name_version')}</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              {products.length} {t('set_products_count')} · {sales.length} {t('set_sales_count')} · {clients.length} {t('set_clients_count')} ·{' '}
              {suppliers.length} {t('set_suppliers_count')}
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

      {/* Restore confirm */}
      <Modal open={!!restoreTarget} onClose={() => setRestoreTarget(null)} title={t('set_restore_confirm_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          {t('set_restore_confirm_prefix')}{' '}
          <span className="font-semibold text-gray-900 dark:text-white">
            {restoreTarget && new Date(restoreTarget.date).toLocaleString('fr-FR')}
          </span>
          .
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setRestoreTarget(null)} className="btn-secondary">
            {t('set_cancel')}
          </button>
          <button onClick={doRestore} className="btn-primary">
            <RotateCcw className="h-4 w-4" />
            {t('set_restore')}
          </button>
        </div>
      </Modal>

      {/* Reset confirm */}
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={t('set_reset_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          {t('set_reset_desc1')} <span className="font-semibold text-rose-600 dark:text-rose-400">{t('set_reset_desc2')}</span>{' '}
          {t('set_reset_desc3')}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setResetOpen(false)} className="btn-secondary">
            {t('set_cancel')}
          </button>
          <button onClick={confirmReset} className="btn-danger">
            <RefreshCcw className="h-4 w-4" />
            {t('set_reset_action')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function ParametresPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
