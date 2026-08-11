'use client'

// Budget général : la vue consolidée d'un exercice — enveloppe OPEX (charges)
// + enveloppe CAPEX (investissements) — et la gestion des exercices eux-mêmes.
// Rien n'est ressaisi ici : tout vient des budgets OPEX et des investissements.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, CalendarRange, Landmark, Pencil } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { usePermissions } from '@/lib/access'
import { budgetConsumed, fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, budgets, investments, expenses, exercices, activeStore, ensureExercice, updateExercice } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()

  const nowYear = new Date().getFullYear()
  const [year, setYear] = useState(String(nowYear))
  const [exOpen, setExOpen] = useState(false)
  const [exStart, setExStart] = useState('')
  const [exEnd, setExEnd] = useState('')

  const y = Number(year)
  const exercice = exercices.find((e) => e.year === y)

  const synth = useMemo(() => {
    const opex = budgets.filter((b) => b.year === y && b.status !== 'brouillon')
    const opexAll = budgets.filter((b) => b.year === y)
    const capex = investments.filter((i) => i.year === y && i.status !== 'annule')
    const opexPlanned = opexAll.reduce((s, b) => s + b.planned, 0)
    const opexConsumed = opexAll.reduce((s, b) => s + budgetConsumed(b, expenses), 0)
    const capexPlanned = capex.reduce((s, i) => s + i.planned, 0)
    const capexActual = capex.reduce((s, i) => s + (i.actual ?? 0), 0)
    return {
      opexCount: opexAll.length, opexValidated: opex.length, opexPlanned, opexConsumed,
      capexCount: capex.length, capexPlanned, capexActual,
      total: opexPlanned + capexPlanned,
    }
  }, [budgets, investments, expenses, y])

  if (!ready) return <Loader />

  const years = Array.from(new Set([nowYear, nowYear + 1, ...budgets.map((b) => b.year), ...investments.map((i) => i.year), ...exercices.map((e) => e.year)])).sort()

  const openExercice = () => {
    const ex = exercice ?? ensureExercice(y)
    setExStart(ex.startDate)
    setExEnd(ex.endDate)
    setExOpen(true)
  }

  const saveExercice = () => {
    const ex = exercice ?? ensureExercice(y)
    if (exStart >= exEnd) { toast(t('fin_toast_dates'), 'error'); return }
    updateExercice(ex.id, { startDate: exStart, endDate: exEnd })
    setExOpen(false)
    toast(`✓ ${t('fin_ex_saved')} ${y}`)
  }

  const blocks = [
    {
      title: t('fin_bg_opex'), href: '/finance/budgets/opex',
      rows: [
        { l: t('fin_bg_count'), v: `${synth.opexCount} (${synth.opexValidated} ${t('fin_bg_validated')})` },
        { l: t('fin_kpi_planned'), v: fmtDH(synth.opexPlanned) },
        { l: t('fin_kpi_consumed'), v: fmtDH(synth.opexConsumed) },
        { l: t('fin_kpi_remaining'), v: fmtDH(synth.opexPlanned - synth.opexConsumed) },
      ],
    },
    {
      title: t('fin_bg_capex'), href: '/finance/budgets/capex',
      rows: [
        { l: t('fin_bg_count'), v: String(synth.capexCount) },
        { l: t('fin_col_planned'), v: fmtDH(synth.capexPlanned) },
        { l: t('fin_cx_actual'), v: fmtDH(synth.capexActual) },
        { l: t('fin_cx_gap'), v: fmtDH(synth.capexActual - synth.capexPlanned) },
      ],
    },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Landmark className="h-6 w-6 text-amber-500" />
            {t('fin_bg_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('fin_bg_sub')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={year} onChange={setYear} options={years.map((yy) => ({ value: String(yy), label: `${t('fin_exercice')} ${yy}` }))} className="w-40" />
          {can('fin.budget_edit') && (
            <button onClick={openExercice} className="btn-secondary">
              <CalendarRange className="h-4 w-4" />
              {t('fin_ex_manage')}
            </button>
          )}
        </div>
      </motion.div>

      {/* Exercice */}
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <CalendarRange className="h-5 w-5 text-amber-500" />
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{t('fin_exercice')} {y}</p>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              {exercice
                ? `${new Date(exercice.startDate).toLocaleDateString('fr-FR')} → ${new Date(exercice.endDate).toLocaleDateString('fr-FR')}`
                : t('fin_ex_default')}
            </p>
          </div>
        </div>
        <p className="text-right">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('fin_bg_total')}</span>
          <span className="ml-2 text-xl font-extrabold tabular-nums text-gray-900 dark:text-white">{fmtDH(synth.total)}</span>
        </p>
      </div>

      {/* OPEX / CAPEX */}
      <div className="grid gap-6 lg:grid-cols-2">
        {blocks.map((blk) => (
          <div key={blk.title} className="glass-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{blk.title}</p>
              <Link href={blk.href} className="flex items-center gap-1 text-xs font-semibold text-amber-600 transition hover:text-amber-500 dark:text-amber-400">
                {t('fin_bg_open')} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="space-y-2">
              {blk.rows.map((r) => (
                <div key={r.l} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-white/10">
                  <span className="text-gray-500 dark:text-zinc-400">{r.l}</span>
                  <span className="font-bold tabular-nums text-gray-900 dark:text-white">{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center text-sm">
        <Link href="/finance/analyse" className="font-semibold text-amber-600 transition hover:text-amber-500 dark:text-amber-400">
          {t('fin_bg_to_analysis')} →
        </Link>
      </div>

      {/* Dates de l'exercice */}
      <Modal open={exOpen} onClose={() => setExOpen(false)} title={`${t('fin_exercice')} ${y}`} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-300">{t('fin_ex_desc')}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{t('fin_start')}</label>
            <input type="date" value={exStart} onChange={(e) => setExStart(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="field-label">{t('fin_end')}</label>
            <input type="date" value={exEnd} onChange={(e) => setExEnd(e.target.value)} className="input-field" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setExOpen(false)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={saveExercice} className="btn-primary"><Pencil className="h-4 w-4" />{t('fin_save')}</button>
        </div>
      </Modal>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
