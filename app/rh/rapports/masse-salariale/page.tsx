'use client'

// Masse salariale. Deux lectures : ce que touchent les gens (net) et ce que ça
// coûte à l'entreprise. La part patronale est ESTIMÉE — elle dépend du secteur
// et du taux accident du travail propre à chaque société.

import { useMemo, useState } from 'react'
import { Coins } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import { RATES_2025, monthLabel, periodOf, todayISO, type Payslip } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { fmtDH } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

/**
 * Estimation des charges patronales (droit commun marocain) :
 * allocations familiales 6,40 % · prestations sociales 8,98 % (plafond 6 000 DH) ·
 * AMO 4,11 % · taxe de formation professionnelle 1,60 %.
 * Le taux accident du travail dépend de l'activité : il n'est PAS inclus.
 */
const EMPLOYER = { family: 0.064, social: 0.0898, amo: 0.0411, training: 0.016 }

interface Row {
  id: string
  period: string
  name: string
  brut: number
  cnss: number
  amo: number
  ir: number
  net: number
  employer: number
  cost: number
}

export default function Page() {
  const payslips = useHrList<Payslip>('payslips')
  const { byId } = useEmployees()
  const { t, lang } = useLanguage()
  const [period, setPeriod] = useState(periodOf(todayISO()))
  const [allPeriods, setAllPeriods] = useState(false)

  const rows = useMemo<Row[]>(() => {
    const list = allPeriods ? payslips.items : payslips.items.filter((p) => p.period === period)
    return list.map((p) => {
      const base = Math.min(p.brutImposable, RATES_2025.cnssCeiling)
      const employer =
        p.brutImposable * EMPLOYER.family +
        base * EMPLOYER.social +
        p.brutImposable * EMPLOYER.amo +
        p.brutImposable * EMPLOYER.training
      return {
        id: p.id,
        period: p.period,
        name: byId(p.employeeId)?.name ?? '—',
        brut: p.brut,
        cnss: p.cnss,
        amo: p.amo,
        ir: p.ir,
        net: p.net,
        employer: Math.round(employer * 100) / 100,
        cost: Math.round((p.brut + employer) * 100) / 100,
      }
    }).sort((a, b) => b.period.localeCompare(a.period) || b.cost - a.cost)
  }, [payslips.items, period, allPeriods, byId])

  const sum = (k: keyof Row) => rows.reduce((a, r) => a + (typeof r[k] === 'number' ? (r[k] as number) : 0), 0)

  const columns: HrColumn<Row>[] = [
    ...(allPeriods ? [{ key: 'period', label: t('hr_adj_period'), value: (r: Row) => r.period }] : []),
    { key: 'name', label: t('hr_f_name'), value: (r) => r.name, render: (r) => <span className="font-semibold text-gray-900 dark:text-white">{r.name}</span> },
    { key: 'brut', label: t('hr_pay_brut'), align: 'right', value: (r) => r.brut, render: (r) => <span className="tabular-nums">{fmtDH(r.brut)}</span> },
    { key: 'cnss', label: 'CNSS', align: 'right', value: (r) => r.cnss, render: (r) => <span className="tabular-nums text-gray-500">{fmtDH(r.cnss)}</span> },
    { key: 'amo', label: 'AMO', align: 'right', value: (r) => r.amo, render: (r) => <span className="tabular-nums text-gray-500">{fmtDH(r.amo)}</span> },
    { key: 'ir', label: 'IR', align: 'right', value: (r) => r.ir, render: (r) => <span className="tabular-nums text-gray-500">{fmtDH(r.ir)}</span> },
    { key: 'net', label: t('hr_pay_net'), align: 'right', value: (r) => r.net, render: (r) => <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtDH(r.net)}</span> },
    { key: 'emp', label: t('hr_mass_employer'), align: 'right', value: (r) => r.employer, render: (r) => <span className="tabular-nums text-orange-600 dark:text-orange-400">{fmtDH(r.employer)}</span> },
    { key: 'cost', label: t('hr_mass_cost'), align: 'right', value: (r) => r.cost, render: (r) => <span className="font-bold tabular-nums text-gray-900 dark:text-white">{fmtDH(r.cost)}</span> },
  ]

  return (
    <HrPage icon={Coins} title="hr_mass_title" subtitle="hr_mass_sub" perm="hr.payroll">
      <div className="glass-card flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_adj_period')}</span>
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} disabled={allPeriods} className="input-field disabled:opacity-40" />
        </label>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-gray-700 dark:text-zinc-200">
          <input type="checkbox" checked={allPeriods} onChange={(e) => setAllPeriods(e.target.checked)} className="h-4 w-4 accent-amber-500" />
          {t('hr_mass_all')}
        </label>
        {!allPeriods && <p className="pb-2 text-sm capitalize text-gray-500 dark:text-zinc-400">{monthLabel(period, lang)}</p>}
      </div>

      <HrStats
        cards={[
          { label: t('hr_pay_brut'), value: fmtDH(sum('brut')) },
          { label: t('hr_pay_net'), value: fmtDH(sum('net')), tone: 'text-emerald-600 dark:text-emerald-400' },
          { label: t('hr_mass_employer'), value: fmtDH(sum('employer')), tone: 'text-orange-600 dark:text-orange-400' },
          { label: t('hr_mass_cost'), value: fmtDH(sum('cost')) },
        ]}
      />

      <p className="rounded-xl border border-dashed border-gray-200 p-3 text-[11px] leading-relaxed text-gray-500 dark:border-white/15 dark:text-zinc-400">
        {t('hr_mass_note')} — {(EMPLOYER.family * 100).toFixed(2)} % + {(EMPLOYER.social * 100).toFixed(2)} % ({t('hr_pay_capped')} {fmtDH(RATES_2025.cnssCeiling)}) + {(EMPLOYER.amo * 100).toFixed(2)} % + {(EMPLOYER.training * 100).toFixed(2)} %.
      </p>

      <HrTable
        rows={rows}
        columns={columns}
        search={(r) => r.name}
        filename={`masse-salariale-${allPeriods ? 'tout' : period}`}
        empty={t('hr_mass_empty')}
      />
    </HrPage>
  )
}
