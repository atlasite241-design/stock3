'use client'

// Analyse budgétaire : prévu vs réel par catégorie, avec verdict — sous
// budget, conforme (±5 %), dépassement. Exports CSV/Excel + impression.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, FileSpreadsheet, Printer, Scale } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import Select from '@/components/Select'
import { usePermissions } from '@/lib/access'
import { budgetConsumed, fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, budgets, expenses, activeStore } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()

  const nowYear = new Date().getFullYear()
  const [year, setYear] = useState(String(nowYear))
  const y = Number(year)

  // Une ligne par catégorie : budgets agrégés + dépenses imputées agrégées.
  const rows = useMemo(() => {
    const m = new Map<string, { planned: number; real: number }>()
    for (const b of budgets) {
      if (b.year !== y) continue
      const cur = m.get(b.category) ?? { planned: 0, real: 0 }
      cur.planned += b.planned
      cur.real += budgetConsumed(b, expenses)
      m.set(b.category, cur)
    }
    return [...m.entries()]
      .map(([category, v]) => {
        const gap = v.real - v.planned
        const pct = v.planned > 0 ? (v.real / v.planned) * 100 : 0
        const verdict: 'under' | 'ok' | 'over' = pct > 100 ? 'over' : pct >= 95 ? 'ok' : 'under'
        return { category, ...v, gap, pct, verdict }
      })
      .sort((a, b) => b.gap - a.gap)
  }, [budgets, expenses, y])

  const totals = useMemo(() => {
    let planned = 0, real = 0
    for (const r of rows) { planned += r.planned; real += r.real }
    return { planned, real, gap: real - planned }
  }, [rows])

  if (!ready) return <Loader />

  const years = Array.from(new Set([nowYear, nowYear + 1, ...budgets.map((b) => b.year)])).sort()

  const VERDICT: Record<'under' | 'ok' | 'over', { label: string; chip: string }> = {
    under: { label: t('fin_an_under'), chip: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400' },
    ok: { label: t('fin_an_ok'), chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400' },
    over: { label: t('fin_an_over'), chip: 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400' },
  }

  const headers = [t('fin_col_category'), t('fin_kpi_planned'), t('fin_an_real'), t('fin_cx_gap'), '%', t('fin_col_status')]
  const data = () => rows.map((r) => [r.category, r.planned.toFixed(2), r.real.toFixed(2), r.gap.toFixed(2), Math.round(r.pct), VERDICT[r.verdict].label])

  const exportCsv = () => {
    const csv = [headers, ...data()].map((x) => x.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `analyse-budget-${y}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  const exportXlsx = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data()])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Budget'); XLSX.writeFile(wb, `analyse-budget-${y}.xlsx`)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Scale className="h-6 w-6 text-amber-500" />
            {t('fin_an_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('fin_an_sub')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={year} onChange={setYear} options={years.map((yy) => ({ value: String(yy), label: `${t('fin_exercice')} ${yy}` }))} className="w-40" />
          {can('fin.export') && (
            <>
              <button onClick={exportCsv} disabled={!rows.length} className="btn-secondary disabled:opacity-40"><Download className="h-4 w-4" />CSV</button>
              <button onClick={exportXlsx} disabled={!rows.length} className="btn-secondary disabled:opacity-40"><FileSpreadsheet className="h-4 w-4" />Excel</button>
              <button onClick={() => window.print()} className="btn-secondary"><Printer className="h-4 w-4" />PDF</button>
            </>
          )}
        </div>
      </motion.div>

      <div className="print-area space-y-6">
        <div className="grid grid-cols-3 gap-3">
          {[
            { v: fmtDH(totals.planned), l: t('fin_kpi_planned'), c: 'text-gray-900 dark:text-white' },
            { v: fmtDH(totals.real), l: t('fin_an_real'), c: 'text-amber-600 dark:text-amber-400' },
            { v: `${totals.gap > 0 ? '+' : ''}${fmtDH(totals.gap)}`, l: t('fin_cx_gap'), c: totals.gap > 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400' },
          ].map((s, i) => (
            <div key={i} className="glass-card p-4 text-center">
              <p className={`truncate text-xl font-extrabold tabular-nums ${s.c}`}>{s.v}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
            </div>
          ))}
        </div>

        <div className="glass-card overflow-x-auto">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Scale className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
              <p className="text-sm text-gray-500 dark:text-zinc-400">{t('fin_an_empty')}</p>
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                  <th className="px-4 py-3">{t('fin_col_category')}</th>
                  <th className="px-4 py-3 text-right">{t('fin_kpi_planned')}</th>
                  <th className="px-4 py-3 text-right">{t('fin_an_real')}</th>
                  <th className="px-4 py-3 text-right">{t('fin_cx_gap')}</th>
                  <th className="px-4 py-3">{t('fin_col_progress')}</th>
                  <th className="px-4 py-3">{t('fin_col_status')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.category} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{r.category}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-zinc-300">{fmtDH(r.planned)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-white">{fmtDH(r.real)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${r.gap > 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {r.gap > 0 ? '+' : ''}{fmtDH(r.gap)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                          <div className={`h-full rounded-full ${r.verdict === 'over' ? 'bg-rose-500' : r.verdict === 'ok' ? 'bg-emerald-500' : 'bg-sky-500'}`}
                            style={{ width: `${Math.min(100, r.pct)}%` }} />
                        </div>
                        <span className="text-xs font-bold tabular-nums text-gray-500">{Math.round(r.pct)} %</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${VERDICT[r.verdict].chip}`}>
                        {VERDICT[r.verdict].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
