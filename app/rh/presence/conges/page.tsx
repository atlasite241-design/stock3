'use client'

// Congés : demande, approbation, refus. Le décompte des jours suit l'usage du
// commerce marocain — le dimanche est exclu, le samedi non.

import { useState } from 'react'
import { CalendarOff, Check, Plus, X } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { LEAVE_TYPES, todayISO, workingDays, type Leave, type LeaveStatus, type LeaveType } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { useLanguage } from '@/lib/i18n'
import { getSession } from '@/lib/auth'

const STATUS_STYLE: Record<LeaveStatus, string> = {
  demande: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  approuve: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  refuse: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
}

export default function Page() {
  const leaves = useHrList<Leave>('leaves')
  const { employees, nameOf } = useEmployees()
  const { t, lang } = useLanguage()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ employeeId: '', type: 'paye' as LeaveType, from: todayISO(), to: todayISO(), reason: '' })

  const days = workingDays(f.from, f.to)
  const statusLabel = (s: LeaveStatus) =>
    s === 'demande' ? t('hr_lv_requested') : s === 'approuve' ? t('hr_lv_approved') : t('hr_lv_refused')

  const decide = (id: string, status: LeaveStatus) => {
    leaves.update(id, { status, decidedBy: getSession()?.name, decidedAt: todayISO() })
    toast(`✓ ${statusLabel(status)}`)
  }

  const pending = leaves.items.filter((l) => l.status === 'demande')
  const approvedDays = leaves.items.filter((l) => l.status === 'approuve').reduce((a, l) => a + l.days, 0)

  const columns: HrColumn<Leave>[] = [
    { key: 'emp', label: t('hr_col_employee'), value: (l) => nameOf(l.employeeId) },
    { key: 'type', label: t('hr_lv_type'), value: (l) => LEAVE_TYPES.find((x) => x.value === l.type)?.[lang] ?? l.type },
    { key: 'from', label: t('hr_lv_from'), value: (l) => l.from },
    { key: 'to', label: t('hr_lv_to'), value: (l) => l.to },
    { key: 'days', label: t('hr_days'), align: 'center', value: (l) => l.days },
    {
      key: 'status', label: t('hr_col_status'), align: 'center',
      value: (l) => statusLabel(l.status),
      render: (l) => (
        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[l.status]}`}>
          {statusLabel(l.status)}
        </span>
      ),
    },
    { key: 'reason', label: t('hr_lv_reason'), value: (l) => l.reason ?? '—' },
    {
      key: 'act', label: '', meta: true, align: 'right', value: () => '',
      render: (l) => l.status === 'demande' ? (
        <span className="flex justify-end gap-1">
          <button onClick={() => decide(l.id, 'approuve')} className="rounded-lg p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
            <Check className="h-4 w-4" />
          </button>
          <button onClick={() => decide(l.id, 'refuse')} className="rounded-lg p-1.5 text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10">
            <X className="h-4 w-4" />
          </button>
        </span>
      ) : (
        <span className="text-[11px] text-gray-400">{l.decidedBy ?? ''}</span>
      ),
    },
  ]

  return (
    <HrPage
      icon={CalendarOff}
      title="hr_lv_title"
      subtitle="hr_lv_sub"
      perm="hr.leaves"
      actions={<button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />{t('hr_lv_new')}</button>}
    >
      <HrStats
        cards={[
          { label: t('hr_lv_requested'), value: String(pending.length), tone: pending.length ? 'text-amber-600 dark:text-amber-400' : undefined },
          { label: t('hr_lv_approved'), value: String(leaves.items.filter((l) => l.status === 'approuve').length) },
          { label: t('hr_days'), value: String(approvedDays) },
          { label: t('hr_col_employees'), value: String(new Set(leaves.items.map((l) => l.employeeId)).size) },
        ]}
      />

      <HrTable
        rows={leaves.items}
        columns={columns}
        search={(l) => `${nameOf(l.employeeId)} ${l.reason ?? ''}`}
        filename="conges"
        empty={t('hr_lv_empty')}
        defaultSort={{ key: 'from', dir: 'desc' }}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={t('hr_lv_new')} closeOnBackdrop={false}>
        <div className="space-y-3">
          <Select
            value={f.employeeId}
            onChange={(v) => setF({ ...f, employeeId: v })}
            placeholder={t('hr_col_employee')}
            options={employees.map((e) => ({ value: e.id, label: `${e.matricule} — ${e.name}` }))}
          />
          <Select
            value={f.type}
            onChange={(v) => setF({ ...f, type: v as LeaveType })}
            options={LEAVE_TYPES.map((x) => ({ value: x.value, label: x[lang] }))}
          />
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
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
            <b className="tabular-nums text-amber-600 dark:text-amber-400">{days}</b> {t('hr_days')} — <span className="text-xs text-gray-500 dark:text-zinc-400">{t('hr_lv_days_hint')}</span>
          </p>
          <input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder={t('hr_lv_reason')} className="input-field" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
            <button
              onClick={() => {
                if (!f.employeeId || days <= 0) return
                leaves.add({ ...f, days, status: 'demande' })
                setOpen(false)
                setF({ employeeId: '', type: 'paye', from: todayISO(), to: todayISO(), reason: '' })
                toast(`✓ ${t('hr_saved')}`)
              }}
              disabled={!f.employeeId || days <= 0}
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
