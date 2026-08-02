'use client'

// Dossier employé : tout ce que l'application sait d'une personne, sur un écran.
// Les sections sensibles (paie) restent conditionnées à la permission.

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Award, BadgeCheck, CalendarDays, ContactRound, FileText, GraduationCap, Pencil,
  Receipt, Target, TrendingDown, UserSquare2,
} from 'lucide-react'
import HrPage from '@/components/hr/HrPage'
import EmployeeForm from '@/components/hr/EmployeeForm'
import Loader from '@/components/Loader'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import {
  HR_CONTRACTS, LEAVE_TYPES, fmtHours, monthLabel,
  type Attendance, type Certification, type HrAction, type HrDocument, type Leave,
  type Objective, type PayAdjustment, type Payslip, type Skill,
} from '@/lib/hr'
import { fmtDH } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'
import { usePermissions } from '@/lib/access'

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-gray-50 py-2 last:border-0 dark:border-white/5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900 dark:text-white">{value || '—'}</span>
    </div>
  )
}

function Card({ icon: Icon, title, children }: { icon: typeof FileText; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
        <Icon className="h-4 w-4 text-amber-500" />{title}
      </p>
      {children}
    </div>
  )
}

function Content() {
  const id = useSearchParams().get('id') ?? ''
  const { t, lang } = useLanguage()
  const { can } = usePermissions()
  const toast = useToast()
  const { employees, all, byId, patch, archive } = useEmployees()
  const [edit, setEdit] = useState(false)

  const documents = useHrList<HrDocument>('documents')
  const attendance = useHrList<Attendance>('attendance')
  const leaves = useHrList<Leave>('leaves')
  const payslips = useHrList<Payslip>('payslips')
  const adjustments = useHrList<PayAdjustment>('adjustments')
  const actions = useHrList<HrAction>('actions')
  const objectives = useHrList<Objective>('objectives')
  const skills = useHrList<Skill>('skills')
  const certifications = useHrList<Certification>('certifications')

  const e = byId(id)

  if (!id || !e) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-sm text-gray-500 dark:text-zinc-400">{t('hr_file_pick')}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {employees.slice(0, 12).map((x) => (
            <Link key={x.id} href={`/rh/employes/dossier?id=${x.id}`} className="btn-secondary">{x.name}</Link>
          ))}
        </div>
      </div>
    )
  }

  const mine = <T extends { employeeId: string }>(l: T[]) => l.filter((x) => x.employeeId === e.id)
  const myAttendance = mine(attendance.items)
  const present = myAttendance.filter((a) => a.status === 'present').length
  const absent = myAttendance.filter((a) => a.status === 'absent').length
  const minutes = myAttendance.reduce((a, x) => a + x.minutes, 0)
  const myLeaves = mine(leaves.items)
  const mySlips = mine(payslips.items).sort((a, b) => b.period.localeCompare(a.period))
  const contract = HR_CONTRACTS.find((c) => c.value === e.contract)?.[lang] ?? e.contract

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card icon={ContactRound} title={t('hr_file_identity')}>
          <Row label={t('hr_f_matricule')} value={<span className="font-mono">{e.matricule}</span>} />
          <Row label={t('hr_f_poste')} value={e.poste} />
          <Row label={t('hr_f_dept')} value={e.departement} />
          <Row label={t('hr_f_role')} value={e.role} />
          <Row label={t('hr_f_contract')} value={contract} />
          <Row label={t('hr_f_hire')} value={e.hireDate} />
          {e.endDate && <Row label={t('hr_f_end')} value={e.endDate} />}
          <Row label={t('hr_f_phone')} value={e.phone} />
          <Row label={t('hr_f_email')} value={e.email} />
          <Row label={t('hr_f_cin')} value={e.cin} />
          <Row label={t('hr_f_cnss')} value={e.cnss} />
          <Row
            label={t('hr_file_login')}
            value={
              <span className={e.canLogin ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}>
                {e.canLogin ? t('hr_file_login_yes') : t('hr_file_login_no')}
              </span>
            }
          />
        </Card>

        <Card icon={CalendarDays} title={t('hr_file_attendance')}>
          <Row label={t('hr_att_present')} value={<span className="tabular-nums">{present}</span>} />
          <Row label={t('hr_att_absent')} value={<span className="tabular-nums">{absent}</span>} />
          <Row label={t('hr_att_hours')} value={<span className="tabular-nums">{fmtHours(minutes)}</span>} />
          <Row label={t('hr_lv_title')} value={<span className="tabular-nums">{myLeaves.reduce((a, l) => a + (l.status === 'approuve' ? l.days : 0), 0)}</span>} />
          <div className="mt-2 space-y-1">
            {myLeaves.slice(0, 5).map((l) => (
              <p key={l.id} className="flex justify-between text-xs text-gray-500 dark:text-zinc-400">
                <span>{LEAVE_TYPES.find((x) => x.value === l.type)?.[lang] ?? l.type}</span>
                <span className="tabular-nums">{l.from} → {l.to}</span>
              </p>
            ))}
          </div>
        </Card>

        {can('hr.payroll') ? (
          <Card icon={Receipt} title={t('hr_file_payroll')}>
            <Row label={t('hr_f_salary')} value={<span className="tabular-nums font-bold">{fmtDH(e.baseSalary)}</span>} />
            <Row label={t('hr_f_dependents')} value={e.dependents ?? 0} />
            <Row label={t('hr_f_rib')} value={<span className="font-mono text-xs">{e.rib}</span>} />
            <div className="mt-2 space-y-1">
              {mySlips.slice(0, 6).map((p) => (
                <Link key={p.id} href={`/rh/paie/bulletins?id=${p.id}`} className="flex justify-between text-xs text-gray-500 hover:text-amber-600 dark:text-zinc-400">
                  <span>{monthLabel(p.period, lang)}</span>
                  <span className="tabular-nums font-semibold">{fmtDH(p.net)}</span>
                </Link>
              ))}
              {mySlips.length === 0 && <p className="text-xs text-gray-400">{t('hr_pay_none')}</p>}
            </div>
            <div className="mt-2 border-t border-gray-50 pt-2 dark:border-white/5">
              {mine(adjustments.items).slice(0, 4).map((a) => (
                <p key={a.id} className="flex justify-between text-xs text-gray-500 dark:text-zinc-400">
                  <span>{a.label}</span>
                  <span className="tabular-nums">{fmtDH(a.amount)}</span>
                </p>
              ))}
            </div>
          </Card>
        ) : (
          <Card icon={Receipt} title={t('hr_file_payroll')}>
            <p className="py-6 text-center text-xs text-gray-400 dark:text-zinc-500">{t('hr_denied')}</p>
          </Card>
        )}

        <Card icon={FileText} title={t('hr_doc_title')}>
          {mine(documents.items).length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-400">{t('hr_doc_empty')}</p>
          ) : mine(documents.items).map((d) => (
            <Row key={d.id} label={d.type} value={<>{d.name} <span className="text-xs text-gray-400">{d.date}</span></>} />
          ))}
        </Card>

        <Card icon={Target} title={t('hr_obj_title')}>
          {mine(objectives.items).length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-400">{t('hr_obj_empty')}</p>
          ) : mine(objectives.items).map((o) => (
            <div key={o.id} className="border-b border-gray-50 py-2 last:border-0 dark:border-white/5">
              <p className="flex justify-between text-sm">
                <span className="font-medium text-gray-900 dark:text-white">{o.title}</span>
                <span className="tabular-nums text-gray-500">{o.progress}/{o.target} {o.unit ?? ''}</span>
              </p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, o.target ? (o.progress / o.target) * 100 : 0)}%` }} />
              </div>
            </div>
          ))}
        </Card>

        <Card icon={GraduationCap} title={t('hr_sk_title')}>
          {mine(skills.items).map((s) => (
            <Row key={s.id} label={s.name} value={'★'.repeat(s.level) + '☆'.repeat(4 - s.level)} />
          ))}
          {mine(certifications.items).map((c) => (
            <Row key={c.id} label={c.name} value={<><BadgeCheck className="inline h-3.5 w-3.5 text-emerald-500" /> {c.expiresAt ?? c.issuedAt}</>} />
          ))}
          {mine(skills.items).length === 0 && mine(certifications.items).length === 0 && (
            <p className="py-4 text-center text-xs text-gray-400">{t('hr_sk_empty')}</p>
          )}
        </Card>

        <div className="lg:col-span-3">
          <Card icon={Award} title={t('hr_act_title')}>
            {mine(actions.items).length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400">{t('hr_act_empty')}</p>
            ) : (
              <div className="space-y-1">
                {mine(actions.items).map((a) => (
                  <p key={a.id} className="flex items-center justify-between gap-3 border-b border-gray-50 py-2 text-sm last:border-0 dark:border-white/5">
                    <span className="flex items-center gap-2">
                      {a.kind === 'recompense'
                        ? <Award className="h-4 w-4 text-emerald-500" />
                        : <TrendingDown className="h-4 w-4 text-rose-500" />}
                      <span className="font-medium text-gray-900 dark:text-white">{a.label}</span>
                      <span className="text-xs text-gray-400">{a.type}</span>
                    </span>
                    <span className="text-xs tabular-nums text-gray-400">{a.date}</span>
                  </p>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {can('hr.edit') && (
          <>
            <button onClick={() => setEdit(true)} className="btn-secondary"><Pencil className="h-4 w-4" />{t('hr_edit')}</button>
            {e.active && (
              <button
                onClick={() => { archive(e.id); toast(`✓ ${e.name} — ${t('hr_archived')}`) }}
                className="btn-secondary text-rose-600 dark:text-rose-400"
              >
                {t('hr_archive')}
              </button>
            )}
          </>
        )}
      </div>

      <Modal open={edit} onClose={() => setEdit(false)} title={e.name} maxWidth="max-w-3xl" closeOnBackdrop={false}>
        <EmployeeForm
          initial={e}
          existing={all}
          onCancel={() => setEdit(false)}
          onSubmit={(data) => {
            patch(e.id, { ...data, baseSalary: Number(data.baseSalary) || 0 })
            setEdit(false)
            toast(`✓ ${t('hr_saved')}`)
          }}
        />
      </Modal>
    </>
  )
}

export default function Page() {
  return (
    <HrPage icon={UserSquare2} title="hr_file_title" subtitle="hr_file_sub" perm="hr.view">
      <Suspense fallback={<Loader />}>
        <Content />
      </Suspense>
    </HrPage>
  )
}
