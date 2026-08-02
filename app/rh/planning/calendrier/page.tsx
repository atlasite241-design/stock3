'use client'

// Calendrier : un mois, une ligne par personne. Superpose congés, jours fériés
// et pointage réel — c'est le seul écran qui montre les trois ensemble.

import { useMemo, useState } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import HrPage from '@/components/hr/HrPage'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { monthLabel, type Attendance, type Holiday, type Leave, type Shift, type Team } from '@/lib/hr'
import { useLanguage } from '@/lib/i18n'

type Mark = 'present' | 'late' | 'absent' | 'leave' | 'holiday' | 'off' | 'none'

const STYLE: Record<Mark, string> = {
  present: 'bg-emerald-500',
  late: 'bg-orange-400',
  absent: 'bg-rose-500',
  leave: 'bg-indigo-400',
  holiday: 'bg-amber-400',
  off: 'bg-gray-200 dark:bg-white/10',
  none: 'bg-gray-50 dark:bg-white/[0.03]',
}

export default function Page() {
  const attendance = useHrList<Attendance>('attendance')
  const leaves = useHrList<Leave>('leaves')
  const holidays = useHrList<Holiday>('holidays')
  const shifts = useHrList<Shift>('shifts')
  const teams = useHrList<Team>('teams')
  const { active: employees } = useEmployees()
  const { t, lang } = useLanguage()

  const [cursor, setCursor] = useState(() => new Date().toISOString().slice(0, 7))

  const [year, month] = cursor.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const dayList = Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    return { day: i + 1, date: `${cursor}-${d}`, dow: new Date(year, month - 1, i + 1).getDay() }
  })

  const holidayDates = useMemo(() => {
    const set = new Set<string>()
    const mm = String(month).padStart(2, '0')
    for (const h of holidays.items) {
      if (h.date.startsWith(cursor)) set.add(h.date)
      // Une fête à date fixe est saisie une fois, avec une année ; on la reporte
      // sur le mois affiché, sinon elle disparaîtrait dès l'année suivante.
      else if (h.fixed && h.date.slice(5, 7) === mm) set.add(`${year}-${h.date.slice(5)}`)
    }
    return set
  }, [holidays.items, cursor, month, year])

  const attMap = useMemo(() => {
    const m = new Map<string, Attendance>()
    for (const a of attendance.items) if (a.date.startsWith(cursor)) m.set(`${a.employeeId}|${a.date}`, a)
    return m
  }, [attendance.items, cursor])

  const approvedLeaves = useMemo(() => leaves.items.filter((l) => l.status === 'approuve'), [leaves.items])

  const shiftOf = (employeeId: string) => {
    const team = teams.items.find((x) => x.memberIds.includes(employeeId))
    return shifts.items.find((s) => s.id === team?.shiftId)
  }

  const markOf = (employeeId: string, date: string, dow: number): Mark => {
    if (holidayDates.has(date)) return 'holiday'
    const a = attMap.get(`${employeeId}|${date}`)
    if (a) {
      if (a.status === 'conge') return 'leave'
      if (a.status === 'absent') return 'absent'
      if (a.status === 'present') return a.lateMin > 0 ? 'late' : 'present'
    }
    if (approvedLeaves.some((l) => l.employeeId === employeeId && date >= l.from && date <= l.to)) return 'leave'
    const sh = shiftOf(employeeId)
    if (sh && !sh.days.includes(dow)) return 'off'
    if (!sh && dow === 0) return 'off'
    return 'none'
  }

  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1)
    setCursor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const legend: { mark: Mark; label: string }[] = [
    { mark: 'present', label: t('hr_att_present') },
    { mark: 'late', label: t('hr_late') },
    { mark: 'absent', label: t('hr_att_absent') },
    { mark: 'leave', label: t('hr_leave') },
    { mark: 'holiday', label: t('hr_hol_title') },
    { mark: 'off', label: t('hr_cal_off') },
  ]

  return (
    <HrPage icon={CalendarRange} title="hr_cal_title" subtitle="hr_cal_sub" perm="hr.planning">
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="btn-secondary px-2"><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></button>
          <span className="min-w-[160px] text-center text-sm font-bold capitalize text-gray-900 dark:text-white">
            {monthLabel(cursor, lang)}
          </span>
          <button onClick={() => shift(1)} className="btn-secondary px-2"><ChevronRight className="h-4 w-4 rtl:rotate-180" /></button>
        </div>
        <div className="flex flex-wrap gap-3">
          {legend.map((l) => (
            <span key={l.mark} className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-zinc-400">
              <span className={`h-3 w-3 rounded-sm ${STYLE[l.mark]}`} />{l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-x-auto p-3">
        {employees.length === 0 ? (
          <p className="p-12 text-center text-sm text-gray-500 dark:text-zinc-400">{t('hr_cal_empty')}</p>
        ) : (
          <table className="w-full border-separate border-spacing-y-1">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white px-2 text-left text-[10px] font-bold uppercase text-gray-400 dark:bg-[#12121a] rtl:left-auto rtl:right-0 rtl:text-right">
                  {t('hr_col_employee')}
                </th>
                {dayList.map((d) => (
                  <th key={d.date} className={`w-6 pb-1 text-center text-[9px] font-bold ${d.dow === 0 ? 'text-rose-400' : 'text-gray-400'}`}>
                    {d.day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="sticky left-0 z-10 max-w-[160px] truncate bg-white px-2 text-xs font-semibold text-gray-900 dark:bg-[#12121a] dark:text-white rtl:left-auto rtl:right-0">
                    {e.name}
                  </td>
                  {dayList.map((d) => {
                    const m = markOf(e.id, d.date, d.dow)
                    return (
                      <td key={d.date} className="px-px">
                        <span
                          title={`${e.name} · ${d.date}`}
                          className={`block h-5 w-5 rounded-sm ${STYLE[m]}`}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </HrPage>
  )
}
