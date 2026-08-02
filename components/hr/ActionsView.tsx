'use client'

// Récompenses et sanctions : mêmes champs, sens opposé. Un composant, deux
// écrans — et le dossier employé les affiche ensemble, dans l'ordre.

import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Plus, Trash2 } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { todayISO, type HrAction } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { fmtDH } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'
import { getSession } from '@/lib/auth'

export default function ActionsView({
  kind,
  icon,
  title,
  subtitle,
  empty,
  newLabel,
  filename,
  types,
  tone,
}: {
  kind: HrAction['kind']
  icon: LucideIcon
  title: TKey
  subtitle: TKey
  empty: TKey
  newLabel: TKey
  filename: string
  types: string[]
  tone: string
}) {
  const actions = useHrList<HrAction>('actions')
  const { employees, nameOf } = useEmployees()
  const { t } = useLanguage()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ employeeId: '', type: types[0] ?? '', label: '', date: todayISO(), amount: 0, note: '' })

  const rows = useMemo(() => actions.items.filter((a) => a.kind === kind), [actions.items, kind])
  const withAmount = rows.reduce((a, x) => a + (x.amount ?? 0), 0)

  const columns: HrColumn<HrAction>[] = [
    { key: 'date', label: t('hr_col_date'), value: (a) => a.date },
    { key: 'emp', label: t('hr_col_employee'), value: (a) => nameOf(a.employeeId) },
    {
      key: 'type', label: t('hr_act_type'), value: (a) => a.type,
      render: (a) => <span className={`font-semibold ${tone}`}>{a.type}</span>,
    },
    { key: 'label', label: t('hr_col_detail'), value: (a) => a.label },
    {
      key: 'amount', label: t('cp_col_amount'), align: 'right',
      value: (a) => a.amount ?? 0,
      render: (a) => (a.amount ? <span className="tabular-nums font-semibold">{fmtDH(a.amount)}</span> : '—'),
    },
    { key: 'by', label: t('hr_ev_by'), value: (a) => a.by ?? '—' },
    {
      key: 'del', label: '', meta: true, align: 'right', value: () => '',
      render: (a) => (
        <button onClick={() => actions.remove(a.id)} className="text-gray-300 transition-colors hover:text-rose-500">
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <HrPage
      icon={icon}
      title={title}
      subtitle={subtitle}
      perm="hr.performance"
      actions={<button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />{t(newLabel)}</button>}
    >
      <HrStats
        cards={[
          { label: t('hr_col_records'), value: String(rows.length) },
          { label: t('hr_col_employees'), value: String(new Set(rows.map((r) => r.employeeId)).size) },
          { label: t('cp_col_amount'), value: fmtDH(withAmount) },
          { label: t('hr_act_this_year'), value: String(rows.filter((r) => r.date.startsWith(String(new Date().getFullYear()))).length) },
        ]}
      />

      <HrTable
        rows={rows}
        columns={columns}
        search={(a) => `${nameOf(a.employeeId)} ${a.type} ${a.label}`}
        filename={filename}
        empty={t(empty)}
        defaultSort={{ key: 'date', dir: 'desc' }}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={t(newLabel)} closeOnBackdrop={false}>
        <div className="space-y-3">
          <Select
            value={f.employeeId}
            onChange={(v) => setF({ ...f, employeeId: v })}
            placeholder={t('hr_col_employee')}
            options={employees.map((e) => ({ value: e.id, label: `${e.matricule} — ${e.name}` }))}
          />
          <Select value={f.type} onChange={(v) => setF({ ...f, type: v })} options={types} placeholder={t('hr_act_type')} />
          <input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder={t('hr_col_detail')} className="input-field" />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_col_date')}</span>
              <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="input-field" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('cp_col_amount')}</span>
              <input
                type="number" min={0} step={0.01} value={f.amount || ''}
                onChange={(e) => setF({ ...f, amount: Number(e.target.value) })}
                className="input-field tabular-nums"
              />
              <span className="mt-1 block text-[10px] text-gray-400">{t('hr_act_amount_hint')}</span>
            </label>
          </div>
          <textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={t('hr_ev_comment')} rows={2} className="input-field" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
            <button
              onClick={() => {
                if (!f.employeeId || !f.label.trim()) return
                actions.add({ ...f, kind, amount: f.amount || undefined, note: f.note || undefined, by: getSession()?.name })
                setOpen(false)
                setF({ employeeId: '', type: types[0] ?? '', label: '', date: todayISO(), amount: 0, note: '' })
                toast(`✓ ${t('hr_saved')}`)
              }}
              disabled={!f.employeeId || !f.label.trim()}
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
