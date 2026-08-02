'use client'

// Banque : le compte 5141 seul, avec son solde progressif — la vue qu'on
// rapproche du relevé bancaire.

import { Landmark } from 'lucide-react'
import AppShell from '@/components/AppShell'
import AccountingShell from '@/components/compta/AccountingShell'
import { fmtDH } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const BANK = '5141'

function View() {
  const { t } = useLanguage()
  return (
    <AccountingShell
      title="cp_bq_title" subtitle="cp_bq_sub" icon={Landmark} exportName="banque"
      exportRows={(d) => {
        const rows: (string | number)[][] = [[t('cp_col_date'), t('cp_col_label'), t('cp_col_in'), t('cp_col_out')]]
        for (const e of [...d.entries].reverse()) {
          for (const l of e.lines) {
            if (l.account !== BANK) continue
            rows.push([new Date(e.date).toLocaleDateString('fr-FR'), e.label, l.debit.toFixed(2), l.credit.toFixed(2)])
          }
        }
        return rows
      }}
    >
      {(d) => {
        // Ordre chronologique croissant : un solde progressif ne se lit que dans
        // le sens du temps.
        const rows = [...d.entries].reverse().flatMap((e) =>
          e.lines.filter((l) => l.account === BANK).map((l) => ({ e, l }))
        )
        let run = 0
        const withBalance = rows.map(({ e, l }) => {
          run += l.debit - l.credit
          return { e, l, balance: run }
        })
        const inAmt = rows.reduce((a, r) => a + r.l.debit, 0)
        const outAmt = rows.reduce((a, r) => a + r.l.credit, 0)

        return (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { v: inAmt, l: t('cp_col_in'), c: 'text-emerald-600 dark:text-emerald-400' },
                { v: outAmt, l: t('cp_col_out'), c: 'text-rose-500' },
                { v: inAmt - outAmt, l: t('cp_bq_balance'), c: inAmt - outAmt < 0 ? 'text-rose-500' : 'text-cyan-600 dark:text-cyan-400' },
              ].map((s, i) => (
                <div key={i} className="glass-card p-4 text-center">
                  <p className={`text-xl font-extrabold tabular-nums ${s.c}`}>{fmtDH(s.v)}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
                </div>
              ))}
            </div>

            <p className="rounded-xl border border-dashed border-gray-200 p-3 text-xs text-gray-500 dark:border-white/15 dark:text-zinc-400">
              {t('cp_bq_note')}
            </p>

            <div className="glass-card overflow-x-auto">
              {withBalance.length === 0 ? (
                <p className="p-12 text-center text-sm text-gray-500 dark:text-zinc-400">{t('cp_empty')}</p>
              ) : (
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                      <th className="px-4 py-3">{t('cp_col_date')}</th>
                      <th className="px-4 py-3">{t('cp_col_label')}</th>
                      <th className="px-4 py-3 text-right">{t('cp_col_in')}</th>
                      <th className="px-4 py-3 text-right">{t('cp_col_out')}</th>
                      <th className="px-4 py-3 text-right">{t('cp_bq_running')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withBalance.slice(-300).map(({ e, l, balance }, i) => (
                      <tr key={e.id + i} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                        <td className="px-4 py-2 text-xs text-gray-500">{new Date(e.date).toLocaleDateString('fr-FR')}</td>
                        <td className="px-4 py-2 text-gray-800 dark:text-zinc-200">{e.label}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{l.debit ? fmtDH(l.debit) : ''}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-rose-500">{l.credit ? fmtDH(l.credit) : ''}</td>
                        <td className={`px-4 py-2 text-right font-bold tabular-nums ${balance < 0 ? 'text-rose-500' : 'text-gray-900 dark:text-white'}`}>{fmtDH(balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
