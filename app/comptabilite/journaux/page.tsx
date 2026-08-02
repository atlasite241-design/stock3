'use client'

// Journaux : les écritures regroupées par nature d'opération, avec leurs totaux.

import Link from 'next/link'
import { BookMarked } from 'lucide-react'
import AppShell from '@/components/AppShell'
import AccountingShell from '@/components/compta/AccountingShell'
import { JOURNALS } from '@/lib/accounting'
import { fmtDH } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const TONE: Record<string, string> = {
  VE: 'text-emerald-600 dark:text-emerald-400',
  AC: 'text-indigo-600 dark:text-indigo-400',
  BQ: 'text-cyan-600 dark:text-cyan-400',
  CA: 'text-amber-600 dark:text-amber-400',
  OD: 'text-violet-600 dark:text-violet-400',
}

function View() {
  const { t } = useLanguage()
  return (
    <AccountingShell
      title="cp_jx_title" subtitle="cp_jx_sub" icon={BookMarked} exportName="journaux"
      exportRows={(d) => {
        const rows: (string | number)[][] = [[t('cp_col_journal'), t('cp_col_label'), t('cp_entries'), t('cp_col_debit'), t('cp_col_credit')]]
        for (const j of JOURNALS) {
          const list = d.entries.filter((e) => e.journal === j.code)
          const deb = list.reduce((a, e) => a + e.lines.reduce((x, l) => x + l.debit, 0), 0)
          const cre = list.reduce((a, e) => a + e.lines.reduce((x, l) => x + l.credit, 0), 0)
          rows.push([j.code, j.label, list.length, deb.toFixed(2), cre.toFixed(2)])
        }
        return rows
      }}
    >
      {(d) => (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {JOURNALS.map((j) => {
            const list = d.entries.filter((e) => e.journal === j.code)
            const deb = list.reduce((a, e) => a + e.lines.reduce((x, l) => x + l.debit, 0), 0)
            const cre = list.reduce((a, e) => a + e.lines.reduce((x, l) => x + l.credit, 0), 0)
            return (
              <Link key={j.code} href={`/comptabilite/ecritures`} className="glass-card block p-5 transition hover:border-amber-300">
                <div className="flex items-center justify-between">
                  <span className={`rounded-lg bg-gray-100 px-2 py-1 font-mono text-sm font-extrabold dark:bg-white/10 ${TONE[j.code]}`}>{j.code}</span>
                  <span className="text-xs tabular-nums text-gray-400">{list.length.toLocaleString('fr-FR')} {t('cp_entries')}</span>
                </div>
                <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">{j.label}</p>
                <div className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t('cp_col_debit')}</span>
                    <span className="font-semibold tabular-nums text-gray-700 dark:text-zinc-200">{fmtDH(deb)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t('cp_col_credit')}</span>
                    <span className="font-semibold tabular-nums text-gray-700 dark:text-zinc-200">{fmtDH(cre)}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </AccountingShell>
  )
}

export default function Page() {
  return <AppShell><View /></AppShell>
}
