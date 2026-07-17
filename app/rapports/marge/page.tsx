'use client'

import { motion } from 'framer-motion'
import { Percent, TrendingUp } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products } = useDroguerie()
  const { t } = useLanguage()

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const rows = products
    .map((p) => {
      const marginDh = p.price - p.cost
      const marginPct = p.price > 0 ? (marginDh / p.price) * 100 : 0
      return { ...p, marginDh, marginPct }
    })
    .sort((a, b) => b.marginPct - a.marginPct)

  const avgMargin = rows.length > 0 ? rows.reduce((a, r) => a + r.marginPct, 0) / rows.length : 0
  const totalMarginValue = rows.reduce((a, r) => a + r.marginDh * r.stock, 0)

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
              {rows.map((p) => (
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
