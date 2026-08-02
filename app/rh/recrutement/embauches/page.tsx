'use client'

// Embauches : le passage candidat → employé. C'est ici que la candidature
// devient une fiche, un compte, un matricule. La candidature reste, marquée
// « embauchée » et rattachée à l'employé créé — l'historique du recrutement ne
// doit pas disparaître le jour de la signature.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, UserRoundCheck } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { HR_CONTRACTS, todayISO, type Application, type ContractType, type JobOffer } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees, nextMatricule } from '@/lib/hr-employees'
import { USER_ROLES, fmtDH, type AppUser } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export default function Page() {
  const applications = useHrList<Application>('applications')
  const jobs = useHrList<JobOffer>('jobs')
  const { all, create, byId } = useEmployees()
  const { t, lang } = useLanguage()
  const toast = useToast()

  const [hiring, setHiring] = useState<Application | null>(null)
  const [f, setF] = useState({
    poste: '', contract: 'cdi' as ContractType, baseSalary: 0,
    role: 'Vendeur' as AppUser['role'], hireDate: todayISO(), matricule: '',
  })

  // Candidatures prêtes à embaucher : retenues, mais pas encore converties.
  const ready = useMemo(() => applications.items.filter((a) => a.status === 'retenue'), [applications.items])
  const hired = useMemo(() => applications.items.filter((a) => a.status === 'embauchee'), [applications.items])

  const jobOf = (a: Application) => jobs.items.find((j) => j.id === a.jobId)

  const start = (a: Application) => {
    const job = jobOf(a)
    setF({
      poste: job?.poste ?? '',
      contract: job?.contract ?? 'cdi',
      baseSalary: job?.salaryFrom ?? 0,
      role: 'Vendeur',
      hireDate: todayISO(),
      matricule: nextMatricule(all),
    })
    setHiring(a)
  }

  const confirm = () => {
    if (!hiring || !f.poste.trim()) return
    const employee = create({
      name: hiring.name,
      poste: f.poste,
      hireDate: f.hireDate,
      contract: f.contract,
      baseSalary: f.baseSalary,
      role: f.role,
      matricule: f.matricule,
      phone: hiring.phone,
      email: hiring.email,
    })
    applications.update(hiring.id, { status: 'embauchee', hiredEmployeeId: employee.id, hiredAt: f.hireDate })
    setHiring(null)
    toast(`✓ ${employee.name} — ${employee.matricule}`)
  }

  const columns: HrColumn<Application>[] = [
    { key: 'date', label: t('hr_hire_date'), value: (a) => a.hiredAt ?? a.appliedAt },
    { key: 'name', label: t('hr_f_name'), value: (a) => a.name, render: (a) => <span className="font-semibold text-gray-900 dark:text-white">{a.name}</span> },
    { key: 'job', label: t('hr_job_title'), value: (a) => jobOf(a)?.title ?? '—' },
    {
      key: 'emp', label: t('hr_hire_record'), value: (a) => byId(a.hiredEmployeeId ?? '')?.matricule ?? '—',
      render: (a) => {
        const e = a.hiredEmployeeId ? byId(a.hiredEmployeeId) : undefined
        return e ? (
          <Link href={`/rh/employes/dossier?id=${e.id}`} className="inline-flex items-center gap-1 font-mono text-xs text-amber-600 hover:underline dark:text-amber-400">
            {e.matricule}<ArrowRight className="h-3 w-3 rtl:rotate-180" />
          </Link>
        ) : <span className="text-gray-400">—</span>
      },
    },
  ]

  return (
    <HrPage icon={UserRoundCheck} title="hr_hire_title" subtitle="hr_hire_sub" perm="hr.edit">
      <HrStats
        cards={[
          { label: t('hr_hire_ready'), value: String(ready.length), tone: ready.length ? 'text-amber-600 dark:text-amber-400' : undefined },
          { label: t('hr_hire_done'), value: String(hired.length), tone: 'text-emerald-600 dark:text-emerald-400' },
          { label: t('hr_hire_this_year'), value: String(hired.filter((a) => (a.hiredAt ?? '').startsWith(String(new Date().getFullYear()))).length) },
          { label: t('hr_job_open'), value: String(jobs.items.filter((j) => j.status === 'ouverte').length) },
        ]}
      />

      {ready.length > 0 && (
        <div className="glass-card p-5">
          <p className="mb-3 text-sm font-bold text-gray-900 dark:text-white">{t('hr_hire_ready')}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ready.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3 dark:border-white/10">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{a.name}</p>
                  <p className="truncate text-[11px] text-gray-400">{jobOf(a)?.title ?? '—'}</p>
                </div>
                <button onClick={() => start(a)} className="btn-primary shrink-0">{t('hr_hire_do')}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <HrTable
        rows={hired}
        columns={columns}
        search={(a) => `${a.name} ${jobOf(a)?.title ?? ''}`}
        filename="embauches"
        empty={t('hr_hire_empty')}
        defaultSort={{ key: 'date', dir: 'desc' }}
      />

      <Modal open={!!hiring} onClose={() => setHiring(null)} title={hiring?.name ?? ''} closeOnBackdrop={false}>
        <div className="space-y-3">
          <p className="rounded-xl border border-dashed border-gray-200 p-3 text-[11px] leading-relaxed text-gray-500 dark:border-white/15 dark:text-zinc-400">
            {t('hr_hire_hint')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input value={f.poste} onChange={(e) => setF({ ...f, poste: e.target.value })} placeholder={t('hr_f_poste')} className="input-field" autoFocus />
            <input value={f.matricule} onChange={(e) => setF({ ...f, matricule: e.target.value })} placeholder={t('hr_f_matricule')} className="input-field font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={f.contract}
              onChange={(v) => setF({ ...f, contract: v as ContractType })}
              options={HR_CONTRACTS.map((c) => ({ value: c.value, label: c[lang] }))}
            />
            <Select value={f.role} onChange={(v) => setF({ ...f, role: v as AppUser['role'] })} options={[...USER_ROLES]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_f_hire')}</span>
              <input type="date" value={f.hireDate} onChange={(e) => setF({ ...f, hireDate: e.target.value })} className="input-field" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_f_salary')}</span>
              <input
                type="number" min={0} step={0.01} value={f.baseSalary || ''}
                onChange={(e) => setF({ ...f, baseSalary: Number(e.target.value) })}
                className="input-field tabular-nums"
              />
              {!!jobOf(hiring ?? ({} as Application))?.salaryFrom && (
                <span className="mt-1 block text-[10px] text-gray-400">
                  {t('hr_job_salary_from')} {fmtDH(jobOf(hiring!)!.salaryFrom!)}
                </span>
              )}
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setHiring(null)} className="btn-secondary">{t('mag_cancel')}</button>
            <button onClick={confirm} disabled={!f.poste.trim()} className="btn-primary disabled:opacity-40">{t('hr_hire_do')}</button>
          </div>
        </div>
      </Modal>
    </HrPage>
  )
}
