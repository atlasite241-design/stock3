'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, KeyRound, Lock, LogIn, Mail, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { hashSecret } from '@/lib/auth'
import { useDroguerie } from '@/lib/store'
import { turso, tursoConfigured } from '@/lib/turso'
import { useLanguage } from '@/lib/i18n'

export default function LoginPage() {
  const { ready, session, needsSetup, loginIdentifier, loginPin, establishSession, logout } = useAuth()
  const { users, updateUser, addUser } = useDroguerie()
  const { t } = useLanguage()
  const router = useRouter()

  useEffect(() => {
    if (session) router.replace('/')
  }, [session, router])

  // La page de connexion rafraîchit TOUJOURS les comptes depuis Turso :
  // évite les utilisateurs locaux périmés (ancien seed de démo, autre appareil…)
  // qui empêchent la connexion alors que les vrais comptes sont dans le cloud.
  useEffect(() => {
    if (!tursoConfigured()) return
    ;(async () => {
      try {
        const db = turso()
        const res = await db.execute("SELECT data FROM records WHERE collection='users' AND deleted=0")
        if (res.rows.length === 0) return
        const arr: unknown[] = []
        for (const row of res.rows) {
          try {
            arr.push(JSON.parse(String(row.data)))
          } catch {}
        }
        if (arr.length > 0) {
          localStorage.setItem('dp_users', JSON.stringify(arr))
          window.dispatchEvent(new CustomEvent('droguerie-sync-pull'))
        }
      } catch {
        /* hors-ligne : on garde les comptes locaux */
      }
    })()
  }, [])

  const resetAccess = () => {
    if (!window.confirm(t('auth_reset_confirm'))) return
    users.forEach((u) => updateUser(u.id, { passwordHash: '', pinHash: '' }))
    logout()
  }

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center bg-[#0b1220] text-sm text-slate-500">…</div>
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#0b1220] via-[#0e1526] to-[#141c31] p-5">
      {/* Glows */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-20 top-1/4 h-80 w-80 rounded-full bg-blue-600/15 blur-[130px]" />
        <div className="absolute -right-20 bottom-1/4 h-80 w-80 rounded-full bg-violet-600/15 blur-[130px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="relative w-full max-w-[420px] rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-2xl"
      >
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <h1 className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-3xl font-black tracking-tight text-transparent">
            DROGUERIEPRO
          </h1>
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
            {t('auth_edition')}
          </span>
          <p className="mt-1 text-lg font-semibold text-white">{needsSetup ? t('auth_setup_title') : t('auth_welcome_pro')}</p>
        </div>

        {needsSetup ? (
          <SetupForm users={users} updateUser={updateUser} establishSession={establishSession} />
        ) : (
          <LoginForm users={users} addUser={addUser} loginIdentifier={loginIdentifier} loginPin={loginPin} onForgot={resetAccess} />
        )}
      </motion.div>
    </div>
  )
}

type Users = ReturnType<typeof useDroguerie>['users']

// --- Champ sombre réutilisable ---
function DarkField({ label, icon, right, children }: { label: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
        {right}
      </div>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>}
        {children}
      </div>
    </label>
  )
}

const inputCls =
  'h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] pl-11 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-400/70 focus:bg-white/[0.08] focus:ring-2 focus:ring-blue-500/20'

