'use client'

import React, { useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import Select from '@/components/Select'
import { useLanguage } from '@/lib/i18n'
import type { Store } from '@/lib/store'

export interface StoreFormValues {
  name: string
  code: string
  docPrefix: string
  address: string
  city: string
  phone: string
  email: string
  manager: string
  ice: string
  idFiscal: string
  logoDataUrl: string
  active: boolean
}

export function emptyStoreForm(): StoreFormValues {
  return { name: '', code: '', docPrefix: '', address: '', city: '', phone: '', email: '', manager: '', ice: '', idFiscal: '', logoDataUrl: '', active: true }
}

export function storeToForm(s: Store): StoreFormValues {
  return {
    name: s.name, code: s.code, docPrefix: s.docPrefix, address: s.address, city: s.city,
    phone: s.phone, email: s.email, manager: s.manager, ice: s.ice, idFiscal: s.idFiscal,
    logoDataUrl: s.logoDataUrl, active: s.active,
  }
}

export default function StoreForm({
  value,
  onChange,
}: {
  value: StoreFormValues
  onChange: (v: StoreFormValues) => void
}) {
  const { t } = useLanguage()
  const set = <K extends keyof StoreFormValues>(k: K, v: StoreFormValues[K]) => onChange({ ...value, [k]: v })
  const [uploading, setUploading] = useState(false)

  const onLogo = (file?: File | null) => {
    if (!file) return
    setUploading(true)
    const reader = new FileReader()
    reader.onload = () => {
      set('logoDataUrl', String(reader.result))
      setUploading(false)
    }
    reader.onerror = () => setUploading(false)
    reader.readAsDataURL(file)
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5">
          {value.logoDataUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value.logoDataUrl} alt="logo" className="h-full w-full object-contain" />
              <button
                type="button"
                onClick={() => set('logoDataUrl', '')}
                className="absolute right-1 top-1 rounded-md bg-gray-900/60 p-0.5 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <ImagePlus className="h-6 w-6 text-gray-300 dark:text-zinc-600" />
          )}
        </div>
        <label className="btn-secondary cursor-pointer">
          <ImagePlus className="h-4 w-4" />
          {uploading ? '…' : t('mag_logo')}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('mag_name')}>
          <input className="input-field" value={value.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={t('mag_manager')}>
          <input className="input-field" value={value.manager} onChange={(e) => set('manager', e.target.value)} />
        </Field>
        <Field label={t('mag_code')}>
          <input className="input-field" value={value.code} onChange={(e) => set('code', e.target.value.toUpperCase())} />
        </Field>
        <Field label={t('mag_prefix')}>
          <input className="input-field" value={value.docPrefix} placeholder={t('mag_prefix_hint')} onChange={(e) => set('docPrefix', e.target.value.toUpperCase())} />
        </Field>
        <Field label={t('mag_address')}>
          <input className="input-field" value={value.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label={t('mag_city')}>
          <input className="input-field" value={value.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label={t('mag_phone')}>
          <input className="input-field" value={value.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label={t('mag_email')}>
          <input className="input-field" value={value.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label={t('mag_ice')}>
          <input className="input-field" value={value.ice} onChange={(e) => set('ice', e.target.value)} />
        </Field>
        <Field label={t('mag_if')}>
          <input className="input-field" value={value.idFiscal} onChange={(e) => set('idFiscal', e.target.value)} />
        </Field>
        <Field label={t('mag_status')}>
          <Select
            value={value.active ? 'active' : 'inactive'}
            onChange={(v) => set('active', v === 'active')}
            options={[
              { value: 'active', label: t('mag_active') },
              { value: 'inactive', label: t('mag_inactive') },
            ]}
          />
        </Field>
      </div>
    </div>
  )
}
