'use client'

import { AlertOctagon } from 'lucide-react'
import AppShell from '@/components/AppShell'
import StockAuditView, { colStock, colValue, type AuditColumn } from '@/components/stock/StockAuditView'
import { availableStock, type Product } from '@/lib/store'

/**
 * Anomalies détectables à partir des seules données existantes. Chaque règle
 * décrit un état incohérent — pas une simple alerte de gestion (celles-ci ont
 * leurs propres écrans : stock critique, dormants…).
 */
const rules: { label: string; hit: (p: Product) => boolean }[] = [
  { label: 'Stock négatif', hit: (p) => p.stock < 0 },
  { label: 'Réservé > stock', hit: (p) => (p.reserved ?? 0) > p.stock },
  { label: 'Prix de vente inférieur au coût', hit: (p) => p.price > 0 && p.cost > 0 && p.price < p.cost },
  { label: 'Prix de vente manquant', hit: (p) => !p.price || p.price <= 0 },
  { label: 'Coût d’achat manquant', hit: (p) => (!p.cost || p.cost <= 0) && p.stock > 0 },
  { label: 'Code-barres manquant', hit: (p) => !p.barcode },
  { label: 'Sans catégorie', hit: (p) => !p.category },
  { label: 'Seuil non défini', hit: (p) => p.minStock === 0 && availableStock(p) > 0 },
]

const anomaliesOf = (p: Product) => rules.filter((r) => r.hit(p)).map((r) => r.label)

const colIssues: AuditColumn = {
  key: 'issues', label: 'Anomalies détectées',
  raw: (p) => anomaliesOf(p).join(' · '),
  render: (p) => (
    <div className="flex flex-wrap gap-1">
      {anomaliesOf(p).map((a) => (
        <span key={a} className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{a}</span>
      ))}
    </div>
  ),
}

const colCount: AuditColumn = {
  key: 'count', label: 'Nb', align: 'center',
  raw: (p) => anomaliesOf(p).length,
  render: (p) => <span className="font-bold tabular-nums text-rose-500">{anomaliesOf(p).length}</span>,
}

export default function Page() {
  return (
    <AppShell>
      <StockAuditView
        title="Anomalies de stock"
        subtitle="Incohérences dans les fiches produits : valeurs impossibles ou informations manquantes."
        icon={AlertOctagon}
        accent="rose"
        emptyLabel="Aucune anomalie détectée 🎉"
        note={`Règles appliquées : ${rules.map((r) => r.label).join(' · ')}.`}
        filter={(p) => anomaliesOf(p).length > 0}
        columns={[colCount, colIssues, colStock, colValue]}
        defaultSort={{ key: 'count', dir: 'desc' }}
      />
    </AppShell>
  )
}
