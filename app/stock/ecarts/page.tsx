'use client'

// Écarts d'inventaire : tous les mouvements de régularisation (inventaire et
// ajustements), c'est-à-dire la différence constatée entre stock théorique et
// stock compté. Sert au contrôle de gestion et à la recherche de causes.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, FileSpreadsheet, Scale, TrendingDown, TrendingUp } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import { fmtDH, useDroguerie } from '@/lib/store'

const PERIODS = [
  { days: 30, label: '30 jours' },
  { days: 90, label: '90 jours' },
  { days: 365, label: '1 an' },
  { days: 0, label: 'Tout' },
]

function Content() {
  const { ready, movements, products, activeStoreId, activeStore } = useDroguerie()
  const [days, setDays] = useState(90)

  const rows = useMemo(() => {
    const since = days > 0 ? Date.now() - days * 86400000 : 0
    const cost = new Map(products.map((p) => [p.id, p.cost]))
    return movements
      .filter((m) => !m.storeId || m.storeId === activeStoreId)
      .filter((m) => m.type === 'inventaire' || m.type === 'ajustement')
      .filter((m) => new Date(m.date).getTime() >= since)
      .map((m) => ({ ...m, value: Math.abs(m.qty) * (cost.get(m.productId) ?? 0) }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [movements, products, activeStoreId, days])

  const totals = useMemo(() => {
    let plus = 0, minus = 0, value = 0
    for (const r of rows) {
      if (r.qty > 0) plus += r.qty
      else minus += Math.abs(r.qty)
      value += r.qty < 0 ? -r.value : r.value
    }
    return { plus, minus, value, count: rows.length }
  }, [rows])

  if (!ready) return <Loader />

  const headers = ['Date', 'Produit', 'Type', 'Écart', 'Valeur', 'Note']
  const data = () => rows.map((r) => [
    new Date(r.date).toLocaleDateString('fr-FR'), r.productName, r.type,
    r.qty, r.value.toFixed(2), r.note ?? '',
  ])
  const exportCsv = () => {
    const csv = [headers, ...data()].map((x) => x.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'ecarts-inventaire.csv'; a.click(); URL.revokeObjectURL(url)
  }
  const exportXlsx = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data()])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Écarts'); XLSX.writeFile(wb, 'ecarts-inventaire.xlsx')
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Scale className="h-6 w-6 text-amber-500" />Écarts d’inventaire
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            Régularisations constatées — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} disabled={!rows.length} className="btn-secondary disabled:opacity-40"><Download className="h-4 w-4" />CSV</button>
          <button onClick={exportXlsx} disabled={!rows.length} className="btn-secondary disabled:opacity-40"><FileSpreadsheet className="h-4 w-4" />Excel</button>
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button key={p.days} onClick={() => setDays(p.days)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${days === p.days ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-zinc-300'}`}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { v: totals.count, l: 'Régularisations', c: 'text-gray-900 dark:text-white' },
          { v: `+${totals.plus}`, l: 'Écarts positifs', c: 'text-emerald-600 dark:text-emerald-400' },
          { v: `−${totals.minus}`, l: 'Écarts négatifs', c: 'text-rose-500' },
          { v: fmtDH(totals.value), l: 'Impact valorisé', c: totals.value < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-4 text-center">
            <p className={`text-xl font-extrabold tabular-nums ${s.c}`}>{s.v}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-x-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Scale className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">Aucun écart sur la période — le stock théorique correspond au comptage.</p>
          </div>
        ) : (
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                <th className="px-4 py-3">Date</th><th className="px-4 py-3">Produit</th>
                <th className="px-4 py-3">Origine</th><th className="px-4 py-3 text-center">Écart</th>
                <th className="px-4 py-3 text-right">Valeur</th><th className="px-4 py-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 400).map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(r.date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{r.productName}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{r.type === 'inventaire' ? 'Inventaire' : 'Ajustement'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${r.qty < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {r.qty < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                      {r.qty > 0 ? '+' : ''}{r.qty}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-zinc-300">{fmtDH(r.value)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{r.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
