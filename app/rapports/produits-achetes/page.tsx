'use client'

// Produits achetés : ce que vous commandez réellement, agrégé par article.
// Alimenté par les lignes des commandes fournisseurs réceptionnées.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, FileSpreadsheet, Printer, Search, Truck } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const PERIODS: { days: number; key: TKey }[] = [
  { days: 30, key: 'sk_var_p30' },
  { days: 90, key: 'sk_var_p90' },
  { days: 365, key: 'sk_var_p365' },
  { days: 0, key: 'sk_var_pall' },
]

function Content() {
  const { ready, purchases, activeStoreId, activeStore } = useDroguerie()
  const { t } = useLanguage()
  const [days, setDays] = useState(90)
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const since = days > 0 ? Date.now() - days * 86400000 : 0
    const m = new Map<string, { name: string; qty: number; amount: number; orders: number; suppliers: Set<string> }>()
    for (const p of purchases) {
      if (p.storeId && activeStoreId && p.storeId !== activeStoreId) continue
      // Seules les commandes réceptionnées constituent un achat effectif.
      if (p.status === 'en_attente') continue
      if (new Date(p.date).getTime() < since) continue
      for (const it of p.items ?? []) {
        const key = it.productId || it.name
        const e = m.get(key) ?? { name: it.name, qty: 0, amount: 0, orders: 0, suppliers: new Set<string>() }
        const q = Number(it.qty) || 0
        e.qty += q
        e.amount += q * (Number(it.cost) || 0)
        e.orders++
        e.suppliers.add(p.supplierName)
        m.set(key, e)
      }
    }
    const q = query.trim().toLowerCase()
    return [...m.values()]
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => b.amount - a.amount)
  }, [purchases, activeStoreId, days, query])

  if (!ready) return <Loader />

  const totalQty = rows.reduce((a, r) => a + r.qty, 0)
  const totalAmt = rows.reduce((a, r) => a + r.amount, 0)

  const headers = [t('sa_col_product'), t('cp_col_amount'), t('sk_val_qty'), t('rp_pa_orders'), t('nav_suppliers')]
  const data = () => rows.map((r) => [r.name, r.amount.toFixed(2), r.qty, r.orders, [...r.suppliers].join(' · ')])
  const exportCsv = () => {
    const csv = [headers, ...data()].map((x) => x.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'produits-achetes.csv'; a.click(); URL.revokeObjectURL(url)
  }
  const exportXlsx = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data()])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Achats'); XLSX.writeFile(wb, 'produits-achetes.xlsx')
  }

  return (
    <>
      <style>{`@media print { aside, header.app-header, .no-print { display:none !important } main { padding:0 !important } }`}</style>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Truck className="h-6 w-6 text-amber-500" />{t('rp_pa_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('rp_pa_sub')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button onClick={exportCsv} disabled={!rows.length} className="btn-secondary disabled:opacity-40"><Download className="h-4 w-4" />CSV</button>
          <button onClick={exportXlsx} disabled={!rows.length} className="btn-secondary disabled:opacity-40"><FileSpreadsheet className="h-4 w-4" />Excel</button>
          <button onClick={() => window.print()} disabled={!rows.length} className="btn-secondary disabled:opacity-40"><Printer className="h-4 w-4" />PDF</button>
        </div>
      </motion.div>

      <div className="glass-card flex flex-wrap items-center gap-3 p-3 no-print">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button key={p.days} onClick={() => setDays(p.days)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${days === p.days ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-zinc-300'}`}>
              {t(p.key)}
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('prod_search_placeholder')} className="input-field pl-9" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { v: rows.length.toLocaleString('fr-FR'), l: t('sa_col_product') },
          { v: totalQty.toLocaleString('fr-FR'), l: t('sk_val_qty') },
          { v: fmtDH(totalAmt), l: t('cp_col_amount') },
        ].map((s, i) => (
          <div key={i} className="glass-card p-4 text-center">
            <p className="text-xl font-extrabold tabular-nums text-gray-900 dark:text-white">{s.v}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-x-auto">
        {rows.length === 0 ? (
          <p className="p-12 text-center text-sm text-gray-500 dark:text-zinc-400">{t('rp_pa_empty')}</p>
        ) : (
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                <th className="px-4 py-3">{t('sa_col_product')}</th>
                <th className="px-4 py-3 text-center">{t('sk_val_qty')}</th>
                <th className="px-4 py-3 text-center">{t('rp_pa_orders')}</th>
                <th className="px-4 py-3">{t('nav_suppliers')}</th>
                <th className="px-4 py-3 text-right">{t('cp_col_amount')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map((r, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{r.name}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-gray-700 dark:text-zinc-200">{r.qty.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-gray-500">{r.orders}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-zinc-400">{[...r.suppliers].slice(0, 2).join(' · ')}{r.suppliers.size > 2 ? ' …' : ''}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">{fmtDH(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
