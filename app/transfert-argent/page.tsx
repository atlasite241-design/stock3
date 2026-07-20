'use client'

import { useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { ArrowLeftRight, Coins, Route, Search, TrendingUp, Trash2 } from 'lucide-react'
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
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { TRANSFER_ROUTES, fmtDH, useDroguerie, type MoneyTransfer } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const DONUT_COLORS = ['#38bdf8', '#0ea5e9', '#6366f1', '#0891b2', '#818cf8', '#22d3ee', '#3b82f6', '#7dd3fc']
const MONTH_KEYS: TKey[] = ['month_jan', 'month_feb', 'month_mar', 'month_apr', 'month_may', 'month_jun', 'month_jul', 'month_aug', 'month_sep', 'month_oct', 'month_nov', 'month_dec']

const EMPTY_FORM = {
  route: TRANSFER_ROUTES[0],
  label: '',
  amount: '',
}

function Content() {
  const { ready, moneyTransfers, addMoneyTransfer, deleteMoneyTransfer } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [routeFilter, setRouteFilter] = useState('Tous')
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<MoneyTransfer | null>(null)

  const now = new Date()
  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`

  const monthly = useMemo(() => {
    const buckets: { key: string; label: string; total: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({ key: monthKey(d), label: t(MONTH_KEYS[d.getMonth()]), total: 0 })
    }
    moneyTransfers.forEach((m) => {
      const key = monthKey(new Date(m.date))
      const bucket = buckets.find((b) => b.key === key)
      if (bucket) bucket.total += m.amount
    })
    return buckets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moneyTransfers])

  const routeData = useMemo(() => {
    const map = new Map<string, number>()
    moneyTransfers.forEach((m) => map.set(m.route, (map.get(m.route) ?? 0) + m.amount))
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [moneyTransfers])
  const routeTotal = routeData.reduce((a, c) => a + c.value, 0)

  if (!ready) {
    return <Loader />
  }

  const thisMonthTotal = moneyTransfers
    .filter((m) => monthKey(new Date(m.date)) === monthKey(now))
    .reduce((a, m) => a + m.amount, 0)
  const thisMonthCount = moneyTransfers.filter((m) => monthKey(new Date(m.date)) === monthKey(now)).length
  const thisYearTotal = moneyTransfers
    .filter((m) => new Date(m.date).getFullYear() === now.getFullYear())
    .reduce((a, m) => a + m.amount, 0)
  const topRoute = routeData[0]

  const cards = [
    { label: t('mtr_kpi_month_total'), value: fmtDH(thisMonthTotal), icon: ArrowLeftRight, cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400' },
    { label: t('mtr_kpi_year_total'), value: fmtDH(thisYearTotal), icon: TrendingUp, cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400' },
    { label: t('mtr_kpi_month_count'), value: String(thisMonthCount), icon: Coins, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('mtr_kpi_top_route'), value: topRoute ? topRoute.name : '—', sub: topRoute ? fmtDH(topRoute.value) : undefined, icon: Route, cls: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400' },
  ]

  const visible = moneyTransfers
    .filter((m) => routeFilter === 'Tous' || m.route === routeFilter)
    .filter((m) => {
      const q = query.trim().toLowerCase()
      return !q || m.label.toLowerCase().includes(q) || m.route.toLowerCase().includes(q)
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  const submitTransfer = () => {
    const amount = parseFloat(form.amount.replace(',', '.')) || 0
    if (amount <= 0) {
      toast(t('mtr_toast_invalid_amount'), 'error')
      return
    }
    addMoneyTransfer({ date: new Date().toISOString(), route: form.route, label: form.label.trim(), amount, note: '' })
    toast(`✓ ${t('mtr_toast_registered')} ${fmtDH(amount)}`)
    setNewOpen(false)
    setForm(EMPTY_FORM)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteMoneyTransfer(deleteTarget.id)
    toast(`${deleteTarget.route} ${t('mtr_toast_deleted')}`)
    setDeleteTarget(null)
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('mtr_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('mtr_subtitle')}</p>
        </div>
        <button onClick={() => setNewOpen(true)} className="btn-primary">
          <ArrowLeftRight className="h-4 w-4" />
          {t('mtr_new')}
        </button>
      </motion.div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.4 }}
            className="glass-card glass-card-hover p-5"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.cls}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{c.label}</p>
            <p className="mt-1 truncate text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
              {c.value}
            </p>
            {c.sub && <p className="mt-1 text-xs text-sky-500 dark:text-sky-400 tabular-nums">{c.sub}</p>}
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
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('mtr_evolution_title')}</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t('mtr_evolution_subtitle')}</p>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 5, right: 5, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => fmtDH(v)}
                  cursor={{ fill: 'rgba(56,189,248,0.08)' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Bar dataKey="total" name="Transferts" fill="#38bdf8" radius={[8, 8, 0, 0]} />
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
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('mtr_by_route')}</h2>
          <div className="relative mx-auto mt-2 h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  formatter={(v: number) => fmtDH(v)}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Pie data={routeData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={78} paddingAngle={4} cornerRadius={6} stroke="none">
                  {routeData.map((c, i) => (
                    <Cell key={c.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-lg font-bold tracking-tight text-gray-900 dark:text-white tabular-nums">{fmtDH(routeTotal)}</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{t('mtr_total')}</p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {routeData.slice(0, 5).map((c, i) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                <span className="flex-1 truncate text-sm text-gray-600 dark:text-zinc-400">{c.name}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                  {routeTotal > 0 ? Math.round((c.value / routeTotal) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('mtr_search_placeholder')}
            className="input-field pl-10"
          />
        </div>
        <Select
          value={routeFilter}
          onChange={setRouteFilter}
          options={[{ value: 'Tous', label: t('mtr_all_routes') }, ...TRANSFER_ROUTES.map((c) => ({ value: c, label: c }))]}
          className="w-auto min-w-[180px]"
        />
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('mtr_recent_title')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('mtr_col_date')}</th>
                <th className="px-5 py-3.5">{t('mtr_col_route')}</th>
                <th className="px-5 py-3.5">{t('mtr_col_label')}</th>
                <th className="px-5 py-3.5">{t('mtr_col_amount')}</th>
                <th className="px-5 py-3.5 text-right">{t('mtr_col_action')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => (
                <tr key={m.id} className="group border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-sky-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">
                    {new Date(m.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="flex w-fit items-center gap-1.5 rounded-full bg-sky-50 dark:bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-600 dark:text-sky-300">
                      <ArrowLeftRight className="h-3 w-3" />
                      {m.route}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white">{m.label || '—'}</td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(m.amount)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setDeleteTarget(m)}
                        className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                        title={t('mtr_delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('mtr_none_in_view')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* New transfer modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title={t('mtr_new')} maxWidth="max-w-sm">
        <div className="space-y-4">
          <div>
            <label className="field-label">{t('mtr_route_label')}</label>
            <Select value={form.route} onChange={(v) => setForm({ ...form, route: v })} options={TRANSFER_ROUTES} />
          </div>
          <div>
            <label className="field-label">{t('mtr_label_optional')}</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder={t('mtr_label_placeholder')}
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('mtr_amount_required')}</label>
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={() => setNewOpen(false)} className="btn-secondary">
              {t('mtr_cancel')}
            </button>
            <button onClick={submitTransfer} className="btn-primary">
              {t('mtr_save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('mtr_delete_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <span className="font-semibold text-gray-900 dark:text-white">{deleteTarget?.route}</span> {t('mtr_delete_desc')}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
            {t('mtr_cancel')}
          </button>
          <button onClick={confirmDelete} className="btn-danger">
            <Trash2 className="h-4 w-4" />
            {t('mtr_delete')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function TransfertArgentPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
