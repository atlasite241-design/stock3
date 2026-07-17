'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Banknote, ShoppingBag, Truck, Wallet } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { fmtDH, useDroguerie, type Purchase } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

type Period = '7j' | '30j' | 'tout'

const STATUS_KEY: Record<Purchase['status'], TKey> = {
  en_attente: 'po_status_pending',
  partiellement_recue: 'po_status_partial',
  recue: 'po_status_received',
  retournee: 'po_status_returned',
}
const STATUS_CHIP: Record<Purchase['status'], string> = {
  en_attente: 'border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
  partiellement_recue: 'border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400',
  recue: 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  retournee: 'border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400',
}

function Content() {
  const { ready, purchases } = useDroguerie()
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
  const filtered = [...purchases]
    .filter((p) => period === 'tout' || new Date(p.date) >= cutoff(period === '7j' ? 6 : 29))
    .sort((a, b) => b.date.localeCompare(a.date))

  const total = filtered.reduce((a, p) => a + p.total, 0)
  const paid = filtered.reduce((a, p) => a + p.paid, 0)

  const cards = [
    { label: t('rpa_kpi_total'), value: fmtDH(total), icon: Wallet, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('rpa_kpi_count'), value: String(filtered.length), icon: ShoppingBag, cls: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
    { label: t('rpa_kpi_paid'), value: fmtDH(paid), icon: Banknote, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
    { label: t('rpa_kpi_remaining'), value: fmtDH(total - paid), icon: Truck, cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' },
  ]

  const periods: { key: Period; label: string }[] = [
    { key: '7j', label: t('rp_period_7d') },
    { key: '30j', label: t('rp_period_30d') },
    { key: 'tout', label: t('rp_period_all') },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('rpa_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('rpa_subtitle')}</p>
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
                <th className="px-5 py-3.5">{t('rpa_col_ref')}</th>
                <th className="px-5 py-3.5">{t('rp_col_date')}</th>
                <th className="px-5 py-3.5">{t('rpa_col_supplier')}</th>
                <th className="px-5 py-3.5">{t('rpa_col_total')}</th>
                <th className="px-5 py-3.5">{t('rpa_col_paid')}</th>
                <th className="px-5 py-3.5">{t('rpa_col_status')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((p) => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{p.ref}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">
                    {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-zinc-300">{p.supplierName}</td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(p.total)}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtDH(p.paid)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${STATUS_CHIP[p.status]}`}>{t(STATUS_KEY[p.status])}</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('rpa_none')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </>
  )
}

export default function RapportAchatsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
