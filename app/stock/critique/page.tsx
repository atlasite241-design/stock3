'use client'

import { AlertTriangle } from 'lucide-react'
import AppShell from '@/components/AppShell'
import StockAuditView, { colCategory, colMin, colStock, colValue } from '@/components/stock/StockAuditView'
import { availableStock } from '@/lib/store'

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="sk_crit_title"
        subtitle="sk_crit_sub"
        icon={AlertTriangle}
        accent="amber"
        emptyLabel="sk_crit_empty"
        filter={(p) => availableStock(p) <= p.minStock && p.minStock > 0}
        columns={[colCategory, colStock, colMin, colValue]}
        defaultSort={{ key: 'stock', dir: 'asc' }}
      />
    </AppShell>
  )
}
