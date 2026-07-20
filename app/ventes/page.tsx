'use client'

import { useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Download, Eye, Receipt, ShoppingCart, TrendingUp, Wallet } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { exportSalesCSV, fmtDH, PAYMENT_META, useDroguerie, type Sale } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

type Period = 'jour' | '7j' | '30j' | 'tout'

function VentesContent() {
  const { ready, sales } = useDroguerie()
  const { t } = useLanguage()
  const [period, setPeriod] = useState<Period>('7j')
  const [detail, setDetail] = useState<Sale | null>(null)

  if (!ready) {
    return <Loader />
  }

  const now = new Date()
  const cutoff = (days: number) => {
    const d = new Date()
    d.setDate(now.getDate() - days)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const filtered = sales
    .filter((s) => {
      const d = new Date(s.date)
      if (period === 'jour') return d.toDateString() === now.toDateString()
      if (period === '7j') return d >= cutoff(6)
      if (period === '30j') return d >= cutoff(29)
      return true
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  const ca = filtered.reduce((a, s) => a + s.total, 0)
  const profit = filtered.reduce((a, s) => a + s.profit, 0)
  const panierMoyen = filtered.length > 0 ? ca / filtered.length : 0

  const cards = [
    { label: t('vh_kpi_revenue'), value: fmtDH(ca), icon: Wallet, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('vh_kpi_count'), value: String(filtered.length), icon: ShoppingCart, cls: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
    { label: t('vh_kpi_avg_basket'), value: fmtDH(panierMoyen), icon: Receipt, cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400' },
    { label: t('vh_kpi_profit'), value: fmtDH(profit), icon: TrendingUp, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
  ]

  const periods: { key: Period; label: string }[] = [
    { key: 'jour', label: t('vh_period_today') },
    { key: '7j', label: t('vh_period_7d') },
    { key: '30j', label: t('vh_period_30d') },
    { key: 'tout', label: t('vh_period_all') },
  ]

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('vh_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('vh_subtitle')}</p>
        </div>
        <button onClick={() => exportSalesCSV(filtered)} className="btn-secondary">
          <Download className="h-4 w-4" />
          {t('vh_export_csv')}
        </button>
      </motion.div>

      {/* Period filter */}
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

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.4 }}
            className="glass-card glass-card-hover p-5"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.cls}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{c.label}</p>
            <p className="mt-1 text-[24px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
              {c.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('vh_col_date')}</th>
                <th className="px-5 py-3.5">{t('vh_col_items')}</th>
                <th className="px-5 py-3.5">{t('vh_col_client')}</th>
                <th className="px-5 py-3.5">{t('vh_col_payment')}</th>
                <th className="px-5 py-3.5">{t('vh_col_total')}</th>
                <th className="px-5 py-3.5 text-right">{t('vh_col_details')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="group border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">
                      {new Date(s.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">
                    {s.items.reduce((a, i) => a + i.qty, 0)} {t('pos_article_count')}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">{s.clientName ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${PAYMENT_META[s.payment].chip}`}>
                      {PAYMENT_META[s.payment].label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                    {fmtDH(s.total)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end">
                      <button
                        onClick={() => setDetail(s)}
                        className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-400"
                        title={t('vh_view_detail')}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('vh_none_in_period')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={t('vh_detail_title')} maxWidth="max-w-sm">
        {detail && (
          <>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              {new Date(detail.date).toLocaleString('fr-FR')}
              {detail.clientName ? ` — ${detail.clientName}` : ''}
            </p>
            <div className="mt-3 space-y-2">
              {detail.items.map((i) => (
                <div
                  key={i.productId}
                  className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{i.name}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 tabular-nums">
                      {i.qty} × {fmtDH(i.price)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                    {fmtDH(i.price * i.qty)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1 rounded-xl bg-gradient-to-r from-amber-50 dark:from-amber-500/10 to-yellow-50 dark:to-yellow-500/5 p-4">
              <div className="flex justify-between text-sm text-gray-600 dark:text-zinc-400">
                <span>{t('vh_payment')}</span>
                <span className="font-semibold">{PAYMENT_META[detail.payment].label}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-zinc-400">
                <span>{t('vh_profit')}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtDH(detail.profit)}</span>
              </div>
              <div className="flex justify-between pt-1 text-base font-bold text-gray-900 dark:text-white">
                <span>{t('vh_total')}</span>
                <span className="tabular-nums">{fmtDH(detail.total)}</span>
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

export default function VentesPage() {
  return (
    <AppShell>
      <VentesContent />
    </AppShell>
  )
}
