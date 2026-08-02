'use client'

// Rapport du stock.
//
// Cet écran rendait UNE LIGNE PAR PRODUIT, sans limite : avec un catalogue de
// 86 000 références, le navigateur figeait sur « Page ne répondant pas ». Un
// tableau HTML ne tient pas 86 000 lignes. On affiche donc une page à la fois,
// avec recherche et filtre ; l'export contient l'intégralité.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Loader from '@/components/Loader'
import { AlertTriangle, Boxes, Download, FileSpreadsheet, PackageX, Search, TrendingUp } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { fmtDH, useDroguerie, type Product } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const PAGE = 100

type Status = 'ok' | 'low' | 'out'
const statusOf = (p: Product): Status => (p.stock === 0 ? 'out' : p.stock <= p.minStock ? 'low' : 'ok')

const FILTERS: { value: Status | 'all'; key: TKey }[] = [
  { value: 'all', key: 'sk_var_pall' },
  { value: 'out', key: 'rpst_status_out' },
  { value: 'low', key: 'rpst_status_low' },
  { value: 'ok', key: 'rpst_status_ok' },
]

function Content() {
  const { ready, products } = useDroguerie()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status | 'all'>('all')
  const [shown, setShown] = useState(PAGE)

  // Les totaux parcourent tout le catalogue : une seule passe, mémorisée.
  // Sans useMemo, trois parcours de 86 000 produits repartaient à chaque frappe
  // dans le champ de recherche.
  const totals = useMemo(() => {
    let value = 0, out = 0, low = 0
    for (const p of products) {
      value += p.cost * p.stock
      const s = statusOf(p)
      if (s === 'out') out++
      else if (s === 'low') low++
    }
    return { value, out, low }
  }, [products])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = products.filter(
      (p) =>
        (status === 'all' || statusOf(p) === status) &&
        (!q || p.name.toLowerCase().includes(q) || p.barcode.includes(q) || (p.category ?? '').toLowerCase().includes(q))
    )
    return list.sort((a, b) => a.stock - b.stock)
  }, [products, query, status])

  if (!ready) return <Loader />

  const STATUS_LABEL: Record<Status, string> = { ok: t('rpst_status_ok'), low: t('rpst_status_low'), out: t('rpst_status_out') }
  const STATUS_CHIP: Record<Status, string> = {
    ok: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    low: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    out: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
  }

  const cards = [
    { label: t('rpst_kpi_value'), value: fmtDH(totals.value), icon: TrendingUp, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
    { label: t('rpst_kpi_products'), value: products.length.toLocaleString('fr-FR'), icon: Boxes, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('rpst_kpi_out_of_stock'), value: totals.out.toLocaleString('fr-FR'), icon: PackageX, cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' },
    { label: t('rpst_kpi_low_stock'), value: totals.low.toLocaleString('fr-FR'), icon: AlertTriangle, cls: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  ]

  // L'export porte sur la SÉLECTION complète, pas seulement sur ce qui est affiché.
  const sheet = () => [
    [t('rpst_col_product'), t('rpst_col_category'), t('rpst_col_stock'), t('rpst_col_min'), t('rpst_col_value'), t('rpst_col_status')],
    ...rows.map((p) => [p.name, p.category ?? '', p.stock, p.minStock, (p.cost * p.stock).toFixed(2), STATUS_LABEL[statusOf(p)]]),
  ]
  const exportCsv = () => {
    const csv = sheet().map((l) => l.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'rapport-stock.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  const exportXlsx = async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet()), 'Stock')
    XLSX.writeFile(wb, 'rapport-stock.xlsx')
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('rpst_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('rpst_subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} disabled={!rows.length} className="btn-secondary disabled:opacity-40"><Download className="h-4 w-4" />CSV</button>
          <button onClick={exportXlsx} disabled={!rows.length} className="btn-secondary disabled:opacity-40"><FileSpreadsheet className="h-4 w-4" />Excel</button>
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.4 }} className="glass-card glass-card-hover p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.cls}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{c.label}</p>
            <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">{c.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="glass-card flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 rtl:left-auto rtl:right-3" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShown(PAGE) }}
            placeholder={t('prod_search_placeholder')}
            className="input-field pl-9 rtl:pl-3 rtl:pr-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatus(f.value); setShown(PAGE) }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                status === f.value ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-zinc-300'
              }`}
            >
              {t(f.key)}
            </button>
          ))}
        </div>
        <span className="text-xs font-semibold tabular-nums text-gray-500 dark:text-zinc-400">
          {rows.length.toLocaleString('fr-FR')}
        </span>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('rpst_col_product')}</th>
                <th className="px-5 py-3.5">{t('rpst_col_category')}</th>
                <th className="px-5 py-3.5">{t('rpst_col_stock')}</th>
                <th className="px-5 py-3.5">{t('rpst_col_min')}</th>
                <th className="px-5 py-3.5">{t('rpst_col_value')}</th>
                <th className="px-5 py-3.5">{t('rpst_col_status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((p) => {
                const s = statusOf(p)
                return (
                  <tr key={p.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                    <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white">{p.name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">{p.category}</td>
                    <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{p.stock}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-zinc-400 tabular-nums">{p.minStock}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-zinc-300 tabular-nums">{fmtDH(p.cost * p.stock)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-lg px-2 py-1 text-xs font-bold ${STATUS_CHIP[s]}`}>{STATUS_LABEL[s]}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <p className="p-12 text-center text-sm text-gray-500 dark:text-zinc-400">{t('rpst_empty')}</p>
        )}

        {rows.length > shown && (
          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-gray-100 p-4 dark:border-white/10">
            <span className="text-xs tabular-nums text-gray-500 dark:text-zinc-400">
              {shown.toLocaleString('fr-FR')} / {rows.length.toLocaleString('fr-FR')}
            </span>
            <button onClick={() => setShown((n) => n + PAGE * 5)} className="btn-secondary">{t('rpst_more')}</button>
          </div>
        )}
      </motion.div>
    </>
  )
}

export default function RapportStockPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
