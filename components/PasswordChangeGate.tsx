'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useDroguerie } from '@/lib/store'
import { hashSecret } from '@/lib/auth'
import { useLanguage } from '@/lib/i18n'

/**
 * Si l'utilisateur connecté a un mot de passe temporaire (mustChangePassword),
 * bloque l'accès jusqu'à ce qu'il en choisisse un nouveau.
 */
export default function PasswordChangeGate({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth()
  const { updateUser } = useDroguerie()
  const { t } = useLanguage()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  if (!currentUser?.mustChangePassword) return <>{children}</>

  const submit = () => {
    setError('')
    if (pw.length < 4) return setError(t('auth_pw_short'))
    if (pw !== confirm) return setError(t('auth_pw_mismatch'))
    updateUser(currentUser.id, { passwordHash: hashSecret(pw), mustChangePassword: false })
    // Recharge la liste des utilisateurs partout (AuthProvider inclus) pour
    // que mustChangePassword=false soit vu immédiatement.
    window.dispatchEvent(new CustomEvent('droguerie-sync-pull'))
  }

  const input =
    'h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-400/70 focus:ring-2 focus:ring-amber-500/20'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#0a0a0f] via-[#0d0d14] to-[#12121a] p-5">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-500/10 blur-[130px]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-2xl"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-gray-900 shadow-lg">
            <Lock className="h-7 w-7" />
          </span>
          <h1 className="text-xl font-bold text-white">{t('pwc_title')}</h1>
          <p className="text-sm text-slate-400">{t('pwc_subtitle')}</p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('pwc_new')}</span>
            <input className={input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('pwc_confirm')}</span>
            <input className={input} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </label>
          {error && <p className="text-sm font-medium text-rose-400">{error}</p>}
          <button onClick={submit} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3.5 text-sm font-bold text-gray-900 transition hover:brightness-110 active:scale-[0.98]">
            <ShieldCheck className="h-4 w-4" />
            {t('pwc_submit')}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
