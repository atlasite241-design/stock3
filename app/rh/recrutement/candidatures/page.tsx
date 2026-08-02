'use client'

// Candidatures. Le statut avance dans un seul sens : reçue → présélection →
// entretien → retenue → embauchée (ou refusée à tout moment).

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { UserSearch, Plus, Trash2 } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import Loader from '@/components/Loader'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { todayISO, type Application, type ApplicationStatus, type JobOffer } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useLanguage, type TKey } from '@/lib/i18n'

export const STATUSES: { value: ApplicationStatus; key: TKey; style: string }[] = [
  { value: 'recue', key: 'hr_app_received', style: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-zinc-300' },
  { value: 'preselection', key: 'hr_app_shortlist', style: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400' },
  { value: 'entretien', key: 'hr_app_interview', style: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
  { value: 'retenue', key: 'hr_app_selected', style: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400' },
  { value: 'embauchee', key: 'hr_app_hired', style: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
  { value: 'refusee', key: 'hr_app_rejected', style: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' },
]

function Content() {
  const applications = useHrList<Application>('applications')
  const jobs = useHrList<JobOffer>('jobs')
  const { t } = useLanguage()
  const toast = useToast()
  const jobFilter = useSearchParams().get('job')
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ jobId: jobFilter ?? '', name: '', phone: '', email: '', cvNote: '' })

  const rows = useMemo(
    () => (jobFilter ? applications.items.filter((a) => a.jobId === jobFilter) : applications.items),
    [applications.items, jobFilter]
  )

  const label = (s: ApplicationStatus) => t(STATUSES.find((x) => x.value === s)?.key ?? 'hr_app_received')
  const style = (s: ApplicationStatus) => STATUSES.find((x) => x.value === s)?.style ?? ''
  const jobTitle = (id?: string) => jobs.items.find((j) => j.id === id)?.title ?? '—'

  const columns: HrColumn<Application>[] = [
    { key: 'date', label: t('hr_app_date'), value: (a) => a.appliedAt },
    { key: 'name', label: t('hr_f_name'), value: (a) => a.name, render: (a) => <span className="font-semibold text-gray-900 dark:text-white">{a.name}</span> },
    { key: 'job', label: t('hr_job_title'), value: (a) => jobTitle(a.jobId) },
    { key: 'phone', label: t('hr_f_phone'), value: (a) => a.phone ?? '—' },
    { key: 'itv', label: t('hr_itv_title'), align: 'center', value: (a) => a.interviews.length },
    {
      key: 'status', label: t('hr_col_status'), align: 'center',
      value: (a) => label(a.status),
      render: (a) => (
        <select
          value={a.status}
          onChange={(e) => applications.update(a.id, { status: e.target.value as ApplicationStatus })}
          className={`cursor-pointer rounded-full border-0 px-2 py-1 text-[11px] font-bold ${style(a.status)}`}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{t(s.key)}</option>
          ))}
        </select>
      ),
    },
    {
      key: 'del', label: '', meta: true, align: 'right', value: () => '',
      render: (a) => (
        <button onClick={() => applications.remove(a.id)} className="text-gray-300 transition-colors hover:text-rose-500">
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ]

  const count = (s: ApplicationStatus) => rows.filter((a) => a.status === s).length

  return (
    <>
      {jobFilter && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {t('hr_app_filtered')} <b>{jobTitle(jobFilter)}</b>
        </p>
      )}

      <HrStats
        cards={[
          { label: t('hr_app_received'), value: String(count('recue')) },
          { label: t('hr_app_interview'), value: String(count('entretien')) },
          { label: t('hr_app_hired'), value: String(count('embauchee')), tone: 'text-emerald-600 dark:text-emerald-400' },
          { label: t('hr_app_rejected'), value: String(count('refusee')), tone: 'text-rose-600 dark:text-rose-400' },
        ]}
      />

      <div className="flex justify-end no-print">
        <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />{t('hr_app_new')}</button>
      </div>

      <HrTable
        rows={rows}
        columns={columns}
        search={(a) => `${a.name} ${a.phone ?? ''} ${a.email ?? ''} ${jobTitle(a.jobId)}`}
        filename="candidatures"
        empty={t('hr_app_empty')}
        defaultSort={{ key: 'date', dir: 'desc' }}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={t('hr_app_new')} closeOnBackdrop={false}>
        <div className="space-y-3">
          <Select
            value={f.jobId}
            onChange={(v) => setF({ ...f, jobId: v })}
            placeholder={t('hr_job_title')}
            options={jobs.items.map((j) => ({ value: j.id, label: j.title }))}
          />
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t('hr_f_name')} className="input-field" autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder={t('hr_f_phone')} className="input-field" />
            <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder={t('hr_f_email')} className="input-field" />
          </div>
          <textarea value={f.cvNote} onChange={(e) => setF({ ...f, cvNote: e.target.value })} rows={3} placeholder={t('hr_app_cv')} className="input-field" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
            <button
              onClick={() => {
                if (!f.name.trim()) return
                applications.add({
                  jobId: f.jobId || undefined,
                  name: f.name.trim(),
                  phone: f.phone || undefined,
                  email: f.email || undefined,
                  cvNote: f.cvNote || undefined,
                  appliedAt: todayISO(),
                  status: 'recue',
                  interviews: [],
                })
                setOpen(false)
                setF({ jobId: jobFilter ?? '', name: '', phone: '', email: '', cvNote: '' })
                toast(`✓ ${t('hr_saved')}`)
              }}
              disabled={!f.name.trim()}
              className="btn-primary disabled:opacity-40"
            >
              {t('hr_create')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default function Page() {
  return (
    <HrPage icon={UserSearch} title="hr_app_title" subtitle="hr_app_sub" perm="hr.recruitment">
      <Suspense fallback={<Loader />}>
        <Content />
      </Suspense>
    </HrPage>
  )
}
