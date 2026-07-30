'use client'

import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { Rotate3d } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import { useLanguage } from '@/lib/i18n'

// Le canvas 3D (three.js) n'est chargé que côté client, et uniquement sur
// cette route (import dynamique → n'alourdit pas le reste de l'app).
const Explorer3D = dynamic(() => import('@/components/wms3d/Explorer3D'), { ssr: false, loading: () => <Loader /> })

export default function ExplorateurPage() {
  const { t } = useLanguage()
  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <Rotate3d className="h-6 w-6 text-amber-500" />{t('x3_title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('x3_subtitle')}</p>
      </motion.div>
      <Explorer3D />
    </AppShell>
  )
}
