'use client'

import { CalendarClock } from 'lucide-react'
import AppShell from '@/components/AppShell'
import StockAuditView, { colCategory, colStock, type AuditColumn } from '@/components/stock/StockAuditView'
import { availableStock } from '@/lib/store'

/**
 * Jours restants avant rupture = stock disponible ÷ consommation quotidienne
 * moyenne (sorties des 90 derniers jours ÷ 90). Renvoie null si le produit
 * n'a enregistré aucune sortie : sans consommation, aucune date de rupture
 * ne peut être annoncée honnêtement.
 */
const daysLeft = (stock: number, out90: number): number | null => {
  if (out90 <= 0) return null
  const perDay = out90 / 90
  return Math.floor(stock / perDay)
}

const colRate: AuditColumn = {
  key: 'rate', label: 'Conso / jour', align: 'center',
  raw: (p, c) => Number(((c.out90.get(p.id) ?? 0) / 90).toFixed(2)),
  render: (p, c) => <span className="tabular-nums text-gray-500">{((c.out90.get(p.id) ?? 0) / 90).toFixed(2)}</span>,
}

const colDays: AuditColumn = {
  key: 'days', label: 'Rupture dans', align: 'center',
  raw: (p, c) => daysLeft(availableStock(p), c.out90.get(p.id) ?? 0) ?? 9999,
  render: (p, c) => {
    const d = daysLeft(availableStock(p), c.out90.get(p.id) ?? 0)
    if (d === null) return <span className="text-xs text-gray-400">—</span>
    return <span className={`font-bold tabular-nums ${d <= 7 ? 'text-rose-500' : d <= 21 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{d} j</span>
  },
}

const colDate: AuditColumn = {
  key: 'date', label: 'Date estimée', align: 'right',
  raw: (p, c) => daysLeft(availableStock(p), c.out90.get(p.id) ?? 0) ?? 9999,
  render: (p, c) => {
    const d = daysLeft(availableStock(p), c.out90.get(p.id) ?? 0)
    if (d === null) return <span className="text-xs text-gray-400">—</span>
    return <span className="tabular-nums text-gray-600 dark:text-zinc-300">{new Date(c.now + d * 86400000).toLocaleDateString('fr-FR')}</span>
  },
}

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="Prévisions de rupture"
        subtitle="Produits dont le stock sera épuisé dans les 60 prochains jours au rythme de consommation actuel."
        icon={CalendarClock}
        accent="rose"
        emptyLabel="Aucune rupture prévue dans les 60 jours 🎉"
        note="Consommation quotidienne = sorties des 90 derniers jours ÷ 90. Les produits sans aucune sortie sont exclus : aucune prévision ne serait fondée."
        filter={(p, c) => {
          const d = daysLeft(availableStock(p), c.out90.get(p.id) ?? 0)
          return d !== null && d <= 60
        }}
        columns={[colCategory, colStock, colRate, colDays, colDate]}
        defaultSort={{ key: 'days', dir: 'asc' }}
      />
    </AppShell>
  )
}
