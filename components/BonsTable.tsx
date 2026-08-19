'use client'

import type { ReactNode } from 'react'
import { fmtDH, type BonPapier } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'
import BonStatusPill from './BonStatusPill'

const d2 = (n: number) => String(n).padStart(2, '0')
export const fmtBonDate = (iso: string) => { const d = new Date(iso); return `${d2(d.getDate())}/${d2(d.getMonth() + 1)}/${d.getFullYear()}` }
export const fmtBonTime = (iso: string) => { const d = new Date(iso); return `${d2(d.getHours())}:${d2(d.getMinutes())}` }

export default function BonsTable({
  bons,
  renderActions,
  emptyLabel,
}: {
  bons: BonPapier[]
  renderActions?: (b: BonPapier) => ReactNode
  emptyLabel?: string
}) {
  const { t } = useLanguage()
  if (bons.length === 0) {
    return <div className="glass-card p-10 text-center text-sm text-gray-400 dark:text-zinc-500">{emptyLabel ?? t('bon_none')}</div>
  }
  return (
    <div className="glass-card overflow-x-auto">
      <table className="w-full min-w-[840px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
            <th className="px-4 py-3">{t('bon_col_ref')}</th>
            <th className="px-4 py-3">{t('bon_col_date')}</th>
            <th className="px-4 py-3">{t('bon_col_time')}</th>
            <th className="px-4 py-3">{t('bon_col_client')}</th>
            <th className="px-4 py-3">{t('bon_col_client_code')}</th>
            <th className="px-4 py-3">{t('bon_col_vendeur')}</th>
            <th className="px-4 py-3">{t('bon_col_status')}</th>
            <th className="px-4 py-3 text-right">{t('bon_col_amount')}</th>
            {renderActions && <th className="px-4 py-3 text-right">{t('bon_col_action')}</th>}
          </tr>
        </thead>
        <tbody>
          {bons.map((b) => (
            <tr key={b.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
              <td className="px-4 py-2.5 font-mono font-bold text-gray-900 dark:text-white">{b.ref}</td>
              <td className="px-4 py-2.5 tabular-nums text-gray-500 dark:text-zinc-400">{fmtBonDate(b.date)}</td>
              <td className="px-4 py-2.5 tabular-nums text-gray-500 dark:text-zinc-400">{fmtBonTime(b.date)}</td>
              <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{b.clientName}</td>
              <td className="px-4 py-2.5 font-mono text-gray-500 dark:text-zinc-400">{b.clientCode ?? '—'}</td>
              <td className="px-4 py-2.5 text-gray-500 dark:text-zinc-400">{b.vendeurName ?? '—'}</td>
              <td className="px-4 py-2.5"><BonStatusPill status={b.status} /></td>
              <td className="px-4 py-2.5 text-right font-bold tabular-nums text-gray-900 dark:text-white">{b.total ? fmtDH(b.total) : '—'}</td>
              {renderActions && <td className="px-4 py-2.5 text-right">{renderActions(b)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
