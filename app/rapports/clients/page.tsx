'use client'

import { motion } from 'framer-motion'
import { CreditCard, Users, Wallet } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, clients } = useDroguerie()
  const { t } = useLanguage()

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const totalSpent = clients.reduce((a, c) => a + c.totalSpent, 0)
  const totalCredit = clients.reduce((a, c) => a + c.credit, 0)

  const cards = [
    { label: t('rpc_kpi_clients'), value: String(clients.length), icon: Users, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('rpc_kpi_total_spent'), value: fmtDH(totalSpent), icon: Wallet, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
    { label: t('rpc_kpi_total_credit'), value: fmtDH(totalCredit), icon: CreditCard, cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' },
  ]

  const sorted = [...clients].sort((a, b) => b.totalSpent - a.totalSpent)

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('rpc_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('rpc_subtitle')}</p>
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
                <th className="px-5 py-3.5">{t('rpc_col_client')}</th>
                <th className="px-5 py-3.5">{t('rpc_col_city')}</th>
                <th className="px-5 py-3.5">{t('rpc_col_spent')}</th>
                <th className="px-5 py-3.5">{t('rpc_col_points')}</th>
                <th className="px-5 py-3.5">{t('rpc_col_credit')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white">{c.name}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">{c.city}</td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(c.totalSpent)}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-zinc-300 tabular-nums">{c.points}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold tabular-nums">
                    <span className={c.credit > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>{fmtDH(c.credit)}</span>
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

export default function RapportClientsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
