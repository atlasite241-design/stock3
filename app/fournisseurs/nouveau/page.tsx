'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Save, Truck, X } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useToast } from '@/components/Toast'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const EMPTY_FORM = { name: '', phone: '', address: '' }

function Content() {
  const { addSupplier } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const [form, setForm] = useState(EMPTY_FORM)

  const validate = () => {
    if (!form.name.trim()) {
      toast(t('fnew_toast_name_required'), 'error')
      return false
    }
    return true
  }

  const save = (andNew: boolean) => {
    if (!validate()) return
    addSupplier({ name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() })
    toast(`✓ ${form.name} ${t('fnew_toast_added')}`)
    if (andNew) {
      setForm(EMPTY_FORM)
    } else {
      router.push('/fournisseurs')
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('fnew_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('fnew_subtitle')}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4 }}
        className="glass-card max-w-2xl p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label">{t('fli_name')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ex: Droguerie Centrale SARL"
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('fli_phone')}</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="05 22 XX XX XX"
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('fli_address')}</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder={t('fli_address_placeholder')}
              className="input-field"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button onClick={() => router.push('/fournisseurs')} className="btn-secondary">
            <X className="h-4 w-4" />
            {t('fnew_cancel')}
          </button>
          <button onClick={() => save(true)} className="btn-secondary">
            <Truck className="h-4 w-4" />
            {t('fnew_save_new')}
          </button>
          <button onClick={() => save(false)} className="btn-primary">
            <Save className="h-4 w-4" />
            {t('fnew_save')}
          </button>
        </div>
      </motion.div>
    </>
  )
}

export default function NouveauFournisseurPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
