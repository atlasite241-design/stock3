'use client'

// TVA : déclaration de la période — collectée sur les ventes, récupérable sur
// les achats, et le solde à verser (ou le crédit reportable).

import { Percent } from 'lucide-react'
import AppShell from '@/components/AppShell'
import AccountingShell from '@/components/compta/AccountingShell'
import { vatReport } from '@/lib/accounting'
import { fmtDH } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function View() {
  const { t } = useLanguage()
  return (
    <AccountingShell
      title="cp_tva_title" subtitle="cp_tva_sub" icon={Percent} exportName="tva"
      exportRows={(d) => {
        const v = vatReport(d.entries)
        return [
          [t('cp_col_label'), t('cp_col_amount')],
          [t('cp_tva_collected'), v.collected.toFixed(2)],
          [t('cp_tva_deductible'), v.deductible.toFixed(2)],
          [v.due >= 0 ? t('cp_tva_due') : t('cp_tva_credit'), Math.abs(v.due).toFixed(2)],
        ]
      }}
    >
      {(d) => {
        const v = vatReport(d.entries)
        const due = v.due >= 0
        return (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { v: v.collected, l: t('cp_tva_collected'), c: 'text-emerald-600 dark:text-emerald-400', d: t('cp_tva_collected_d') },
                { v: v.deductible, l: t('cp_tva_deductible'), c: 'text-indigo-600 dark:text-indigo-400', d: t('cp_tva_deductible_d') },
                { v: Math.abs(v.due), l: due ? t('cp_tva_due') : t('cp_tva_credit'), c: due ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400', d: due ? t('cp_tva_due_d') : t('cp_tva_credit_d') },
              ].map((s, i) => (
                <div key={i} className="glass-card p-5 text-center">
                  <p className={`text-2xl font-extrabold tabular-nums ${s.c}`}>{fmtDH(s.v)}</p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">{s.l}</p>
                  <p className="mt-1 text-[11px] leading-snug text-gray-400 dark:text-zinc-500">{s.d}</p>
                </div>
              ))}
            </div>

            <div className="glass-card p-4">
              <h2 className="text-sm font-bold text-gray-800 dark:text-zinc-100">{t('cp_tva_calc')}</h2>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between border-b border-gray-50 pb-2 dark:border-white/5">
                  <span className="text-gray-600 dark:text-zinc-300"><span className="font-mono text-xs text-gray-400">4455</span> {t('cp_tva_collected')}</span>
                  <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtDH(v.collected)}</span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-50 pb-2 dark:border-white/5">
                  <span className="text-gray-600 dark:text-zinc-300"><span className="font-mono text-xs text-gray-400">3455</span> − {t('cp_tva_deductible')}</span>
                  <span className="font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">{fmtDH(v.deductible)}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-bold text-gray-900 dark:text-white">= {due ? t('cp_tva_due') : t('cp_tva_credit')}</span>
                  <span className={`text-lg font-extrabold tabular-nums ${due ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmtDH(Math.abs(v.due))}</span>
                </div>
              </div>
              <p className="mt-3 rounded-lg border border-dashed border-gray-200 p-2.5 text-[11px] text-gray-500 dark:border-white/15 dark:text-zinc-400">
                {t('cp_tva_note')} <span className="font-semibold">{d.vatRate}%</span>.
              </p>
            </div>
          </>
        )
      }}
    </AccountingShell>
  )
}

export default function Page() {
  return <AppShell><View /></AppShell>
}
