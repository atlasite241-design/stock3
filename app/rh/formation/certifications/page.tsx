'use client'

// Certifications : diplômes, habilitations, visites médicales. L'échéance est
// le vrai sujet — une habilitation périmée est une non-conformité.

import { useState } from 'react'
import { AlertTriangle, BadgeCheck, Plus, Trash2 } from 'lucide-react'
import HrPage, { HrStats } from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { todayISO, type Certification } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { useLanguage } from '@/lib/i18n'

const SUGGESTED = [
  'Visite médicale', 'Habilitation cariste', 'Permis de conduire',
  'Formation incendie', 'Secourisme', 'Manipulation produits chimiques', 'Diplôme',
]

export default function Page() {
  const certifications = useHrList<Certification>('certifications')
  const { employees, nameOf } = useEmployees()
  const { t } = useLanguage()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ employeeId: '', name: '', issuer: '', issuedAt: todayISO(), expiresAt: '', ref: '' })

  const daysLeft = (c: Certification) =>
    c.expiresAt ? Math.floor((new Date(c.expiresAt).getTime() - Date.now()) / 86400000) : null
  const expired = certifications.items.filter((c) => (daysLeft(c) ?? 1) < 0)
  const soon = certifications.items.filter((c) => {
    const d = daysLeft(c)
    return d !== null && d >= 0 && d <= 60
  })

  const columns: HrColumn<Certification>[] = [
    { key: 'emp', label: t('hr_col_employee'), value: (c) => nameOf(c.employeeId) },
    { key: 'name', label: t('hr_ce_name'), value: (c) => c.name },
    { key: 'issuer', label: t('hr_ce_issuer'), value: (c) => c.issuer ?? '—' },
    { key: 'ref', label: t('hr_doc_ref'), value: (c) => c.ref ?? '—' },
    { key: 'issued', label: t('hr_ce_issued'), value: (c) => c.issuedAt },
    {
      key: 'expires', label: t('hr_doc_expires'), value: (c) => c.expiresAt ?? '',
      render: (c) => {
        const d = daysLeft(c)
        if (d === null) return <span className="text-gray-400">{t('hr_ce_no_expiry')}</span>
        const tone = d < 0 ? 'text-rose-600 dark:text-rose-400' : d <= 60 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-zinc-300'
        return (
          <span className={`inline-flex items-center gap-1 font-semibold ${tone}`}>
            {d <= 60 && <AlertTriangle className="h-3.5 w-3.5" />}
            {c.expiresAt}
            <span className="text-[10px] font-normal">({d < 0 ? t('hr_ce_expired') : `${d} ${t('hr_days')}`})</span>
          </span>
        )
      },
    },
    {
      key: 'del', label: '', meta: true, align: 'right', value: () => '',
      render: (c) => (
        <button onClick={() => certifications.remove(c.id)} className="text-gray-300 transition-colors hover:text-rose-500">
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <HrPage
      icon={BadgeCheck}
      title="hr_ce_title"
      subtitle="hr_ce_sub"
      perm="hr.training"
      actions={<button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />{t('hr_ce_new')}</button>}
    >
      <HrStats
        cards={[
          { label: t('hr_col_records'), value: String(certifications.items.length) },
          { label: t('hr_col_employees'), value: String(new Set(certifications.items.map((c) => c.employeeId)).size) },
          { label: t('hr_ce_soon'), value: String(soon.length), tone: soon.length ? 'text-orange-600 dark:text-orange-400' : undefined },
          { label: t('hr_ce_expired'), value: String(expired.length), tone: expired.length ? 'text-rose-600 dark:text-rose-400' : undefined },
        ]}
      />

      <HrTable
        rows={certifications.items}
        columns={columns}
        search={(c) => `${nameOf(c.employeeId)} ${c.name} ${c.issuer ?? ''}`}
        filename="certifications"
        empty={t('hr_ce_empty')}
        defaultSort={{ key: 'expires', dir: 'asc' }}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={t('hr_ce_new')} closeOnBackdrop={false}>
        <div className="space-y-3">
          <Select
            value={f.employeeId}
            onChange={(v) => setF({ ...f, employeeId: v })}
            placeholder={t('hr_col_employee')}
            options={employees.map((e) => ({ value: e.id, label: `${e.matricule} — ${e.name}` }))}
          />
          <Select value={f.name} onChange={(v) => setF({ ...f, name: v })} options={SUGGESTED} placeholder={t('hr_ce_name')} />
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t('hr_ce_name')} className="input-field" />
          <input value={f.issuer} onChange={(e) => setF({ ...f, issuer: e.target.value })} placeholder={t('hr_ce_issuer')} className="input-field" />
          <input value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} placeholder={t('hr_doc_ref')} className="input-field font-mono" />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_ce_issued')}</span>
              <input type="date" value={f.issuedAt} onChange={(e) => setF({ ...f, issuedAt: e.target.value })} className="input-field" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_doc_expires')}</span>
              <input type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} className="input-field" />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
            <button
              onClick={() => {
                if (!f.employeeId || !f.name.trim()) return
                certifications.add({
                  employeeId: f.employeeId, name: f.name.trim(),
                  issuer: f.issuer || undefined, issuedAt: f.issuedAt,
                  expiresAt: f.expiresAt || undefined, ref: f.ref || undefined,
                })
                setOpen(false)
                setF({ employeeId: '', name: '', issuer: '', issuedAt: todayISO(), expiresAt: '', ref: '' })
                toast(`✓ ${t('hr_saved')}`)
              }}
              disabled={!f.employeeId || !f.name.trim()}
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
