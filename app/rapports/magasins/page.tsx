'use client'

// Performances par magasin : comparer les points de vente sur une même période.
// Cet écran ignore volontairement le magasin actif — c'est le seul endroit où
// l'on veut voir TOUS les magasins côte à côte.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, Download } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import { availableStock, fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const PERIODS: { days: number; key: TKey }[] = [
  { days: 30, key: 'sk_var_p30' },
  { days: 90, key: 'sk_var_p90' },
  { days: 365, key: 'sk_var_p365' },
  { days: 0, key: 'sk_var_pall' },
]

function Content() {
  const { ready, stores, sales, products, activeStoreId } = useDroguerie()
  const { t } = useLanguage()
  const [days, setDays] = useState(30)

  const rows = useMemo(() => {
    const since = days > 0 ? Date.now() - days * 86400000 : 0
    return stores.map((st) => {
      const mine = sales.filter((s) => (s.storeId ?? '') === st.id && new Date(s.date).getTime() >= since)
      const revenue = mine.reduce((a, s) => a + s.total, 0)
      const profit = mine.reduce((a, s) => a + s.profit, 0)
      const stock = products
        .filter((p) => (p.storeId ?? '') === st.id)
        .reduce((a, p) => a + availableStock(p) * p.cost, 0)
      const refs = products.filter((p) => (p.storeId ?? '') === st.id).length
      return {
        id: st.id, name: st.name, sales: mine.length, revenue, profit, stock, refs,
        margin: revenue ? Math.round((profit / revenue) * 100) : 0,
        basket: mine.length ? revenue / mine.length : 0,
      }
    }).sort((a, b) => b.revenue - a.revenue)
  }, [stores, sales, products, days])

  if (!ready) return <Loader />

  const best = rows[0]?.revenue ?? 0
  const exportCsv = () => {
    const csv = [[t('mag_name'), t('rp_mg_sales'), t('rp_mg_revenue'), t('rp_mg_profit'), t('rp_mg_margin'), t('rp_mg_basket'), t('rp_mg_stock')],
      ...rows.map((r) => [r.name, r.sales, r.revenue.toFixed(2), r.profit.toFixed(2), r.margin, r.basket.toFixed(2), r.stock.toFixed(2)])]
      .map((x) => x.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'performances-magasins.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Building2 className="h-6 w-6 text-amber-500" />{t('rp_mg_title')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">{t('rp_mg_sub')}</p>
        </div>
        <button onClick={exportCsv} disabled={!rows.length} className="btn-secondary disabled:opacity-40"><Download className="h-4 w-4" />CSV</button>
      </motion.div>

      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button key={p.days} onClick={() => setDays(p.days)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${days === p.days ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-zinc-300'}`}>
            {t(p.key)}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
              <th className="px-4 py-3">{t('mag_name')}</th>
              <th className="px-4 py-3 text-center">{t('rp_mg_sales')}</th>
              <th className="px-4 py-3 text-right">{t('rp_mg_revenue')}</th>
              <th className="px-4 py-3 text-right">{t('rp_mg_profit')}</th>
              <th className="px-4 py-3 text-center">{t('rp_mg_margin')}</th>
              <th className="px-4 py-3 text-right">{t('rp_mg_basket')}</th>
              <th className="px-4 py-3 text-right">{t('rp_mg_stock')}</th>
              <th className="px-4 py-3">{t('rp_vd_share')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-b border-gray-50 last:border-0 dark:border-white/5 ${r.id === activeStoreId ? 'bg-amber-50/40 dark:bg-amber-500/[0.06]' : ''}`}>
                <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">
                  {r.name}
                  <span className="ml-1.5 text-[10px] text-gray-400">{r.refs.toLocaleString('fr-FR')} {t('sk_val_short_refs')}</span>
                </td>
                <td className="px-4 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{r.sales}</td>
                <td className="px-4 py-2.5 text-right font-bold tabular-nums text-gray-900 dark:text-white">{fmtDH(r.revenue)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmtDH(r.profit)}</td>
                <td className="px-4 py-2.5 text-center tabular-nums text-gray-500">{r.margin}%</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{fmtDH(r.basket)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-indigo-600 dark:text-indigo-400">{fmtDH(r.stock)}</td>
                <td className="px-4 py-2.5">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${best ? Math.round((r.revenue / best) * 100) : 0}%` }} />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">{t('wr_empty')}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
