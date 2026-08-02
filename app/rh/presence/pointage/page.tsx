'use client'

// Pointage : l'écran qu'on ouvre le matin. Une grille de personnes, un clic
// par arrivée et par départ. Volontairement gros et sans formulaire.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, LogIn, LogOut, Check } from 'lucide-react'
import HrPage from '@/components/hr/HrPage'
import { useToast } from '@/components/Toast'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { attendanceId, clock, nowHHMM, shiftForDate } from '@/lib/hr-attendance'
import { fmtHours, todayISO, type Attendance, type Shift, type Team } from '@/lib/hr'
import { useLanguage } from '@/lib/i18n'
import { usePermissions } from '@/lib/access'
import { getSession } from '@/lib/auth'

export default function Page() {
  const attendance = useHrList<Attendance>('attendance')
  const shifts = useHrList<Shift>('shifts')
  const teams = useHrList<Team>('teams')
  const { active: employees } = useEmployees()
  const { t } = useLanguage()
  const { can } = usePermissions()
  const toast = useToast()
  const [date, setDate] = useState(todayISO())
  const [time, setTime] = useState(nowHHMM())

  const session = typeof window !== 'undefined' ? getSession() : null
  // Sans « voir les présences de tous », on ne pointe que soi-même.
  const supervisor = can('hr.attendance')
  const visible = useMemo(
    () => (supervisor ? employees : employees.filter((e) => e.userId === session?.userId)),
    [employees, supervisor, session?.userId]
  )

  const todays = useMemo(() => {
    const m = new Map<string, Attendance>()
    for (const a of attendance.items) if (a.date === date) m.set(a.employeeId, a)
    return m
  }, [attendance.items, date])

  const shiftOf = (employeeId: string) => {
    const team = teams.items.find((x) => x.memberIds.includes(employeeId))
    return shiftForDate(shifts.items, team?.shiftId, date)
  }

  const punch = (employeeId: string, name: string) => {
    const current = todays.get(employeeId) ?? attendance.all.find((a) => a.id === attendanceId(employeeId, date))
    const { record, action } = clock(current, employeeId, date, time, shiftOf(employeeId))
    attendance.put(record)
    toast(
      action === 'in' ? `✓ ${name} — ${t('hr_clock_in')} ${time}`
      : action === 'out' ? `✓ ${name} — ${t('hr_clock_out')} ${time}`
      : `✓ ${name} — ${t('hr_clock_updated')} ${time}`
    )
  }

  const mark = (employeeId: string, status: Attendance['status']) => {
    const current = todays.get(employeeId)
    attendance.put({
      id: attendanceId(employeeId, date),
      employeeId, date, status,
      lateMin: 0, earlyMin: 0, minutes: 0,
      ...(current ? { in: current.in, out: current.out } : {}),
    })
  }

  return (
    <HrPage icon={Clock} title="hr_clock_title" subtitle="hr_clock_sub" perm="hr.clock">
      <div className="glass-card flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_col_date')}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_clock_time')}</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input-field tabular-nums" />
        </label>
        <button onClick={() => setTime(nowHHMM())} className="btn-secondary">{t('hr_clock_now')}</button>
      </div>

      {visible.length === 0 ? (
        <p className="glass-card p-12 text-center text-sm text-gray-500 dark:text-zinc-400">{t('hr_clock_empty')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((e, i) => {
            const a = todays.get(e.id)
            const done = !!a?.in && !!a?.out
            const sh = shiftOf(e.id)
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="glass-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{e.name}</p>
                    <p className="truncate text-[11px] text-gray-400 dark:text-zinc-500">
                      {e.poste}{sh ? ` · ${sh.name} ${sh.start}–${sh.end}` : ''}
                    </p>
                  </div>
                  {done && <Check className="h-4 w-4 shrink-0 text-emerald-500" />}
                </div>

                <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
                  <span className="tabular-nums">
                    <span className="text-[10px] uppercase text-gray-400">{t('hr_clock_in')}</span>{' '}
                    <b className="text-gray-900 dark:text-white">{a?.in ?? '—'}</b>
                  </span>
                  <span className="tabular-nums">
                    <span className="text-[10px] uppercase text-gray-400">{t('hr_clock_out')}</span>{' '}
                    <b className="text-gray-900 dark:text-white">{a?.out ?? '—'}</b>
                  </span>
                  <span className="tabular-nums text-xs font-bold text-amber-600 dark:text-amber-400">
                    {a?.minutes ? fmtHours(a.minutes) : '—'}
                  </span>
                </div>

                {!!a?.lateMin && (
                  <p className="mt-1.5 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                    {t('hr_late')} {fmtHours(a.lateMin)}
                  </p>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => punch(e.id, e.name)}
                    className="btn-primary flex-1 justify-center"
                    disabled={a?.status === 'absent' || a?.status === 'conge'}
                  >
                    {a?.in ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                    {a?.in ? t('hr_clock_out') : t('hr_clock_in')}
                  </button>
                  {supervisor && (
                    <>
                      <button onClick={() => mark(e.id, 'absent')} className="btn-secondary px-2 text-xs">{t('hr_absent')}</button>
                      <button onClick={() => mark(e.id, 'conge')} className="btn-secondary px-2 text-xs">{t('hr_leave')}</button>
                    </>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </HrPage>
  )
}
