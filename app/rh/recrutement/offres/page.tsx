'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Briefcase, Plus, Trash2 } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { HR_CONTRACTS, todayISO, type Application, type ContractType, type JobOffer } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { fmtDH } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export default function Page() {
  const jobs = useHrList<JobOffer>('jobs')
  const applications = useHrList<Application>('applications')
  const { t, lang } = useLanguage()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({
    title: '', poste: '', contract: 'cdi' as ContractType, openings: 1,
    salaryFrom: 0, salaryTo: 0, publishedAt: todayISO(), closesAt: '', description: '',
  })

  const countFor = (jobId: string) => applications.items.filter((a) => a.jobId === jobId).length
  const hiredFor = (jobId: string) => applications.items.filter((a) => a.jobId === jobId && a.status === 'embauchee').length

  const openJobs = jobs.items.filter((j) => j.status === 'ouverte')
  const seats = openJobs.reduce((a, j) => a + j.openings, 0)

  return (
    <HrPage
      icon={Briefcase}
      title="hr_job_title"
      subtitle="hr_job_sub"
      perm="hr.recruitment"
      actions={<button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />{t('hr_job_new')}</button>}
    >
      <HrStats
        cards={[
          { label: t('hr_job_open'), value: String(openJobs.length) },
          { label: t('hr_job_seats'), value: String(seats) },
          { label: t('hr_app_title'), value: String(applications.items.length) },
          { label: t('hr_hire_title'), value: String(applications.items.filter((a) => a.status === 'embauchee').length), tone: 'text-emerald-600 dark:text-emerald-400' },
        ]}
      />

      {jobs.items.length === 0 ? (
        <p className="glass-card p-12 text-center text-sm text-gray-500 dark:text-zinc-400">{t('hr_job_empty')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.items.map((j) => (
            <div key={j.id} className="glass-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{j.title}</p>
                  <p className="truncate text-[11px] text-gray-400 dark:text-zinc-500">
                    {j.poste} · {HR_CONTRACTS.find((c) => c.value === j.contract)?.[lang]}
                  </p>
                </div>
                <button onClick={() => jobs.remove(j.id)} className="text-gray-300 transition-colors hover:text-rose-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  j.status === 'ouverte'
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-zinc-400'
                }`}>
                  {j.status === 'ouverte' ? t('hr_job_open') : t('hr_job_closed')}
                </span>
                <span className="text-[11px] tabular-nums text-gray-500">
                  {hiredFor(j.id)} / {j.openings} {t('hr_job_filled')}
                </span>
              </div>

              {(j.salaryFrom || j.salaryTo) && (
                <p className="mt-1.5 text-xs tabular-nums text-gray-500 dark:text-zinc-400">
                  {fmtDH(j.salaryFrom ?? 0)}{j.salaryTo ? ` – ${fmtDH(j.salaryTo)}` : ''}
                </p>
              )}
              {j.description && <p className="mt-1.5 line-clamp-2 text-xs text-gray-500 dark:text-zinc-400">{j.description}</p>}

              <div className="mt-3 flex gap-2">
                <Link href={`/rh/recrutement/candidatures?job=${j.id}`} className="btn-secondary flex-1 justify-center">
                  {countFor(j.id)} {t('hr_app_title')}
                </Link>
                <button
                  onClick={() => jobs.update(j.id, { status: j.status === 'ouverte' ? 'fermee' : 'ouverte' })}
                  className="btn-secondary"
                >
                  {j.status === 'ouverte' ? t('hr_job_close') : t('hr_job_reopen')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t('hr_job_new')} closeOnBackdrop={false}>
        <div className="space-y-3">
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t('hr_job_what')} className="input-field" autoFocus />
          <input value={f.poste} onChange={(e) => setF({ ...f, poste: e.target.value })} placeholder={t('hr_f_poste')} className="input-field" />
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={f.contract}
              onChange={(v) => setF({ ...f, contract: v as ContractType })}
              options={HR_CONTRACTS.map((c) => ({ value: c.value, label: c[lang] }))}
            />
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_job_seats')}</span>
              <input type="number" min={1} value={f.openings} onChange={(e) => setF({ ...f, openings: Math.max(1, Number(e.target.value)) })} className="input-field tabular-nums" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" min={0} value={f.salaryFrom || ''} onChange={(e) => setF({ ...f, salaryFrom: Number(e.target.value) })} placeholder={t('hr_job_salary_from')} className="input-field tabular-nums" />
            <input type="number" min={0} value={f.salaryTo || ''} onChange={(e) => setF({ ...f, salaryTo: Number(e.target.value) })} placeholder={t('hr_job_salary_to')} className="input-field tabular-nums" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_job_published')}</span>
              <input type="date" value={f.publishedAt} onChange={(e) => setF({ ...f, publishedAt: e.target.value })} className="input-field" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_job_closes')}</span>
              <input type="date" value={f.closesAt} onChange={(e) => setF({ ...f, closesAt: e.target.value })} className="input-field" />
            </label>
          </div>
          <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} placeholder={t('hr_job_desc')} className="input-field" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
            <button
              onClick={() => {
                if (!f.title.trim()) return
                jobs.add({
                  ...f,
                  poste: f.poste || f.title,
                  salaryFrom: f.salaryFrom || undefined,
                  salaryTo: f.salaryTo || undefined,
                  closesAt: f.closesAt || undefined,
                  description: f.description || undefined,
                  status: 'ouverte',
                })
                setOpen(false)
                setF({ title: '', poste: '', contract: 'cdi', openings: 1, salaryFrom: 0, salaryTo: 0, publishedAt: todayISO(), closesAt: '', description: '' })
                toast(`✓ ${t('hr_saved')}`)
              }}
              disabled={!f.title.trim()}
              className="btn-primary disabled:opacity-40"
            >
              {t('hr_create')}
            </button>
          </div>
        </div>
      </Modal>
    </HrPage>
  )
}
