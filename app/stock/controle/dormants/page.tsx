'use client'

import AppShell from '@/components/AppShell'
import StockAuditView, { colCategory, colStock, colValue, colLastMove } from '@/components/stock/StockAuditView'
import { availableStock } from '@/lib/store'
import { Moon } from 'lucide-react'

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="Produits dormants"
        subtitle="En stock mais sans aucun mouvement depuis plus de 90 jours : trésorerie immobilisée."
        icon={Moon}
        accent="cyan"
        emptyLabel="Aucun produit dormant 🎉"
        note="Un produit est dormant s’il a du stock et aucune entrée ni sortie depuis 90 jours."
        filter={(p, c) => { const ts = c.lastMove.get(p.id); const days = ts ? (c.now - ts) / 86400000 : Infinity; return availableStock(p) > 0 && days > 90 }}
        columns={[colCategory, colStock, colValue, colLastMove]}
        defaultSort={{ key: 'value', dir: 'desc' }}
      />
    </AppShell>
  )
}
