'use client'

// Prévisions : projection de fin d'exercice à partir du rythme réel — moyenne
// mensuelle des dépenses et recettes observées, extrapolée aux mois restants.
// Une projection est une estimation, l'écran l'assume et l'affiche comme telle.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import Select from '@/components/Select'
import { budgetConsumed, fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, budgets, expenses, revenues, sales, activeStore } = useDroguerie()
  const { t } = useLanguage()

  const nowYear = new Date().getFullYear()
  const [year, setYear] = useState(String(nowYear))
  const y = Number(year)

  const proj = useMemo(() => {
    const now = new Date()
    // Mois écoulés de l'exercice (au moins 1 pour éviter la division par zéro).
    const elapsed = y < now.getFullYear() ? 12 : y > now.getFullYear() ? 0 : now.getMonth() + 1
    const months = Math.max(1, elapsed)
    const inYear = (iso: string) => new Date(iso).getFullYear() === y

    const exp = expenses.filter((e) => inYear(e.date)).reduce((s, e) => s + e.amount, 0)
    const rev = revenues.filter((r) => inYear(r.date)).reduce((s, r) => s + r.amount, 0)
      + sales.filter((s) => inYear(s.date)).reduce((s2, x) => s2 + x.total, 0)

    const expMonthly = exp / months
    const revMonthly = rev / months
    const remainingMonths = Math.max(0, 12 - elapsed)

    const bs = budgets.filter((b) => b.year === y)
    const planned = bs.reduce((s, b) => s + b.planned, 0)
    const consumed = bs.reduce((s, b) => s + budgetConsumed(b, expenses), 0)
    // Rythme du consommé budgétaire : projection de l'atterrissage.
    const landing = elapsed > 0 ? (consumed / months) * 12 : consumed

    return {
      elapsed, remainingMonths, expMonthly, revMonthly,
      expProjected: exp + expMonthly * remainingMonths,
      revProjected: rev + revMonthly * remainingMonths,
      planned, consumed, landing,
      landingPct: planned > 0 ? (landing / planned) * 100 : 0,
    }
  }, [budgets, expenses, revenues, sales, y])

  if (!ready) return <Loader />

  const years = Array.from(new Set([nowYear, nowYear + 1, ...budgets.map((b) => b.year)])).sort()

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <TrendingUp className="h-6 w-6 text-amber-500" />
            {t('fin_pv_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('fin_pv_sub')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <Select value={year} onChange={setYear} options={years.map((yy) => ({ value: String(yy), label: `${t('fin_exercice')} ${yy}` }))} className="w-40" />
      </motion.div>

      <div className="glass-card px-5 py-4">
        <p className="text-sm text-gray-600 dark:text-zinc-300">
          {t('fin_pv_basis_1')} <b>{proj.elapsed}</b> {t('fin_pv_basis_2')} <b>{proj.remainingMonths}</b> {t('fin_pv_basis_3')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { l: t('fin_pv_exp_rate'), v: `${fmtDH(proj.expMonthly)} / ${t('fin_pv_month')}` },
          { l: t('fin_pv_rev_rate'), v: `${fmtDH(proj.revMonthly)} / ${t('fin_pv_month')}` },
          { l: t('fin_pv_exp_proj'), v: fmtDH(proj.expProjected) },
          { l: t('fin_pv_rev_proj'), v: fmtDH(proj.revProjected) },
        ].map((s) => (
          <div key={s.l} className="glass-card p-4 text-center">
            <p className="truncate text-lg font-extrabold tabular-nums text-gray-900 dark:text-white">{s.v}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Atterrissage budgétaire */}
      <div className="glass-card p-5">
        <p className="mb-1 text-sm font-bold text-gray-900 dark:text-white">{t('fin_pv_landing')}</p>
        <p className="mb-4 text-xs text-gray-500 dark:text-zinc-400">{t('fin_pv_landing_desc')}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { l: t('fin_kpi_planned'), v: fmtDH(proj.planned), c: 'text-gray-900 dark:text-white' },
            { l: t('fin_kpi_consumed'), v: fmtDH(proj.consumed), c: 'text-amber-600 dark:text-amber-400' },
            { l: t('fin_pv_landing_value'), v: `${fmtDH(proj.landing)} (${Math.round(proj.landingPct)} %)`, c: proj.landingPct > 100 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400' },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-gray-100 px-4 py-3 text-center dark:border-white/10">
              <p className={`text-lg font-extrabold tabular-nums ${s.c}`}>{s.v}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
            </div>
          ))}
        </div>
        {proj.landingPct > 100 && proj.planned > 0 && (
          <p className="mt-3 text-xs font-semibold text-rose-500">{t('fin_pv_landing_alert')}</p>
        )}
      </div>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
