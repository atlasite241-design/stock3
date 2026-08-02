'use client'

// Rapport de présence : le taux par personne sur une période. C'est l'écran
// qu'on regarde avant un entretien annuel.

import { useMemo, useState } from 'react'
import { CalendarCheck2 } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import { fmtHours, type Attendance, type Leave } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { useLanguage, type TKey } from '@/lib/i18n'

const PERIODS: { days: number; key: TKey }[] = [
  { days: 30, key: 'sk_var_p30' },
  { days: 90, key: 'sk_var_p90' },
  { days: 365, key: 'sk_var_p365' },
  { days: 0, key: 'sk_var_pall' },
]

interface Row {
  id: string
  name: string
  matricule: string
  present: number
  absent: number
  leave: number
  late: number
  lateMin: number
  minutes: number
  rate: number
}

export default function Page() {
  const attendance = useHrList<Attendance>('attendance')
  const leaves = useHrList<Leave>('leaves')
  const { active: employees } = useEmployees()
  const { t } = useLanguage()
  const [days, setDays] = useState(30)

  const rows = useMemo<Row[]>(() => {
    const since = days > 0 ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10) : ''
    return employees.map((e) => {
      const mine = attendance.items.filter((a) => a.employeeId === e.id && a.date >= since)
      const present = mine.filter((a) => a.status === 'present').length
      const absent = mine.filter((a) => a.status === 'absent').length
      const leaveDays = leaves.items
        .filter((l) => l.employeeId === e.id && l.status === 'approuve' && l.to >= since)
        .reduce((a, l) => a + l.days, 0)
      const late = mine.filter((a) => a.lateMin > 0).length
      // Le taux compare les jours travaillés aux jours ATTENDUS : présences +
      // absences. Les congés validés ne pénalisent pas — ce sont des droits.
      const expected = present + absent
      return {
        id: e.id, name: e.name, matricule: e.matricule,
        present, absent, leave: leaveDays, late,
        lateMin: mine.reduce((a, x) => a + x.lateMin, 0),
        minutes: mine.reduce((a, x) => a + x.minutes, 0),
        rate: expected ? Math.round((present / expected) * 100) : 100,
      }
    }).sort((a, b) => a.rate - b.rate)
  }, [employees, attendance.items, leaves.items, days])

  const columns: HrColumn<Row>[] = [
    { key: 'mat', label: t('hr_f_matricule'), value: (r) => r.matricule, render: (r) => <span className="font-mono text-xs text-gray-500">{r.matricule}</span> },
    { key: 'name', label: t('hr_f_name'), value: (r) => r.name, render: (r) => <span className="font-semibold text-gray-900 dark:text-white">{r.name}</span> },
    { key: 'present', label: t('hr_att_present'), align: 'center', value: (r) => r.present },
    { key: 'absent', label: t('hr_att_absent'), align: 'center', value: (r) => r.absent, render: (r) => <span className={r.absent ? 'font-semibold text-rose-600 dark:text-rose-400' : ''}>{r.absent}</span> },
    { key: 'leave', label: t('hr_leave'), align: 'center', value: (r) => r.leave },
    { key: 'late', label: t('hr_late'), align: 'center', value: (r) => r.late, render: (r) => <span className={r.late ? 'text-orange-600 dark:text-orange-400' : ''}>{r.late}</span> },
    { key: 'lateMin', label: t('hr_pres_late_total'), align: 'right', value: (r) => r.lateMin, render: (r) => <span className="tabular-nums text-xs">{r.lateMin ? fmtHours(r.lateMin) : '—'}</span> },
    { key: 'hours', label: t('hr_att_hours'), align: 'right', value: (r) => r.minutes, render: (r) => <span className="tabular-nums font-semibold">{fmtHours(r.minutes)}</span> },
    {
      key: 'rate', label: t('hr_pres_rate'), align: 'right',
      value: (r) => r.rate,
      render: (r) => (
        <span className="flex items-center justify-end gap-2">
          <span className={`tabular-nums text-xs font-bold ${r.rate >= 95 ? 'text-emerald-600 dark:text-emerald-400' : r.rate >= 85 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {r.rate} %
          </span>
          <span className="h-2 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <span
              className={`block h-full rounded-full ${r.rate >= 95 ? 'bg-emerald-500' : r.rate >= 85 ? 'bg-amber-500' : 'bg-rose-500'}`}
              style={{ width: `${r.rate}%` }}
            />
          </span>
        </span>
      ),
    },
  ]

  const avgRate = rows.length ? Math.round(rows.reduce((a, r) => a + r.rate, 0) / rows.length) : 0

  return (
    <HrPage icon={CalendarCheck2} title="hr_rpres_title" subtitle="hr_rpres_sub" perm="hr.reports">
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            onClick={() => setDays(p.days)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              days === p.days ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-zinc-300'
            }`}
          >
            {t(p.key)}
          </button>
        ))}
      </div>

      <HrStats
        cards={[
          { label: t('hr_col_employees'), value: String(rows.length) },
          { label: t('hr_pres_rate'), value: `${avgRate} %`, tone: avgRate >= 95 ? 'text-emerald-600 dark:text-emerald-400' : undefined },
          { label: t('hr_att_absent'), value: String(rows.reduce((a, r) => a + r.absent, 0)) },
          { label: t('hr_att_hours'), value: fmtHours(rows.reduce((a, r) => a + r.minutes, 0)) },
        ]}
      />

      <HrTable
        rows={rows}
        columns={columns}
        search={(r) => `${r.name} ${r.matricule}`}
        filename="rapport-presence"
        empty={t('hr_rpres_empty')}
      />
    </HrPage>
  )
}
