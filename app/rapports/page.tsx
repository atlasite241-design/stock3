'use client'

import { useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Download, Printer, TrendingDown, TrendingUp } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import AppShell from '@/components/AppShell'
import { exportSalesCSV, fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

type Period = '7j' | '30j' | 'tout'
const DONUT_COLORS = ['#f59e0b', '#facc15', '#fb923c', '#0ea5e9', '#10b981', '#a78bfa', '#94a3b8']

function Content() {
  const { ready, products, sales, clients, suppliers } = useDroguerie()
  const { t } = useLanguage()
  const [period, setPeriod] = useState<Period>('30j')

  if (!ready) {
    return <Loader />
  }

  const now = new Date()
  const cutoff = (days: number) => {
    const d = new Date()
    d.setDate(now.getDate() - days)
    return d
  }
  const inPeriod = sales.filter((s) => {
    if (period === 'tout') return true
    return new Date(s.date) >= cutoff(period === '7j' ? 6 : 29)
  })

  const ca = inPeriod.reduce((a, s) => a + s.total, 0)
  const profit = inPeriod.reduce((a, s) => a + s.profit, 0)
  const stockValue = products.reduce((a, p) => a + p.cost * p.stock, 0)
  const totalCredit = clients.reduce((a, c) => a + c.credit, 0)
  const totalDebt = suppliers.reduce((a, s) => a + s.balance, 0)

  // Product sales aggregation
  const prodMap = new Map<string, { name: string; qty: number; revenue: number; profit: number }>()
  products.forEach((p) => prodMap.set(p.id, { name: p.name, qty: 0, revenue: 0, profit: 0 }))
  inPeriod.forEach((s) =>
    s.items.forEach((i) => {
      const e = prodMap.get(i.productId)
      if (!e) return
      const p = products.find((x) => x.id === i.productId)
      e.qty += i.qty
      e.revenue += i.price * i.qty
      e.profit += (i.price - (p?.cost ?? 0)) * i.qty
    })
  )
  const ranked = Array.from(prodMap.values()).sort((a, b) => b.qty - a.qty)
  const topProducts = ranked.slice(0, 6)
  const worstProducts = ranked.filter((p) => p.qty === 0).slice(0, 6)

  // Category breakdown
  const catMap = new Map<string, number>()
  inPeriod.forEach((s) =>
    s.items.forEach((i) => {
      const cat = products.find((p) => p.id === i.productId)?.category ?? 'Autre'
      catMap.set(cat, (catMap.get(cat) ?? 0) + i.price * i.qty)
    })
  )
  const catData = Array.from(catMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const cards = [
    { label: t('rep_kpi_revenue'), value: fmtDH(ca), sub: `${inPeriod.length} ${t('rep_kpi_sales_count')}` },
    { label: t('rep_kpi_profit'), value: fmtDH(profit), sub: `${t('rep_margin')} ${ca > 0 ? ((profit / ca) * 100).toFixed(0) : 0}%` },
    { label: t('rep_kpi_stock_value'), value: fmtDH(stockValue), sub: `${products.length} ${t('rep_kpi_products_count')}` },
    { label: t('rep_kpi_receivables'), value: fmtDH(totalCredit), sub: `${t('rep_suppliers_debts')} ${fmtDH(totalDebt)}` },
  ]

  const periods: { key: Period; label: string }[] = [
    { key: '7j', label: t('poh_period_7d') },
    { key: '30j', label: t('poh_period_30d') },
    { key: 'tout', label: t('poh_period_all') },
  ]

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('rep_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('rep_subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer className="h-4 w-4" />
            {t('rep_print')}
          </button>
          <button onClick={() => exportSalesCSV(inPeriod)} className="btn-secondary">
            <Download className="h-4 w-4" />
            {t('rep_export_csv')}
          </button>
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-2">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              period === p.key
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-lg shadow-amber-400/25'
                : 'border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 hover:border-amber-300 hover:bg-amber-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.4 }}
            className="glass-card p-5"
          >
            <p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">{c.label}</p>
            <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
              {c.value}
            </p>
            <p className="mt-2 text-xs text-gray-400 dark:text-zinc-500">{c.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 xl:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="glass-card p-6 xl:col-span-2"
        >
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('rep_top_products')}</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t('rep_qty_sold_period')}</p>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} margin={{ top: 5, right: 5, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 12) + '…' : v)}
                />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(245,158,11,0.08)' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Bar dataKey="qty" name={t('rep_sold')} fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="glass-card flex flex-col p-6"
        >
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('rep_by_category')}</h2>
          <div className="relative mx-auto mt-2 h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  formatter={(v: number) => fmtDH(v)}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Pie data={catData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={84} paddingAngle={4} cornerRadius={6} stroke="none">
                  {catData.map((c, i) => (
                    <Cell key={c.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-2">
            {catData.slice(0, 5).map((c, i) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                <span className="flex-1 truncate text-sm text-gray-600 dark:text-zinc-400">{c.name}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{fmtDH(c.value)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Best / worst tables */}
      <div className="grid gap-6 xl:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="glass-card p-6"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            {t('rep_best_margins')}
          </h2>
          <div className="mt-4 space-y-2">
            {[...topProducts].sort((a, b) => b.profit - a.profit).slice(0, 5).map((p) => (
              <div key={p.name} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50/60 dark:bg-white/5 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtDH(p.profit)}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="glass-card p-6"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            <TrendingDown className="h-4 w-4 text-rose-500 dark:text-rose-400" />
            {t('rep_unsold_products')}
          </h2>
          <div className="mt-4 space-y-2">
            {worstProducts.map((p) => (
              <div key={p.name} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50/60 dark:bg-white/5 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
                <span className="text-xs font-semibold text-gray-400 dark:text-zinc-500">{t('rep_zero_sold')}</span>
              </div>
            ))}
            {worstProducts.length === 0 && (
              <p className="py-6 text-center text-sm text-emerald-600 dark:text-emerald-400">{t('rep_all_selling')}</p>
            )}
          </div>
        </motion.div>
      </div>
    </>
  )
}

export default function RapportsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