function LoginForm({
  users,
  addUser,
  loginIdentifier,
  loginPin,
  onForgot,
}: {
  users: Users
  addUser: ReturnType<typeof useDroguerie>['addUser']
  loginIdentifier: (id: string, p: string) => { ok: boolean }
  loginPin: (id: string, pin: string) => { ok: boolean }
  onForgot: () => void
}) {
  const { t } = useLanguage()
  const [mode, setMode] = useState<'password' | 'pin' | 'signup'>('password')
  const [identifier, setIdentifier] = useState('')
  const [pw, setPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const pinUsers = users.filter((u) => u.active && u.pinHash)
  const [pinUserId, setPinUserId] = useState('')
  const [pin, setPin] = useState('')

  const submitPassword = () => {
    setError('')
    if (!loginIdentifier(identifier, pw).ok) setError(t('auth_bad_credentials'))
  }
  const submitPin = () => {
    setError('')
    if (!loginPin(pinUserId, pin).ok) {
      setError(t('auth_bad_pin'))
      setPin('')
    }
  }

  if (mode === 'pin') {
    return (
      <div className="space-y-4">
        {pinUsers.length === 0 ? (
          <p className="rounded-xl bg-white/5 p-4 text-center text-sm text-slate-400">{t('auth_no_pin_users')}</p>
        ) : !pinUserId ? (
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-400">{t('auth_choose_user')}</p>
            <div className="grid grid-cols-2 gap-2">
              {pinUsers.map((u) => (
                <button key={u.id} onClick={() => { setPinUserId(u.id); setPin(''); setError('') }} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-blue-400/50 hover:bg-white/[0.07]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-xs font-bold text-white">{u.name.slice(0, 2).toUpperCase()}</span>
                  <span className="truncate text-sm font-semibold text-slate-100">{u.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm font-semibold text-white">{pinUsers.find((u) => u.id === pinUserId)?.name}</p>
            <DarkField label={t('auth_enter_pin')} icon={<KeyRound className="h-4 w-4" />}>
              <input className={`${inputCls} text-center tracking-[0.5em]`} type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && submitPin()} autoFocus />
            </DarkField>
            {error && <p className="text-center text-sm font-medium text-rose-400">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setPinUserId(''); setPin(''); setError('') }} className="h-12 flex-1 rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-slate-200 transition hover:bg-white/10">{t('auth_back')}</button>
              <button onClick={submitPin} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-sm font-bold text-white transition hover:brightness-110">
                <LogIn className="h-4 w-4" />{t('auth_signin')}
              </button>
            </div>
          </div>
        )}
        <button onClick={() => { setMode('password'); setError('') }} className="w-full text-center text-xs font-semibold text-slate-400 transition hover:text-blue-400">
          {t('auth_password_link')}
        </button>
      </div>
    )
  }

  if (mode === 'signup') {
    return (
      <SignupForm
        users={users}
        addUser={addUser}
        onDone={(name) => {
          setMode('password')
          setIdentifier(name)
          setPw('')
          setError('')
          setNotice(t('auth_ca_success'))
        }}
        onBack={() => { setMode('password'); setError('') }}
      />
    )
  }

  return (
    <div className="space-y-5">
      {notice && <p className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-center text-sm font-semibold text-emerald-300">{notice}</p>}
      <DarkField label={t('auth_identifier')} icon={<User className="h-4 w-4" />}>
        <input className={inputCls} value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={t('auth_identifier_ph')} autoFocus onKeyDown={(e) => e.key === 'Enter' && submitPassword()} />
      </DarkField>

      <DarkField
        label={t('auth_password')}
        icon={<Lock className="h-4 w-4" />}
        right={<button type="button" onClick={onForgot} className="text-xs font-semibold text-blue-400 transition hover:text-blue-300">{t('auth_forgot')}</button>}
      >
        <input className={`${inputCls} pr-11`} type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === 'Enter' && submitPassword()} />
        <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-200" aria-label="toggle">
          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </DarkField>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-300">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/10 accent-blue-500" />
        {t('auth_remember')}
      </label>

      {error && <p className="text-sm font-medium text-rose-400">{error}</p>}

      <button onClick={submitPassword} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-blue-900/40 transition hover:brightness-110 active:scale-[0.98]">
        {t('auth_connect')}
        <LogIn className="h-4 w-4" />
      </button>

      <div className="pt-1 text-center text-sm text-slate-500">
        {t('auth_no_account')}{' '}
        <button onClick={() => { setMode('signup'); setError(''); setNotice('') }} className="font-bold text-white transition hover:text-blue-400">{t('auth_create_account')}</button>
      </div>

      <button onClick={() => { setMode('pin'); setError('') }} className="w-full text-center text-xs font-semibold text-slate-500 transition hover:text-blue-400">
        {t('auth_pin_link')}
      </button>
    </div>
  )
}

function SignupForm({
  users,
  addUser,
  onDone,
  onBack,
}: {
  users: Users
  addUser: ReturnType<typeof useDroguerie>['addUser']
  onDone: (name: string) => void
  onBack: () => void
}) {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const norm = (s: string) => s.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ')

  const submit = () => {
    setError('')
    const n = name.trim()
    if (!n) return setError(t('auth_ca_name'))
    if (pw.length < 4) return setError(t('auth_pw_short'))
    if (pw !== confirm) return setError(t('auth_pw_mismatch'))
    const taken = users.some(
      (u) => norm(u.name) === norm(n) || (email.trim() && u.email && norm(u.email) === norm(email))
    )
    if (taken) return setError(t('auth_ca_taken'))
    addUser({
      name: n,
      phone: '',
      role: 'Vendeur',
      active: true,
      email: email.trim(),
      passwordHash: hashSecret(pw),
    })
    onDone(n)
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-lg font-semibold text-white">{t('auth_create_account')}</p>
      <DarkField label={t('auth_ca_name')} icon={<User className="h-4 w-4" />}>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('auth_ca_name_ph')} autoFocus />
      </DarkField>
      <DarkField label={t('auth_email')} icon={<Mail className="h-4 w-4" />}>
        <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" />
      </DarkField>
      <DarkField label={t('auth_password')} icon={<Lock className="h-4 w-4" />}>
        <input className={inputCls} type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </DarkField>
      <DarkField label={t('auth_setup_confirm')} icon={<Lock className="h-4 w-4" />}>
        <input className={inputCls} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </DarkField>
      {error && <p className="text-sm font-medium text-rose-400">{error}</p>}
      <button onClick={submit} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 py-3.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98]">
        <User className="h-4 w-4" />{t('auth_ca_submit')}
      </button>
      <p className="text-center text-xs text-slate-500">{t('auth_ca_role_note')}</p>
      <button onClick={onBack} className="w-full text-center text-xs font-semibold text-slate-400 transition hover:text-blue-400">{t('auth_back')}</button>
    </div>
  )
}

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
      <div className="flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2.5 text-xs text-blue-300">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        {t('auth_setup_desc')}
      </div>
      <DarkField label={t('auth_setup_admin')} icon={<User className="h-4 w-4" />}>
        <input className={`${inputCls} opacity-70`} value={admin?.name ?? ''} disabled />
      </DarkField>
      <DarkField label={t('auth_email')} icon={<Mail className="h-4 w-4" />}>
        <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@exemple.com" />
      </DarkField>
      <DarkField label={t('auth_password')} icon={<Lock className="h-4 w-4" />}>
        <input className={inputCls} type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </DarkField>
      <DarkField label={t('auth_setup_confirm')} icon={<Lock className="h-4 w-4" />}>
        <input className={inputCls} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </DarkField>
      {error && <p className="text-sm font-medium text-rose-400">{error}</p>}
      <button onClick={submit} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98]">
        <ShieldCheck className="h-4 w-4" />{t('auth_setup_btn')}
      </button>
    </div>
  )
}
