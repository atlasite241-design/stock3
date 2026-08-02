'use client'

// Horaires : les modèles de journée. C'est la référence qui rend un retard
// calculable — sans horaire, l'heure d'arrivée n'a rien à quoi se comparer.

import { useState } from 'react'
import { Clock4, Plus, Trash2 } from 'lucide-react'
import HrPage from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { fmtHours, minutesBetween, type Shift } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useLanguage } from '@/lib/i18n'

const DAY_KEYS = ['hr_day_sun', 'hr_day_mon', 'hr_day_tue', 'hr_day_wed', 'hr_day_thu', 'hr_day_fri', 'hr_day_sat'] as const

export default function Page() {
  const shifts = useHrList<Shift>('shifts')
  const { t } = useLanguage()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<Omit<Shift, 'id'>>({
    name: '', start: '09:00', end: '19:00', breakMin: 60, days: [1, 2, 3, 4, 5, 6], graceMin: 10,
  })

  const netMinutes = (s: Pick<Shift, 'start' | 'end' | 'breakMin'>) =>
    Math.max(0, minutesBetween(s.start, s.end) - s.breakMin)

  const toggleDay = (d: number) =>
    setF((p) => ({ ...p, days: p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d].sort() }))

  const columns: HrColumn<Shift>[] = [
    { key: 'name', label: t('hr_sh_name'), value: (s) => s.name },
    { key: 'start', label: t('hr_sh_start'), align: 'center', value: (s) => s.start },
    { key: 'end', label: t('hr_sh_end'), align: 'center', value: (s) => s.end },
    { key: 'break', label: t('hr_sh_break'), align: 'center', value: (s) => `${s.breakMin} min` },
    {
      key: 'net', label: t('hr_sh_net'), align: 'right',
      value: (s) => netMinutes(s),
      render: (s) => <span className="font-semibold tabular-nums">{fmtHours(netMinutes(s))}</span>,
    },
    { key: 'grace', label: t('hr_sh_grace'), align: 'center', value: (s) => `${s.graceMin} min` },
    {
      key: 'days', label: t('hr_sh_days'),
      value: (s) => s.days.map((d) => t(DAY_KEYS[d])).join(' '),
      render: (s) => (
        <span className="flex gap-0.5">
          {DAY_KEYS.map((k, d) => (
            <span
              key={d}
              className={`inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold ${
                s.days.includes(d)
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-zinc-600'
              }`}
            >
              {t(k).slice(0, 1)}
            </span>
          ))}
        </span>
      ),
    },
    {
      key: 'del', label: '', meta: true, align: 'right', value: () => '',
      render: (s) => (
        <button onClick={() => shifts.remove(s.id)} className="text-gray-300 transition-colors hover:text-rose-500">
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <HrPage
      icon={Clock4}
      title="hr_sh_title"
      subtitle="hr_sh_sub"
      perm="hr.planning"
      actions={<button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />{t('hr_sh_new')}</button>}
    >
      <HrTable
        rows={shifts.items}
        columns={columns}
        search={(s) => s.name}
        filename="horaires"
        empty={t('hr_sh_empty')}
        defaultSort={{ key: 'name', dir: 'asc' }}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={t('hr_sh_new')} closeOnBackdrop={false}>
        <div className="space-y-3">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t('hr_sh_name')} className="input-field" autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_sh_start')}</span>
              <input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className="input-field tabular-nums" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_sh_end')}</span>
              <input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} className="input-field tabular-nums" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_sh_break')}</span>
              <input type="number" min={0} value={f.breakMin} onChange={(e) => setF({ ...f, breakMin: Number(e.target.value) })} className="input-field tabular-nums" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_sh_grace')}</span>
              <input type="number" min={0} value={f.graceMin} onChange={(e) => setF({ ...f, graceMin: Number(e.target.value) })} className="input-field tabular-nums" />
            </label>
          </div>
          <div>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_sh_days')}</span>
            <div className="flex flex-wrap gap-1.5">
              {DAY_KEYS.map((k, d) => (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    f.days.includes(d) ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-zinc-400'
                  }`}
                >
                  {t(k)}
                </button>
              ))}
            </div>
          </div>
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
            {t('hr_sh_net')} : <b className="tabular-nums text-amber-600 dark:text-amber-400">{fmtHours(netMinutes(f))}</b>
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
            <button
              onClick={() => {
                if (!f.name.trim() || !f.days.length) return
                shifts.add(f)
                setOpen(false)
                setF({ name: '', start: '09:00', end: '19:00', breakMin: 60, days: [1, 2, 3, 4, 5, 6], graceMin: 10 })
                toast(`✓ ${t('hr_saved')}`)
              }}
              disabled={!f.name.trim() || !f.days.length}
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
