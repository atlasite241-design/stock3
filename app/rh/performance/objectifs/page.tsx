'use client'

// Objectifs : une cible chiffrée, une avancée, une échéance.
// Le statut se déduit de l'avancée et de la date — le laisser saisir à la main
// produirait des objectifs « en cours » périmés depuis six mois.

import { useState } from 'react'
import { Plus, Target, Trash2 } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { todayISO, type Objective } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { useLanguage } from '@/lib/i18n'

export default function Page() {
  const objectives = useHrList<Objective>('objectives')
  const { employees, nameOf } = useEmployees()
  const { t } = useLanguage()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ employeeId: '', title: '', target: 0, unit: '', from: todayISO(), deadline: '' })

  /** Atteint dès que la cible est franchie ; manqué si l'échéance est passée sans l'être. */
  const statusOf = (o: Objective): Objective['status'] => {
    if (o.target > 0 && o.progress >= o.target) return 'atteint'
    if (o.deadline && o.deadline < todayISO()) return 'manque'
    return 'en_cours'
  }
  const label = (s: Objective['status']) =>
    s === 'atteint' ? t('hr_obj_reached') : s === 'manque' ? t('hr_obj_missed') : t('hr_obj_ongoing')
  const style = (s: Objective['status']) =>
    s === 'atteint'
      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
      : s === 'manque'
        ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
        : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'

  const columns: HrColumn<Objective>[] = [
    { key: 'emp', label: t('hr_col_employee'), value: (o) => nameOf(o.employeeId) },
    { key: 'title', label: t('hr_obj_what'), value: (o) => o.title },
    {
      key: 'progress', label: t('hr_obj_progress'), align: 'right',
      value: (o) => (o.target ? Math.round((o.progress / o.target) * 100) : 0),
      render: (o) => (
        <span className="flex items-center justify-end gap-2">
          <span className="tabular-nums text-xs text-gray-500">{o.progress} / {o.target} {o.unit ?? ''}</span>
          <span className="h-2 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <span
              className="block h-full rounded-full bg-amber-500"
              style={{ width: `${Math.min(100, o.target ? (o.progress / o.target) * 100 : 0)}%` }}
            />
          </span>
        </span>
      ),
    },
    { key: 'deadline', label: t('hr_obj_deadline'), value: (o) => o.deadline ?? '—' },
    {
      key: 'status', label: t('hr_col_status'), align: 'center',
      value: (o) => label(statusOf(o)),
      render: (o) => (
        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${style(statusOf(o))}`}>
          {label(statusOf(o))}
        </span>
      ),
    },
    {
      key: 'set', label: '', meta: true, align: 'right', value: () => '',
      render: (o) => (
        <span className="flex items-center justify-end gap-1">
          <input
            type="number"
            value={o.progress}
            onChange={(e) => objectives.update(o.id, { progress: Number(e.target.value) })}
            className="w-20 rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-xs tabular-nums dark:border-white/10"
          />
          <button onClick={() => objectives.remove(o.id)} className="text-gray-300 transition-colors hover:text-rose-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </span>
      ),
    },
  ]

  const reached = objectives.items.filter((o) => statusOf(o) === 'atteint').length

  return (
    <HrPage
      icon={Target}
      title="hr_obj_title"
      subtitle="hr_obj_sub"
      perm="hr.performance"
      actions={<button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />{t('hr_obj_new')}</button>}
    >
      <HrStats
        cards={[
          { label: t('hr_col_records'), value: String(objectives.items.length) },
          { label: t('hr_obj_ongoing'), value: String(objectives.items.filter((o) => statusOf(o) === 'en_cours').length) },
          { label: t('hr_obj_reached'), value: String(reached), tone: 'text-emerald-600 dark:text-emerald-400' },
          { label: t('hr_obj_missed'), value: String(objectives.items.filter((o) => statusOf(o) === 'manque').length), tone: 'text-rose-600 dark:text-rose-400' },
        ]}
      />

      <HrTable
        rows={objectives.items}
        columns={columns}
        search={(o) => `${nameOf(o.employeeId)} ${o.title}`}
        filename="objectifs"
        empty={t('hr_obj_empty')}
        defaultSort={{ key: 'deadline', dir: 'asc' }}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={t('hr_obj_new')} closeOnBackdrop={false}>
        <div className="space-y-3">
          <Select
            value={f.employeeId}
            onChange={(v) => setF({ ...f, employeeId: v })}
            placeholder={t('hr_col_employee')}
            options={employees.map((e) => ({ value: e.id, label: `${e.matricule} — ${e.name}` }))}
          />
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t('hr_obj_what')} className="input-field" />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number" min={0} value={f.target || ''}
              onChange={(e) => setF({ ...f, target: Number(e.target.value) })}
              placeholder={t('hr_obj_target')} className="input-field tabular-nums"
            />
            <input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder={t('hr_obj_unit')} className="input-field" />
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_obj_deadline')}</span>
            <input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} className="input-field" />
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
            <button
              onClick={() => {
                if (!f.employeeId || !f.title.trim() || f.target <= 0) return
                objectives.add({ ...f, deadline: f.deadline || undefined, unit: f.unit || undefined, progress: 0, status: 'en_cours' })
                setOpen(false)
                setF({ employeeId: '', title: '', target: 0, unit: '', from: todayISO(), deadline: '' })
                toast(`✓ ${t('hr_saved')}`)
              }}
              disabled={!f.employeeId || !f.title.trim() || f.target <= 0}
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
