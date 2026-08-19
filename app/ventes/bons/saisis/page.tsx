'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2, Eye, Search } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import BonsTable from '@/components/BonsTable'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, bons } = useDroguerie()
  const { t } = useLanguage()
  const router = useRouter()
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bons
      .filter((b) => b.status === 'saisi')
      .filter((b) => !q || b.ref.toLowerCase().includes(q) || b.clientName.toLowerCase().includes(q) || (b.invoiceNo ?? '').toLowerCase().includes(q))
      .sort((a, b) => ((a.saisiAt ?? a.date) < (b.saisiAt ?? b.date) ? 1 : -1))
  }, [bons, query])

  if (!ready) return <Loader />

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />{t('bon_entered_title')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('bon_entered_sub')}</p>
      </motion.div>

      <div className="glass-card flex items-center gap-2 p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('bon_filter_search')} className="input-field h-11 pl-10" />
        </div>
        <span className="shrink-0 px-2 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{rows.length}</span>
      </div>

      <BonsTable
        bons={rows}
        renderActions={(b) => (
          <button onClick={() => router.push(`/ventes/bons/saisie?id=${b.id}`)} title={t('bon_view_action')} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10">
            <Eye className="h-4 w-4" />
          </button>
        )}
      />
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
