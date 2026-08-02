'use client'

// Présences, Absences et Retards lisent la MÊME collection : ce sont trois
// filtres sur le pointage, pas trois données. Un seul composant, trois écrans.

import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { fmtHours, type Attendance } from '@/lib/hr'
import { useLanguage, type TKey } from '@/lib/i18n'

const PERIODS: { days: number; key: TKey }[] = [
  { days: 7, key: 'rp_vd_p7' },
  { days: 30, key: 'sk_var_p30' },
  { days: 90, key: 'sk_var_p90' },
  { days: 0, key: 'sk_var_pall' },
]

export default function AttendanceView({
  icon,
  title,
  subtitle,
  empty,
  filter,
  filename,
  extraColumns = [],
}: {
  icon: LucideIcon
  title: TKey
  subtitle: TKey
  empty: TKey
  filter: (a: Attendance) => boolean
  filename: string
  extraColumns?: HrColumn<Attendance>[]
}) {
  const attendance = useHrList<Attendance>('attendance')
  const { nameOf } = useEmployees()
  const { t } = useLanguage()
  const [days, setDays] = useState(30)

  const rows = useMemo(() => {
    const since = days > 0 ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10) : ''
    return attendance.items.filter((a) => a.date >= since && filter(a))
  }, [attendance.items, days, filter])

  const totalMin = rows.reduce((a, x) => a + x.minutes, 0)
  const lateMin = rows.reduce((a, x) => a + x.lateMin, 0)
  const people = new Set(rows.map((r) => r.employeeId)).size

  const columns: HrColumn<Attendance>[] = [
    { key: 'date', label: t('hr_col_date'), value: (a) => a.date },
    { key: 'emp', label: t('hr_col_employee'), value: (a) => nameOf(a.employeeId) },
    { key: 'in', label: t('hr_clock_in'), align: 'center', value: (a) => a.in ?? '—' },
    { key: 'out', label: t('hr_clock_out'), align: 'center', value: (a) => a.out ?? '—' },
    {
      key: 'worked', label: t('hr_att_hours'), align: 'right',
      value: (a) => a.minutes,
      render: (a) => <span className="tabular-nums">{a.minutes ? fmtHours(a.minutes) : '—'}</span>,
    },
    ...extraColumns,
    { key: 'note', label: t('hr_col_detail'), value: (a) => a.note ?? '—' },
  ]

  return (
    <HrPage icon={icon} title={title} subtitle={subtitle} perm="hr.attendance">
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
          { label: t('hr_col_records'), value: rows.length.toLocaleString('fr-FR') },
          { label: t('hr_col_employees'), value: String(people) },
          { label: t('hr_att_hours'), value: fmtHours(totalMin) },
          { label: t('hr_late'), value: fmtHours(lateMin), tone: lateMin ? 'text-orange-600 dark:text-orange-400' : undefined },
        ]}
      />

      <HrTable
        rows={rows}
        columns={columns}
        search={(a) => `${nameOf(a.employeeId)} ${a.date}`}
        filename={filename}
        empty={t(empty)}
        defaultSort={{ key: 'date', dir: 'desc' }}
      />
    </HrPage>
  )
}
