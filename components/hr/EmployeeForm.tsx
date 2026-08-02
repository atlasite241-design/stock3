'use client'

// Formulaire de fiche employé — création et modification.
// Un seul formulaire pour les deux : les champs sont identiques, seul le
// bouton change. Le rôle et le nom vont sur le compte, le reste sur la RH.

import { useState } from 'react'
import Select from '@/components/Select'
import { HR_CONTRACTS, todayISO, type ContractType, type Employee, type MaritalStatus } from '@/lib/hr'
import { nextMatricule, type EmployeeView, type NewEmployee } from '@/lib/hr-employees'
import { USER_ROLES, type AppUser } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export default function EmployeeForm({
  initial,
  existing,
  onSubmit,
  onCancel,
}: {
  initial?: EmployeeView
  existing: Employee[]
  onSubmit: (data: NewEmployee) => void
  onCancel: () => void
}) {
  const { t, lang } = useLanguage()
  const [f, setF] = useState<NewEmployee>({
    name: initial?.name ?? '',
    poste: initial?.poste ?? '',
    departement: initial?.departement ?? '',
    hireDate: initial?.hireDate ?? todayISO(),
    contract: initial?.contract ?? 'cdi',
    baseSalary: initial?.baseSalary ?? 0,
    role: initial?.role ?? 'Vendeur',
    matricule: initial?.matricule ?? nextMatricule(existing),
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    cin: initial?.cin ?? '',
    cnss: initial?.cnss ?? '',
    address: initial?.address ?? '',
    birthDate: initial?.birthDate ?? '',
    rib: initial?.rib ?? '',
    maritalStatus: initial?.maritalStatus ?? 'celibataire',
    dependents: initial?.dependents ?? 0,
    note: initial?.note ?? '',
  })

  const set = <K extends keyof NewEmployee>(k: K, v: NewEmployee[K]) => setF((p) => ({ ...p, [k]: v }))
  const valid = f.name.trim().length > 1 && f.poste.trim().length > 0

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{label}</span>
      {children}
    </label>
  )

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2">
        <Field label={t('hr_f_name')}>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} className="input-field" autoFocus />
        </Field>
        <Field label={t('hr_f_matricule')}>
          <input value={f.matricule} onChange={(e) => set('matricule', e.target.value)} className="input-field font-mono" />
        </Field>
        <Field label={t('hr_f_poste')}>
          <input value={f.poste} onChange={(e) => set('poste', e.target.value)} className="input-field" />
        </Field>
        <Field label={t('hr_f_dept')}>
          <input value={f.departement} onChange={(e) => set('departement', e.target.value)} className="input-field" />
        </Field>
        <Field label={t('hr_f_role')}>
          <Select value={f.role} onChange={(v) => set('role', v as AppUser['role'])} options={[...USER_ROLES]} />
        </Field>
        <Field label={t('hr_f_contract')}>
          <Select
            value={f.contract}
            onChange={(v) => set('contract', v as ContractType)}
            options={HR_CONTRACTS.map((c) => ({ value: c.value, label: c[lang] }))}
          />
        </Field>
        <Field label={t('hr_f_hire')}>
          <input type="date" value={f.hireDate} onChange={(e) => set('hireDate', e.target.value)} className="input-field" />
        </Field>
        <Field label={t('hr_f_salary')}>
          <input
            type="number" min={0} step={0.01} value={f.baseSalary || ''}
            onChange={(e) => set('baseSalary', Number(e.target.value))}
            className="input-field tabular-nums"
          />
        </Field>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Field label={t('hr_f_phone')}>
          <input value={f.phone} onChange={(e) => set('phone', e.target.value)} className="input-field" />
        </Field>
        <Field label={t('hr_f_email')}>
          <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} className="input-field" />
        </Field>
        <Field label={t('hr_f_cin')}>
          <input value={f.cin} onChange={(e) => set('cin', e.target.value)} className="input-field font-mono" />
        </Field>
        <Field label={t('hr_f_cnss')}>
          <input value={f.cnss} onChange={(e) => set('cnss', e.target.value)} className="input-field font-mono" />
        </Field>
        <Field label={t('hr_f_birth')}>
          <input type="date" value={f.birthDate} onChange={(e) => set('birthDate', e.target.value)} className="input-field" />
        </Field>
        <Field label={t('hr_f_rib')}>
          <input value={f.rib} onChange={(e) => set('rib', e.target.value)} className="input-field font-mono" />
        </Field>
        <Field label={t('hr_f_marital')}>
          <Select
            value={f.maritalStatus ?? 'celibataire'}
            onChange={(v) => set('maritalStatus', v as MaritalStatus)}
            options={[
              { value: 'celibataire', label: t('hr_marital_single') },
              { value: 'marie', label: t('hr_marital_married') },
              { value: 'divorce', label: t('hr_marital_divorced') },
              { value: 'veuf', label: t('hr_marital_widowed') },
            ]}
          />
        </Field>
        <Field label={t('hr_f_dependents')}>
          <input
            type="number" min={0} max={6} value={f.dependents ?? 0}
            onChange={(e) => set('dependents', Math.max(0, Math.min(6, Number(e.target.value))))}
            className="input-field tabular-nums"
          />
          <span className="mt-1 block text-[10px] text-gray-400">{t('hr_f_dependents_hint')}</span>
        </Field>
        <div className="sm:col-span-2">
          <Field label={t('hr_f_address')}>
            <input value={f.address} onChange={(e) => set('address', e.target.value)} className="input-field" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label={t('hr_f_note')}>
            <textarea value={f.note} onChange={(e) => set('note', e.target.value)} rows={2} className="input-field" />
          </Field>
        </div>
      </section>

      {!initial && (
        <p className="rounded-xl border border-dashed border-gray-200 p-3 text-[11px] leading-relaxed text-gray-500 dark:border-white/15 dark:text-zinc-400">
          {t('hr_f_account_hint')}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-secondary">{t('mag_cancel')}</button>
        <button onClick={() => valid && onSubmit(f)} disabled={!valid} className="btn-primary disabled:opacity-40">
          {initial ? t('hr_save') : t('hr_create')}
        </button>
      </div>
    </div>
  )
}
