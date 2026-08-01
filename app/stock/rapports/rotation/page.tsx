'use client'

// Rotation des stocks : à quelle vitesse chaque article s'écoule.
//
// Rotation = quantité sortie sur la période ÷ stock disponible actuel.
// (Le stock moyen exact demanderait un historique de niveaux ; le stock
// courant en est l'approximation usuelle en distribution.)
// Couverture = nombre de jours que le stock actuel peut tenir au rythme observé.

import { RefreshCw } from 'lucide-react'
import AppShell from '@/components/AppShell'
import StockAuditView, { colCategory, colStock, type AuditColumn } from '@/components/stock/StockAuditView'
import { availableStock } from '@/lib/store'

const rotation = (stock: number, out90: number) => (stock > 0 ? out90 / stock : out90 > 0 ? 99 : 0)
const coverage = (stock: number, out90: number) => (out90 > 0 ? Math.floor(stock / (out90 / 90)) : null)

const colOut: AuditColumn = {
  key: 'out', label: 'sk_rot_col_out', align: 'center',
  raw: (p, c) => c.out90.get(p.id) ?? 0,
  render: (p, c) => <span className="tabular-nums text-gray-600 dark:text-zinc-300">{c.out90.get(p.id) ?? 0}</span>,
}

const colRotation: AuditColumn = {
  key: 'rot', label: 'sk_rot_col_ratio', align: 'center',
  raw: (p, c) => Number(rotation(availableStock(p), c.out90.get(p.id) ?? 0).toFixed(2)),
  render: (p, c) => {
    const r = rotation(availableStock(p), c.out90.get(p.id) ?? 0)
    return (
      <span className={`font-bold tabular-nums ${r >= 2 ? 'text-emerald-600 dark:text-emerald-400' : r >= 0.5 ? 'text-amber-500' : 'text-rose-500'}`}>
        {r.toFixed(2)}
      </span>
    )
  },
}

const colCoverage: AuditColumn = {
  key: 'cov', label: 'sk_rot_col_cov', align: 'center',
  raw: (p, c) => coverage(availableStock(p), c.out90.get(p.id) ?? 0) ?? 9999,
  render: (p, c) => {
    const d = coverage(availableStock(p), c.out90.get(p.id) ?? 0)
    return d === null
      ? <span className="text-xs text-gray-400">—</span>
      : <span className="tabular-nums text-gray-600 dark:text-zinc-300">{d} {c.t('sa_days')}</span>
  },
}

const colClass: AuditColumn = {
  key: 'cls', label: 'sk_rot_col_class', align: 'center',
  raw: (p, c) => rotation(availableStock(p), c.out90.get(p.id) ?? 0),
  render: (p, c) => {
    const r = rotation(availableStock(p), c.out90.get(p.id) ?? 0)
    const [key, cls] = r >= 2
      ? ['sk_rot_fast', 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'] as const
      : r >= 0.5 ? ['sk_rot_medium', 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'] as const
      : r > 0 ? ['sk_rot_slow', 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'] as const
      : ['sk_rot_still', 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'] as const
    return <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${cls}`}>{c.t(key)}</span>
  },
}

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="sk_rot_title"
        subtitle="sk_rot_sub"
        icon={RefreshCw}
        accent="cyan"
        emptyLabel="sk_rot_empty"
        note="sk_rot_note"
        filter={(p) => availableStock(p) > 0}
        columns={[colCategory, colStock, colOut, colRotation, colCoverage, colClass]}
        defaultSort={{ key: 'rot', dir: 'asc' }}
      />
    </AppShell>
  )
}
