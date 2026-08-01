'use client'

import { AlertOctagon } from 'lucide-react'
import AppShell from '@/components/AppShell'
import StockAuditView, { colStock, colValue, type AuditColumn } from '@/components/stock/StockAuditView'
import { availableStock, type Product } from '@/lib/store'
import type { TKey } from '@/lib/i18n'

/**
 * Anomalies détectables à partir des seules données existantes. Chaque règle
 * décrit un état incohérent — pas une simple alerte de gestion (celles-ci ont
 * leurs propres écrans : stock critique, dormants…).
 */
const rules: { key: TKey; hit: (p: Product) => boolean }[] = [
  { key: 'sk_ano_r_neg', hit: (p) => p.stock < 0 },
  { key: 'sk_ano_r_res', hit: (p) => (p.reserved ?? 0) > p.stock },
  { key: 'sk_ano_r_price_low', hit: (p) => p.price > 0 && p.cost > 0 && p.price < p.cost },
  { key: 'sk_ano_r_no_price', hit: (p) => !p.price || p.price <= 0 },
  { key: 'sk_ano_r_no_cost', hit: (p) => (!p.cost || p.cost <= 0) && p.stock > 0 },
  { key: 'sk_ano_r_no_barcode', hit: (p) => !p.barcode },
  { key: 'sk_ano_r_no_cat', hit: (p) => !p.category },
  { key: 'sk_ano_r_no_min', hit: (p) => p.minStock === 0 && availableStock(p) > 0 },
]

const hitsOf = (p: Product) => rules.filter((r) => r.hit(p))

const colIssues: AuditColumn = {
  key: 'issues', label: 'sk_ano_col_issues',
  raw: (p, c) => hitsOf(p).map((r) => c.t(r.key)).join(' · '),
  render: (p, c) => (
    <div className="flex flex-wrap gap-1">
      {hitsOf(p).map((r) => (
        <span key={r.key} className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
          {c.t(r.key)}
        </span>
      ))}
    </div>
  ),
}

const colCount: AuditColumn = {
  key: 'count', label: 'sk_ano_col_count', align: 'center',
  raw: (p) => hitsOf(p).length,
  render: (p) => <span className="font-bold tabular-nums text-rose-500">{hitsOf(p).length}</span>,
}

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="sk_ano_title"
        subtitle="sk_ano_sub"
        icon={AlertOctagon}
        accent="rose"
        emptyLabel="sk_ano_empty"
        note="sk_ano_note"
        filter={(p) => hitsOf(p).length > 0}
        columns={[colCount, colIssues, colStock, colValue]}
        defaultSort={{ key: 'count', dir: 'desc' }}
      />
    </AppShell>
  )
}
