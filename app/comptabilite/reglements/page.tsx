'use client'

// Règlements : les encaissements et décaissements de la période, tels qu'ils
// apparaissent en comptabilité (journaux de trésorerie).

import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react'
import AppShell from '@/components/AppShell'
import AccountingShell from '@/components/compta/AccountingShell'
import { accountLabel } from '@/lib/accounting'
import { fmtDH } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

/** Une écriture de trésorerie : mouvement sur 5141 (banque) ou 5161 (caisse). */
const TREASURY = ['5141', '5161']

function View() {
  const { t } = useLanguage()
  return (
    <AccountingShell
      title="cp_rg_title" subtitle="cp_rg_sub" icon={Wallet} exportName="reglements"
      exportRows={(d) => {
        const rows: (string | number)[][] = [[t('cp_col_date'), t('cp_col_label'), t('cp_col_account'), t('cp_col_in'), t('cp_col_out')]]
        for (const e of d.entries) {
          for (const l of e.lines) {
            if (!TREASURY.includes(l.account)) continue
            rows.push([new Date(e.date).toLocaleDateString('fr-FR'), e.label, `${l.account} ${accountLabel(l.account)}`, l.debit.toFixed(2), l.credit.toFixed(2)])
          }
        }
        return rows
      }}
    >
      {(d) => {
        const rows = d.entries.flatMap((e) =>
          e.lines.filter((l) => TREASURY.includes(l.account)).map((l) => ({ e, l }))
        )
        const inAmt = rows.reduce((a, r) => a + r.l.debit, 0)
        const outAmt = rows.reduce((a, r) => a + r.l.credit, 0)

        return (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { v: inAmt, l: t('cp_col_in'), c: 'text-emerald-600 dark:text-emerald-400' },
                { v: outAmt, l: t('cp_col_out'), c: 'text-rose-500' },
                { v: inAmt - outAmt, l: t('cp_rg_net'), c: inAmt - outAmt < 0 ? 'text-rose-500' : 'text-gray-900 dark:text-white' },
              ].map((s, i) => (
                <div key={i} className="glass-card p-4 text-center">
                  <p className={`text-xl font-extrabold tabular-nums ${s.c}`}>{fmtDH(s.v)}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
                </div>
              ))}
            </div>

            <div className="glass-card overflow-x-auto">
              {rows.length === 0 ? (
                <p className="p-12 text-center text-sm text-gray-500 dark:text-zinc-400">{t('cp_empty')}</p>
              ) : (
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                      <th className="px-4 py-3">{t('cp_col_date')}</th>
                      <th className="px-4 py-3">{t('cp_col_label')}</th>
                      <th className="px-4 py-3">{t('cp_col_account')}</th>
                      <th className="px-4 py-3 text-right">{t('cp_col_in')}</th>
                      <th className="px-4 py-3 text-right">{t('cp_col_out')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 300).map(({ e, l }, i) => (
                      <tr key={e.id + i} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                        <td className="px-4 py-2 text-xs text-gray-500">{new Date(e.date).toLocaleDateString('fr-FR')}</td>
                        <td className="px-4 py-2 text-gray-800 dark:text-zinc-200">{e.label}</td>
                        <td className="px-4 py-2 text-xs">
                          <span className="font-mono text-gray-500">{l.account}</span>{' '}
                          <span className="text-gray-400">{accountLabel(l.account)}</span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          {l.debit ? <span className="inline-flex items-center gap-1"><ArrowDownLeft className="h-3 w-3" />{fmtDH(l.debit)}</span> : ''}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-rose-500">
                          {l.credit ? <span className="inline-flex items-center gap-1"><ArrowUpRight className="h-3 w-3" />{fmtDH(l.credit)}</span> : ''}
                        </td>
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
