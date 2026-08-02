'use client'

// Plan comptable : la balance par compte sur la période, adossée au CGNC.

import { ListTree } from 'lucide-react'
import AppShell from '@/components/AppShell'
import AccountingShell from '@/components/compta/AccountingShell'
import { ACCOUNTS, balances } from '@/lib/accounting'
import { fmtDH } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const CLASS_LABEL: Record<number, string> = {
  3: 'Actif circulant', 4: 'Passif circulant', 5: 'Trésorerie', 6: 'Charges', 7: 'Produits',
}

function View() {
  const { t } = useLanguage()
  return (
    <AccountingShell
      title="cp_pc_title" subtitle="cp_pc_sub" icon={ListTree} exportName="plan-comptable"
      exportRows={(d) => {
        const b = new Map(balances(d.entries).map((x) => [x.code, x]))
        return [
          [t('cp_col_account'), t('cp_col_label'), t('cp_col_class'), t('cp_col_debit'), t('cp_col_credit'), t('cp_col_balance')],
          ...ACCOUNTS.map((a) => {
            const x = b.get(a.code)
            return [a.code, a.label, CLASS_LABEL[a.cls], (x?.debit ?? 0).toFixed(2), (x?.credit ?? 0).toFixed(2), (x?.balance ?? 0).toFixed(2)]
          }),
        ]
      }}
    >
      {(d) => {
        const b = new Map(balances(d.entries).map((x) => [x.code, x]))
        const classes = [3, 4, 5, 6, 7] as const
        return (
          <div className="space-y-4">
            {classes.map((cls) => {
              const accounts = ACCOUNTS.filter((a) => a.cls === cls)
              const used = accounts.filter((a) => b.has(a.code))
              return (
                <section key={cls} className="glass-card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-gray-100 p-3 dark:border-white/10">
                    <h2 className="text-sm font-bold text-gray-800 dark:text-zinc-100">
                      <span className="mr-2 font-mono text-amber-600 dark:text-amber-400">{cls}</span>{CLASS_LABEL[cls]}
                    </h2>
                    <span className="text-[11px] text-gray-400">{used.length}/{accounts.length} {t('cp_used')}</span>
                  </div>
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-50 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/5 dark:text-zinc-500">
                        <th className="px-4 py-2">{t('cp_col_account')}</th>
                        <th className="px-4 py-2 text-right">{t('cp_col_debit')}</th>
                        <th className="px-4 py-2 text-right">{t('cp_col_credit')}</th>
                        <th className="px-4 py-2 text-right">{t('cp_col_balance')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((a) => {
                        const x = b.get(a.code)
                        return (
                          <tr key={a.code} className={`border-b border-gray-50 last:border-0 dark:border-white/5 ${x ? '' : 'opacity-40'}`}>
                            <td className="px-4 py-2">
                              <span className="font-mono font-semibold text-gray-700 dark:text-zinc-200">{a.code}</span>{' '}
                              <span className="text-gray-500 dark:text-zinc-400">{a.label}</span>
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-gray-600 dark:text-zinc-300">{x?.debit ? fmtDH(x.debit) : '—'}</td>
                            <td className="px-4 py-2 text-right tabular-nums text-gray-600 dark:text-zinc-300">{x?.credit ? fmtDH(x.credit) : '—'}</td>
                            <td className={`px-4 py-2 text-right font-bold tabular-nums ${(x?.balance ?? 0) < 0 ? 'text-rose-500' : 'text-gray-900 dark:text-white'}`}>
                              {x ? fmtDH(x.balance) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </section>
              )
            })}
          </div>
        )
      }}
    </AccountingShell>
  )
}

export default function Page() {
  return <AppShell><View /></AppShell>
}
