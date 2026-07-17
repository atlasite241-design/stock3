'use client'

import { motion } from 'framer-motion'
import { Lock, Printer } from 'lucide-react'
import AppShell from '@/components/AppShell'
import ClosureSummary from '@/components/ClosureSummary'
import { fmtDH, PAYMENT_META, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, sessions, sales, cash } = useDroguerie()
  const { t } = useLanguage()

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const lastClosed = [...sessions].filter((s) => s.closedAt).sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))[0]

  if (!lastClosed) {
    return (
      <>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('fdj_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('fdj_subtitle')}</p>
        </motion.div>
        <div className="glass-card flex flex-col items-center gap-3 p-10 text-center">
          <Lock className="h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500 dark:text-zinc-400">{t('fdj_no_session')}</p>
        </div>
      </>
    )
  }

  const since = lastClosed.openedAt
  const until = lastClosed.closedAt ?? new Date().toISOString()
  const inWindow = (d: string) => d >= since && d <= until

  const sessionSales = sales.filter((s) => inWindow(s.date)).sort((a, b) => b.date.localeCompare(a.date))
  const sessionCash = cash.filter((c) => inWindow(c.date))

  const dt = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const hm = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('fdj_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('fdj_opened_at')} {dt(since)} · {t('fdj_closed_at')} {dt(until)}
          </p>
        </div>
        <button onClick={() => window.print()} className="btn-secondary">
          <Printer className="h-4 w-4" />
          {t('fdj_print')}
        </button>
      </motion.div>

      <div className="print-area grid items-start gap-6 lg:grid-cols-2">
        {/* Breakdown */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card overflow-hidden">
          <div className="border-b border-gray-100 dark:border-white/10 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('fdj_breakdown')}</h2>
          </div>
          <ClosureSummary session={lastClosed} />
        </motion.div>

        {/* Operations */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card overflow-hidden">
          <div className="border-b border-gray-100 dark:border-white/10 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('fdj_operations')}</h2>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  <th className="px-4 py-2.5">{t('fdj_col_time')}</th>
                  <th className="px-4 py-2.5">{t('cj_col_label')}</th>
                  <th className="px-4 py-2.5 text-right">{t('fdj_col_total')}</th>
                </tr>
              </thead>
              <tbody>
                {sessionCash.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 dark:border-white/5">
                    <td className="px-4 py-2 text-gray-500 dark:text-zinc-400">{hm(c.date)}</td>
                    <td className="px-4 py-2 text-gray-800 dark:text-zinc-100">{c.label}</td>
                    <td className={`px-4 py-2 text-right font-semibold tabular-nums ${c.type === 'recette' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                      {c.type === 'recette' ? '+' : '−'}
                      {fmtDH(c.amount)}
                    </td>
                  </tr>
                ))}
                {sessionCash.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-xs text-gray-400 dark:text-zinc-500">{t('fdj_none_ops')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Sales of the session */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }} className="glass-card overflow-hidden lg:col-span-2">
          <div className="border-b border-gray-100 dark:border-white/10 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('fdj_sales')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  <th className="px-5 py-2.5">{t('fdj_col_time')}</th>
                  <th className="px-5 py-2.5">{t('fdj_col_ref')}</th>
                  <th className="px-5 py-2.5">{t('fac_col_client')}</th>
                  <th className="px-5 py-2.5">{t('fdj_col_mode')}</th>
                  <th className="px-5 py-2.5 text-right">{t('fdj_col_total')}</th>
                </tr>
              </thead>
              <tbody>
                {sessionSales.slice(0, 100).map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 dark:border-white/5">
                    <td className="px-5 py-2 text-gray-500 dark:text-zinc-400">{hm(s.date)}</td>
                    <td className="px-5 py-2 font-mono text-xs text-gray-600 dark:text-zinc-400">#{s.id.slice(-5).toUpperCase()}</td>
                    <td className="px-5 py-2 text-gray-700 dark:text-zinc-300">{s.clientName ?? '—'}</td>
                    <td className="px-5 py-2">
                      <span className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${PAYMENT_META[s.payment].chip}`}>{PAYMENT_META[s.payment].label}</span>
                    </td>
                    <td className="px-5 py-2 text-right font-semibold text-gray-900 dark:text-white tabular-nums">{fmtDH(s.total)}</td>
                  </tr>
                ))}
                {sessionSales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-xs text-gray-400 dark:text-zinc-500">{t('fdj_none_sales')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </>
  )
}

export default function FinJourneePage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
