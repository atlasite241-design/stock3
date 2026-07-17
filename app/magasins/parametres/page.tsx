'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Save, SlidersHorizontal } from 'lucide-react'
import AppShell from '@/components/AppShell'
import StoreForm, { emptyStoreForm, storeToForm, type StoreFormValues } from '@/components/StoreForm'
import { useToast } from '@/components/Toast'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, activeStore, activeStoreId, updateStore } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [form, setForm] = useState<StoreFormValues>(emptyStoreForm())

  useEffect(() => {
    if (activeStore) setForm(storeToForm(activeStore))
  }, [activeStore])

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const save = () => {
    if (!activeStoreId) return
    updateStore(activeStoreId, { ...form })
    toast(t('mag_saved'))
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <SlidersHorizontal className="h-6 w-6 text-amber-500" />
          {t('mset_title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          {t('mset_subtitle')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card max-w-3xl p-6">
        <StoreForm value={form} onChange={setForm} />
        <div className="mt-6 flex justify-end">
          <button onClick={save} className="btn-primary">
            <Save className="h-4 w-4" />
            {t('mag_save')}
          </button>
        </div>
      </motion.div>
    </>
  )
}

export default function StoreSettingsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
