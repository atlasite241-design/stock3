'use client'

import { motion } from 'framer-motion'
import { Database, FileDown, FileSpreadsheet } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { exportAllJSON, exportProductsCSV, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products } = useDroguerie()
  const { t } = useLanguage()

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('psub_export_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('psub_export_subtitle')}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card max-w-xl p-6">
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
    </>
  )
}

export default function ParametresExportExcelPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
