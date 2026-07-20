'use client'

import React, { useRef } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { FileSpreadsheet, FileUp } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useToast } from '@/components/Toast'
import { importAllJSON, parseProductsCSV, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, importProducts } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const jsonInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  if (!ready) {
    return <Loader />
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

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('psub_import_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('psub_import_subtitle')}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card max-w-xl p-6">
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
    </>
  )
}

export default function ParametresImportExcelPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
