'use client'

import { useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { MapPin, PackageSearch, Printer, Search } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { availableStock, fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, activeStore, locationSortKey } = useDroguerie()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [onlyLocated, setOnlyLocated] = useState(false)

  // Produits sous le seuil (rupture ou faible), triés par emplacement physique.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products
      .filter((p) => availableStock(p) <= p.minStock)
      .filter((p) => !onlyLocated || p.emplacementComplet)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q) || (p.emplacementComplet ?? '').toLowerCase().includes(q))
      .sort((a, b) => locationSortKey(a).localeCompare(locationSortKey(b), 'fr') || a.name.localeCompare(b.name, 'fr'))
  }, [products, query, onlyLocated, locationSortKey])

  if (!ready) return <Loader />

  const needed = (stock: number, min: number) => Math.max(0, min - stock)

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4 no-print">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <PackageSearch className="h-6 w-6 text-amber-500" />
            {t('reappro_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('reappro_subtitle')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <button onClick={() => window.print()} disabled={rows.length === 0} className="btn-primary disabled:opacity-50">
          <Printer className="h-4 w-4" />
          {t('reappro_print')}
        </button>
      </motion.div>

      <div className="flex flex-wrap items-center gap-3 no-print">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('reappro_search')} className="input-field pl-10" />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-zinc-400">
          <input type="checkbox" checked={onlyLocated} onChange={(e) => setOnlyLocated(e.target.checked)} className="h-4 w-4 accent-amber-500" />
          {t('reappro_only_located')}
        </label>
        <span className="ml-auto text-sm font-semibold text-gray-500 dark:text-zinc-400 tabular-nums">{rows.length} {t('reappro_count')}</span>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card print-area overflow-hidden">
        <div className="hidden print:block px-5 pt-4 text-lg font-bold">{t('reappro_title')} — {activeStore?.name}</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3">{t('wms_emplacement')}</th>
                <th className="px-5 py-3">{t('reappro_col_product')}</th>
                <th className="px-5 py-3 text-center">{t('reappro_col_stock')}</th>
                <th className="px-5 py-3 text-center">{t('reappro_col_min')}</th>
                <th className="px-5 py-3 text-center">{t('reappro_col_needed')}</th>
                <th className="px-5 py-3 text-right">{t('reappro_col_cost')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map((p) => {
                const s = availableStock(p)
                return (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 dark:border-white/5 hover:bg-amber-50/40 dark:hover:bg-white/5">
                    <td className="px-5 py-2.5">
                      {p.emplacementComplet
                        ? <span className="flex items-center gap-1 font-mono text-xs text-amber-600 dark:text-amber-400"><MapPin className="h-3 w-3" />{p.emplacementComplet}</span>
                        : <span className="text-xs text-gray-300 dark:text-zinc-600">{t('reappro_no_location')}</span>}
                    </td>
                    <td className="px-5 py-2.5">
                      <p className="font-semibold text-gray-900 dark:text-white">{p.name}</p>
                      <p className="font-mono text-[11px] text-gray-400 dark:text-zinc-500">{p.barcode || '—'}</p>
                    </td>
                    <td className={`px-5 py-2.5 text-center font-bold tabular-nums ${s === 0 ? 'text-rose-500' : 'text-amber-500'}`}>{s}</td>
                    <td className="px-5 py-2.5 text-center tabular-nums text-gray-500 dark:text-zinc-400">{p.minStock}</td>
                    <td className="px-5 py-2.5 text-center font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+{needed(s, p.minStock)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-gray-600 dark:text-zinc-400">{fmtDH(needed(s, p.minStock) * p.cost)}</td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('reappro_none')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Le tableau est plafonné pour ne pas figer le navigateur ; le dire
            évite de prendre une liste tronquée pour la liste complète. */}
        {rows.length > 300 && (
          <p className="border-t border-gray-100 px-4 py-2 text-center text-[11px] text-gray-400 dark:border-white/10 dark:text-zinc-500">
            300 / {rows.length.toLocaleString('fr-FR')} — {t('rpst_capped')}
          </p>
        )}
      </motion.div>
    </>
  )
}

export default function ReapproPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
