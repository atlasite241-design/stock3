'use client'

// Historique du stock : évolution du niveau global dans le temps.
//
// Il n'existe pas de photo quotidienne du stock en base. On le reconstitue
// donc à rebours : niveau à une date = stock actuel − somme des mouvements
// postérieurs à cette date. C'est exact tant que l'historique des mouvements
// est complet — d'où l'avertissement affiché.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, History, TrendingDown, TrendingUp } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import { availableStock, fmtDH, useDroguerie } from '@/lib/store'

const RANGES = [
  { days: 30, label: '30 jours' },
  { days: 90, label: '90 jours' },
  { days: 180, label: '6 mois' },
  { days: 365, label: '1 an' },
]

function Content() {
  const { ready, products, movements, activeStoreId, activeStore } = useDroguerie()
  const [days, setDays] = useState(90)

  const { series, first, last, oldest } = useMemo(() => {
    const mine = products.filter((p) => !activeStoreId || !p.storeId || p.storeId === activeStoreId)
    const costOf = new Map(mine.map((p) => [p.id, p.cost]))
    const ids = new Set(mine.map((p) => p.id))

    let qtyNow = 0, valNow = 0
    for (const p of mine) { const s = availableStock(p); qtyNow += s; valNow += s * p.cost }

    const mv = movements
      .filter((m) => (!m.storeId || m.storeId === activeStoreId) && ids.has(m.productId))
      .map((m) => ({ ts: new Date(m.date).getTime(), qty: m.qty, val: m.qty * (costOf.get(m.productId) ?? 0) }))
      .sort((a, b) => b.ts - a.ts) // du plus récent au plus ancien

    const oldest = mv.length ? new Date(Math.min(...mv.map((m) => m.ts))) : null

    // Remontée dans le temps, jour par jour : on retranche les mouvements
    // survenus après chaque borne.
    const today = new Date(); today.setHours(23, 59, 59, 999)
    const points: { date: string; quantité: number; valeur: number }[] = []
    let qty = qtyNow, val = valNow, i = 0
    for (let d = 0; d <= days; d++) {
      const bound = today.getTime() - d * 86400000
      while (i < mv.length && mv[i].ts > bound) { qty -= mv[i].qty; val -= mv[i].val; i++ }
      points.push({
        date: new Date(bound).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        quantité: Math.round(qty),
        valeur: Number(val.toFixed(2)),
      })
    }
    points.reverse()
    return { series: points, first: points[0], last: points[points.length - 1], oldest }
  }, [products, movements, activeStoreId, days])

  if (!ready) return <Loader />

  const dQty = last.quantité - first.quantité
  const dVal = last.valeur - first.valeur

  const exportCsv = () => {
    const csv = [['Date', 'Quantité', 'Valeur'], ...series.map((s) => [s.date, s.quantité, s.valeur.toFixed(2)])]
      .map((r) => r.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'historique-stock.csv'; a.click(); URL.revokeObjectURL(url)
  }

  // Au-delà de l'historique réellement disponible, la reconstitution est plate
  // et donc trompeuse : on le dit.
  const truncated = oldest && Date.now() - oldest.getTime() < days * 86400000

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <History className="h-6 w-6 text-amber-500" />Historique du stock
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            Évolution du niveau global — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <button onClick={exportCsv} className="btn-secondary"><Download className="h-4 w-4" />CSV</button>
      </motion.div>

      <div className="flex flex-wrap gap-1.5">
        {RANGES.map((r) => (
          <button key={r.days} onClick={() => setDays(r.days)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${days === r.days ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-zinc-300'}`}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { v: first.quantité.toLocaleString('fr-FR'), l: `Il y a ${days} j`, c: 'text-gray-500' },
          { v: last.quantité.toLocaleString('fr-FR'), l: 'Aujourd’hui', c: 'text-gray-900 dark:text-white' },
          { v: `${dQty >= 0 ? '+' : ''}${dQty.toLocaleString('fr-FR')}`, l: 'Variation (unités)', c: dQty < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400' },
          { v: `${dVal >= 0 ? '+' : ''}${fmtDH(dVal)}`, l: 'Variation (valeur)', c: dVal < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-4 text-center">
            <p className={`text-xl font-extrabold tabular-nums ${s.c}`}>{s.v}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
          </div>
        ))}
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-dashed border-gray-200 p-3 text-xs text-gray-500 dark:border-white/15 dark:text-zinc-400">
        {dQty < 0 ? <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" /> : <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
        Le niveau passé est reconstitué à partir des mouvements (aucune photo quotidienne n’est stockée).
        {truncated && oldest && ` L’historique ne remonte qu’au ${oldest.toLocaleDateString('fr-FR')} : avant cette date la courbe est plate et sans signification.`}
      </p>

      <div className="glass-card p-4">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="gq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" minTickGap={24} />
            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={60} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }}
              formatter={(v: number, n: string) => (n === 'valeur' ? fmtDH(v) : v.toLocaleString('fr-FR'))} />
            <Area type="monotone" dataKey="quantité" stroke="#f59e0b" strokeWidth={2} fill="url(#gq)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
