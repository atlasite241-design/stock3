'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw, Search, XCircle } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import BonsTable from '@/components/BonsTable'
import { useToast } from '@/components/Toast'
import { usePermissions } from '@/lib/access'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, bons, reopenBon } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bons
      .filter((b) => b.status === 'annule')
      .filter((b) => !q || b.ref.toLowerCase().includes(q) || b.clientName.toLowerCase().includes(q))
      .sort((a, b) => ((a.annuleAt ?? a.date) < (b.annuleAt ?? b.date) ? 1 : -1))
  }, [bons, query])

  const reopen = (id: string) => {
    const r = reopenBon(id)
    toast(r.ok ? t('bon_reopen_done') : t('bon_reopen_returns'), r.ok ? 'success' : 'error')
  }

  if (!ready) return <Loader />

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <XCircle className="h-6 w-6 text-rose-500" />{t('bon_cancelled_title')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('bon_cancelled_sub')}</p>
      </motion.div>

      <div className="glass-card flex items-center gap-2 p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('bon_filter_search')} className="input-field h-11 pl-10" />
        </div>
        <span className="shrink-0 px-2 text-sm font-bold tabular-nums text-rose-500">{rows.length}</span>
      </div>

      <BonsTable
        bons={rows}
        renderActions={(b) => (
          can('bons.reopen') ? (
            <button onClick={() => reopen(b.id)} title={t('bon_reopen')} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-amber-300 hover:text-amber-600 dark:border-white/10 dark:text-zinc-300">
              <RotateCcw className="h-3.5 w-3.5" />{t('bon_reopen')}
            </button>
          ) : null
        )}
      />

      {rows.some((b) => b.motif) && (
        <div className="glass-card space-y-1 p-4 text-xs text-gray-500 dark:text-zinc-400">
          {rows.filter((b) => b.motif).map((b) => (
            <div key={b.id}><span className="font-mono font-semibold text-gray-700 dark:text-zinc-200">{b.ref}</span> — {t('bon_motif')} : {b.motif}</div>
          ))}
        </div>
      )}
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
