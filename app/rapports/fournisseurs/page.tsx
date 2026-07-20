'use client'

import { motion } from 'framer-motion'
import Loader from '@/components/Loader'
import { AlertCircle, ShoppingBag, Truck } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, suppliers, purchases } = useDroguerie()
  const { t } = useLanguage()

  if (!ready) {
    return <Loader />
  }

  const orderCount = new Map<string, number>()
  purchases.forEach((p) => orderCount.set(p.supplierId, (orderCount.get(p.supplierId) ?? 0) + 1))

  const totalBought = suppliers.reduce((a, s) => a + s.totalPurchased, 0)
  const totalDebt = suppliers.reduce((a, s) => a + s.balance, 0)

  const cards = [
    { label: t('rpf_kpi_suppliers'), value: String(suppliers.length), icon: Truck, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('rpf_kpi_total_bought'), value: fmtDH(totalBought), icon: ShoppingBag, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
    { label: t('rpf_kpi_total_debt'), value: fmtDH(totalDebt), icon: AlertCircle, cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' },
  ]

  const sorted = [...suppliers].sort((a, b) => b.totalPurchased - a.totalPurchased)

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('rpf_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('rpf_subtitle')}</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
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
                <th className="px-5 py-3.5">{t('rpf_col_supplier')}</th>
                <th className="px-5 py-3.5">{t('rpf_col_orders')}</th>
                <th className="px-5 py-3.5">{t('rpf_col_total_bought')}</th>
                <th className="px-5 py-3.5">{t('rpf_col_balance')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white">{s.name}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">{orderCount.get(s.id) ?? 0}</td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(s.totalPurchased)}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold tabular-nums">
                    <span className={s.balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>{fmtDH(s.balance)}</span>
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

export default function RapportFournisseursPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
