'use client'

import React, { useEffect, useRef, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Cloud, Database, FileDown, FileSpreadsheet, FileUp, RefreshCcw, RotateCcw, Save, Trash2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import {
  createBackup,
  deleteBackup,
  exportAllJSON,
  exportProductsCSV,
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
  const { ready, products, importProducts } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [resetOpen, setResetOpen] = useState(false)
  const [backups, setBackups] = useState<Backup[]>([])
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null)
  const [importState, setImportState] = useState<{ msg: string; pct: number | null } | null>(null)
  const jsonInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ready) setBackups(listBackups())
  }, [ready])

  if (!ready) {
    return <Loader />
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

  const confirmReset = () => {
    resetDemoData()
    window.location.reload()
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
    e.target.value = ''
    setImportState({ msg: t('set_import_reading'), pct: 0 })
    const reader = new FileReader()
    reader.onprogress = (ev) => {
      if (ev.lengthComputable) setImportState({ msg: t('set_import_reading'), pct: Math.round((ev.loaded / ev.total) * 100) })
    }
    reader.onerror = () => { setImportState(null); toast(t('set_toast_invalid_backup'), 'error') }
    reader.onload = () => {
      // On repasse la main au navigateur entre chaque phase lourde (évite le gel).
      setImportState({ msg: t('set_import_parsing'), pct: null })
      setTimeout(() => {
        let rows: ReturnType<typeof parseProductsCSV>
        try { rows = parseProductsCSV(String(reader.result)) } catch { setImportState(null); toast(t('set_toast_no_valid_product'), 'error'); return }
        if (rows.length === 0) { setImportState(null); toast(t('set_toast_no_valid_product'), 'error'); return }
        setImportState({ msg: `${t('set_import_importing')} (${rows.length})`, pct: null })
        setTimeout(() => {
          try {
            const { added, updated } = importProducts(rows)
            toast(`✓ ${t('set_toast_import_added')} ${added} ${t('set_toast_import_added_suffix')} ${updated} ${t('set_toast_import_updated_suffix')}`)
          } catch {
            // Dépassement de quota localStorage sur un fichier trop volumineux.
            toast(t('set_import_quota'), 'error')
          } finally {
            setImportState(null)
          }
        }, 40)
      }, 40)
    }
    reader.readAsText(file)
  }

  return (
    <>
      {importState && (
        <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-2xl border border-sky-200 bg-white/95 p-4 shadow-2xl backdrop-blur dark:border-sky-500/25 dark:bg-[#12121a]/95">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-900 dark:text-white">{importState.msg}</span>
            {importState.pct !== null && <span className="font-bold text-sky-600 dark:text-sky-400 tabular-nums">{importState.pct}%</span>}
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            {importState.pct !== null
              ? <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all" style={{ width: `${importState.pct}%` }} />
              : <div className="h-full w-1/3 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-sky-400 to-blue-500" />}
          </div>
        </div>
      )}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('psub_backup_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('psub_backup_subtitle')}</p>
      </motion.div>

      {/* Sauvegardes locales */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card max-w-xl p-6">
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
                className="rounded-lg p-1.5 text-gray-400 dark:text-zinc-500 transition hover:bg-amber-50 hover:text-amber-600"
                title={t('set_restore')}
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  deleteBackup(b.id)
                  setBackups(listBackups())
                }}
                className="rounded-lg p-1.5 text-gray-400 dark:text-zinc-500 transition hover:bg-rose-50 hover:text-rose-500"
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

      {/* Import */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card max-w-xl p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('psub_import_title')}</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">{t('set_excel_csv')}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button onClick={() => csvInputRef.current?.click()} className="btn-secondary">
            <FileUp className="h-4 w-4" />
            {t('set_import_products_csv')}
          </button>
          <button onClick={() => jsonInputRef.current?.click()} className="btn-secondary">
            <FileUp className="h-4 w-4" />
            {t('set_import_json')}
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-400 dark:text-zinc-500">{t('set_csv_import_note')}</p>
        <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={onImportCSV} className="hidden" />
        <input ref={jsonInputRef} type="file" accept=".json,application/json" onChange={onImportJSON} className="hidden" />
      </motion.div>

      {/* Export */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }} className="glass-card max-w-xl p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('psub_export_title')}</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">{t('set_excel_csv')}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button onClick={() => exportProductsCSV(products)} className="btn-secondary">
            <FileDown className="h-4 w-4" />
            {t('set_export_products_csv')}
          </button>
          <button onClick={exportAllJSON} className="btn-secondary">
            <Database className="h-4 w-4" />
            {t('set_export_json')}
          </button>
        </div>
      </motion.div>

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

export default function ParametresSauvegardePage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
