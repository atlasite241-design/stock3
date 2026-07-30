'use client'

import { motion } from 'framer-motion'
import { Camera } from 'lucide-react'
import AppShell from '@/components/AppShell'
import PhotoStoreWizard from '@/components/storevision/PhotoStoreWizard'
import { useLanguage } from '@/lib/i18n'

export default function AssistantPhotosPage() {
  const { t } = useLanguage()
  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <Camera className="h-6 w-6 text-amber-500" />{t('sv_title')}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">{t('sv_subtitle')}</p>
      </motion.div>
      <PhotoStoreWizard />
    </AppShell>
  )
}
