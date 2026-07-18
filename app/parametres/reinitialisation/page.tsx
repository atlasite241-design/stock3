'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Loader2, Lock, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { useDroguerie } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { verifySecret } from '@/lib/auth'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, settings, resetStats } = useDroguerie()
  const { session, currentUser } = useAuth()
  const { t, lang } = useLanguage()
  const toast = useToast()

  const [password, setPassword] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!ready) return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>

  const isAdmin = session?.role === 'Administrateur'

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="glass-card flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500"><ShieldAlert className="h-7 w-7" /></span>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('rst_title')}</h1>
          <p className="text-sm text-rose-500">{t('rst_forbidden')}</p>
        </div>
      </div>
    )
  }

  const lastReset = settings.statsResetAt
    ? new Date(settings.statsResetAt).toLocaleString(lang === 'ar' ? 'ar-MA' : 'fr-FR')
    : t('rst_never')

  const hasSecret = !!(currentUser?.passwordHash || currentUser?.pinHash)

  const doReset = () => {
    if (hasSecret) {
      const ok = verifySecret(password, currentUser?.passwordHash) || verifySecret(password, currentUser?.pinHash)
      if (!ok) {
        toast(t('rst_wrong_password'), 'error')
        return
      }
    }
    setConfirmOpen(false)
    setLoading(true)
    // Petite animation de chargement, puis application.
    setTimeout(() => {
      resetStats(currentUser?.name ?? session?.name ?? '')
      setLoading(false)
      setPassword('')
      toast(`✓ ${t('rst_done')}`)
    }, 900)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400"><RotateCcw className="h-6 w-6" /></span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('rst_title')}</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">{t('rst_subtitle')}</p>
          </div>
        </div>
      </motion.div>

      {/* Last reset */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card flex items-center justify-between p-4">
        <span className="text-sm font-medium text-gray-500 dark:text-zinc-400">{t('rst_last_reset')}</span>
        <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{lastReset}</span>
      </motion.div>

      {/* What's zeroed / intact */}
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card p-5">
          <div className="mb-2 flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <RotateCcw className="h-4 w-4" />
            <h3 className="text-sm font-bold uppercase tracking-wide">{t('rst_explain_title')}</h3>
          </div>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-300">{t('rst_zeroed')}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }} className="glass-card p-5">
          <div className="mb-2 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            <h3 className="text-sm font-bold uppercase tracking-wide">{t('rst_explain_intact_title')}</h3>
          </div>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-300">{t('rst_intact')}</p>
        </motion.div>
      </div>

      {/* Action card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} className="glass-card p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('rst_admin_only')}</p>
        <label className="field-label flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />{t('rst_password_label')}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('rst_password_ph')}
          className="input-field max-w-sm"
          autoComplete="off"
        />
        <div className="mt-4">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={loading || (hasSecret && !password)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {loading ? t('rst_processing') : t('rst_button')}
          </button>
        </div>
      </motion.div>

      {/* Confirmation modal */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('rst_confirm_title')}>
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <p className="text-sm leading-relaxed text-gray-700 dark:text-zinc-200">{t('rst_confirm_body')}</p>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmOpen(false)} className="btn-secondary">{t('rst_cancel')}</button>
            <button onClick={doReset} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98]">
              <CheckCircle2 className="h-4 w-4" />{t('rst_confirm')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function ReinitialisationPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
