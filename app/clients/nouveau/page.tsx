'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Save, UserPlus, X } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  cin: '',
  clientType: 'Particulier',
  creditLimit: '0',
  creditAllowed: 'oui',
  paymentTermDays: '30',
  notes: '',
}

function Content() {
  const { addClient } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const [form, setForm] = useState(EMPTY_FORM)

  const validate = () => {
    if (!form.name.trim()) {
      toast(t('clin_toast_name_required'), 'error')
      return false
    }
    if (!form.phone.trim()) {
      toast(t('clin_toast_phone_required'), 'error')
      return false
    }
    return true
  }

  const buildPayload = () => ({
    name: form.name.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    address: form.address.trim(),
    city: form.city.trim(),
    cin: form.cin.trim(),
    clientType: form.clientType as 'Particulier' | 'Professionnel' | 'VIP',
    creditLimit: Math.max(0, parseFloat(form.creditLimit.replace(',', '.')) || 0),
    creditAllowed: form.creditAllowed === 'oui',
    paymentTermDays: parseInt(form.paymentTermDays, 10) || 30,
    notes: form.notes.trim(),
  })

  const save = (andNew: boolean) => {
    if (!validate()) return
    const client = addClient(buildPayload())
    toast(`✓ ${client.name} ${t('clin_toast_added')}`)
    if (andNew) {
      setForm(EMPTY_FORM)
    } else {
      router.push('/clients')
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('clin_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('clin_subtitle')}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4 }}
        className="glass-card max-w-3xl p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label">{t('clin_name')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ex: Ahmed Bennani"
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('clin_phone')}</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="06 XX XX XX XX"
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('clin_email')}</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="client@exemple.com"
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('clin_cin')}</label>
            <input
              type="text"
              value={form.cin}
              onChange={(e) => setForm({ ...form, cin: e.target.value })}
              placeholder="ex: BK123456"
              className="input-field"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">{t('clin_address')}</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder={t('clin_address_placeholder')}
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('clin_city')}</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="ex: Casablanca"
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('clin_type')}</label>
            <Select
              value={form.clientType}
              onChange={(v) => setForm({ ...form, clientType: v })}
              options={[
                { value: 'Particulier', label: t('cli_type_particulier') },
                { value: 'Professionnel', label: t('cli_type_professionnel') },
                { value: 'VIP', label: t('cli_type_vip') },
              ]}
            />
          </div>
          <div>
            <label className="field-label">{t('clin_credit_allowed')}</label>
            <Select
              value={form.creditAllowed}
              onChange={(v) => setForm({ ...form, creditAllowed: v })}
              options={[
                { value: 'oui', label: t('clin_yes') },
                { value: 'non', label: t('clin_no') },
              ]}
            />
          </div>
          <div>
            <label className="field-label">{t('clin_credit_limit')}</label>
            <input
              type="number"
              min="0"
              value={form.creditLimit}
              onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
              placeholder="0"
              className="input-field"
              disabled={form.creditAllowed === 'non'}
            />
          </div>
          <div>
            <label className="field-label">{t('clin_payment_term')}</label>
            <Select
              value={form.paymentTermDays}
              onChange={(v) => setForm({ ...form, paymentTermDays: v })}
              options={[
                { value: '30', label: t('clin_term_30') },
                { value: '60', label: t('clin_term_60') },
                { value: '90', label: t('clin_term_90') },
              ]}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">{t('clin_notes')}</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={t('clin_notes_placeholder')}
              rows={3}
              className="input-field !h-auto resize-none py-2.5"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button onClick={() => router.push('/clients')} className="btn-secondary">
            <X className="h-4 w-4" />
            {t('clin_cancel')}
          </button>
          <button onClick={() => save(true)} className="btn-secondary">
            <UserPlus className="h-4 w-4" />
            {t('clin_save_new')}
          </button>
          <button onClick={() => save(false)} className="btn-primary">
            <Save className="h-4 w-4" />
            {t('clin_save')}
          </button>
        </div>
      </motion.div>
    </>
  )
}

export default function NouveauClientPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
