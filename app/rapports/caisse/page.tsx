'use client'

import { motion } from 'framer-motion'
import Loader from '@/components/Loader'
import { Lock, Unlock, Wallet } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, sessions, currentSession, expectedCash } = useDroguerie()
  const { t } = useLanguage()

  if (!ready) {
    return <Loader />
  }

  const closedSessions = [...sessions].filter((s) => s.closedAt).sort((a, b) => b.openedAt.localeCompare(a.openedAt))

  const cards = [
    {
      label: t('rpca_kpi_status'),
      value: currentSession ? t('rpca_status_open') : t('rpca_status_closed'),
      icon: currentSession ? Unlock : Lock,
      cls: currentSession
        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400'
        : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-zinc-400',
    },
    {
      label: t('rpca_kpi_expected'),
      value: currentSession ? fmtDH(expectedCash(currentSession)) : '—',
      icon: Wallet,
      cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500',
    },
    { label: t('rpca_kpi_sessions'), value: String(sessions.length), icon: Wallet, cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400' },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('rpca_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('rpca_subtitle')}</p>
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
                <th className="px-5 py-3.5">{t('rpca_col_opening')}</th>
                <th className="px-5 py-3.5">{t('rpca_col_closing')}</th>
                <th className="px-5 py-3.5">{t('rpca_col_expected')}</th>
                <th className="px-5 py-3.5">{t('rpca_col_counted')}</th>
                <th className="px-5 py-3.5">{t('rpca_col_diff')}</th>
              </tr>
            </thead>
            <tbody>
              {closedSessions.map((s) => {
                const diff = (s.closingAmount ?? 0) - (s.expectedAmount ?? 0)
                return (
                  <tr key={s.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                    <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">
                      {new Date(s.openedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">
                      {s.closedAt ? new Date(s.closedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-zinc-300 tabular-nums">{fmtDH(s.expectedAmount ?? 0)}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{fmtDH(s.closingAmount ?? 0)}</td>
                    <td className="px-5 py-3.5 text-sm font-bold tabular-nums">
                      <span className={diff === 0 ? 'text-emerald-600 dark:text-emerald-400' : diff > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'}>
                        {fmtDH(diff)}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {closedSessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('rpca_none')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </>
  )
}

export default function RapportCaissePage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
