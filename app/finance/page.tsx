'use client'

// Tableau de bord financier : la santé budgétaire en un écran. Tout est
// calculé depuis les données vivantes (budgets, investissements, dépenses,
// recettes, ventes) — rien n'est stocké ici.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Gauge, Landmark, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
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
import Loader from '@/components/Loader'
import Select from '@/components/Select'
import { budgetAlert, budgetConsumed, fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const DONUT_COLORS = ['#f59e0b', '#a78bfa', '#38bdf8', '#f43f5e', '#10b981', '#94a3b8', '#fb923c', '#818cf8']
const MONTH_KEYS: TKey[] = ['month_jan', 'month_feb', 'month_mar', 'month_apr', 'month_may', 'month_jun', 'month_jul', 'month_aug', 'month_sep', 'month_oct', 'month_nov', 'month_dec']

function Content() {
  const { ready, budgets, investments, expenses, revenues, sales, stores, allBudgets, allInvestments, activeStore } = useDroguerie()
  const { t } = useLanguage()

  const nowYear = new Date().getFullYear()
  const [year, setYear] = useState(String(nowYear))
  const y = Number(year)

  const inYear = (iso: string) => new Date(iso).getFullYear() === y

  const kpis = useMemo(() => {
    const bs = budgets.filter((b) => b.year === y)
    const inv = investments.filter((i) => i.year === y && i.status !== 'annule')
    const exp = expenses.filter((e) => inYear(e.date))
    const rev = revenues.filter((r) => inYear(r.date))
    const sal = sales.filter((s) => inYear(s.date))
    const opexPlanned = bs.reduce((s, b) => s + b.planned, 0)
    const opexConsumed = bs.reduce((s, b) => s + budgetConsumed(b, expenses), 0)
    const capexPlanned = inv.reduce((s, i) => s + i.planned, 0)
    const capexActual = inv.reduce((s, i) => s + (i.actual ?? 0), 0)
    const totalExp = exp.reduce((s, e) => s + e.amount, 0)
    const totalRev = rev.reduce((s, r) => s + r.amount, 0) + sal.reduce((s, x) => s + x.total, 0)
    return {
      opexPlanned, opexConsumed, opexRemaining: opexPlanned - opexConsumed,
      capexPlanned, capexActual,
      totalExp, totalRev, solde: totalRev - totalExp - capexActual,
      rate: opexPlanned > 0 ? (opexConsumed / opexPlanned) * 100 : 0,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets, investments, expenses, revenues, sales, y])

  // Budget prévu vs dépenses réelles, par mois de l'exercice.
  const monthly = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, m) => ({
      label: t(MONTH_KEYS[m]),
      prevu: 0,
      reel: 0,
    }))
    const opexPlanned = budgets.filter((b) => b.year === y).reduce((s, b) => s + b.planned, 0)
    for (const m of months) m.prevu = Math.round(opexPlanned / 12)
    for (const e of expenses) {
      const d = new Date(e.date)
      if (d.getFullYear() === y) months[d.getMonth()].reel += e.amount
    }
    return months
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets, expenses, y])

  // OPEX consommé par catégorie (dépenses de l'exercice).
  const byCategory = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of expenses) if (inYear(e.date)) m.set(e.category, (m.get(e.category) ?? 0) + e.amount)
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, y])

  // Dépenses par magasin (toutes boutiques, données brutes non scopées).
  const byStore = useMemo(() => {
    const m = new Map<string, number>()
    // Les budgets/investissements bruts portent le storeId ; les dépenses scopées
    // ne couvrent que le magasin actif — on agrège donc depuis les budgets.
    for (const b of allBudgets) if (b.year === y) m.set(b.storeId ?? '', (m.get(b.storeId ?? '') ?? 0) + budgetConsumed(b, expenses))
    for (const i of allInvestments) if (i.year === y && i.status !== 'annule') m.set(i.storeId ?? '', (m.get(i.storeId ?? '') ?? 0) + (i.actual ?? 0))
    return [...m.entries()]
      .map(([sid, value]) => ({ name: stores.find((s) => s.id === sid)?.name ?? '—', value }))
      .filter((r) => r.value > 0)
     
  }, [allBudgets, allInvestments, expenses, stores, y])

  // OPEX vs CAPEX (prévu et réalisé).
  const opexVsCapex = [
    { name: 'OPEX', prevu: kpis.opexPlanned, reel: kpis.opexConsumed },
    { name: 'CAPEX', prevu: kpis.capexPlanned, reel: kpis.capexActual },
  ]

  if (!ready) return <Loader />

  const years = Array.from(new Set([nowYear, nowYear + 1, ...budgets.map((b) => b.year)])).sort()
  const alert = budgetAlert(kpis.opexPlanned, kpis.opexConsumed)

  const cards = [
    { l: t('fin_dash_budget_total'), v: fmtDH(kpis.opexPlanned + kpis.capexPlanned), icon: Landmark, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { l: t('fin_dash_opex_consumed'), v: fmtDH(kpis.opexConsumed), sub: `${t('fin_kpi_planned')} : ${fmtDH(kpis.opexPlanned)}`, icon: Wallet, cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500' },
    { l: t('fin_dash_capex_actual'), v: fmtDH(kpis.capexActual), sub: `${t('fin_col_planned')} : ${fmtDH(kpis.capexPlanned)}`, icon: Gauge, cls: 'bg-violet-50 dark:bg-violet-500/10 text-violet-500' },
    { l: t('fin_dash_solde'), v: fmtDH(kpis.solde), sub: `${t('fin_dash_rev')} ${fmtDH(kpis.totalRev)} · ${t('fin_dash_exp')} ${fmtDH(kpis.totalExp)}`, icon: kpis.solde >= 0 ? TrendingUp : TrendingDown, cls: kpis.solde >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Landmark className="h-6 w-6 text-amber-500" />
            {t('fin_dash_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('fin_dash_sub')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <Select value={year} onChange={setYear} options={years.map((yy) => ({ value: String(yy), label: `${t('fin_exercice')} ${yy}` }))} className="w-40" />
      </motion.div>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div key={c.l} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.4 }}
            className="glass-card glass-card-hover p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.cls}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{c.l}</p>
            <p className="mt-1 truncate text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">{c.v}</p>
            {c.sub && <p className="mt-1 truncate text-xs text-gray-400 dark:text-zinc-500">{c.sub}</p>}
          </motion.div>
        ))}
      </div>

      {/* Taux de consommation */}
      <div className="glass-card px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-900 dark:text-white">{t('fin_kpi_rate')}</p>
          <p className={`text-lg font-extrabold tabular-nums ${alert === 'over' ? 'text-rose-500' : alert === 'warning' || alert === 'reached' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {Math.round(kpis.rate)} %
          </p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
          <div className={`h-full rounded-full ${alert === 'over' ? 'bg-rose-500' : alert === 'warning' || alert === 'reached' ? 'bg-amber-400' : 'bg-emerald-500'}`}
            style={{ width: `${Math.min(100, kpis.rate)}%` }} />
        </div>
        {alert !== 'ok' && (
          <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
            {alert === 'over' ? t('fin_alert_over') : alert === 'reached' ? t('fin_alert_reached') : t('fin_alert_warning')}
          </p>
        )}
      </div>

      {/* Graphiques */}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="glass-card p-5">
          <p className="mb-4 text-sm font-bold text-gray-900 dark:text-white">{t('fin_chart_planned_vs_real')}</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmtDH(v)} />
              <Bar dataKey="prevu" name={t('fin_kpi_planned')} fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="reel" name={t('fin_dash_exp')} fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-5">
          <p className="mb-4 text-sm font-bold text-gray-900 dark:text-white">{t('fin_chart_opex_by_cat')}</p>
          {byCategory.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400 dark:text-zinc-500">{t('fin_dash_none')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Tooltip formatter={(v: number) => fmtDH(v)} />
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={4} cornerRadius={6} stroke="none">
                  {byCategory.map((c, i) => <Cell key={c.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="glass-card p-5">
          <p className="mb-4 text-sm font-bold text-gray-900 dark:text-white">{t('fin_chart_opex_vs_capex')}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={opexVsCapex}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmtDH(v)} />
              <Bar dataKey="prevu" name={t('fin_kpi_planned')} fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="reel" name={t('fin_dash_realised')} fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-5">
          <p className="mb-4 text-sm font-bold text-gray-900 dark:text-white">{t('fin_chart_by_store')}</p>
          {byStore.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400 dark:text-zinc-500">{t('fin_dash_none')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Tooltip formatter={(v: number) => fmtDH(v)} />
                <Pie data={byStore} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={4} cornerRadius={6} stroke="none">
                  {byStore.map((c, i) => <Cell key={c.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
