'use client'

import AppShell from '@/components/AppShell'
import StockAuditView, { colCategory, colStock, colValue } from '@/components/stock/StockAuditView'
import { TrendingDown } from 'lucide-react'

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="Stock négatif"
        subtitle="Quantités inférieures à zéro : une sortie a été enregistrée sans entrée correspondante."
        icon={TrendingDown}
        accent="rose"
        emptyLabel="Aucun stock négatif 🎉"
        filter={(p) => p.stock < 0}
        columns={[colCategory, colStock, colValue]}
        defaultSort={{ key: 'stock', dir: 'asc' }}
      />
    </AppShell>
  )
}
