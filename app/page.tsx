'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Barcode,
  Boxes,
  ChevronRight,
  Download,
  PackagePlus,
  Plus,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import {
  Area,
  AreaChart,
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
import Select from '@/components/Select'
import { exportSalesCSV, fmtDH, PAYMENT_META, useDroguerie } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const DAY_KEYS: TKey[] = ['day_sun', 'day_mon', 'day_tue', 'day_wed', 'day_thu', 'day_fri', 'day_sat']
const DONUT_COLORS = ['#f59e0b', '#facc15', '#fb923c', '#0ea5e9', '#10b981', '#a78bfa', '#94a3b8']

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] px-4 py-3 shadow-xl">
      <p className="mb-1 text-xs font-medium text-gray-500 dark:text-zinc-400">{label}</p>
      <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
        {fmtDH(Number(payload[0].value))}
      </p>
      {payload[0].payload.ventes !== undefined && (
        <p className="text-xs text-gray-500 dark:text-zinc-400">{payload[0].payload.ventes} vente(s)</p>
      )}
    </div>
  )
}

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-500 dark:text-zinc-400">{payload[0].name}</p>
      <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
        {fmtDH(Number(payload[0].value))}
      </p>
    </div>
  )
}

function TrendChip({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs font-medium text-gray-400 dark:text-zinc-500">—</span>
  const up = pct >= 0
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${
        up ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
      }`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  )
}

export default function DashboardPage() {
  const { ready, products: scopedProducts, sales: scopedSales, allProducts, allSales, stores, activeStore } = useDroguerie()
  const { t, lang } = useLanguage()
  const [dateStr, setDateStr] = useState('')
  const [scope, setScope] = useState('active')

  // Administrators can consolidate every store; otherwise the dashboard follows the active store.
  const consolidated = scope === 'all'
  const products = consolidated ? allProducts : scopedProducts
  const sales = consolidated ? allSales : scopedSales

  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    )
  }, [lang])

  if (!ready) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">
          {t('dash_loading')}
        </div>
      </AppShell>
    )
  }

  // --- Today vs yesterday ---
  const dayKey = (d: Date) => d.toDateString()
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const salesOf = (key: string) => sales.filter((s) => dayKey(new Date(s.date)) === key)
  const todaySales = salesOf(dayKey(today))
  const yesterdaySales = salesOf(dayKey(yesterday))

  const caToday = todaySales.reduce((a, s) => a + s.total, 0)
  const caYesterday = yesterdaySales.reduce((a, s) => a + s.total, 0)
  const profitToday = todaySales.reduce((a, s) => a + s.profit, 0)
  const profitYesterday = yesterdaySales.reduce((a, s) => a + s.profit, 0)

  const pct = (t: number, y: number) => (y > 0 ? ((t - y) / y) * 100 : null)

  const lowStock = products
    .filter((p) => p.stock <= p.minStock)
    .sort((a, b) => a.stock - b.stock)

  const kpis = [
    {
      label: t('dash_kpi_ca_today'),
      value: fmtDH(caToday),
      icon: Wallet,
      iconClass: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500',
      trend: pct(caToday, caYesterday),
    },
    {
      label: t('dash_kpi_sales_today'),
      value: String(todaySales.length),
      icon: ShoppingCart,
      iconClass: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
      trend: pct(todaySales.length, yesterdaySales.length),
    },
    {
      label: t('dash_kpi_profit_today'),
      value: fmtDH(profitToday),
      icon: TrendingUp,
      iconClass: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
      trend: pct(profitToday, profitYesterday),
    },
    {
      label: t('dash_kpi_low_stock'),
      value: String(lowStock.length),
      icon: AlertTriangle,
      iconClass: lowStock.length > 0 ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
      trend: null,
    },
  ]

  // --- 7-day revenue chart ---
  const days: { label: string; ca: number; ventes: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const daySales = salesOf(dayKey(d))
    days.push({
      label: t(DAY_KEYS[d.getDay()]),
      ca: daySales.reduce((a, s) => a + s.total, 0),
      ventes: daySales.length,
    })
  }
  const ca7 = days.reduce((a, d) => a + d.ca, 0)

  // --- Sales by category ---
  const catMap = new Map<string, number>()
  sales.forEach((s) =>
    s.items.forEach((i) => {
      const cat = products.find((p) => p.id === i.productId)?.category ?? t('dash_other_category')
      catMap.set(cat, (catMap.get(cat) ?? 0) + i.price * i.qty)
    })
  )
  const catData = Array.from(catMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
  const catTotal = catData.reduce((a, c) => a + c.value, 0)

  // --- Top products ---
  const prodMap = new Map<string, { name: string; qty: number; revenue: number }>()
  sales.forEach((s) =>
    s.items.forEach((i) => {
      const e = prodMap.get(i.productId) ?? { name: i.name, qty: 0, revenue: 0 }
      e.qty += i.qty
      e.revenue += i.price * i.qty
      prodMap.set(i.productId, e)
    })
  )
  const topProducts = Array.from(prodMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)
  const maxQty = topProducts[0]?.qty ?? 1

  const recentSales = [...sales].slice(-6).reverse()

  const quickActions = [
    { href: '/caisse', label: t('dash_qa_new_sale'), icon: ShoppingCart },
    { href: '/produits?new=1', label: t('dash_qa_add_product'), icon: PackagePlus },
    { href: '/stock', label: t('dash_qa_manage_stock'), icon: Boxes },
    { href: '/clients', label: t('dash_qa_clients'), icon: Users },
  ]

  return (
    <AppShell>
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <p className="text-sm font-medium capitalize text-gray-500 dark:text-zinc-400">
            {dateStr} · {t('dash_hello')} 👋
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            {t('dash_title')}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {stores.length > 1 && (
            <Select
              className="w-52"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'active', label: activeStore?.name ?? t('mag_current') },
                { value: 'all', label: `${t('mag_all_stores')} · ${t('mag_consolidated')}` },
              ]}
            />
          )}
          <Link href="/caisse" className="btn-secondary">
            <Barcode className="h-4 w-4" />
            {t('dash_scan')}
          </Link>
          <button onClick={() => exportSalesCSV(sales)} className="btn-secondary">
            <Download className="h-4 w-4" />
            {t('dash_export')}
          </button>
          <Link href="/caisse" className="btn-primary">
            <Plus className="h-4 w-4" />
            {t('dash_new_sale')}
          </Link>
        </div>
      </motion.div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.4 }}
            className="glass-card glass-card-hover p-5"
          >
            <div className="flex items-start justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.iconClass}`}>
                <k.icon className="h-5 w-5" />
              </div>
              <TrendChip pct={k.trend} />
            </div>
            <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{k.label}</p>
            <p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
              {k.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Revenue chart + categories */}
      <div className="grid gap-6 xl:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="glass-card p-6 xl:col-span-2"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('dash_revenue_title')}</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t('dash_revenue_period')}</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900 dark:text-white tabular-nums">
                {fmtDH(ca7)}
              </p>
            </div>
            <Link href="/ventes" className="btn-secondary !h-9 !px-3 text-xs">
              {t('dash_view_sales')}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days} margin={{ top: 5, right: 5, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: 'rgba(0,0,0,0.15)', strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey="ca"
                  name="CA"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  fill="url(#gradCA)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Categories donut */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="glass-card flex flex-col p-6"
        >
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('dash_sales_by_cat')}</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t('dash_all_sales')}</p>
          <div className="relative mx-auto mt-2 h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<DonutTooltip />} />
                <Pie
                  data={catData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={84}
                  paddingAngle={4}
                  cornerRadius={8}
                  stroke="none"
                >
                  {catData.map((c, i) => (
                    <Cell key={c.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-xl font-bold tracking-tight text-gray-900 dark:text-white tabular-nums">
                {fmtDH(catTotal)}
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{t('dash_total')}</p>
            </div>
          </div>
          <div className="mt-3 space-y-2.5">
            {catData.slice(0, 5).map((c, i) => (
              <div key={c.name} className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                />
                <span className="flex-1 truncate text-sm text-gray-600 dark:text-zinc-400">{c.name}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                  {fmtDH(c.value)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Top products + recent sales */}
      <div className="grid gap-6 xl:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="glass-card p-6 xl:col-span-2"
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('dash_top_products')}</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t('dash_best_sellers')}</p>
            </div>
            <Link href="/produits" className="text-xs font-bold text-amber-600 dark:text-amber-400 transition hover:text-amber-500">
              {t('dash_all_products')}
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10 text-xs font-bold text-amber-600 dark:text-amber-400">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                    <p className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                      {fmtDH(p.revenue)}
                    </p>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500"
                        style={{ width: `${(p.qty / maxQty) * 100}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-gray-500 dark:text-zinc-400 tabular-nums">
                      {p.qty} {t('dash_sold')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {topProducts.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_no_sales_yet')}</p>
            )}
          </div>
        </motion.div>

        {/* Recent sales */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="glass-card flex flex-col p-6"
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('dash_recent_sales')}</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t('dash_last_transactions')}</p>
            </div>
            <Receipt className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
          </div>
          <div className="mt-4 flex-1 space-y-1">
            {recentSales.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-amber-50/60"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-zinc-400">
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white tabular-nums">{fmtDH(s.total)}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}{' '}
                    {new Date(s.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}
                    {s.items.reduce((a, i) => a + i.qty, 0)} {t('dash_articles_abbr')}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${PAYMENT_META[s.payment].chip}`}
                >
                  {PAYMENT_META[s.payment].label}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/ventes"
            className="mt-4 block w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 py-2.5 text-center text-xs font-bold text-gray-700 dark:text-zinc-300 transition hover:border-amber-300 hover:bg-amber-50"
          >
            {t('dash_view_all_sales')}
          </Link>
        </motion.div>
      </div>

      {/* Low stock + quick actions */}
      <div className="grid gap-6 xl:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="glass-card p-6 xl:col-span-2"
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('dash_low_stock_title')}</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t('dash_low_stock_desc')}</p>
            </div>
            <Link href="/stock" className="text-xs font-bold text-amber-600 dark:text-amber-400 transition hover:text-amber-500">
              {t('dash_manage_stock')}
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {lowStock.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center gap-4">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    p.stock === 0 ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-500'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                    <p className="shrink-0 text-xs font-semibold text-gray-500 dark:text-zinc-400 tabular-nums">
                      {p.stock} / min. {p.minStock}
                    </p>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <div
                      className={`h-full rounded-full ${p.stock === 0 ? 'bg-rose-500' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(100, (p.stock / (p.minStock * 2)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {lowStock.length === 0 && (
              <p className="py-6 text-center text-sm text-emerald-600 dark:text-emerald-400">
                {t('dash_all_stock_ok')}
              </p>
            )}
          </div>
        </motion.div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="glass-card p-6"
        >
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('dash_quick_actions')}</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t('dash_direct_access')}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {quickActions.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="glass-card-hover flex flex-col items-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/5 p-4 text-center"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-gray-900 shadow-lg shadow-amber-400/25">
                  <a.icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">{a.label}</span>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-2 pb-4 pt-2 text-xs text-gray-400 dark:text-zinc-500">
        <p>© 2026 Droguerie Pro — Gestion &amp; Caisse.</p>
        <p className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          {t('dash_footer_saved')}
        </p>
      </footer>
    </AppShell>
  )
}
