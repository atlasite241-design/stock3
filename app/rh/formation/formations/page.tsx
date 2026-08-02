'use client'

// Formations : sessions et participants. Une session a plusieurs participants,
// pas l'inverse — c'est ce qui permet de calculer un coût par personne.

import { useState } from 'react'
import { GraduationCap, Plus, Trash2 } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { todayISO, type Training } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { fmtDH } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const STATUS_STYLE: Record<Training['status'], string> = {
  planifiee: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
  en_cours: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  terminee: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  annulee: 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-zinc-400',
}

export default function Page() {
  const trainings = useHrList<Training>('trainings')
  const { active: employees, nameOf } = useEmployees()
  const { t } = useLanguage()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Training | null>(null)
  const [f, setF] = useState<{ title: string; org: string; from: string; to: string; cost: number; participantIds: string[]; status: Training['status'] }>({
    title: '', org: '', from: todayISO(), to: '', cost: 0, participantIds: [], status: 'planifiee',
  })

  const statusLabel = (s: Training['status']) =>
    s === 'planifiee' ? t('hr_tr_planned') : s === 'en_cours' ? t('hr_tr_ongoing') : s === 'terminee' ? t('hr_tr_done') : t('hr_tr_cancelled')

  const start = (tr?: Training) => {
    setEditing(tr ?? null)
    setF({
      title: tr?.title ?? '', org: tr?.org ?? '', from: tr?.from ?? todayISO(), to: tr?.to ?? '',
      cost: tr?.cost ?? 0, participantIds: tr?.participantIds ?? [], status: tr?.status ?? 'planifiee',
    })
    setOpen(true)
  }

  const save = () => {
    if (!f.title.trim()) return
    const data = { ...f, org: f.org || undefined, to: f.to || undefined, cost: f.cost || undefined }
    if (editing) trainings.update(editing.id, data)
    else trainings.add(data)
    setOpen(false)
    toast(`✓ ${t('hr_saved')}`)
  }

  const totalCost = trainings.items.reduce((a, x) => a + (x.cost ?? 0), 0)
  const seats = trainings.items.reduce((a, x) => a + x.participantIds.length, 0)

  return (
    <HrPage
      icon={GraduationCap}
      title="hr_tr_title"
      subtitle="hr_tr_sub"
      perm="hr.training"
      actions={<button onClick={() => start()} className="btn-primary"><Plus className="h-4 w-4" />{t('hr_tr_new')}</button>}
    >
      <HrStats
        cards={[
          { label: t('hr_col_records'), value: String(trainings.items.length) },
          { label: t('hr_tr_seats'), value: String(seats) },
          { label: t('hr_tr_cost'), value: fmtDH(totalCost) },
          { label: t('hr_tr_cost_each'), value: seats ? fmtDH(totalCost / seats) : '—' },
        ]}
      />

      {trainings.items.length === 0 ? (
        <p className="glass-card p-12 text-center text-sm text-gray-500 dark:text-zinc-400">{t('hr_tr_empty')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trainings.items.map((tr) => (
            <div key={tr.id} className="glass-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{tr.title}</p>
                  <p className="truncate text-[11px] text-gray-400 dark:text-zinc-500">{tr.org ?? '—'}</p>
                </div>
                <button onClick={() => trainings.remove(tr.id)} className="text-gray-300 transition-colors hover:text-rose-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[tr.status]}`}>
                {statusLabel(tr.status)}
              </span>

              <p className="mt-2 text-xs tabular-nums text-gray-500 dark:text-zinc-400">
                {tr.from}{tr.to ? ` → ${tr.to}` : ''}{tr.cost ? ` · ${fmtDH(tr.cost)}` : ''}
              </p>

              <div className="mt-2 flex flex-wrap gap-1">
                {tr.participantIds.map((id) => (
                  <span key={id} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-white/10 dark:text-zinc-300">
                    {nameOf(id)}
                  </span>
                ))}
                {tr.participantIds.length === 0 && <span className="text-[11px] text-gray-400">{t('hr_tr_no_participant')}</span>}
              </div>

              <button onClick={() => start(tr)} className="btn-secondary mt-3 w-full justify-center">{t('hr_edit')}</button>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? editing.title : t('hr_tr_new')} closeOnBackdrop={false}>
        <div className="space-y-3">
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t('hr_tr_what')} className="input-field" autoFocus />
          <input value={f.org} onChange={(e) => setF({ ...f, org: e.target.value })} placeholder={t('hr_tr_org')} className="input-field" />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_lv_from')}</span>
              <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="input-field" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_lv_to')}</span>
              <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="input-field" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_tr_cost')}</span>
              <input type="number" min={0} step={0.01} value={f.cost || ''} onChange={(e) => setF({ ...f, cost: Number(e.target.value) })} className="input-field tabular-nums" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_col_status')}</span>
              <Select
                value={f.status}
                onChange={(v) => setF({ ...f, status: v as Training['status'] })}
                options={(['planifiee', 'en_cours', 'terminee', 'annulee'] as const).map((s) => ({ value: s, label: statusLabel(s) }))}
              />
            </label>
          </div>
          <div>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_tr_participants')}</span>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-100 p-1 dark:border-white/10">
              {employees.map((e) => (
                <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={f.participantIds.includes(e.id)}
                    onChange={() =>
                      setF((p) => ({
                        ...p,
                        participantIds: p.participantIds.includes(e.id)
                          ? p.participantIds.filter((x) => x !== e.id)
                          : [...p.participantIds, e.id],
                      }))
                    }
                    className="h-4 w-4 accent-amber-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-zinc-200">{e.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
            <button onClick={save} disabled={!f.title.trim()} className="btn-primary disabled:opacity-40">
              {editing ? t('hr_save') : t('hr_create')}
            </button>
          </div>
        </div>
      </Modal>
    </HrPage>
  )
}
