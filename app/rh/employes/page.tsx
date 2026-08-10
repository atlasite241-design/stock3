'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, UserCheck, UserX, Users } from 'lucide-react'
import HrPage from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import EmployeeForm from '@/components/hr/EmployeeForm'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { HR_CONTRACTS } from '@/lib/hr'
import { useEmployees, type EmployeeView } from '@/lib/hr-employees'
import { fmtDH } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'
import { usePermissions } from '@/lib/access'

export default function Page() {
  const { employees, all, create, sansFiche, creerFichesManquantes } = useEmployees()
  const { t, lang } = useLanguage()
  const { can } = usePermissions()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const rows = employees.filter((e) => showInactive || e.active)
  const contractLabel = (v: string) => HR_CONTRACTS.find((c) => c.value === v)?.[lang] ?? v

  const columns: HrColumn<EmployeeView>[] = [
    {
      key: 'matricule', label: t('hr_f_matricule'), value: (e) => e.matricule,
      render: (e) => <span className="font-mono text-xs text-gray-500">{e.matricule}</span>,
    },
    {
      key: 'name', label: t('hr_f_name'), value: (e) => e.name,
      render: (e) => (
        <Link href={`/rh/employes/dossier?id=${e.id}`} className="font-semibold text-gray-900 hover:text-amber-600 dark:text-white dark:hover:text-amber-400">
          {e.name}
        </Link>
      ),
    },
    { key: 'poste', label: t('hr_f_poste'), value: (e) => e.poste },
    { key: 'dept', label: t('hr_f_dept'), value: (e) => e.departement ?? '—' },
    { key: 'contract', label: t('hr_f_contract'), value: (e) => contractLabel(e.contract) },
    { key: 'hire', label: t('hr_f_hire'), value: (e) => e.hireDate },
    {
      key: 'salary', label: t('hr_f_salary'), align: 'right',
      // Le salaire ne s'affiche qu'avec la permission Paie : la liste du
      // personnel n'est pas un bulletin.
      value: (e) => (can('hr.payroll') ? e.baseSalary : 0),
      render: (e) => (can('hr.payroll')
        ? <span className="tabular-nums font-semibold">{fmtDH(e.baseSalary)}</span>
        : <span className="text-gray-300 dark:text-zinc-700">•••</span>),
    },
    {
      key: 'status', label: t('hr_col_status'), align: 'center',
      value: (e) => (e.active ? t('hr_active') : t('hr_inactive')),
      render: (e) => (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
          e.active
            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
            : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-zinc-400'
        }`}>
          {e.active ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
          {e.active ? t('hr_active') : t('hr_inactive')}
        </span>
      ),
    },
  ]

  return (
    <HrPage
      icon={Users}
      title="hr_emp_title"
      subtitle="hr_emp_sub"
      perm="hr.view"
      actions={
        <>
          <button onClick={() => setShowInactive((v) => !v)} className="btn-secondary">
            {showInactive ? t('hr_hide_inactive') : t('hr_show_inactive')}
          </button>
          {can('hr.edit') && (
            <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />{t('hr_emp_new')}</button>
          )}
        </>
      }
    >
      {/*
        Comptes SANS fiche employé : nés hors de la RH (inscription approuvée,
        écran Utilisateurs), ils ne peuvent ni pointer ni être payés tant que
        la fiche n'existe pas. On les montre, on les crée en un clic.
      */}
      {can('hr.edit') && sansFiche.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {sansFiche.length} {t('hr_orphan_accounts')}
            </p>
            <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-400/80">
              {sansFiche.map((u) => u.name).join(' · ')} — {t('hr_orphan_hint')}
            </p>
          </div>
          <button
            onClick={() => {
              const n = creerFichesManquantes()
              toast(`✓ ${n} ${t('hr_orphan_created')}`)
            }}
            className="btn-primary !h-9 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('hr_orphan_create')}
          </button>
        </div>
      )}

      <HrTable
        rows={rows}
        columns={columns}
        search={(e) => `${e.name} ${e.matricule} ${e.poste} ${e.departement ?? ''}`}
        filename="employes"
        empty={t('hr_emp_empty')}
        defaultSort={{ key: 'matricule', dir: 'asc' }}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={t('hr_emp_new')} maxWidth="max-w-3xl" closeOnBackdrop={false}>
        <EmployeeForm
          existing={all}
          onCancel={() => setOpen(false)}
          onSubmit={(data) => {
            const e = create(data)
            setOpen(false)
            toast(`✓ ${e.name} — ${e.matricule}`)
          }}
        />
      </Modal>
    </HrPage>
  )
}
