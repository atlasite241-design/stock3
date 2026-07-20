'use client'

import { useEffect, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Save, Store } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useToast } from '@/components/Toast'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, settings, saveSettings } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [form, setForm] = useState(settings)

  useEffect(() => {
    if (ready) setForm(settings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  if (!ready) {
    return <Loader />
  }

  const save = () => {
    saveSettings({ ...form })
    toast(`✓ ${t('set_toast_saved')}`)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('psub_store_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('psub_store_subtitle')}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card max-w-xl p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('psub_store_title')}</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">{t('psub_store_subtitle')}</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="field-label">{t('set_ticket_message')}</label>
            <input type="text" value={form.ticketMessage} onChange={(e) => setForm({ ...form, ticketMessage: e.target.value })} className="input-field" />
          </div>
          <button onClick={save} className="btn-primary w-full">
            <Save className="h-4 w-4" />
            {t('set_save_settings')}
          </button>
        </div>
      </motion.div>
    </>
  )
}

export default function ParametresMagasinPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
