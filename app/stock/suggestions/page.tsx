'use client'

import { ShoppingCart } from 'lucide-react'
import AppShell from '@/components/AppShell'
import StockAuditView, { colCategory, colMin, colStock, type AuditColumn } from '@/components/stock/StockAuditView'
import { availableStock, fmtDH } from '@/lib/store'

/**
 * Quantité conseillée : ramener au seuil, plus la consommation observée sur
 * 30 jours (extrapolée depuis les sorties des 90 derniers jours).
 */
const suggested = (stock: number, min: number, out90: number) =>
  Math.max(0, min - stock) + Math.ceil(out90 / 3)

const colSuggested: AuditColumn = {
  key: 'sug', label: 'sk_sug_col_order', align: 'center',
  raw: (p, c) => suggested(availableStock(p), p.minStock, c.out90.get(p.id) ?? 0),
  render: (p, c) => (
    <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
      {suggested(availableStock(p), p.minStock, c.out90.get(p.id) ?? 0)}
    </span>
  ),
}

const colCost: AuditColumn = {
  key: 'cost', label: 'sk_sug_col_cost', align: 'right',
  raw: (p, c) => Number((suggested(availableStock(p), p.minStock, c.out90.get(p.id) ?? 0) * p.cost).toFixed(2)),
  render: (p, c) => (
    <span className="tabular-nums text-gray-600 dark:text-zinc-300">
      {fmtDH(suggested(availableStock(p), p.minStock, c.out90.get(p.id) ?? 0) * p.cost)}
    </span>
  ),
}

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="sk_sug_title"
        subtitle="sk_sug_sub"
        icon={ShoppingCart}
        accent="emerald"
        emptyLabel="sk_sug_empty"
        note="sk_sug_note"
        filter={(p, c) => suggested(availableStock(p), p.minStock, c.out90.get(p.id) ?? 0) > 0}
        columns={[colCategory, colStock, colMin, colSuggested, colCost]}
        defaultSort={{ key: 'cost', dir: 'desc' }}
      />
    </AppShell>
  )
}
