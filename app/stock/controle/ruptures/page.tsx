'use client'

import { PackageX } from 'lucide-react'
import AppShell from '@/components/AppShell'
import StockAuditView, { colCategory, colMin, colStock, colValue } from '@/components/stock/StockAuditView'
import { availableStock } from '@/lib/store'

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="sk_out_title"
        subtitle="sk_out_sub"
        icon={PackageX}
        accent="rose"
        emptyLabel="sk_out_empty"
        // Rupture = plus rien de disponible. Distinct du stock critique, qui
        // signale un niveau bas mais encore vendable.
        filter={(p) => availableStock(p) <= 0}
        columns={[colCategory, colStock, colMin, colValue]}
        defaultSort={{ key: 'cat', dir: 'asc' }}
      />
    </AppShell>
  )
}
