'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { KeyRound, Lock, LogIn, Mail, ShieldCheck, Store, User } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { hashSecret } from '@/lib/auth'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export default function LoginPage() {
  const { ready, session, needsSetup, loginPassword, loginPin, establishSession, logout } = useAuth()
  const { users, updateUser } = useDroguerie()
  const { t } = useLanguage()
  const router = useRouter()

  useEffect(() => {
    if (session) router.replace('/')
  }, [session, router])

  const resetAccess = () => {
    if (!window.confirm(t('auth_reset_confirm'))) return
    users.forEach((u) => updateUser(u.id, { passwordHash: '', pinHash: '' }))
    logout()
  }

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-400 dark:bg-[#0a0a0f] dark:text-zinc-500">…</div>
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-amber-50/40 p-5 dark:from-[#0a0a0f] dark:to-amber-950/10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-400/30">
            <Store className="h-6 w-6 text-gray-900" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Droguerie <span className="bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent">Pro</span>
            </h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">{needsSetup ? t('auth_setup_title') : t('auth_login_subtitle')}</p>
          </div>
        </div>

        <div className="glass-card p-6">
          {needsSetup ? <SetupForm users={users} updateUser={updateUser} establishSession={establishSession} /> : <LoginForm users={users} loginPassword={loginPassword} loginPin={loginPin} />}
        </div>

        {!needsSetup && (
          <div className="mt-4 text-center text-xs text-gray-400 dark:text-zinc-500">
            {t('auth_login_problem')}{' '}
            <button onClick={resetAccess} className="font-semibold text-amber-600 hover:underline dark:text-amber-400">
              {t('auth_reset')}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

type Users = ReturnType<typeof useDroguerie>['users']

function SetupForm({ users, updateUser, establishSession }: { users: Users; updateUser: ReturnType<typeof useDroguerie>['updateUser']; establishSession: (u: Users[number]) => void }) {
  const { t } = useLanguage()
  const admin = users.find((u) => u.active && u.role === 'Administrateur') ?? users.find((u) => u.active) ?? users[0]
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    setError('')
    if (pw.length < 4) return setError(t('auth_pw_short'))
    if (pw !== confirm) return setError(t('auth_pw_mismatch'))
    if (!admin) return
    const passwordHash = hashSecret(pw)
    updateUser(admin.id, { email: email.trim(), passwordHash })
    establishSession({ ...admin, email: email.trim(), passwordHash })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        {t('auth_setup_desc')}
      </div>
      <Field icon={<User className="h-4 w-4" />} label={t('auth_setup_admin')}>
        <input className="input-field pl-9" value={admin?.name ?? ''} disabled />
      </Field>
      <Field icon={<Mail className="h-4 w-4" />} label={t('auth_email')}>
        <input className="input-field pl-9" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@exemple.com" />
      </Field>
      <Field icon={<Lock className="h-4 w-4" />} label={t('auth_password')}>
        <input className="input-field pl-9" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <Field icon={<Lock className="h-4 w-4" />} label={t('auth_setup_confirm')}>
        <input className="input-field pl-9" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </Field>
      {error && <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}
      <button onClick={submit} className="btn-primary w-full">
        <ShieldCheck className="h-4 w-4" />
        {t('auth_setup_btn')}
      </button>
    </div>
  )
}

function LoginForm({ users, loginPassword, loginPin }: { users: Users; loginPassword: (e: string, p: string) => { ok: boolean }; loginPin: (id: string, pin: string) => { ok: boolean } }) {
  const { t } = useLanguage()
  const [tab, setTab] = useState<'password' | 'pin'>('password')

  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')

  const pinUsers = users.filter((u) => u.active && u.pinHash)
  const [pinUserId, setPinUserId] = useState('')
  const [pin, setPin] = useState('')

  const submitPassword = () => {
    setError('')
    if (!loginPassword(email, pw).ok) setError(t('auth_bad_credentials'))
  }
  const submitPin = () => {
    setError('')
    if (!loginPin(pinUserId, pin).ok) {
      setError(t('auth_bad_pin'))
      setPin('')
    }
  }

  return (
    <div>
      <div className="mb-4 flex rounded-xl bg-gray-100 p-1 dark:bg-white/5">
        {(['password', 'pin'] as const).map((tk) => (
          <button
            key={tk}
            onClick={() => { setTab(tk); setError('') }}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition ${tab === tk ? 'bg-white text-amber-700 shadow-sm dark:bg-white/10 dark:text-amber-400' : 'text-gray-500 dark:text-zinc-400'}`}
          >
            {tk === 'password' ? t('auth_tab_password') : t('auth_tab_pin')}
          </button>
        ))}
      </div>

      {tab === 'password' ? (
        <div className="space-y-4">
          <Field icon={<Mail className="h-4 w-4" />} label={t('auth_email')}>
            <input className="input-field pl-9" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field icon={<Lock className="h-4 w-4" />} label={t('auth_password')}>
            <input className="input-field pl-9" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitPassword()} />
          </Field>
          {error && <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}
          <button onClick={submitPassword} className="btn-primary w-full">
            <LogIn className="h-4 w-4" />
            {t('auth_signin')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {pinUsers.length === 0 ? (
            <p className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-500 dark:bg-white/5 dark:text-zinc-400">{t('auth_no_pin_users')}</p>
          ) : !pinUserId ? (
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('auth_choose_user')}</p>
              <div className="grid grid-cols-2 gap-2">
                {pinUsers.map((u) => (
                  <button key={u.id} onClick={() => { setPinUserId(u.id); setPin(''); setError('') }} className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 text-left transition hover:border-amber-300 hover:bg-amber-50 dark:border-white/10 dark:hover:bg-amber-500/10">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 text-xs font-bold text-gray-900">{u.name.slice(0, 2).toUpperCase()}</span>
                    <span className="truncate text-sm font-semibold text-gray-800 dark:text-zinc-100">{u.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-sm font-semibold text-gray-800 dark:text-white">{pinUsers.find((u) => u.id === pinUserId)?.name}</p>
              <Field icon={<KeyRound className="h-4 w-4" />} label={t('auth_enter_pin')}>
                <input className="input-field pl-9 text-center tracking-[0.5em]" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && submitPin()} autoFocus />
              </Field>
              {error && <p className="text-center text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setPinUserId(''); setPin(''); setError('') }} className="btn-secondary flex-1">{t('auth_back')}</button>
                <button onClick={submitPin} className="btn-primary flex-1">
                  <LogIn className="h-4 w-4" />
                  {t('auth_signin')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500">{icon}</span>
        {children}
      </div>
    </label>
  )
}
