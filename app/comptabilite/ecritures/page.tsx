'use client'

// Écritures : le grand livre chronologique, chaque pièce détaillée ligne à ligne.

import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import AppShell from '@/components/AppShell'
import AccountingShell from '@/components/compta/AccountingShell'
import Select from '@/components/Select'
import { accountLabel, JOURNALS, type JournalCode } from '@/lib/accounting'
import { fmtDH } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function View() {
  const { t } = useLanguage()
  const [journal, setJournal] = useState<JournalCode | ''>('')

  return (
    <AccountingShell
      title="cp_ec_title" subtitle="cp_ec_sub" icon={BookOpen} exportName="ecritures"
      exportRows={(d) => [
        [t('cp_col_date'), t('cp_col_journal'), t('cp_col_ref'), t('cp_col_label'), t('cp_col_account'), t('cp_col_debit'), t('cp_col_credit')],
        ...d.entries.flatMap((e) =>
          e.lines.map((l) => [
            new Date(e.date).toLocaleDateString('fr-FR'), e.journal, e.ref, e.label,
            `${l.account} ${accountLabel(l.account)}`, l.debit.toFixed(2), l.credit.toFixed(2),
          ])
        ),
      ]}
    >
      {(d) => {
        const list = journal ? d.entries.filter((e) => e.journal === journal) : d.entries
        return (
          <>
            <div className="glass-card flex flex-wrap items-center gap-3 p-3 no-print">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">{t('cp_col_journal')}</span>
              <div className="w-64">
                <Select value={journal} onChange={(v) => setJournal(v as JournalCode | '')}
                  options={[{ value: '', label: t('cp_all_journals') }, ...JOURNALS.map((j) => ({ value: j.code, label: `${j.code} — ${j.label}` }))]} />
              </div>
            </div>

            <div className="glass-card overflow-x-auto">
              {list.length === 0 ? (
                <p className="p-12 text-center text-sm text-gray-500 dark:text-zinc-400">{t('cp_empty')}</p>
              ) : (
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                      <th className="px-3 py-3">{t('cp_col_date')}</th>
                      <th className="px-3 py-3">{t('cp_col_journal')}</th>
                      <th className="px-3 py-3">{t('cp_col_ref')}</th>
                      <th className="px-3 py-3">{t('cp_col_account')}</th>
                      <th className="px-3 py-3 text-right">{t('cp_col_debit')}</th>
                      <th className="px-3 py-3 text-right">{t('cp_col_credit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.slice(0, 300).map((e) =>
                      e.lines.map((l, i) => (
                        <tr key={e.id + i} className={`text-xs ${i === e.lines.length - 1 ? 'border-b border-gray-100 dark:border-white/10' : ''}`}>
                          <td className="px-3 py-1.5 text-gray-500">{i === 0 ? new Date(e.date).toLocaleDateString('fr-FR') : ''}</td>
                          <td className="px-3 py-1.5">{i === 0 && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{e.journal}</span>
                          )}</td>
                          <td className="px-3 py-1.5 font-mono text-[11px] text-gray-500">{i === 0 ? e.ref : ''}</td>
                          <td className="px-3 py-1.5">
                            <span className="font-mono font-semibold text-gray-700 dark:text-zinc-200">{l.account}</span>{' '}
                            <span className="text-gray-500 dark:text-zinc-400">{accountLabel(l.account)}</span>
                            {i === 0 && <span className="ml-2 text-[10px] text-gray-400">{e.label}</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-zinc-200">{l.debit ? fmtDH(l.debit) : ''}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-zinc-200">{l.credit ? fmtDH(l.credit) : ''}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
              {list.length > 300 && (
                <p className="p-2 text-center text-[11px] text-gray-400">{t('cp_truncated')} {(list.length - 300).toLocaleString('fr-FR')}</p>
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
