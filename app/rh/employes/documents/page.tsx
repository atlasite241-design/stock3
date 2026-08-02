'use client'

// Documents du personnel : contrats, CIN, CNSS, diplômes, certificats médicaux.
// L'application enregistre la RÉFÉRENCE et l'échéance, pas le fichier lui-même —
// stocker des scans en base ferait exploser la synchronisation.

import { useState } from 'react'
import { AlertTriangle, FileText, Plus, Trash2 } from 'lucide-react'
import HrPage from '@/components/hr/HrPage'
import HrTable, { type HrColumn } from '@/components/hr/HrTable'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { todayISO, type HrDocument } from '@/lib/hr'
import { useHrList } from '@/lib/hr-store'
import { useEmployees } from '@/lib/hr-employees'
import { useLanguage } from '@/lib/i18n'

const DOC_TYPES = ['Contrat', 'CIN', 'CNSS', 'Diplôme', 'Certificat médical', 'Attestation', 'Autre']

export default function Page() {
  const docs = useHrList<HrDocument>('documents')
  const { employees, nameOf } = useEmployees()
  const { t } = useLanguage()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ employeeId: '', type: 'Contrat', name: '', date: todayISO(), expiresAt: '', ref: '', note: '' })

  const soon = (d: HrDocument) => {
    if (!d.expiresAt) return false
    const days = (new Date(d.expiresAt).getTime() - Date.now()) / 86400000
    return days <= 60
  }

  const columns: HrColumn<HrDocument>[] = [
    { key: 'emp', label: t('hr_col_employee'), value: (d) => nameOf(d.employeeId) },
    { key: 'type', label: t('hr_doc_type'), value: (d) => d.type },
    { key: 'name', label: t('hr_doc_name'), value: (d) => d.name },
    { key: 'ref', label: t('hr_doc_ref'), value: (d) => d.ref ?? '—' },
    { key: 'date', label: t('hr_doc_date'), value: (d) => d.date },
    {
      key: 'exp', label: t('hr_doc_expires'), value: (d) => d.expiresAt ?? '',
      render: (d) => d.expiresAt
        ? <span className={soon(d) ? 'inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400' : ''}>
            {soon(d) && <AlertTriangle className="h-3.5 w-3.5" />}{d.expiresAt}
          </span>
        : '—',
    },
    {
      key: 'del', label: '', meta: true, align: 'right', value: () => '',
      render: (d) => (
        <button onClick={() => docs.remove(d.id)} className="text-gray-300 transition-colors hover:text-rose-500">
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <HrPage
      icon={FileText}
      title="hr_doc_title"
      subtitle="hr_doc_sub"
      perm="hr.documents"
      actions={<button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />{t('hr_doc_new')}</button>}
    >
      <HrTable
        rows={docs.items}
        columns={columns}
        search={(d) => `${nameOf(d.employeeId)} ${d.type} ${d.name} ${d.ref ?? ''}`}
        filename="documents-personnel"
        empty={t('hr_doc_empty')}
        defaultSort={{ key: 'exp', dir: 'asc' }}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={t('hr_doc_new')} closeOnBackdrop={false}>
        <div className="space-y-3">
          <Select
            value={f.employeeId}
            onChange={(v) => setF({ ...f, employeeId: v })}
            placeholder={t('hr_col_employee')}
            options={employees.map((e) => ({ value: e.id, label: `${e.matricule} — ${e.name}` }))}
          />
          <Select value={f.type} onChange={(v) => setF({ ...f, type: v })} options={DOC_TYPES} />
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t('hr_doc_name')} className="input-field" />
          <input value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} placeholder={t('hr_doc_ref')} className="input-field font-mono" />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_doc_date')}</span>
              <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="input-field" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{t('hr_doc_expires')}</span>
              <input type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} className="input-field" />
            </label>
          </div>
          <p className="rounded-xl border border-dashed border-gray-200 p-3 text-[11px] text-gray-500 dark:border-white/15 dark:text-zinc-400">
            {t('hr_doc_hint')}
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
            <button
              onClick={() => {
                if (!f.employeeId || !f.name.trim()) return
                docs.add({ ...f, expiresAt: f.expiresAt || undefined, ref: f.ref || undefined })
                setOpen(false)
                setF({ employeeId: '', type: 'Contrat', name: '', date: todayISO(), expiresAt: '', ref: '', note: '' })
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
