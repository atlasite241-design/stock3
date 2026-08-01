'use client'

import { CalendarX2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import StockAuditView, { colCategory, colStock, colValue, type AuditColumn } from '@/components/stock/StockAuditView'
import { availableStock } from '@/lib/store'

/** Jours restants avant péremption (négatif = déjà expiré). */
const daysToExpiry = (iso: string | undefined, now: number): number | null => {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? Math.floor((t - now) / 86400000) : null
}

const colExpiry: AuditColumn = {
  key: 'expiry', label: 'sk_exp_col_date', align: 'center',
  raw: (p) => p.expiryDate ?? '',
  render: (p) => (
    <span className="tabular-nums text-gray-600 dark:text-zinc-300">
      {p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('fr-FR') : '—'}
    </span>
  ),
}

const colLeft: AuditColumn = {
  key: 'left', label: 'sk_exp_col_state', align: 'center',
  raw: (p, c) => daysToExpiry(p.expiryDate, c.now) ?? 9999,
  render: (p, c) => {
    const d = daysToExpiry(p.expiryDate, c.now)
    if (d === null) return <span className="text-xs text-gray-400">—</span>
    if (d < 0) {
      return (
        <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
          {c.t('sk_exp_since')} {-d} {c.t('sa_days')}
        </span>
      )
    }
    return (
      <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${d <= 30 ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'}`}>
        {c.t('sk_exp_in')} {d} {c.t('sa_days')}
      </span>
    )
  },
}

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="sk_exp_title"
        subtitle="sk_exp_sub"
        icon={CalendarX2}
        accent="rose"
        emptyLabel="sk_exp_empty"
        note="sk_exp_note"
        filter={(p, c) => {
          const d = daysToExpiry(p.expiryDate, c.now)
          return d !== null && d <= 30 && availableStock(p) > 0
        }}
        columns={[colCategory, colExpiry, colLeft, colStock, colValue]}
        defaultSort={{ key: 'left', dir: 'asc' }}
      />
    </AppShell>
  )
}
