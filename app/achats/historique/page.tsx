'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Package, ShoppingBag, Truck, Wallet } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Select from '@/components/Select'
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
  const { ready, purchases, suppliers } = useDroguerie()
  const { t } = useLanguage()
  const [period, setPeriod] = useState<Period>('30j')
  const [supplierFilter, setSupplierFilter] = useState('Tous')

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const now = new Date()
  const cutoff = (days: number) => {
    const d = new Date()
    d.setDate(now.getDate() - days)
    return d
  }

  const filtered = purchases
    .filter((p) => {
      if (period === 'tout') return true
      return new Date(p.date) >= cutoff(period === '7j' ? 6 : 29)
    })
    .filter((p) => supplierFilter === 'Tous' || p.supplierName === supplierFilter)
    .sort((a, b) => b.date.localeCompare(a.date))

  const totalAchete = filtered.reduce((a, p) => a + p.total, 0)
  const totalPaye = filtered.reduce((a, p) => a + p.paid, 0)
  const totalDu = totalAchete - totalPaye

  const exportCSV = () => {
    const rows = [['Référence', 'Date', 'Fournisseur', 'Articles', 'Total', 'Payé', 'Statut']]
    filtered.forEach((p) =>
      rows.push([
        p.ref,
        new Date(p.date).toLocaleDateString('fr-FR'),
        p.supplierName,
        String(p.items.reduce((a, i) => a + i.qty, 0)),
        p.total.toFixed(2),
        p.paid.toFixed(2),
        t(STATUS_KEY[p.status]),
      ])
    )
    const csv = rows.map((r) => r.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'historique-achats.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const periods: { key: Period; label: string }[] = [
    { key: '7j', label: t('poh_period_7d') },
    { key: '30j', label: t('poh_period_30d') },
    { key: 'tout', label: t('poh_period_all') },
  ]

  const cards = [
    { label: t('poh_total_bought'), value: fmtDH(totalAchete), icon: ShoppingBag, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('poh_total_paid'), value: fmtDH(totalPaye), icon: Wallet, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
    { label: t('poh_remaining'), value: fmtDH(totalDu), icon: Truck, cls: totalDu > 0 ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('poh_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('poh_subtitle')}</p>
        </div>
        <button onClick={exportCSV} className="btn-secondary">
          <Download className="h-4 w-4" />
          {t('poh_export_csv')}
        </button>
      </motion.div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                period === p.key
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-lg shadow-amber-400/25'
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:bg-amber-50 dark:border-white/10 dark:bg-[#12121a] dark:text-zinc-400 dark:hover:bg-white/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Select
          value={supplierFilter}
          onChange={setSupplierFilter}
          options={[{ value: 'Tous', label: t('poh_all_suppliers') }, ...suppliers.map((s) => ({ value: s.name, label: s.name }))]}
          className="w-auto min-w-[220px]"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
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
            <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
              {c.value}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('poh_col_ref')}</th>
                <th className="px-5 py-3.5">{t('poh_col_date')}</th>
                <th className="px-5 py-3.5">{t('poh_col_supplier')}</th>
                <th className="px-5 py-3.5">{t('poh_col_items')}</th>
                <th className="px-5 py-3.5">{t('poh_col_total')}</th>
                <th className="px-5 py-3.5">{t('poh_col_paid')}</th>
                <th className="px-5 py-3.5">{t('poh_col_status')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-500">
                        <Package className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{p.ref}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">
                    {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-zinc-300">{p.supplierName}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">
                    {p.items.reduce((a, i) => a + i.qty, 0)}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(p.total)}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtDH(p.paid)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${STATUS_CHIP[p.status]}`}>
                      {t(STATUS_KEY[p.status])}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('poh_none_in_period')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </>
  )
}

export default function HistoriqueAchatsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
