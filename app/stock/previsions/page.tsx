'use client'

import { CalendarClock } from 'lucide-react'
import AppShell from '@/components/AppShell'
import StockAuditView, { colCategory, colStock, type AuditColumn } from '@/components/stock/StockAuditView'
import { availableStock } from '@/lib/store'

/**
 * Jours avant rupture = stock ÷ consommation quotidienne moyenne. Renvoie null
 * en l'absence de sortie : aucune date ne pourrait être annoncée honnêtement.
 */
const daysLeft = (stock: number, out90: number): number | null =>
  out90 > 0 ? Math.floor(stock / (out90 / 90)) : null

const colRate: AuditColumn = {
  key: 'rate', label: 'sk_fc_col_rate', align: 'center',
  raw: (p, c) => Number(((c.out90.get(p.id) ?? 0) / 90).toFixed(2)),
  render: (p, c) => <span className="tabular-nums text-gray-500">{((c.out90.get(p.id) ?? 0) / 90).toFixed(2)}</span>,
}

const colDays: AuditColumn = {
  key: 'days', label: 'sk_fc_col_days', align: 'center',
  raw: (p, c) => daysLeft(availableStock(p), c.out90.get(p.id) ?? 0) ?? 9999,
  render: (p, c) => {
    const d = daysLeft(availableStock(p), c.out90.get(p.id) ?? 0)
    if (d === null) return <span className="text-xs text-gray-400">—</span>
    return (
      <span className={`font-bold tabular-nums ${d <= 7 ? 'text-rose-500' : d <= 21 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
        {d} {c.t('sa_days')}
      </span>
    )
  },
}

const colDate: AuditColumn = {
  key: 'date', label: 'sk_fc_col_date', align: 'right',
  raw: (p, c) => daysLeft(availableStock(p), c.out90.get(p.id) ?? 0) ?? 9999,
  render: (p, c) => {
    const d = daysLeft(availableStock(p), c.out90.get(p.id) ?? 0)
    if (d === null) return <span className="text-xs text-gray-400">—</span>
    return <span className="tabular-nums text-gray-600 dark:text-zinc-300">{new Date(c.now + d * 86400000).toLocaleDateString('fr-FR')}</span>
  },
}

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="sk_fc_title"
        subtitle="sk_fc_sub"
        icon={CalendarClock}
        accent="rose"
        emptyLabel="sk_fc_empty"
        note="sk_fc_note"
        filter={(p, c) => {
          const d = daysLeft(availableStock(p), c.out90.get(p.id) ?? 0)
          return d !== null && d <= 60
        }}
        columns={[colCategory, colStock, colRate, colDays, colDate]}
        defaultSort={{ key: 'days', dir: 'asc' }}
      />
    </AppShell>
  )
}
