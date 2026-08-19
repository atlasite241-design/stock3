'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, Pencil, Search } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import Select from '@/components/Select'
import BonsTable from '@/components/BonsTable'
import { BON_STATUS_KEY } from '@/components/BonStatusPill'
import { usePermissions } from '@/lib/access'
import { useDroguerie, type BonStatus } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const d2 = (n: number) => String(n).padStart(2, '0')
const localDay = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d2(d.getMonth() + 1)}-${d2(d.getDate())}` }
const STATUSES: BonStatus[] = ['cree', 'attente', 'encours', 'saisi', 'annule']

function Content() {
  const { ready, bons } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string>('tous')
  const [vendeur, setVendeur] = useState('tous')
  const [client, setClient] = useState('tous')
  const [day, setDay] = useState('')

  const vendeurs = useMemo(() => Array.from(new Set(bons.map((b) => b.vendeurName).filter(Boolean))) as string[], [bons])
  const clientNames = useMemo(() => Array.from(new Set(bons.map((b) => b.clientName))), [bons])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bons
      .filter((b) => status === 'tous' || b.status === status)
      .filter((b) => vendeur === 'tous' || b.vendeurName === vendeur)
      .filter((b) => client === 'tous' || b.clientName === client)
      .filter((b) => !day || localDay(b.date) === day)
      .filter((b) => !q || b.ref.toLowerCase().includes(q) || b.clientName.toLowerCase().includes(q) || (b.clientCode ?? '').toLowerCase().includes(q) || (b.invoiceNo ?? '').toLowerCase().includes(q))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [bons, query, status, vendeur, client, day])

  if (!ready) return <Loader />

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <Search className="h-6 w-6 text-amber-500" />{t('bon_search_title')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('bon_search_sub')}</p>
      </motion.div>

      <div className="glass-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('bon_filter_search')} className="input-field h-11 pl-10" />
        </div>
        <Select
          value={status}
          onChange={setStatus}
          options={[{ value: 'tous', label: t('bon_filter_all') }, ...STATUSES.map((s) => ({ value: s, label: t(BON_STATUS_KEY[s]) }))]}
        />
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="input-field h-11" />
        <Select
          value={vendeur}
          onChange={setVendeur}
          options={[{ value: 'tous', label: `${t('bon_filter_vendeur')} — ${t('bon_filter_all')}` }, ...vendeurs.map((v) => ({ value: v, label: v }))]}
        />
        <Select
          value={client}
          onChange={setClient}
          options={[{ value: 'tous', label: `${t('bon_filter_client')} — ${t('bon_filter_all')}` }, ...clientNames.map((c) => ({ value: c, label: c }))]}
        />
      </div>

      <div className="px-1 text-sm font-bold tabular-nums text-gray-500 dark:text-zinc-400">{rows.length}</div>

      <BonsTable
        bons={rows}
        renderActions={(b) => {
          const editable = b.status !== 'saisi' && b.status !== 'annule'
          if (editable && can('bons.enter')) {
            return (
              <button onClick={() => router.push(`/ventes/bons/saisie?id=${b.id}`)} title={t('bon_enter_action')} className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-600">
                <Pencil className="h-3.5 w-3.5" />{t('bon_enter_action')}
              </button>
            )
          }
          return (
            <button onClick={() => router.push(`/ventes/bons/saisie?id=${b.id}`)} title={t('bon_view_action')} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10">
              <Eye className="h-4 w-4" />
            </button>
          )
        }}
      />
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
