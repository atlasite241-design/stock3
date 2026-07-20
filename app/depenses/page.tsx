'use client'

import { useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react'
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
import { EXPENSE_CATEGORIES, fmtDH, useDroguerie, type Expense } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const STATUS_KEY: Record<Expense['status'], TKey> = {
  payee: 'exp_status_paid',
  a_payer: 'exp_status_due',
  retard: 'exp_status_late',
}
const STATUS_CHIP: Record<Expense['status'], { chip: string; dot: string }> = {
  payee: { chip: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  a_payer: { chip: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  retard: { chip: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
}

const DONUT_COLORS = ['#f59e0b', '#a78bfa', '#38bdf8', '#f43f5e', '#10b981', '#94a3b8', '#fb923c', '#818cf8']
const MONTH_KEYS: TKey[] = ['month_jan', 'month_feb', 'month_mar', 'month_apr', 'month_may', 'month_jun', 'month_jul', 'month_aug', 'month_sep', 'month_oct', 'month_nov', 'month_dec']

const EMPTY_FORM = {
  category: EXPENSE_CATEGORIES[0],
  label: '',
  amount: '',
  status: 'payee' as Expense['status'],
  dueDate: '',
}

function Content() {
  const { ready, expenses, settings, addExpense, markExpensePaid, deleteExpense } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('Toutes')
  const [statusFilter, setStatusFilter] = useState('tous')
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)

  const now = new Date()
  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`

  const monthly = useMemo(() => {
    const buckets: { key: string; label: string; total: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({ key: monthKey(d), label: t(MONTH_KEYS[d.getMonth()]), total: 0 })
    }
    expenses.forEach((e) => {
      const key = monthKey(new Date(e.date))
      const bucket = buckets.find((b) => b.key === key)
      if (bucket) bucket.total += e.amount
    })
    return buckets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses])

  const categoryData = useMemo(() => {
    const map = new Map<string, number>()
    expenses.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount))
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [expenses])
  const categoryTotal = categoryData.reduce((a, c) => a + c.value, 0)

  if (!ready) {
    return <Loader />
  }

  const thisMonthTotal = expenses
    .filter((e) => monthKey(new Date(e.date)) === monthKey(now))
    .reduce((a, e) => a + e.amount, 0)

  const pending = expenses.filter((e) => e.status === 'a_payer' || e.status === 'retard')
  const nextDue = [...pending]
    .filter((e) => e.dueDate)
    .sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string))[0]

  const remaining = Math.max(0, settings.opexBudget - thisMonthTotal)
  const usedPct = settings.opexBudget > 0 ? Math.min(100, Math.round((thisMonthTotal / settings.opexBudget) * 100)) : 0

  const cards = [
    { label: t('exp_kpi_month_total'), value: fmtDH(thisMonthTotal), icon: Wallet, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('exp_kpi_pending'), value: String(pending.length), icon: Receipt, cls: pending.length > 0 ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
    {
      label: t('exp_kpi_next_due'),
      value: nextDue ? nextDue.label : '—',
      sub: nextDue?.dueDate ? new Date(nextDue.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' }) : t('exp_no_due'),
      icon: CalendarClock,
      cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400',
    },
    { label: t('exp_kpi_budget_remaining'), value: fmtDH(remaining), icon: AlertTriangle, cls: 'bg-violet-50 dark:bg-violet-500/10 text-violet-500 dark:text-violet-400', bar: usedPct },
  ]

  const visible = expenses
    .filter((e) => categoryFilter === 'Toutes' || e.category === categoryFilter)
    .filter((e) => statusFilter === 'tous' || e.status === statusFilter)
    .filter((e) => {
      const q = query.trim().toLowerCase()
      return !q || e.label.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  const submitExpense = () => {
    if (!form.label.trim()) {
      toast(t('exp_toast_label_required'), 'error')
      return
    }
    const amount = parseFloat(form.amount.replace(',', '.')) || 0
    if (amount <= 0) {
      toast(t('exp_toast_invalid_amount'), 'error')
      return
    }
    addExpense({
      date: new Date().toISOString(),
      category: form.category,
      label: form.label.trim(),
      amount,
      status: form.status,
      dueDate: form.status !== 'payee' && form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      note: '',
    })
    toast(`✓ ${t('exp_toast_registered')} ${fmtDH(amount)}`)
    setNewOpen(false)
    setForm(EMPTY_FORM)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteExpense(deleteTarget.id)
    toast(`${deleteTarget.label} ${t('exp_toast_deleted')}`)
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('exp_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('exp_subtitle')}</p>
        </div>
        <button onClick={() => setNewOpen(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          {t('exp_new')}
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
            {c.sub && <p className="mt-1 text-xs text-rose-500 dark:text-rose-400">{c.sub}</p>}
            {c.bar !== undefined && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-amber-400"
                  style={{ width: `${c.bar}%` }}
                />
              </div>
            )}
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
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('exp_evolution_title')}</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t('exp_evolution_subtitle')}</p>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 5, right: 5, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => fmtDH(v)}
                  cursor={{ fill: 'rgba(245,158,11,0.08)' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Bar dataKey="total" name="Dépenses" fill="#f59e0b" radius={[8, 8, 0, 0]} />
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
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('exp_by_category')}</h2>
          <div className="relative mx-auto mt-2 h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  formatter={(v: number) => fmtDH(v)}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={78} paddingAngle={4} cornerRadius={6} stroke="none">
                  {categoryData.map((c, i) => (
                    <Cell key={c.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-lg font-bold tracking-tight text-gray-900 dark:text-white tabular-nums">{fmtDH(categoryTotal)}</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{t('exp_opex_total')}</p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {categoryData.slice(0, 5).map((c, i) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                <span className="flex-1 truncate text-sm text-gray-600 dark:text-zinc-400">{c.name}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                  {categoryTotal > 0 ? Math.round((c.value / categoryTotal) * 100) : 0}%
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
            placeholder={t('exp_search_placeholder')}
            className="input-field pl-10"
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[{ value: 'Toutes', label: t('exp_all_categories') }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))]}
          className="w-auto min-w-[160px]"
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'tous', label: t('exp_all_status') },
            { value: 'payee', label: t('exp_status_paid') },
            { value: 'a_payer', label: t('exp_status_due') },
            { value: 'retard', label: t('exp_status_late') },
          ]}
          className="w-auto min-w-[150px]"
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
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('exp_recent_title')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('exp_col_date')}</th>
                <th className="px-5 py-3.5">{t('exp_col_category')}</th>
                <th className="px-5 py-3.5">{t('exp_col_label')}</th>
                <th className="px-5 py-3.5">{t('exp_col_amount')}</th>
                <th className="px-5 py-3.5">{t('exp_col_status')}</th>
                <th className="px-5 py-3.5 text-right">{t('exp_col_action')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.id} className="group border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">
                    {new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-full bg-gray-100 dark:bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-tight text-gray-600 dark:text-zinc-300">
                      {e.category}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white">{e.label}</td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(e.amount)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_CHIP[e.status].chip}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CHIP[e.status].dot}`} />
                      {t(STATUS_KEY[e.status])}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {e.status !== 'payee' && (
                        <button
                          onClick={() => markExpensePaid(e.id)}
                          className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                          title={t('exp_mark_paid')}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(e)}
                        className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                        title={t('exp_delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('exp_none_in_view')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* New expense modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title={t('exp_new')} maxWidth="max-w-sm">
        <div className="space-y-4">
          <div>
            <label className="field-label">{t('exp_category_label')}</label>
            <Select value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={EXPENSE_CATEGORIES} />
          </div>
          <div>
            <label className="field-label">{t('exp_label_required')}</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder={t('exp_label_placeholder')}
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('exp_amount_required')}</label>
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('exp_status_label')}</label>
            <Select
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v as Expense['status'] })}
              options={[
                { value: 'payee', label: t('exp_status_paid_opt') },
                { value: 'a_payer', label: t('exp_status_due_opt') },
                { value: 'retard', label: t('exp_status_late_opt') },
              ]}
            />
          </div>
          {form.status !== 'payee' && (
            <div>
              <label className="field-label">{t('exp_due_date')}</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="input-field"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={() => setNewOpen(false)} className="btn-secondary">
              {t('exp_cancel')}
            </button>
            <button onClick={submitExpense} className="btn-primary">
              {t('exp_save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('exp_delete_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <span className="font-semibold text-gray-900 dark:text-white">{deleteTarget?.label}</span> {t('exp_delete_desc')}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
            {t('exp_cancel')}
          </button>
          <button onClick={confirmDelete} className="btn-danger">
            <Trash2 className="h-4 w-4" />
            {t('exp_delete')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function DepensesPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
