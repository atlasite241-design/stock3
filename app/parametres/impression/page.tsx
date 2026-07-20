'use client'

import { useEffect, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Printer, Save } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useToast } from '@/components/Toast'
import { useDroguerie, type Settings } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const FORMATS: { key: Settings['printFormat']; labelKey: 'psub_print_ticket58' | 'psub_print_ticket80' | 'psub_print_a4' }[] = [
  { key: 'ticket58', labelKey: 'psub_print_ticket58' },
  { key: 'ticket80', labelKey: 'psub_print_ticket80' },
  { key: 'a4', labelKey: 'psub_print_a4' },
]

function Content() {
  const { ready, settings, saveSettings } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [form, setForm] = useState(settings)

  useEffect(() => {
    if (ready) setForm(settings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  if (!ready) {
    return <Loader />
  }

  const save = () => {
    saveSettings({ ...form })
    toast(`✓ ${t('set_toast_saved')}`)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('psub_print_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('psub_print_subtitle')}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card max-w-xl p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500">
            <Printer className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('psub_print_title')}</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">{t('psub_print_subtitle')}</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="field-label">{t('psub_print_format_label')}</label>
            <div className="grid grid-cols-3 gap-3">
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setForm({ ...form, printFormat: f.key })}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                    form.printFormat === f.key
                      ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400'
                      : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 hover:border-amber-300'
                  }`}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-100 dark:border-white/10 pt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('psub_ticket_section')}</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t('psub_ticket_hint')}</p>
            <div className="mt-3">
              <label className="field-label">{t('set_ticket_message')}</label>
              <input type="text" value={form.ticketMessage} onChange={(e) => setForm({ ...form, ticketMessage: e.target.value })} className="input-field" />
            </div>
          </div>
          <button onClick={save} className="btn-primary w-full">
            <Save className="h-4 w-4" />
            {t('set_save_settings')}
          </button>
        </div>
      </motion.div>
    </>
  )
}

export default function ParametresImpressionPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
