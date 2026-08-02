'use client'

// Comme le rapport du stock, cet écran rendait une ligne par produit sans
// limite — impraticable au-delà de quelques milliers de références. Recherche +
// pagination ; les indicateurs, eux, portent toujours sur tout le catalogue.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Loader from '@/components/Loader'
import { Percent, Search, TrendingUp } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const PAGE = 100

function Content() {
  const { ready, products } = useDroguerie()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)

  // On ne clone plus chaque produit (`...p`) : 86 000 copies d'objet par rendu
  // pour deux champs calculés. Seuls les champs utiles sont retenus.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out = []
    for (const p of products) {
      if (q && !p.name.toLowerCase().includes(q) && !p.barcode.includes(q)) continue
      const marginDh = p.price - p.cost
      out.push({
        id: p.id, name: p.name, cost: p.cost, price: p.price, stock: p.stock,
        marginDh,
        marginPct: p.price > 0 ? (marginDh / p.price) * 100 : 0,
      })
    }
    return out.sort((a, b) => b.marginPct - a.marginPct)
  }, [products, query])

  const totals = useMemo(() => {
    let sumPct = 0, value = 0, n = 0
    for (const p of products) {
      const marginDh = p.price - p.cost
      sumPct += p.price > 0 ? (marginDh / p.price) * 100 : 0
      value += marginDh * p.stock
      n++
    }
    return { avg: n ? sumPct / n : 0, value }
  }, [products])

  if (!ready) {
    return <Loader />
  }

  const avgMargin = totals.avg
  const totalMarginValue = totals.value

  const cards = [
    { label: t('rpm_kpi_avg_margin'), value: `${avgMargin.toFixed(1)}%`, icon: Percent, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('rpm_kpi_total_margin_value'), value: fmtDH(totalMarginValue), icon: TrendingUp, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('rpm_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('rpm_subtitle')}</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
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
        <span className="text-xs font-semibold tabular-nums text-gray-500 dark:text-zinc-400">
          {rows.length.toLocaleString('fr-FR')}
        </span>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('rpm_col_product')}</th>
                <th className="px-5 py-3.5">{t('rpm_col_cost')}</th>
                <th className="px-5 py-3.5">{t('rpm_col_price')}</th>
                <th className="px-5 py-3.5">{t('rpm_col_margin_dh')}</th>
                <th className="px-5 py-3.5">{t('rpm_col_margin_pct')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((p) => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white">{p.name}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">{fmtDH(p.cost)}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-zinc-300 tabular-nums">{fmtDH(p.price)}</td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(p.marginDh)}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-lg px-2 py-1 text-xs font-bold ${
                        p.marginPct >= 30
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : p.marginPct >= 15
                          ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {p.marginPct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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

export default function RapportMargePage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
