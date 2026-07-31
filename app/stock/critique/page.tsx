'use client'

import AppShell from '@/components/AppShell'
import StockAuditView, { colCategory, colStock, colMin, colValue } from '@/components/stock/StockAuditView'
import { availableStock } from '@/lib/store'
import { AlertTriangle } from 'lucide-react'

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="Produits en stock critique"
        subtitle="Quantité disponible au niveau ou en dessous du seuil de réapprovisionnement."
        icon={AlertTriangle}
        accent="amber"
        emptyLabel="Aucun produit sous son seuil 🎉"
        filter={(p) => availableStock(p) <= p.minStock && p.minStock > 0}
        columns={[colCategory, colStock, colMin, colValue]}
        defaultSort={{ key: 'stock', dir: 'asc' }}
      />
    </AppShell>
  )
}
