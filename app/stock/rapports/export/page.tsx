'use client'

// Export du stock : choix du périmètre et des colonnes, puis génération du
// fichier. Centralise ce que les autres écrans exportent chacun de leur côté.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Download, FileSpreadsheet, FileText, Printer } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { availableStock, fmtDH, useDroguerie, type Product } from '@/lib/store'

type ColKey = 'barcode' | 'name' | 'category' | 'brand' | 'unit' | 'stock' | 'reserved' | 'minStock' | 'cost' | 'price' | 'value' | 'location' | 'expiry'

const COLUMNS: { key: ColKey; label: string; get: (p: Product) => string | number }[] = [
  { key: 'barcode', label: 'Code-barres', get: (p) => p.barcode || '' },
  { key: 'name', label: 'Produit', get: (p) => p.name },
  { key: 'category', label: 'Catégorie', get: (p) => p.category || '' },
  { key: 'brand', label: 'Marque', get: (p) => p.brand || '' },
  { key: 'unit', label: 'Unité', get: (p) => p.unit || '' },
  { key: 'stock', label: 'Stock disponible', get: (p) => availableStock(p) },
  { key: 'reserved', label: 'Réservé', get: (p) => p.reserved ?? 0 },
  { key: 'minStock', label: 'Seuil', get: (p) => p.minStock },
  { key: 'cost', label: 'Prix d’achat', get: (p) => p.cost },
  { key: 'price', label: 'Prix de vente', get: (p) => p.price },
  { key: 'value', label: 'Valeur (achat)', get: (p) => Number((availableStock(p) * p.cost).toFixed(2)) },
  { key: 'location', label: 'Emplacement', get: (p) => p.emplacementComplet || '' },
  { key: 'expiry', label: 'Péremption', get: (p) => p.expiryDate || '' },
]

const SCOPES = [
  { value: 'all', label: 'Tout le catalogue' },
  { value: 'instock', label: 'Uniquement en stock' },
  { value: 'critical', label: 'Stock critique (≤ seuil)' },
  { value: 'zero', label: 'Rupture (stock = 0)' },
]

const DEFAULT: ColKey[] = ['barcode', 'name', 'category', 'stock', 'minStock', 'cost', 'value', 'location']

function Content() {
  const { ready, products, activeStoreId, activeStore } = useDroguerie()
  const toast = useToast()
  const [scope, setScope] = useState('all')
  const [cols, setCols] = useState<ColKey[]>(DEFAULT)

  const rows = useMemo(() => {
    const mine = products.filter((p) => !activeStoreId || !p.storeId || p.storeId === activeStoreId)
    return mine.filter((p) => {
      const s = availableStock(p)
      if (scope === 'instock') return s > 0
      if (scope === 'critical') return s <= p.minStock && p.minStock > 0
      if (scope === 'zero') return s <= 0
      return true
    })
  }, [products, activeStoreId, scope])

  const chosen = COLUMNS.filter((c) => cols.includes(c.key))
  const totalValue = useMemo(() => rows.reduce((a, p) => a + availableStock(p) * p.cost, 0), [rows])

  if (!ready) return <Loader />

  const toggle = (k: ColKey) => setCols((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]))
  const matrix = () => [chosen.map((c) => c.label), ...rows.map((p) => chosen.map((c) => c.get(p)))]

  const exportCsv = () => {
    if (chosen.length === 0) return
    const csv = matrix().map((r) => r.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `stock-${scope}.csv`; a.click(); URL.revokeObjectURL(url)
    toast(`✓ ${rows.length.toLocaleString('fr-FR')} lignes exportées`)
  }
  const exportXlsx = async () => {
    if (chosen.length === 0) return
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet(matrix())
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Stock')
    XLSX.writeFile(wb, `stock-${scope}.xlsx`)
    toast(`✓ ${rows.length.toLocaleString('fr-FR')} lignes exportées`)
  }

  return (
    <>
      <style>{`@media print { aside, header.app-header, .no-print { display:none !important } main { padding:0 !important } }`}</style>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <FileText className="h-6 w-6 text-amber-500" />Export du stock
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          Choisissez le périmètre et les colonnes — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
        </p>
      </motion.div>

      <div className="glass-card space-y-4 p-4 no-print">
        <div className="max-w-sm">
          <label className="field-label">Périmètre</label>
          <Select value={scope} onChange={setScope} options={SCOPES} />
        </div>

        <div>
          <p className="field-label">Colonnes</p>
          <div className="flex flex-wrap gap-1.5">
            {COLUMNS.map((c) => {
              const on = cols.includes(c.key)
              return (
                <button key={c.key} onClick={() => toggle(c.key)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                    on ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                       : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-white/10 dark:text-zinc-400'
                  }`}>
                  {on && <Check className="h-3 w-3" />}{c.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 dark:border-white/10">
          <span className="text-sm font-semibold tabular-nums text-gray-700 dark:text-zinc-200">
            {rows.length.toLocaleString('fr-FR')} ligne(s) · {fmtDH(totalValue)}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={exportCsv} disabled={!chosen.length || !rows.length} className="btn-secondary disabled:opacity-40"><Download className="h-4 w-4" />CSV</button>
            <button onClick={exportXlsx} disabled={!chosen.length || !rows.length} className="btn-primary disabled:opacity-40"><FileSpreadsheet className="h-4 w-4" />Excel</button>
            <button onClick={() => window.print()} disabled={!chosen.length || !rows.length} className="btn-secondary disabled:opacity-40"><Printer className="h-4 w-4" />PDF</button>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
              {chosen.map((c) => <th key={c.key} className="px-3 py-3">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 100).map((p) => (
              <tr key={p.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                {chosen.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-gray-600 dark:text-zinc-300">{String(c.get(p) ?? '')}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={Math.max(1, chosen.length)} className="px-4 py-10 text-center text-sm text-gray-400">Aucune ligne pour ce périmètre.</td></tr>}
          </tbody>
        </table>
        {rows.length > 100 && (
          <p className="p-2 text-center text-[11px] text-gray-400 no-print">
            Aperçu des 100 premières lignes — l’export contient les {rows.length.toLocaleString('fr-FR')}.
          </p>
        )}
      </div>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
