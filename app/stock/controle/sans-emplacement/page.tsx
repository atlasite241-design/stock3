'use client'

import AppShell from '@/components/AppShell'
import StockAuditView, { colCategory, colStock, colValue } from '@/components/stock/StockAuditView'
import { availableStock } from '@/lib/store'
import { MapPinOff } from 'lucide-react'

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="Produits sans emplacement"
        subtitle="Articles en stock qui n’ont pas encore été rangés dans la structure du magasin."
        icon={MapPinOff}
        accent="violet"
        emptyLabel="Tous les produits en stock ont un emplacement 🎉"
        filter={(p) => !p.emplacementComplet && availableStock(p) > 0}
        columns={[colCategory, colStock, colValue]}
        defaultSort={{ key: 'value', dir: 'desc' }}
      />
    </AppShell>
  )
}
