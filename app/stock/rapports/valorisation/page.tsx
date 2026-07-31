'use client'

// Valorisation du stock : combien vaut ce qui est en rayon, au prix d'achat
// (valeur immobilisée) et au prix de vente (chiffre d'affaires potentiel).

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Coins, Download, FileSpreadsheet, Printer } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import { availableStock, fmtDH, useDroguerie } from '@/lib/store'

const HUES = ['#f59e0b', '#6366f1', '#10b981', '#ef4444', '#0ea5e9', '#a855f7', '#f43f5e', '#84cc16']

function Content() {
  const { ready, products, activeStoreId, activeStore } = useDroguerie()

  const { rows, totals } = useMemo(() => {
    const mine = products.filter((p) => !activeStoreId || !p.storeId || p.storeId === activeStoreId)
    const byCat = new Map<string, { qty: number; cost: number; sale: number; refs: number }>()
    let qty = 0, cost = 0, sale = 0, refs = 0, zero = 0

    for (const p of mine) {
      const s = availableStock(p)
      refs++
      if (s <= 0) { zero++; continue }
      qty += s
      cost += s * p.cost
      sale += s * p.price
      const key = p.category || 'Sans catégorie'
      const c = byCat.get(key) ?? { qty: 0, cost: 0, sale: 0, refs: 0 }
      c.qty += s; c.cost += s * p.cost; c.sale += s * p.price; c.refs++
      byCat.set(key, c)
    }

    const rows = [...byCat.entries()]
      .map(([category, v]) => ({ category, ...v, margin: v.sale - v.cost }))
      .sort((a, b) => b.cost - a.cost)

    return { rows, totals: { qty, cost, sale, refs, zero, margin: sale - cost } }
  }, [products, activeStoreId])

  if (!ready) return <Loader />

  const headers = ['Catégorie', 'Références', 'Quantité', 'Valeur achat', 'Valeur vente', 'Marge potentielle']
  const data = () => rows.map((r) => [r.category, r.refs, r.qty, r.cost.toFixed(2), r.sale.toFixed(2), r.margin.toFixed(2)])
  const exportCsv = () => {
    const csv = [headers, ...data()].map((x) => x.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'valorisation-stock.csv'; a.click(); URL.revokeObjectURL(url)
  }
  const exportXlsx = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data()])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Valorisation'); XLSX.writeFile(wb, 'valorisation-stock.xlsx')
  }

  const chart = rows.slice(0, 10).map((r) => ({ name: r.category.slice(0, 14), valeur: Number(r.cost.toFixed(2)) }))

  return (
    <>
      <style>{`@media print { aside, header.app-header, .no-print { display:none !important } main { padding:0 !important } }`}</style>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Coins className="h-6 w-6 text-amber-500" />Valorisation du stock
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            Capital immobilisé et potentiel de vente — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button onClick={exportCsv} className="btn-secondary"><Download className="h-4 w-4" />CSV</button>
          <button onClick={exportXlsx} className="btn-secondary"><FileSpreadsheet className="h-4 w-4" />Excel</button>
          <button onClick={() => window.print()} className="btn-secondary"><Printer className="h-4 w-4" />PDF</button>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { v: totals.refs.toLocaleString('fr-FR'), l: 'Références', c: 'text-gray-900 dark:text-white' },
          { v: totals.qty.toLocaleString('fr-FR'), l: 'Unités en stock', c: 'text-indigo-600 dark:text-indigo-400' },
          { v: fmtDH(totals.cost), l: 'Valeur d’achat', c: 'text-amber-600 dark:text-amber-400' },
          { v: fmtDH(totals.sale), l: 'Valeur de vente', c: 'text-emerald-600 dark:text-emerald-400' },
          { v: fmtDH(totals.margin), l: 'Marge potentielle', c: 'text-violet-600 dark:text-violet-400' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-4 text-center">
            <p className={`text-xl font-extrabold tabular-nums ${s.c}`}>{s.v}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
          </div>
        ))}
      </div>

      {totals.zero > 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 p-3 text-xs text-gray-500 dark:border-white/15 dark:text-zinc-400">
          {totals.zero.toLocaleString('fr-FR')} référence(s) sans stock ne sont pas valorisées.
        </p>
      )}

      {chart.length > 0 && (
        <div className="glass-card p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">Valeur d’achat par catégorie (top 10)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chart} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={70} />
              <Tooltip formatter={(v: number) => fmtDH(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="valeur" radius={[4, 4, 0, 0]}>
                {chart.map((_, i) => <Cell key={i} fill={HUES[i % HUES.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="glass-card overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
              <th className="px-4 py-3">Catégorie</th><th className="px-4 py-3 text-center">Réf.</th>
              <th className="px-4 py-3 text-center">Quantité</th><th className="px-4 py-3 text-right">Valeur achat</th>
              <th className="px-4 py-3 text-right">Valeur vente</th><th className="px-4 py-3 text-right">Marge</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{r.category}</td>
                <td className="px-4 py-2.5 text-center tabular-nums text-gray-500">{r.refs}</td>
                <td className="px-4 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{r.qty.toLocaleString('fr-FR')}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400">{fmtDH(r.cost)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmtDH(r.sale)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-violet-600 dark:text-violet-400">{fmtDH(r.margin)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">Aucun stock à valoriser.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
