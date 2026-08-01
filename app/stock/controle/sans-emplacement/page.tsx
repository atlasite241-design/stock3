'use client'

import { MapPinOff } from 'lucide-react'
import AppShell from '@/components/AppShell'
import StockAuditView, { colCategory, colStock, colValue } from '@/components/stock/StockAuditView'
import { availableStock } from '@/lib/store'

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="sk_nol_title"
        subtitle="sk_nol_sub"
        icon={MapPinOff}
        accent="violet"
        emptyLabel="sk_nol_empty"
        filter={(p) => !p.emplacementComplet && availableStock(p) > 0}
        columns={[colCategory, colStock, colValue]}
        defaultSort={{ key: 'value', dir: 'desc' }}
      />
    </AppShell>
  )
}
