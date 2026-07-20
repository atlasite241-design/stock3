'use client'

import { useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Building2, Save } from 'lucide-react'
import AppShell from '@/components/AppShell'
import StoreForm, { emptyStoreForm, type StoreFormValues } from '@/components/StoreForm'
import { useToast } from '@/components/Toast'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, addStore } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const [form, setForm] = useState<StoreFormValues>(emptyStoreForm())

  if (!ready) {
    return <Loader />
  }

  const save = () => {
    if (!form.name.trim() || !form.code.trim()) return
    addStore({ ...form })
    toast(t('mag_saved'))
    router.push('/magasins')
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <Building2 className="h-6 w-6 text-amber-500" />
          {t('mag_new_title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('mag_new_subtitle')}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card max-w-3xl p-6">
        <StoreForm value={form} onChange={setForm} />
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => router.push('/magasins')} className="btn-secondary">{t('mag_cancel')}</button>
          <button onClick={save} disabled={!form.name.trim() || !form.code.trim()} className="btn-primary disabled:opacity-50">
            <Save className="h-4 w-4" />
            {t('mag_save')}
          </button>
        </div>
      </motion.div>
    </>
  )
}

export default function NouveauMagasinPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
