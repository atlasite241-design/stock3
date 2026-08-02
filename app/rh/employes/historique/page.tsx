'use client'

// Historique du personnel : tout ce qui est arrivé à quelqu'un, dans l'ordre.
// Les événements ne sont pas stockés séparément — ils sont reconstitués depuis
// les collections existantes, sinon la même information vivrait à deux endroits
// et finirait par diverger.

import { useMemo } from 'react'
import {
  Award, CalendarOff, GraduationCap, History as HistoryIcon, LogIn, Receipt, TrendingDown, UserPlus,
} from 'lucide-react'
import HrPage from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import {
  LEAVE_TYPES, monthLabel,
  type Certification, type HrAction, type Leave, type Payslip, type Training,
} from '@/lib/hr'
import { fmtDH } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

interface Event {
  id: string
  date: string
  employee: string
  kind: string
  label: string
  icon: typeof LogIn
  tone: string
}

export default function Page() {
  const { employees, nameOf } = useEmployees()
  const leaves = useHrList<Leave>('leaves')
  const payslips = useHrList<Payslip>('payslips')
  const actions = useHrList<HrAction>('actions')
  const trainings = useHrList<Training>('trainings')
  const certifications = useHrList<Certification>('certifications')
  const { t, lang } = useLanguage()

  const events = useMemo<Event[]>(() => {
    const out: Event[] = []

    for (const e of employees) {
      out.push({
        id: `hire_${e.id}`, date: e.hireDate, employee: e.name,
        kind: t('hr_hist_hire'), label: `${e.poste}${e.departement ? ' · ' + e.departement : ''}`,
        icon: UserPlus, tone: 'text-emerald-500',
      })
      if (e.endDate) {
        out.push({
          id: `end_${e.id}`, date: e.endDate, employee: e.name,
          kind: t('hr_hist_end'), label: e.poste, icon: LogIn, tone: 'text-gray-400',
        })
      }
    }
    for (const l of leaves.items) {
      out.push({
        id: `lv_${l.id}`, date: l.from, employee: nameOf(l.employeeId),
        kind: LEAVE_TYPES.find((x) => x.value === l.type)?.[lang] ?? l.type,
        label: `${l.days} ${t('hr_days')} — ${l.from} → ${l.to}`,
        icon: CalendarOff, tone: 'text-indigo-500',
      })
    }
    for (const p of payslips.items) {
      out.push({
        id: `ps_${p.id}`, date: p.issuedAt.slice(0, 10), employee: nameOf(p.employeeId),
        kind: t('hr_hist_payslip'), label: `${monthLabel(p.period, lang)} — ${fmtDH(p.net)}`,
        icon: Receipt, tone: 'text-amber-500',
      })
    }
    for (const a of actions.items) {
      out.push({
        id: `ac_${a.id}`, date: a.date, employee: nameOf(a.employeeId),
        kind: a.kind === 'recompense' ? t('hr_reward') : t('hr_sanction'),
        label: `${a.type} — ${a.label}`,
        icon: a.kind === 'recompense' ? Award : TrendingDown,
        tone: a.kind === 'recompense' ? 'text-emerald-500' : 'text-rose-500',
      })
    }
    for (const tr of trainings.items) {
      for (const pid of tr.participantIds) {
        out.push({
          id: `tr_${tr.id}_${pid}`, date: tr.from, employee: nameOf(pid),
          kind: t('hr_hist_training'), label: tr.title, icon: GraduationCap, tone: 'text-sky-500',
        })
      }
    }
    for (const c of certifications.items) {
      out.push({
        id: `ce_${c.id}`, date: c.issuedAt, employee: nameOf(c.employeeId),
        kind: t('hr_hist_cert'), label: c.name, icon: GraduationCap, tone: 'text-emerald-500',
      })
    }

    return out.sort((a, b) => b.date.localeCompare(a.date))
  }, [employees, leaves.items, payslips.items, actions.items, trainings.items, certifications.items, nameOf, t, lang])

  const columns: HrColumn<Event>[] = [
    { key: 'date', label: t('hr_col_date'), value: (e) => e.date },
    { key: 'emp', label: t('hr_col_employee'), value: (e) => e.employee },
    {
      key: 'kind', label: t('hr_col_event'), value: (e) => e.kind,
      render: (e) => (
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <e.icon className={`h-4 w-4 ${e.tone}`} />{e.kind}
        </span>
      ),
    },
    { key: 'label', label: t('hr_col_detail'), value: (e) => e.label },
  ]

  return (
    <HrPage icon={HistoryIcon} title="hr_hist_title" subtitle="hr_hist_sub" perm="hr.view">
      <HrTable
        rows={events}
        columns={columns}
        search={(e) => `${e.employee} ${e.kind} ${e.label}`}
        filename="historique-personnel"
        empty={t('hr_hist_empty')}
        defaultSort={{ key: 'date', dir: 'desc' }}
      />
    </HrPage>
  )
}
