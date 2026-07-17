'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Archive, ChevronRight, Printer, X } from 'lucide-react'
import AppShell from '@/components/AppShell'
import ClosureSummary from '@/components/ClosureSummary'
import Modal from '@/components/Modal'
import { fmtDH, PAYMENT_META, sessionExpected, computeSessionSummary, useDroguerie, type RegisterSession } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, sessions, sales, cash, clientPayments } = useDroguerie()
  const { t } = useLanguage()
  const [dateFilter, setDateFilter] = useState('')
  const [selected, setSelected] = useState<RegisterSession | null>(null)

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const dayKey = (iso: string) => iso.slice(0, 10)
  const closed = [...sessions]
    .filter((s) => s.closedAt)
    .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))

  const filtered = dateFilter ? closed.filter((s) => dayKey(s.closedAt!) === dateFilter) : closed

  const dt = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const hm = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const day = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  const gapOf = (s: RegisterSession) => {
    const sum = s.summary ?? computeSessionSummary(s, sales, cash, clientPayments)
    return (s.closingAmount ?? 0) - sessionExpected(s, sum)
  }

  const detailWindow = (s: RegisterSession) => {
    const since = s.openedAt
    const until = s.closedAt ?? new Date().toISOString()
    const inW = (d: string) => d >= since && d <= until
    return {
      ops: cash.filter((c) => inW(c.date)).sort((a, b) => a.date.localeCompare(b.date)),
      sess: sales.filter((x) => inW(x.date)).sort((a, b) => b.date.localeCompare(a.date)),
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('arc_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('arc_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="input-field h-10 w-44"
            aria-label={t('arc_pick_date')}
          />
          {dateFilter && (
            <button onClick={() => setDateFilter('')} className="btn-secondary h-10 px-3">
              <X className="h-4 w-4" />
              {t('arc_all_dates')}
            </button>
          )}
        </div>
      </motion.div>

      {filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 p-10 text-center">
          <Archive className="h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500 dark:text-zinc-400">{dateFilter ? t('arc_none_date') : t('arc_none')}</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card overflow-hidden">
          <div className="border-b border-gray-100 dark:border-white/10 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('arc_sessions')}</h2>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {filtered.map((s) => {
              const gap = gapOf(s)
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-amber-50 dark:hover:bg-amber-500/10"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                    <Archive className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold capitalize text-gray-900 dark:text-white">{day(s.closedAt!)}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
                      {t('arc_opened')} {hm(s.openedAt)} · {t('arc_closed')} {hm(s.closedAt!)}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">{t('arc_counted')}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{fmtDH(s.closingAmount ?? 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">{t('arc_gap')}</p>
                    <p className={`text-sm font-semibold tabular-nums ${gap === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {gap > 0 ? '+' : ''}
                      {fmtDH(gap)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-300 dark:text-zinc-600" />
                </button>
              )
            })}
          </div>
        </motion.div>
      )}

      {selected && (
        <Modal open onClose={() => setSelected(null)} title={t('arc_detail')} maxWidth="max-w-4xl">
          <div className="print-area space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold capitalize text-gray-900 dark:text-white">{day(selected.closedAt!)}</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
                  {t('arc_opened')} {dt(selected.openedAt)} · {t('arc_closed')} {dt(selected.closedAt!)}
                </p>
              </div>
              <button onClick={() => window.print()} className="btn-secondary no-print">
                <Printer className="h-4 w-4" />
                {t('fdj_print')}
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-white/10">
              <ClosureSummary session={selected} />
            </div>

            {(() => {
              const { ops, sess } = detailWindow(selected)
              return (
                <>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">{t('arc_operations')}</h3>
                    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-white/10">
                      <table className="w-full text-sm">
                        <tbody>
                          {ops.map((c) => (
                            <tr key={c.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                              <td className="px-4 py-2 text-gray-500 dark:text-zinc-400">{hm(c.date)}</td>
                              <td className="px-4 py-2 text-gray-800 dark:text-zinc-100">{c.label}</td>
                              <td className={`px-4 py-2 text-right font-semibold tabular-nums ${c.type === 'recette' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                {c.type === 'recette' ? '+' : '−'}
                                {fmtDH(c.amount)}
                              </td>
                            </tr>
                          ))}
                          {ops.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-4 py-5 text-center text-xs text-gray-400 dark:text-zinc-500">{t('fdj_none_ops')}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">{t('arc_sales')}</h3>
                    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                            <th className="px-4 py-2.5">{t('fdj_col_time')}</th>
                            <th className="px-4 py-2.5">{t('fdj_col_ref')}</th>
                            <th className="px-4 py-2.5">{t('fac_col_client')}</th>
                            <th className="px-4 py-2.5">{t('fdj_col_mode')}</th>
                            <th className="px-4 py-2.5 text-right">{t('fdj_col_total')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sess.slice(0, 100).map((x) => (
                            <tr key={x.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                              <td className="px-4 py-2 text-gray-500 dark:text-zinc-400">{hm(x.date)}</td>
                              <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-zinc-400">#{x.id.slice(-5).toUpperCase()}</td>
                              <td className="px-4 py-2 text-gray-700 dark:text-zinc-300">{x.clientName ?? '—'}</td>
                              <td className="px-4 py-2">
                                <span className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${PAYMENT_META[x.payment].chip}`}>{PAYMENT_META[x.payment].label}</span>
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white tabular-nums">{fmtDH(x.total)}</td>
                            </tr>
                          ))}
                          {sess.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-4 py-5 text-center text-xs text-gray-400 dark:text-zinc-500">{t('fdj_none_sales')}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </Modal>
      )}
    </>
  )
}

export default function ArchivesPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
