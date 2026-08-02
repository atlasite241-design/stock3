'use client'

// Entretiens. Ce ne sont pas des enregistrements séparés : un entretien
// appartient à une candidature. Les stocker à part obligerait à maintenir un
// lien qui finirait par pointer dans le vide après une suppression.

import { useMemo, useState } from 'react'
import { CalendarClock, Plus, Star, Trash2 } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { todayISO, type Application, type Interview } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useLanguage } from '@/lib/i18n'
import { getSession } from '@/lib/auth'

interface Row extends Interview {
  id: string
  applicationId: string
  candidate: string
  index: number
}

export default function Page() {
  const applications = useHrList<Application>('applications')
  const { t } = useLanguage()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ applicationId: '', date: todayISO(), score: 3, note: '' })

  const rows = useMemo<Row[]>(
    () =>
      applications.items.flatMap((a) =>
        a.interviews.map((itv, index) => ({
          ...itv,
          id: `${a.id}_${index}`,
          applicationId: a.id,
          candidate: a.name,
          index,
        }))
      ).sort((x, y) => y.date.localeCompare(x.date)),
    [applications.items]
  )

  const removeInterview = (applicationId: string, index: number) => {
    const app = applications.all.find((a) => a.id === applicationId)
    if (!app) return
    applications.update(applicationId, { interviews: app.interviews.filter((_, i) => i !== index) })
  }

  const columns: HrColumn<Row>[] = [
    { key: 'date', label: t('hr_col_date'), value: (r) => r.date },
    { key: 'cand', label: t('hr_itv_candidate'), value: (r) => r.candidate, render: (r) => <span className="font-semibold text-gray-900 dark:text-white">{r.candidate}</span> },
    { key: 'by', label: t('hr_ev_by'), value: (r) => r.by ?? '—' },
    {
      key: 'score', label: t('hr_itv_score'), align: 'center',
      value: (r) => r.score ?? 0,
      render: (r) => (
        <span className="inline-flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className={`h-3.5 w-3.5 ${i <= (r.score ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200 dark:text-zinc-700'}`} />
          ))}
        </span>
      ),
    },
    { key: 'note', label: t('hr_ev_comment'), value: (r) => r.note ?? '—' },
    {
      key: 'del', label: '', meta: true, align: 'right', value: () => '',
      render: (r) => (
        <button onClick={() => removeInterview(r.applicationId, r.index)} className="text-gray-300 transition-colors hover:text-rose-500">
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ]

  const avg = rows.length ? rows.reduce((a, r) => a + (r.score ?? 0), 0) / rows.length : 0

  return (
    <HrPage
      icon={CalendarClock}
      title="hr_itv_title"
      subtitle="hr_itv_sub"
      perm="hr.recruitment"
      actions={<button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />{t('hr_itv_new')}</button>}
    >
      <HrStats
        cards={[
          { label: t('hr_col_records'), value: String(rows.length) },
          { label: t('hr_itv_candidate'), value: String(new Set(rows.map((r) => r.applicationId)).size) },
          { label: t('hr_itv_score'), value: avg ? `${avg.toFixed(1)} / 5` : '—' },
          { label: t('hr_itv_upcoming'), value: String(rows.filter((r) => r.date >= todayISO()).length) },
        ]}
      />

      <HrTable
        rows={rows}
        columns={columns}
        search={(r) => `${r.candidate} ${r.note ?? ''}`}
        filename="entretiens"
        empty={t('hr_itv_empty')}
        defaultSort={{ key: 'date', dir: 'desc' }}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={t('hr_itv_new')} closeOnBackdrop={false}>
        <div className="space-y-3">
          <Select
            value={f.applicationId}
            onChange={(v) => setF({ ...f, applicationId: v })}
            placeholder={t('hr_itv_candidate')}
            options={applications.items.filter((a) => a.status !== 'refusee').map((a) => ({ value: a.id, label: a.name }))}
          />
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_col_date')}</span>
            <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="input-field" />
          </label>
          <div>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_itv_score')}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setF({ ...f, score: n })}
                  className={`h-9 w-9 rounded-lg text-sm font-bold transition ${
                    f.score >= n ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-zinc-500'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} rows={3} placeholder={t('hr_ev_comment')} className="input-field" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
            <button
              onClick={() => {
                const app = applications.all.find((a) => a.id === f.applicationId)
                if (!app) return
                const itv: Interview = { date: f.date, by: getSession()?.name, score: f.score, note: f.note || undefined }
                // Programmer un entretien fait avancer la candidature : le statut
                // ne doit pas rester « reçue » alors qu'on a déjà vu la personne.
                applications.update(app.id, {
                  interviews: [...app.interviews, itv],
                  status: app.status === 'recue' || app.status === 'preselection' ? 'entretien' : app.status,
                })
                setOpen(false)
                setF({ applicationId: '', date: todayISO(), score: 3, note: '' })
                toast(`✓ ${t('hr_saved')}`)
              }}
              disabled={!f.applicationId}
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
