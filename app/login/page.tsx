'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  PartyPopper,
  Rocket,
  ShieldCheck,
  ShieldQuestion,
  TriangleAlert,
  User,
} from 'lucide-react'
import Loader from '@/components/Loader'
import { useAuth } from '@/lib/auth-context'
import { hashSecret, verifySecret } from '@/lib/auth'
import { useDroguerie, type AppUser } from '@/lib/store'
import { turso, tursoConfigured } from '@/lib/turso'
import { useLanguage, type TKey } from '@/lib/i18n'

const REMEMBER_KEY = 'dp_remember_user'
const SEC_QUESTIONS: TKey[] = ['auth_sec_q1', 'auth_sec_q2', 'auth_sec_q3', 'auth_sec_q4', 'auth_sec_q5']
const ROLE_KEY: Record<AppUser['role'], TKey> = {
  Administrateur: 'usr_role_admin',
  Gérant: 'usr_role_manager',
  Magasinier: 'usr_role_stockman',
  Caissier: 'usr_role_cashier',
  Vendeur: 'usr_role_seller',
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ')

export default function LoginPage() {
  const { ready, session, needsSetup, loginIdentifier, loginPin, establishSession, logout } = useAuth()
  const { users, updateUser, addUser, bootPhase } = useDroguerie()
  const { t } = useLanguage()
  const router = useRouter()
  const [resetOpen, setResetOpen] = useState(false)

  useEffect(() => {
    if (session) router.replace('/')
  }, [session, router])

  // La page de connexion rafraîchit TOUJOURS les comptes depuis Turso :
  // évite les utilisateurs locaux périmés qui empêchent la connexion.
  useEffect(() => {
    if (!tursoConfigured()) return
    ;(async () => {
      try {
        const db = turso()
        const res = await db.execute("SELECT data FROM records WHERE collection='users' AND deleted=0")
        if (res.rows.length === 0) return
        type U = { id?: string }
        const remote: U[] = []
        for (const row of res.rows) {
          try {
            remote.push(JSON.parse(String(row.data)))
          } catch {}
        }
        if (remote.length === 0) return
        let local: U[] = []
        try {
          local = JSON.parse(localStorage.getItem('dp_users') || '[]')
        } catch {}
        const ids = new Set(remote.map((u) => u.id))
        const merged = [...remote, ...local.filter((u) => u.id && !ids.has(u.id))]
        localStorage.setItem('dp_users', JSON.stringify(merged))
        window.dispatchEvent(new CustomEvent('droguerie-sync-pull'))
      } catch {
        /* hors-ligne : on garde les comptes locaux */
      }
    })()
  }, [])

  const resetAccess = () => {
    setResetOpen(false)
    users.forEach((u) => updateUser(u.id, { passwordHash: '', pinHash: '' }))
    logout()
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a0f]">
        <Loader className="!min-h-0" />
        {bootPhase && <p className="text-xs font-medium tracking-wide text-zinc-500">{bootPhase}</p>}
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#0a0a0f] via-[#0d0d14] to-[#12121a] p-5">
      {/* Glows */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-20 top-1/4 h-80 w-80 rounded-full bg-amber-500/10 blur-[130px]" />
        <div className="absolute -right-20 bottom-1/4 h-80 w-80 rounded-full bg-yellow-500/10 blur-[130px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="relative w-full max-w-[420px] rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-2xl"
      >
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <h1 className="text-3xl font-black tracking-tight text-white">
            Droguerie <span className="text-amber-400">Pro</span>
          </h1>
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
            {t('auth_edition')}
          </span>
        </div>

        {needsSetup ? (
          <SetupForm users={users} updateUser={updateUser} establishSession={establishSession} />
        ) : (
          <LoginForm
            users={users}
            addUser={addUser}
            updateUser={updateUser}
            establishSession={establishSession}
            loginIdentifier={loginIdentifier}
            loginPin={loginPin}
            onFullReset={() => setResetOpen(true)}
          />
        )}
      </motion.div>

      {/* Boîte de dialogue de réinitialisation complète (secours administrateur) */}
      {resetOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm" onClick={() => setResetOpen(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#12121a] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                <TriangleAlert className="h-5 w-5" />
              </span>
              <h2 className="text-base font-bold text-white">{t('auth_reset_title')}</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">{t('auth_reset_confirm')}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setResetOpen(false)} className="rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/10 active:scale-[0.98]">
                {t('rst_cancel')}
              </button>
              <button onClick={resetAccess} className="rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-2.5 text-sm font-bold text-gray-900 transition hover:brightness-110 active:scale-[0.98]">
                {t('auth_reset_ok')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
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
  'h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] pl-11 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-400/70 focus:bg-white/[0.08] focus:ring-2 focus:ring-amber-500/20'
const selectCls =
  'h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-amber-400/70 focus:ring-2 focus:ring-amber-500/20'
const primaryBtn =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3.5 text-sm font-bold uppercase tracking-wide text-gray-900 shadow-lg shadow-amber-900/40 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'

type Mode = 'password' | 'pin' | 'signup' | 'pending' | 'approved' | 'recovery'

function LoginForm({
  users,
  addUser,
  updateUser,
  establishSession,
  loginIdentifier,
  loginPin,
  onFullReset,
}: {
  users: Users
  addUser: ReturnType<typeof useDroguerie>['addUser']
  updateUser: ReturnType<typeof useDroguerie>['updateUser']
  establishSession: (u: AppUser) => void
  loginIdentifier: (id: string, p: string) => { ok: boolean }
  loginPin: (id: string, pin: string) => { ok: boolean }
  onFullReset: () => void
}) {
  const { t } = useLanguage()
  const [mode, setMode] = useState<Mode>('password')
  const [identifier, setIdentifier] = useState('')
  const [pw, setPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Inscription
  const [suName, setSuName] = useState('')
  const [suPw, setSuPw] = useState('')
  const [suConfirm, setSuConfirm] = useState('')
  const [suShowPw, setSuShowPw] = useState(false)
  const [secQ, setSecQ] = useState('')
  const [secA, setSecA] = useState('')

  // Attente / approbation (temps réel)
  const [pendingName, setPendingName] = useState('')
  const [approvedUser, setApprovedUser] = useState<AppUser | null>(null)

  // Récupération
  const [recStep, setRecStep] = useState<'username' | 'question' | 'reset'>('username')
  const [recUser, setRecUser] = useState<AppUser | null>(null)
  const [recAnswer, setRecAnswer] = useState('')
  const [recPw, setRecPw] = useState('')
  const [recConfirm, setRecConfirm] = useState('')

  // « Se souvenir de moi » : pré-remplit l'identifiant.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY)
      if (saved) {
        setIdentifier(saved)
        setRemember(true)
      }
    } catch {}
  }, [])

  // Polling temps réel : tant que la demande est en attente, on interroge
  // Turso toutes les 3 s pour détecter l'approbation par l'administrateur.
  useEffect(() => {
    if (mode !== 'pending' || !pendingName || !tursoConfigured()) return
    const id = setInterval(async () => {
      try {
        const db = turso()
        const res = await db.execute("SELECT data FROM records WHERE collection='users' AND deleted=0")
        let found: AppUser | null = null
        for (const row of res.rows) {
          try {
            const u = JSON.parse(String(row.data)) as AppUser
            if (norm(u.name) === norm(pendingName)) {
              found = u
              break
            }
          } catch {}
        }
        if (found && found.active && !found.pendingApproval) {
          // Approuvé → synchronise la liste locale puis affiche la célébration.
          try {
            const local: AppUser[] = JSON.parse(localStorage.getItem('dp_users') || '[]')
            const next = local.some((x) => x.id === found!.id)
              ? local.map((x) => (x.id === found!.id ? found! : x))
              : [found!, ...local]
            localStorage.setItem('dp_users', JSON.stringify(next))
            window.dispatchEvent(new CustomEvent('droguerie-sync-pull'))
          } catch {}
          setApprovedUser(found)
          setMode('approved')
        }
      } catch {
        /* réseau : on réessaie au tick suivant */
      }
    }, 3000)
    return () => clearInterval(id)
  }, [mode, pendingName])

  const submitPassword = () => {
    setError('')
    setNotice('')
    const id = norm(identifier)
    const match = users.find((u) => (u.email && norm(u.email) === id) || norm(u.name) === id)
    if (match?.pendingApproval) {
      // Demande encore en attente → réafficher l'écran d'attente temps réel.
      setPendingName(match.name)
      setMode('pending')
      return
    }
    if (!loginIdentifier(identifier, pw).ok) {
      setError(t('auth_bad_credentials'))
      return
    }
    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, identifier)
      else localStorage.removeItem(REMEMBER_KEY)
    } catch {}
  }

  // --- PIN ---
  const pinUsers = users.filter((u) => u.active && u.pinHash)
  const [pinUserId, setPinUserId] = useState('')
  const [pin, setPin] = useState('')
  const submitPin = () => {
    setError('')
    if (!loginPin(pinUserId, pin).ok) {
      setError(t('auth_bad_pin'))
      setPin('')
    }
  }

  // --- Inscription (nom + mot de passe + question de sécurité) ---
  const submitSignup = () => {
    setError('')
    const n = suName.trim()
    if (!n) return setError(t('auth_ca_name'))
    if (suPw.length < 4) return setError(t('auth_pw_short'))
    if (suPw !== suConfirm) return setError(t('auth_pw_mismatch'))
    if (!secQ || !secA.trim()) return setError(t('auth_sec_required'))
    if (users.some((u) => norm(u.name) === norm(n))) return setError(t('auth_ca_taken'))
    addUser({
      name: n,
      phone: '',
      role: 'Vendeur',
      active: false,
      email: '',
      pendingApproval: true,
      passwordHash: hashSecret(suPw),
      securityQuestion: secQ,
      securityAnswerHash: hashSecret(secA.trim().toLowerCase()),
    })
    setPendingName(n)
    setMode('pending')
  }

  // --- Récupération (question de sécurité) ---
  const submitRecovery = () => {
    setError('')
    if (recStep === 'username') {
      const id = norm(identifier)
      const u = users.find((x) => (x.email && norm(x.email) === id) || norm(x.name) === id)
      if (!u || !u.securityQuestion || !u.securityAnswerHash) return setError(t('auth_rec_notfound'))
      setRecUser(u)
      setRecStep('question')
    } else if (recStep === 'question') {
      if (!recUser) return
      if (!verifySecret(recAnswer.trim().toLowerCase(), recUser.securityAnswerHash)) return setError(t('auth_rec_wrong'))
      setRecStep('reset')
    } else {
      if (!recUser) return
      if (recPw.length < 4) return setError(t('auth_pw_short'))
      if (recPw !== recConfirm) return setError(t('auth_pw_mismatch'))
      updateUser(recUser.id, { passwordHash: hashSecret(recPw), mustChangePassword: false })
      setMode('password')
      setRecStep('username')
      setRecUser(null)
      setRecAnswer('')
      setRecPw('')
      setRecConfirm('')
      setPw('')
      setNotice(t('auth_rec_success'))
    }
  }

  const backToLogin = () => {
    setMode('password')
    setError('')
    setNotice('')
    setRecStep('username')
    setRecUser(null)
  }

  // ============================== ÉCRANS ==============================

  if (mode === 'pending') {
    return (
      <div className="space-y-5 text-center">
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14 }}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/15 text-amber-400"
        >
          <Clock className="h-10 w-10" />
        </motion.span>
        <h2 className="text-lg font-black uppercase tracking-wide text-white">{t('auth_pending_title')}</h2>
        <p className="text-sm leading-relaxed text-slate-400">{t('auth_pending_desc')}</p>
        <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-amber-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('auth_pending_wait')}
        </div>
        <button onClick={backToLogin} className="mx-auto text-xs font-bold uppercase tracking-widest text-slate-500 transition hover:text-amber-400">
          ✕ {t('auth_pending_back')}
        </button>
      </div>
    )
  }

  if (mode === 'approved' && approvedUser) {
    return (
      <div className="space-y-5 text-center">
        <div className="relative mx-auto h-20 w-20">
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 13 }}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"
          >
            <CheckCircle2 className="h-10 w-10" strokeWidth={2.2} />
          </motion.span>
          <PartyPopper className="absolute -right-3 -top-2 h-6 w-6 text-amber-400" />
        </div>
        <h2 className="text-lg font-black uppercase tracking-wide text-white">{t('auth_approved_title')}</h2>
        <p className="text-sm leading-relaxed text-slate-400">
          {t('auth_approved_before')} <b className="text-amber-400">{approvedUser.name}</b>
          {t('auth_approved_after')}
        </p>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] text-left">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('auth_approved_role')}</span>
            <span className="text-xs font-black uppercase text-emerald-400">{t(ROLE_KEY[approvedUser.role] ?? 'usr_role_seller')}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('auth_approved_status')}</span>
            <span className="flex items-center gap-1.5 text-xs font-black uppercase text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {t('auth_approved_active')}
            </span>
          </div>
        </div>
        <button onClick={() => establishSession(approvedUser)} className={primaryBtn}>
          {t('auth_launch')}
          <Rocket className="h-4 w-4" />
        </button>
      </div>
    )
  }

  if (mode === 'signup') {
    return (
      <div className="space-y-4">
        <p className="text-center text-lg font-semibold text-white">{t('auth_create_account')}</p>
        <DarkField label={t('auth_ca_name')} icon={<User className="h-4 w-4" />}>
          <input className={inputCls} value={suName} onChange={(e) => setSuName(e.target.value)} placeholder={t('auth_ca_name_ph')} autoFocus />
        </DarkField>
        <DarkField label={t('auth_password')} icon={<Lock className="h-4 w-4" />}>
          <input className={`${inputCls} pr-11`} type={suShowPw ? 'text' : 'password'} value={suPw} onChange={(e) => setSuPw(e.target.value)} placeholder="••••••••" />
          <button type="button" onClick={() => setSuShowPw((s) => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-200" aria-label="toggle">
            {suShowPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </DarkField>
        <DarkField label={t('auth_setup_confirm')} icon={<ShieldCheck className="h-4 w-4" />}>
          <input className={inputCls} type="password" value={suConfirm} onChange={(e) => setSuConfirm(e.target.value)} placeholder="••••••••" />
        </DarkField>
        <DarkField label={t('auth_sec_q')}>
          <select className={selectCls} value={secQ} onChange={(e) => setSecQ(e.target.value)}>
            <option value="" className="bg-[#12121a]">{t('auth_sec_q_ph')}</option>
            {SEC_QUESTIONS.map((q) => (
              <option key={q} value={q} className="bg-[#12121a]">{t(q)}</option>
            ))}
          </select>
        </DarkField>
        <DarkField label={t('auth_sec_a')} icon={<ShieldQuestion className="h-4 w-4" />}>
          <input className={inputCls} value={secA} onChange={(e) => setSecA(e.target.value)} placeholder={t('auth_sec_a_ph')} onKeyDown={(e) => e.key === 'Enter' && submitSignup()} />
        </DarkField>
        {error && <p className="text-sm font-medium text-rose-400">{error}</p>}
        <button onClick={submitSignup} className={primaryBtn}>
          {t('auth_su_btn')}
          <User className="h-4 w-4" />
        </button>
        <div className="text-center text-sm text-slate-500">
          {t('auth_no_account').replace('?', '?') /* symmetry */} <button onClick={backToLogin} className="font-bold text-amber-400 transition hover:text-amber-300">{t('auth_signin')}</button>
        </div>
      </div>
    )
  }

  if (mode === 'recovery') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-400"><ShieldQuestion className="h-6 w-6" /></span>
          <p className="text-lg font-semibold text-white">{t('auth_rec_title')}</p>
        </div>
        <DarkField label={t('auth_identifier')} icon={<User className="h-4 w-4" />}>
          <input className={`${inputCls} disabled:opacity-60`} value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={t('auth_identifier_ph')} disabled={recStep !== 'username'} autoFocus />
        </DarkField>
        {recStep === 'question' && recUser && (
          <>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('auth_sec_q')} :</p>
              <p className="mt-1 text-sm font-semibold text-white">{t((recUser.securityQuestion as TKey) ?? 'auth_sec_q1')}</p>
            </div>
            <DarkField label={t('auth_sec_a')} icon={<ShieldQuestion className="h-4 w-4" />}>
              <input className={inputCls} value={recAnswer} onChange={(e) => setRecAnswer(e.target.value)} placeholder={t('auth_sec_a_ph')} onKeyDown={(e) => e.key === 'Enter' && submitRecovery()} autoFocus />
            </DarkField>
          </>
        )}
        {recStep === 'reset' && (
          <>
            <DarkField label={t('auth_rec_new_pw')} icon={<Lock className="h-4 w-4" />}>
              <input className={inputCls} type="password" value={recPw} onChange={(e) => setRecPw(e.target.value)} autoFocus />
            </DarkField>
            <DarkField label={t('auth_setup_confirm')} icon={<Lock className="h-4 w-4" />}>
              <input className={inputCls} type="password" value={recConfirm} onChange={(e) => setRecConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitRecovery()} />
            </DarkField>
          </>
        )}
        {error && <p className="text-sm font-medium text-rose-400">{error}</p>}
        <button onClick={submitRecovery} className={primaryBtn}>
          {recStep === 'username' ? t('auth_rec_next') : recStep === 'question' ? t('auth_rec_verify') : t('pwc_submit')}
        </button>
        <button onClick={backToLogin} className="w-full text-center text-xs font-semibold text-slate-400 transition hover:text-amber-400">
          {t('auth_rec_cancel')}
        </button>
        <button onClick={onFullReset} className="w-full text-center text-[11px] text-slate-600 transition hover:text-amber-400">
          {t('auth_rec_full_reset')}
        </button>
      </div>
    )
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
                <button key={u.id} onClick={() => { setPinUserId(u.id); setPin(''); setError('') }} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-amber-400/50 hover:bg-white/[0.07]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 text-xs font-bold text-gray-900">{u.name.slice(0, 2).toUpperCase()}</span>
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
              <button onClick={submitPin} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-sm font-bold text-gray-900 transition hover:brightness-110">
                <LogIn className="h-4 w-4" />{t('auth_signin')}
              </button>
            </div>
          </div>
        )}
        <button onClick={backToLogin} className="w-full text-center text-xs font-semibold text-slate-400 transition hover:text-amber-400">
          {t('auth_password_link')}
        </button>
      </div>
    )
  }

  // --- Connexion (mot de passe) ---
  return (
    <div className="space-y-5">
      <p className="text-center text-lg font-semibold text-white">{t('auth_welcome_pro')}</p>
      {notice && <p className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-center text-sm font-semibold text-emerald-300">{notice}</p>}
      <DarkField label={t('auth_identifier')} icon={<User className="h-4 w-4" />}>
        <input className={inputCls} value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={t('auth_identifier_ph')} autoFocus onKeyDown={(e) => e.key === 'Enter' && submitPassword()} />
      </DarkField>

      <DarkField
        label={t('auth_password')}
        icon={<Lock className="h-4 w-4" />}
        right={<button type="button" onClick={() => { setMode('recovery'); setRecStep('username'); setError(''); setNotice('') }} className="text-xs font-semibold text-amber-400 transition hover:text-amber-300">{t('auth_forgot')}</button>}
      >
        <input className={`${inputCls} pr-11`} type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === 'Enter' && submitPassword()} />
        <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-200" aria-label="toggle">
          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </DarkField>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-300">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/10 accent-amber-500" />
        {t('auth_remember')}
      </label>

      {error && <p className="text-sm font-medium text-rose-400">{error}</p>}

      <button onClick={submitPassword} className={primaryBtn}>
        {t('auth_connect')}
        <LogIn className="h-4 w-4" />
      </button>

      <div className="pt-1 text-center text-sm text-slate-500">
        {t('auth_no_account')}{' '}
        <button onClick={() => { setMode('signup'); setError(''); setNotice('') }} className="font-bold text-white transition hover:text-amber-400">{t('auth_create_account')}</button>
      </div>

      <button onClick={() => { setMode('pin'); setError('') }} className="w-full text-center text-xs font-semibold text-slate-500 transition hover:text-amber-400">
        {t('auth_pin_link')}
      </button>
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
      <p className="text-center text-lg font-semibold text-white">{t('auth_setup_title')}</p>
      <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
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
      <button onClick={submit} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-sm font-bold text-gray-900 transition hover:brightness-110 active:scale-[0.98]">
        <ShieldCheck className="h-4 w-4" />{t('auth_setup_btn')}
      </button>
    </div>
  )
}
