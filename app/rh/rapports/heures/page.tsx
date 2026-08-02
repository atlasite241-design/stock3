'use client'

// Heures travaillées, mois par mois. Les heures au-delà de la durée légale
// (44 h/semaine au Maroc, soit ~191 h/mois) apparaissent à part : ce sont
// elles qui ouvrent droit à majoration.

import { useMemo, useState } from 'react'
import { Timer } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import { fmtHours, monthLabel, periodOf, todayISO, type Attendance } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { useLanguage } from '@/lib/i18n'

/** 44 h/semaine × 52 / 12 ≈ 190,7 h — durée légale mensuelle de référence. */
const LEGAL_MONTHLY_MIN = 191 * 60

interface Row {
  id: string
  name: string
  matricule: string
  days: number
  minutes: number
  overtime: number
  avgPerDay: number
}

export default function Page() {
  const attendance = useHrList<Attendance>('attendance')
  const { active: employees } = useEmployees()
  const { t, lang } = useLanguage()
  const [period, setPeriod] = useState(periodOf(todayISO()))

  const rows = useMemo<Row[]>(() => {
    return employees.map((e) => {
      const mine = attendance.items.filter((a) => a.employeeId === e.id && a.date.startsWith(period))
      const minutes = mine.reduce((a, x) => a + x.minutes, 0)
      const days = mine.filter((a) => a.minutes > 0).length
      return {
        id: e.id, name: e.name, matricule: e.matricule,
        days, minutes,
        overtime: Math.max(0, minutes - LEGAL_MONTHLY_MIN),
        avgPerDay: days ? Math.round(minutes / days) : 0,
      }
    }).sort((a, b) => b.minutes - a.minutes)
  }, [employees, attendance.items, period])

  const columns: HrColumn<Row>[] = [
    { key: 'mat', label: t('hr_f_matricule'), value: (r) => r.matricule, render: (r) => <span className="font-mono text-xs text-gray-500">{r.matricule}</span> },
    { key: 'name', label: t('hr_f_name'), value: (r) => r.name, render: (r) => <span className="font-semibold text-gray-900 dark:text-white">{r.name}</span> },
    { key: 'days', label: t('hr_hrs_days'), align: 'center', value: (r) => r.days },
    {
      key: 'minutes', label: t('hr_att_hours'), align: 'right',
      value: (r) => r.minutes,
      render: (r) => <span className="font-bold tabular-nums text-gray-900 dark:text-white">{fmtHours(r.minutes)}</span>,
    },
    {
      key: 'avg', label: t('hr_hrs_avg'), align: 'right',
      value: (r) => r.avgPerDay,
      render: (r) => <span className="tabular-nums text-gray-500">{r.avgPerDay ? fmtHours(r.avgPerDay) : '—'}</span>,
    },
    {
      key: 'ot', label: t('hr_hrs_overtime'), align: 'right',
      value: (r) => r.overtime,
      render: (r) => r.overtime
        ? <span className="font-bold tabular-nums text-orange-600 dark:text-orange-400">{fmtHours(r.overtime)}</span>
        : <span className="text-gray-300 dark:text-zinc-700">—</span>,
    },
  ]

  const totalMin = rows.reduce((a, r) => a + r.minutes, 0)
  const totalOt = rows.reduce((a, r) => a + r.overtime, 0)

  return (
    <HrPage icon={Timer} title="hr_hrs_title" subtitle="hr_hrs_sub" perm="hr.reports">
      <div className="glass-card flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_adj_period')}</span>
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="input-field" />
        </label>
        <p className="text-sm capitalize text-gray-500 dark:text-zinc-400">{monthLabel(period, lang)}</p>
      </div>

      <HrStats
        cards={[
          { label: t('hr_col_employees'), value: String(rows.filter((r) => r.minutes > 0).length) },
          { label: t('hr_att_hours'), value: fmtHours(totalMin) },
          { label: t('hr_hrs_overtime'), value: fmtHours(totalOt), tone: totalOt ? 'text-orange-600 dark:text-orange-400' : undefined },
          { label: t('hr_hrs_legal'), value: fmtHours(LEGAL_MONTHLY_MIN) },
        ]}
      />

      <p className="rounded-xl border border-dashed border-gray-200 p-3 text-[11px] leading-relaxed text-gray-500 dark:border-white/15 dark:text-zinc-400">
        {t('hr_hrs_note')}
      </p>

      <HrTable
        rows={rows}
        columns={columns}
        search={(r) => `${r.name} ${r.matricule}`}
        filename={`heures-${period}`}
        empty={t('hr_hrs_empty')}
      />
    </HrPage>
  )
}
