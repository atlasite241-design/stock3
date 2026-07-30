'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Rotate3d } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import { useLanguage } from '@/lib/i18n'

// Le lanceur décide s'il faut monter la 3D (et n'importe three.js qu'à ce
// moment-là) : la page reste saine même si le rendu 3D fait tomber l'onglet.
const ExplorerLauncher = dynamic(() => import('@/components/wms3d/ExplorerLauncher'), { ssr: false, loading: () => <Loader /> })

// useSearchParams doit vivre sous <Suspense> (App Router).
function ExplorerWithCode() {
  const params = useSearchParams()
  const code = params.get('code') ?? undefined
  return <ExplorerLauncher initialCode={code} />
}

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
      <Suspense fallback={<Loader />}>
        <ExplorerWithCode />
      </Suspense>
    </AppShell>
  )
}
