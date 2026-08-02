'use client'

// Évaluations : une note sur cinq critères, une moyenne, un commentaire.
// Les critères sont fixes — les laisser libres rendrait toute comparaison
// entre deux évaluations impossible.

import { useState } from 'react'
import { ClipboardCheck, Plus, Star, Trash2 } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { periodOf, todayISO, type Evaluation } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { useLanguage, type TKey } from '@/lib/i18n'
import { getSession } from '@/lib/auth'

const CRITERIA: { key: string; label: TKey }[] = [
  { key: 'quality', label: 'hr_ev_quality' },
  { key: 'speed', label: 'hr_ev_speed' },
  { key: 'attendance', label: 'hr_ev_attendance' },
  { key: 'team', label: 'hr_ev_team' },
  { key: 'client', label: 'hr_ev_client' },
]

export default function Page() {
  const evaluations = useHrList<Evaluation>('evaluations')
  const { employees, nameOf } = useEmployees()
  const { t } = useLanguage()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<{ employeeId: string; period: string; scores: Record<string, number>; comment: string }>({
    employeeId: '',
    period: periodOf(todayISO()),
    scores: Object.fromEntries(CRITERIA.map((c) => [c.key, 3])),
    comment: '',
  })

  const average = (scores: Record<string, number>) => {
    const v = CRITERIA.map((c) => scores[c.key] ?? 0)
    return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10
  }

  const Stars = ({ n }: { n: number }) => (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= Math.round(n) ? 'fill-amber-400 text-amber-400' : 'text-gray-200 dark:text-zinc-700'}`} />
      ))}
      <span className="ml-1 text-xs font-bold tabular-nums text-gray-600 dark:text-zinc-300">{n.toFixed(1)}</span>
    </span>
  )

  const columns: HrColumn<Evaluation>[] = [
    { key: 'period', label: t('hr_adj_period'), value: (e) => e.period },
    { key: 'emp', label: t('hr_col_employee'), value: (e) => nameOf(e.employeeId) },
    ...CRITERIA.map((c) => ({
      key: c.key,
      label: t(c.label),
      align: 'center' as const,
      value: (e: Evaluation) => e.scores[c.key] ?? 0,
    })),
    {
      key: 'avg', label: t('hr_ev_average'), align: 'right',
      value: (e) => e.average,
      render: (e) => <Stars n={e.average} />,
    },
    { key: 'by', label: t('hr_ev_by'), value: (e) => e.by ?? '—' },
    {
      key: 'del', label: '', meta: true, align: 'right', value: () => '',
      render: (e) => (
        <button onClick={() => evaluations.remove(e.id)} className="text-gray-300 transition-colors hover:text-rose-500">
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ]

  const overall = evaluations.items.length
    ? Math.round((evaluations.items.reduce((a, e) => a + e.average, 0) / evaluations.items.length) * 10) / 10
    : 0

  return (
    <HrPage
      icon={ClipboardCheck}
      title="hr_ev_title"
      subtitle="hr_ev_sub"
      perm="hr.performance"
      actions={<button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />{t('hr_ev_new')}</button>}
    >
      <HrStats
        cards={[
          { label: t('hr_col_records'), value: String(evaluations.items.length) },
          { label: t('hr_col_employees'), value: String(new Set(evaluations.items.map((e) => e.employeeId)).size) },
          { label: t('hr_ev_average'), value: overall ? `${overall.toFixed(1)} / 5` : '—' },
          { label: t('hr_ev_top'), value: String(evaluations.items.filter((e) => e.average >= 4).length), tone: 'text-emerald-600 dark:text-emerald-400' },
        ]}
      />

      <HrTable
        rows={evaluations.items}
        columns={columns}
        search={(e) => `${nameOf(e.employeeId)} ${e.comment ?? ''}`}
        filename="evaluations"
        empty={t('hr_ev_empty')}
        defaultSort={{ key: 'period', dir: 'desc' }}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={t('hr_ev_new')} closeOnBackdrop={false}>
        <div className="space-y-3">
          <Select
            value={f.employeeId}
            onChange={(v) => setF({ ...f, employeeId: v })}
            placeholder={t('hr_col_employee')}
            options={employees.map((e) => ({ value: e.id, label: `${e.matricule} — ${e.name}` }))}
          />
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_adj_period')}</span>
            <input type="month" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} className="input-field" />
          </label>

          {CRITERIA.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700 dark:text-zinc-200">{t(c.label)}</span>
              <span className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setF((p) => ({ ...p, scores: { ...p.scores, [c.key]: n } }))}
                    className={`h-8 w-8 rounded-lg text-xs font-bold transition ${
                      (f.scores[c.key] ?? 0) >= n
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-zinc-500'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </span>
            </div>
          ))}

          <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
            {t('hr_ev_average')} : <b className="tabular-nums text-amber-600 dark:text-amber-400">{average(f.scores).toFixed(1)} / 5</b>
          </p>

          <textarea
            value={f.comment}
            onChange={(e) => setF({ ...f, comment: e.target.value })}
            placeholder={t('hr_ev_comment')}
            rows={3}
            className="input-field"
          />

          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
            <button
              onClick={() => {
                if (!f.employeeId) return
                evaluations.add({
                  employeeId: f.employeeId,
                  period: f.period,
                  scores: f.scores,
                  average: average(f.scores),
                  comment: f.comment || undefined,
                  by: getSession()?.name,
                  date: todayISO(),
                })
                setOpen(false)
                setF({ employeeId: '', period: periodOf(todayISO()), scores: Object.fromEntries(CRITERIA.map((c) => [c.key, 3])), comment: '' })
                toast(`✓ ${t('hr_saved')}`)
              }}
              disabled={!f.employeeId}
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
