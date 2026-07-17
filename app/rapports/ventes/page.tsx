'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Receipt, ShoppingCart, TrendingUp, Wallet } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { exportSalesCSV, fmtDH, PAYMENT_META, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

type Period = '7j' | '30j' | 'tout'

function Content() {
  const { ready, sales } = useDroguerie()
  const { t } = useLanguage()
  const [period, setPeriod] = useState<Period>('30j')

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const now = new Date()
  const cutoff = (days: number) => {
    const d = new Date()
    d.setDate(now.getDate() - days)
    return d
  }
  const filtered = [...sales]
    .filter((s) => period === 'tout' || new Date(s.date) >= cutoff(period === '7j' ? 6 : 29))
    .sort((a, b) => b.date.localeCompare(a.date))

  const ca = filtered.reduce((a, s) => a + s.total, 0)
  const profit = filtered.reduce((a, s) => a + s.profit, 0)
  const avgBasket = filtered.length > 0 ? ca / filtered.length : 0

  const cards = [
    { label: t('rps_kpi_revenue'), value: fmtDH(ca), icon: Wallet, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('rps_kpi_count'), value: String(filtered.length), icon: ShoppingCart, cls: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
    { label: t('rps_kpi_avg_basket'), value: fmtDH(avgBasket), icon: Receipt, cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400' },
    { label: t('rps_kpi_profit'), value: fmtDH(profit), icon: TrendingUp, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
  ]

  const periods: { key: Period; label: string }[] = [
    { key: '7j', label: t('rp_period_7d') },
    { key: '30j', label: t('rp_period_30d') },
    { key: 'tout', label: t('rp_period_all') },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('rps_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('rps_subtitle')}</p>
        </div>
        <button onClick={() => exportSalesCSV(filtered)} className="btn-secondary">
          <Download className="h-4 w-4" />
          {t('rp_export_csv')}
        </button>
      </motion.div>

      <div className="flex flex-wrap gap-2">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              period === p.key
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-lg shadow-amber-400/25'
                : 'border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 hover:border-amber-300 hover:bg-amber-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

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

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('rp_col_date')}</th>
                <th className="px-5 py-3.5">{t('rps_col_client')}</th>
                <th className="px-5 py-3.5">{t('rps_col_payment')}</th>
                <th className="px-5 py-3.5">{t('rps_col_total')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((s) => (
                <tr key={s.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">
                    {new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">{s.clientName ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${PAYMENT_META[s.payment].chip}`}>{PAYMENT_META[s.payment].label}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(s.total)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('rps_none')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </>
  )
}

export default function RapportVentesPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
