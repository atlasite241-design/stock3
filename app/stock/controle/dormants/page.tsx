'use client'

import { Moon } from 'lucide-react'
import AppShell from '@/components/AppShell'
import StockAuditView, { colCategory, colLastMove, colStock, colValue } from '@/components/stock/StockAuditView'
import { availableStock } from '@/lib/store'

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="sk_dor_title"
        subtitle="sk_dor_sub"
        icon={Moon}
        accent="cyan"
        emptyLabel="sk_dor_empty"
        note="sk_dor_note"
        filter={(p, c) => { const ts = c.lastMove.get(p.id); const days = ts ? (c.now - ts) / 86400000 : Infinity; return availableStock(p) > 0 && days > 90 }}
        columns={[colCategory, colStock, colValue, colLastMove]}
        defaultSort={{ key: 'value', dir: 'desc' }}
      />
    </AppShell>
  )
}
