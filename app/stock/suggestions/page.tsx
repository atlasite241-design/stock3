'use client'

import { ShoppingCart } from 'lucide-react'
import AppShell from '@/components/AppShell'
import StockAuditView, { colCategory, colMin, colStock, type AuditColumn } from '@/components/stock/StockAuditView'
import { availableStock, fmtDH } from '@/lib/store'

/**
 * Quantité conseillée à commander.
 * Règle : ramener au seuil, plus la consommation observée sur 30 jours
 * (extrapolée depuis les sorties des 90 derniers jours). À défaut d'historique,
 * on se contente de reconstituer le seuil.
 */
const suggested = (stock: number, min: number, out90: number) => {
  const monthly = Math.ceil(out90 / 3)
  return Math.max(0, min - stock) + monthly
}

const colSuggested: AuditColumn = {
  key: 'sug', label: 'À commander', align: 'center',
  raw: (p, c) => suggested(availableStock(p), p.minStock, c.out90.get(p.id) ?? 0),
  render: (p, c) => {
    const q = suggested(availableStock(p), p.minStock, c.out90.get(p.id) ?? 0)
    return <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{q}</span>
  },
}

const colCost: AuditColumn = {
  key: 'cost', label: 'Coût estimé', align: 'right',
  raw: (p, c) => Number((suggested(availableStock(p), p.minStock, c.out90.get(p.id) ?? 0) * p.cost).toFixed(2)),
  render: (p, c) => (
    <span className="tabular-nums text-gray-600 dark:text-zinc-300">
      {fmtDH(suggested(availableStock(p), p.minStock, c.out90.get(p.id) ?? 0) * p.cost)}
    </span>
  ),
}

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="Suggestions d'achat"
        subtitle="Quantités conseillées pour reconstituer le stock et couvrir un mois de consommation."
        icon={ShoppingCart}
        accent="emerald"
        emptyLabel="Aucun achat à prévoir 🎉"
        note="Quantité conseillée = (seuil − stock disponible) + consommation mensuelle estimée, déduite des sorties des 90 derniers jours."
        filter={(p, c) => suggested(availableStock(p), p.minStock, c.out90.get(p.id) ?? 0) > 0}
        columns={[colCategory, colStock, colMin, colSuggested, colCost]}
        defaultSort={{ key: 'cost', dir: 'desc' }}
      />
    </AppShell>
  )
}
