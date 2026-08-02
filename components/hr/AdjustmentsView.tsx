'use client'

// Primes, Avances et Déductions sont la MÊME donnée avec un signe et une
// intention différents. Un composant, trois écrans — et un seul endroit où
// corriger la logique de rattachement au bulletin.

import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Plus, Trash2 } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { monthLabel, periodOf, todayISO, type AdjustmentKind, type PayAdjustment } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { fmtDH } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

export default function AdjustmentsView({
  kind,
  icon,
  title,
  subtitle,
  empty,
  newLabel,
  filename,
  presets,
  /** Les primes peuvent être exonérées (panier, transport) ; pas les avances. */
  allowExempt = false,
}: {
  kind: AdjustmentKind
  icon: LucideIcon
  title: TKey
  subtitle: TKey
  empty: TKey
  newLabel: TKey
  filename: string
  presets: string[]
  allowExempt?: boolean
}) {
  const adjustments = useHrList<PayAdjustment>('adjustments')
  const { employees, nameOf } = useEmployees()
  const { t, lang } = useLanguage()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({
    employeeId: '', label: presets[0] ?? '', amount: 0,
    date: todayISO(), period: periodOf(todayISO()), taxable: true, note: '',
  })

  const rows = useMemo(() => adjustments.items.filter((a) => a.kind === kind), [adjustments.items, kind])
  const total = rows.reduce((a, x) => a + x.amount, 0)
  const currentPeriod = periodOf(todayISO())
  const thisMonth = rows.filter((r) => r.period === currentPeriod).reduce((a, x) => a + x.amount, 0)

  const columns: HrColumn<PayAdjustment>[] = [
    { key: 'date', label: t('hr_col_date'), value: (a) => a.date },
    { key: 'emp', label: t('hr_col_employee'), value: (a) => nameOf(a.employeeId) },
    { key: 'label', label: t('hr_adj_label'), value: (a) => a.label },
    { key: 'period', label: t('hr_adj_period'), value: (a) => a.period, render: (a) => <span className="capitalize">{monthLabel(a.period, lang)}</span> },
    ...(allowExempt
      ? [{
          key: 'tax', label: t('hr_adj_taxable'), align: 'center' as const,
          value: (a: PayAdjustment) => (a.taxable === false ? t('hr_no') : t('hr_yes')),
        }]
      : []),
    {
      key: 'amount', label: t('cp_col_amount'), align: 'right',
      value: (a) => a.amount,
      render: (a) => <span className="font-bold tabular-nums text-gray-900 dark:text-white">{fmtDH(a.amount)}</span>,
    },
    {
      key: 'del', label: '', meta: true, align: 'right', value: () => '',
      render: (a) => (
        <button onClick={() => adjustments.remove(a.id)} className="text-gray-300 transition-colors hover:text-rose-500">
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
      perm="hr.payroll"
      actions={<button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />{t(newLabel)}</button>}
    >
      <HrStats
        cards={[
          { label: t('hr_col_records'), value: rows.length.toLocaleString('fr-FR') },
          { label: t('hr_col_employees'), value: String(new Set(rows.map((r) => r.employeeId)).size) },
          { label: t('hr_adj_this_month'), value: fmtDH(thisMonth) },
          { label: t('gen_total'), value: fmtDH(total) },
        ]}
      />

      <HrTable
        rows={rows}
        columns={columns}
        search={(a) => `${nameOf(a.employeeId)} ${a.label}`}
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
          <Select value={f.label} onChange={(v) => setF({ ...f, label: v })} options={presets} placeholder={t('hr_adj_label')} />
          <input
            value={f.label}
            onChange={(e) => setF({ ...f, label: e.target.value })}
            placeholder={t('hr_adj_label')}
            className="input-field"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('cp_col_amount')}</span>
              <input
                type="number" min={0} step={0.01} value={f.amount || ''}
                onChange={(e) => setF({ ...f, amount: Number(e.target.value) })}
                className="input-field tabular-nums"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_col_date')}</span>
              <input
                type="date" value={f.date}
                onChange={(e) => setF({ ...f, date: e.target.value, period: periodOf(e.target.value) })}
                className="input-field"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_adj_period')}</span>
            <input type="month" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} className="input-field" />
            <span className="mt-1 block text-[10px] text-gray-400">{t('hr_adj_period_hint')}</span>
          </label>
          {allowExempt && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-zinc-200">
              <input type="checkbox" checked={f.taxable} onChange={(e) => setF({ ...f, taxable: e.target.checked })} className="h-4 w-4 accent-amber-500" />
              {t('hr_adj_taxable_hint')}
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
            <button
              onClick={() => {
                if (!f.employeeId || !f.label.trim() || f.amount <= 0) return
                adjustments.add({ ...f, kind, taxable: allowExempt ? f.taxable : true })
                setOpen(false)
                setF({ employeeId: '', label: presets[0] ?? '', amount: 0, date: todayISO(), period: periodOf(todayISO()), taxable: true, note: '' })
                toast(`✓ ${t('hr_saved')}`)
              }}
              disabled={!f.employeeId || !f.label.trim() || f.amount <= 0}
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
