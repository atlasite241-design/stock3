'use client'

// Salaires : la grille. Ce que chacun gagne, ce que ça coûte réellement une
// fois les cotisations patronales comptées, et la simulation immédiate du net.

import { useMemo, useState } from 'react'
import { Banknote, Pencil } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { RATES_2025, computePayslip, periodOf, todayISO, type PayAdjustment } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees, type EmployeeView } from '@/lib/hr-employees'
import { fmtDH } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export default function Page() {
  const { active: employees, patch } = useEmployees()
  const adjustments = useHrList<PayAdjustment>('adjustments')
  const { t } = useLanguage()
  const toast = useToast()
  const [editing, setEditing] = useState<EmployeeView | null>(null)
  const [salary, setSalary] = useState(0)

  const period = periodOf(todayISO())

  const rows = useMemo(
    () =>
      employees.map((e) => {
        const mine = adjustments.items.filter((a) => a.employeeId === e.id && a.period === period)
        const primes = mine.filter((a) => a.kind === 'prime').map((a) => ({ label: a.label, amount: a.amount, taxable: a.taxable !== false }))
        const avances = mine.filter((a) => a.kind === 'avance').reduce((s, a) => s + a.amount, 0)
        const deductions = mine.filter((a) => a.kind === 'deduction').map((a) => ({ label: a.label, amount: a.amount }))
        const c = computePayslip({ base: e.baseSalary, primes, avances, deductions, dependents: e.dependents })
        // `c` est imbriqué et NON étalé : `cnss` désigne le numéro d'affiliation
        // sur l'employé et la cotisation dans le calcul. Les fusionner ferait
        // silencieusement afficher un montant à la place d'un identifiant.
        return { id: e.id, matricule: e.matricule, name: e.name, poste: e.poste, baseSalary: e.baseSalary, employee: e, pay: c, avances }
      }),
    [employees, adjustments.items, period]
  )

  const totalBase = rows.reduce((a, r) => a + r.baseSalary, 0)
  const totalBrut = rows.reduce((a, r) => a + r.pay.brut, 0)
  const totalNet = rows.reduce((a, r) => a + r.pay.net, 0)
  const totalCharges = rows.reduce((a, r) => a + r.pay.cnss + r.pay.amo + r.pay.ir, 0)

  type Row = (typeof rows)[number]

  const columns: HrColumn<Row>[] = [
    { key: 'mat', label: t('hr_f_matricule'), value: (r) => r.matricule, render: (r) => <span className="font-mono text-xs text-gray-500">{r.matricule}</span> },
    { key: 'name', label: t('hr_f_name'), value: (r) => r.name, render: (r) => <span className="font-semibold text-gray-900 dark:text-white">{r.name}</span> },
    { key: 'poste', label: t('hr_f_poste'), value: (r) => r.poste },
    { key: 'base', label: t('hr_f_salary'), align: 'right', value: (r) => r.baseSalary, render: (r) => <span className="tabular-nums">{fmtDH(r.baseSalary)}</span> },
    { key: 'brut', label: t('hr_pay_brut'), align: 'right', value: (r) => r.pay.brut, render: (r) => <span className="tabular-nums">{fmtDH(r.pay.brut)}</span> },
    { key: 'cnss', label: 'CNSS', align: 'right', value: (r) => r.pay.cnss, render: (r) => <span className="tabular-nums text-gray-500">{fmtDH(r.pay.cnss)}</span> },
    { key: 'amo', label: 'AMO', align: 'right', value: (r) => r.pay.amo, render: (r) => <span className="tabular-nums text-gray-500">{fmtDH(r.pay.amo)}</span> },
    { key: 'ir', label: 'IR', align: 'right', value: (r) => r.pay.ir, render: (r) => <span className="tabular-nums text-gray-500">{fmtDH(r.pay.ir)}</span> },
    {
      key: 'net', label: t('hr_pay_net'), align: 'right', value: (r) => r.pay.net,
      render: (r) => <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtDH(r.pay.net)}</span>,
    },
    {
      key: 'edit', label: '', meta: true, align: 'right', value: () => '',
      render: (r) => (
        <button
          onClick={() => { setEditing(r.employee); setSalary(r.baseSalary) }}
          className="text-gray-300 transition-colors hover:text-amber-500"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <HrPage icon={Banknote} title="hr_sal_title" subtitle="hr_sal_sub" perm="hr.payroll">
      <HrStats
        cards={[
          { label: t('hr_sal_base_total'), value: fmtDH(totalBase) },
          { label: t('hr_pay_brut'), value: fmtDH(totalBrut) },
          { label: t('hr_sal_charges'), value: fmtDH(totalCharges), tone: 'text-orange-600 dark:text-orange-400' },
          { label: t('hr_pay_net'), value: fmtDH(totalNet), tone: 'text-emerald-600 dark:text-emerald-400' },
        ]}
      />

      <p className="rounded-xl border border-dashed border-gray-200 p-3 text-[11px] leading-relaxed text-gray-500 dark:border-white/15 dark:text-zinc-400">
        {t('hr_sal_note')} — CNSS {(RATES_2025.cnssRate * 100).toFixed(2)} % ({t('hr_pay_capped')} {fmtDH(RATES_2025.cnssCeiling)}) ·
        AMO {(RATES_2025.amoRate * 100).toFixed(2)} % · {t('hr_pay_scale')} {RATES_2025.year}
      </p>

      <HrTable
        rows={rows}
        columns={columns}
        search={(r) => `${r.name} ${r.matricule} ${r.poste}`}
        filename="grille-salaires"
        empty={t('hr_sal_empty')}
        defaultSort={{ key: 'name', dir: 'asc' }}
      />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.name ?? ''}>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_f_salary')}</span>
            <input
              type="number" min={0} step={0.01} value={salary || ''}
              onChange={(e) => setSalary(Number(e.target.value))}
              className="input-field tabular-nums text-lg"
              autoFocus
            />
          </label>
          {editing && (() => {
            const sim = computePayslip({ base: salary, primes: [], avances: 0, deductions: [], dependents: editing.dependents })
            return (
              <div className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-white/5">
                {[
                  [t('hr_pay_brut'), sim.brut],
                  ['CNSS', -sim.cnss],
                  ['AMO', -sim.amo],
                  [`${t('hr_pay_fp')} (${t('hr_pay_deducted_base')})`, -sim.fraisPro],
                  ['IR', -sim.ir],
                ].map(([label, v]) => (
                  <p key={String(label)} className="flex justify-between py-0.5 text-xs text-gray-500 dark:text-zinc-400">
                    <span>{label}</span>
                    <span className="tabular-nums">{fmtDH(Number(v))}</span>
                  </p>
                ))}
                <p className="mt-1 flex justify-between border-t border-gray-200 pt-1.5 font-bold dark:border-white/10">
                  <span>{t('hr_pay_net')}</span>
                  <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{fmtDH(sim.net)}</span>
                </p>
              </div>
            )
          })()}
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className="btn-secondary">{t('mag_cancel')}</button>
            <button
              onClick={() => {
                if (!editing) return
                patch(editing.id, { baseSalary: salary })
                setEditing(null)
                toast(`✓ ${t('hr_saved')}`)
              }}
              className="btn-primary"
            >
              {t('hr_save')}
            </button>
          </div>
        </div>
      </Modal>
    </HrPage>
  )
}
