'use client'

import { useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Printer, Search, Sparkles } from 'lucide-react'
import AppShell from '@/components/AppShell'
import EAN13, { ean13CheckDigit } from '@/components/EAN13'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

// Code-barres EAN-13 dérivé de façon déterministe depuis l'id du client
// (préfixe marocain 611 + 9 chiffres issus d'un hash + clé de contrôle).
function clientEan(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0
  const nine = String(h).padStart(9, '0').slice(-9)
  const base = '611' + nine
  return base + ean13CheckDigit(base)
}

function Content() {
  const { ready, clients, settings } = useDroguerie()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [qty, setQty] = useState<Record<string, number>>({})

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clients
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q) || (c.city ?? '').toLowerCase().includes(q))
      .map((c) => ({ c, code: clientEan(c.id) }))
  }, [clients, query])

  const setAll = (n: number) => {
    const next: Record<string, number> = {}
    rows.forEach(({ c }) => (next[c.id] = n))
    setQty(next)
  }

  const labels = rows.flatMap(({ c, code }) => {
    const n = qty[c.id] ?? 1
    return Array.from({ length: n }, (_, i) => ({ key: `${c.id}-${i}`, client: c, code }))
  })

  if (!ready) return <Loader />

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('vr_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('vr_subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setAll(1)} className="btn-secondary !h-9 text-xs">{t('vr_all_1')}</button>
          <button onClick={() => setAll(0)} className="btn-secondary !h-9 text-xs">{t('vr_all_0')}</button>
          <button onClick={() => window.print()} disabled={labels.length === 0} className="btn-primary disabled:opacity-50">
            <Printer className="h-4 w-4" />
            {t('vr_print')} ({labels.length})
          </button>
        </div>
      </motion.div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('vr_search')} className="input-field pl-10" />
      </div>

      {/* Clients table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('vr_col_client')}</th>
                <th className="px-5 py-3.5">{t('vr_col_code')}</th>
                <th className="px-5 py-3.5">{t('vr_col_barcode')}</th>
                <th className="px-5 py-3.5">{t('vr_col_labels')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, code }) => (
                <tr key={c.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {c.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image} alt={c.name} className="h-9 w-9 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-xs font-bold text-gray-900">
                          {c.name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{c.name}</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 tabular-nums">{c.phone || '—'}{c.city ? ` · ${c.city}` : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-600 dark:text-zinc-300 tabular-nums">{code}</td>
                  <td className="px-5 py-3"><EAN13 code={code} height={26} moduleWidth={1.3} /></td>
                  <td className="px-5 py-3">
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={qty[c.id] ?? 1}
                      onChange={(e) => setQty({ ...qty, [c.id]: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
                      className="input-field !h-9 w-24"
                    />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('vr_no_clients')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Labels preview / print area */}
      {labels.length > 0 && (
        <div>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-zinc-300">
            <Sparkles className="h-4 w-4 text-amber-500" />
            {t('vr_preview')}
          </p>
          <div className="print-area grid grid-cols-2 gap-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] p-4 sm:grid-cols-3 lg:grid-cols-4">
            {labels.map(({ key, client, code }) => (
              <div key={key} className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-gray-300 dark:border-white/15 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">{settings.storeName}</p>
                <p className="line-clamp-1 w-full text-xs font-semibold text-gray-900 dark:text-white">{client.name}</p>
                <EAN13 code={code} height={34} moduleWidth={1.4} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default function VenteRapidePage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
