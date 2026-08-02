'use client'

// Export RH : un classeur Excel, un onglet par collection. Utile pour le
// comptable, la déclaration CNSS, ou simplement pour archiver hors application.

import { useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import HrPage from '@/components/hr/HrPage'
import { useToast } from '@/components/Toast'
import { HR_CONTRACTS, LEAVE_TYPES, fmtHours, type Attendance, type Certification, type HrAction, type Leave, type Payslip, type Skill, type Training } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { useLanguage } from '@/lib/i18n'

export default function Page() {
  const { employees, nameOf } = useEmployees()
  const attendance = useHrList<Attendance>('attendance')
  const leaves = useHrList<Leave>('leaves')
  const payslips = useHrList<Payslip>('payslips')
  const actions = useHrList<HrAction>('actions')
  const trainings = useHrList<Training>('trainings')
  const skills = useHrList<Skill>('skills')
  const certifications = useHrList<Certification>('certifications')
  const { t, lang } = useLanguage()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const sheets = () => ({
    [t('hr_emp_title')]: [
      [t('hr_f_matricule'), t('hr_f_name'), t('hr_f_poste'), t('hr_f_dept'), t('hr_f_role'), t('hr_f_contract'), t('hr_f_hire'), t('hr_f_salary'), 'CIN', 'CNSS', t('hr_f_phone'), t('hr_col_status')],
      ...employees.map((e) => [
        e.matricule, e.name, e.poste, e.departement ?? '', e.role,
        HR_CONTRACTS.find((c) => c.value === e.contract)?.[lang] ?? e.contract,
        e.hireDate, e.baseSalary, e.cin ?? '', e.cnss ?? '', e.phone ?? '',
        e.active ? t('hr_active') : t('hr_inactive'),
      ]),
    ],
    [t('hr_pres_title')]: [
      [t('hr_col_date'), t('hr_col_employee'), t('hr_clock_in'), t('hr_clock_out'), t('hr_att_hours'), t('hr_late'), t('hr_col_status')],
      ...attendance.items.map((a) => [a.date, nameOf(a.employeeId), a.in ?? '', a.out ?? '', fmtHours(a.minutes), a.lateMin, a.status]),
    ],
    [t('hr_lv_title')]: [
      [t('hr_col_employee'), t('hr_lv_type'), t('hr_lv_from'), t('hr_lv_to'), t('hr_days'), t('hr_col_status')],
      ...leaves.items.map((l) => [
        nameOf(l.employeeId), LEAVE_TYPES.find((x) => x.value === l.type)?.[lang] ?? l.type,
        l.from, l.to, l.days, l.status,
      ]),
    ],
    [t('hr_slip_title')]: [
      [t('hr_adj_period'), t('hr_col_employee'), t('hr_pay_brut'), 'CNSS', 'AMO', t('hr_pay_fp'), t('hr_pay_sni'), 'IR', t('hr_adv_title'), t('hr_pay_net')],
      ...payslips.items.map((p) => [
        p.period, nameOf(p.employeeId), p.brut, p.cnss, p.amo, p.fraisPro, p.netImposable, p.ir, p.avances, p.net,
      ]),
    ],
    [t('hr_act_title')]: [
      [t('hr_col_date'), t('hr_col_employee'), t('hr_act_type'), t('hr_col_detail'), t('cp_col_amount')],
      ...actions.items.map((a) => [a.date, nameOf(a.employeeId), a.type, a.label, a.amount ?? '']),
    ],
    [t('hr_tr_title')]: [
      [t('hr_tr_what'), t('hr_tr_org'), t('hr_lv_from'), t('hr_lv_to'), t('hr_tr_cost'), t('hr_tr_participants')],
      ...trainings.items.map((x) => [x.title, x.org ?? '', x.from, x.to ?? '', x.cost ?? '', x.participantIds.map(nameOf).join(', ')]),
    ],
    [t('hr_sk_title')]: [
      [t('hr_col_employee'), t('hr_sk_name'), t('hr_sk_level')],
      ...skills.items.map((s) => [nameOf(s.employeeId), s.name, s.level]),
    ],
    [t('hr_ce_title')]: [
      [t('hr_col_employee'), t('hr_ce_name'), t('hr_ce_issuer'), t('hr_ce_issued'), t('hr_doc_expires')],
      ...certifications.items.map((c) => [nameOf(c.employeeId), c.name, c.issuer ?? '', c.issuedAt, c.expiresAt ?? '']),
    ],
  })

  const exportXlsx = async () => {
    setBusy(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      for (const [name, aoa] of Object.entries(sheets())) {
        // Excel refuse les noms d'onglet de plus de 31 caractères.
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name.slice(0, 31))
      }
      XLSX.writeFile(wb, `rh-${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast(`✓ ${t('hr_exp_done')}`)
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = () => {
    const parts: string[] = []
    for (const [name, aoa] of Object.entries(sheets())) {
      parts.push(`### ${name}`)
      parts.push(aoa.map((line) => line.join(';')).join('\n'))
      parts.push('')
    }
    const url = URL.createObjectURL(new Blob(['﻿' + parts.join('\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `rh-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast(`✓ ${t('hr_exp_done')}`)
  }

  const counts = [
    { label: t('hr_emp_title'), n: employees.length },
    { label: t('hr_pres_title'), n: attendance.items.length },
    { label: t('hr_lv_title'), n: leaves.items.length },
    { label: t('hr_slip_title'), n: payslips.items.length },
    { label: t('hr_act_title'), n: actions.items.length },
    { label: t('hr_tr_title'), n: trainings.items.length },
    { label: t('hr_sk_title'), n: skills.items.length },
    { label: t('hr_ce_title'), n: certifications.items.length },
  ]

  return (
    <HrPage icon={FileText} title="hr_exp_title" subtitle="hr_exp_sub" perm="hr.reports">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {counts.map((c) => (
          <div key={c.label} className="glass-card p-4">
            <p className="text-xl font-extrabold tabular-nums text-gray-900 dark:text-white">{c.n.toLocaleString('fr-FR')}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="glass-card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{t('hr_exp_ready')}</p>
          <p className="mt-1 max-w-xl text-xs text-gray-500 dark:text-zinc-400">{t('hr_exp_hint')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} className="btn-secondary"><Download className="h-4 w-4" />CSV</button>
          <button onClick={exportXlsx} disabled={busy} className="btn-primary disabled:opacity-40">
            <FileSpreadsheet className="h-4 w-4" />{busy ? '…' : 'Excel'}
          </button>
        </div>
      </div>

      <p className="rounded-xl border border-dashed border-gray-200 p-3 text-[11px] leading-relaxed text-gray-500 dark:border-white/15 dark:text-zinc-400">
        {t('hr_exp_note')}
      </p>
    </HrPage>
  )
}
