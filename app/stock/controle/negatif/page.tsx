'use client'

import { TrendingDown } from 'lucide-react'
import AppShell from '@/components/AppShell'
import StockAuditView, { colCategory, colStock, colValue } from '@/components/stock/StockAuditView'

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="sk_neg_title"
        subtitle="sk_neg_sub"
        icon={TrendingDown}
        accent="rose"
        emptyLabel="sk_neg_empty"
        filter={(p) => p.stock < 0}
        columns={[colCategory, colStock, colValue]}
        defaultSort={{ key: 'stock', dir: 'asc' }}
      />
    </AppShell>
  )
}
