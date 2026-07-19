'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Ban, Check, Mail, Search, ShieldAlert, ShieldCheck, UserCheck, UserPlus, Users, X } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { useDroguerie, type AppUser } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { hashSecret } from '@/lib/auth'
import { useLanguage, type TKey } from '@/lib/i18n'

const ROLE_KEY: Record<AppUser['role'], TKey> = {
  Administrateur: 'usr_role_admin',
  Gérant: 'usr_role_manager',
  Caissier: 'usr_role_cashier',
  Vendeur: 'usr_role_seller',
}

const TEMP_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function genTempPassword(): string {
  let s = ''
  for (let i = 0; i < 8; i++) s += TEMP_CHARS[Math.floor(Math.random() * TEMP_CHARS.length)]
  return s
}

// Compteur style « afficheur digital » (esprit OCB), aux couleurs de l'app.
function Digital({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: React.ReactNode }) {
  return (
    <div className="glass-card flex items-center gap-4 p-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-zinc-500">{label}</p>
        <p className="rounded-lg border border-amber-500/20 bg-black/70 px-3 py-0.5 font-mono text-2xl font-bold tracking-[0.25em] text-amber-400 shadow-[inset_0_0_12px_rgba(245,158,11,0.15)]">
          {String(value).padStart(3, '0')}
        </p>
      </div>
    </div>
  )
}

function Content() {
  const { ready, users, updateUser, deleteUser } = useDroguerie()
  const { session } = useAuth()
  const { t } = useLanguage()
  const toast = useToast()

  const [tab, setTab] = useState<'ops' | 'requests'>('ops')
  const [query, setQuery] = useState('')
  const [approval, setApproval] = useState<{ user: AppUser; temp: string; emailSent: boolean } | null>(null)

  if (!ready) return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>

  const isAdmin = session?.role === 'Administrateur'
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="glass-card flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500"><ShieldAlert className="h-7 w-7" /></span>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('adm_title')}</h1>
          <p className="text-sm text-rose-500">{t('rst_forbidden')}</p>
        </div>
      </div>
    )
  }

  const pending = users.filter((u) => u.pendingApproval)
  const ops = users.filter((u) => !u.pendingApproval)
  const q = query.trim().toLowerCase()
  const filterQ = (list: AppUser[]) => (q ? list.filter((u) => u.name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)) : list)

  const stats = {
    total: users.length,
    actives: users.filter((u) => u.active && !u.pendingApproval).length,
    admins: users.filter((u) => u.role === 'Administrateur' && u.active).length,
    pending: pending.length,
  }

  // Approbation : mot de passe déjà choisi → activation directe ; sinon mot de
  // passe temporaire + email de bienvenue (changement obligatoire).
  const approve = async (u: AppUser) => {
    if (u.passwordHash) {
      updateUser(u.id, { active: true, pendingApproval: false })
      setApproval({ user: u, temp: '', emailSent: false })
      toast(`✓ ${t('usr_pending_approved')}`)
      return
    }
    const temp = genTempPassword()
    updateUser(u.id, { active: true, pendingApproval: false, passwordHash: hashSecret(temp), mustChangePassword: true })
    let emailSent = false
    if (u.email) {
      try {
        const res = await fetch('/api/send-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: u.email, name: u.name, password: temp }),
        })
        const d = (await res.json()) as { ok?: boolean }
        emailSent = !!d.ok
      } catch {
        emailSent = false
      }
    }
    setApproval({ user: u, temp, emailSent })
    toast(`✓ ${t('usr_pending_approved')}`)
  }

  const Avatar = ({ u }: { u: AppUser }) => (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-sm font-black text-gray-900">
      {u.name.slice(0, 2).toUpperCase()}
    </span>
  )

  const chip = 'rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide'

  return (
    <>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400"><ShieldCheck className="h-6 w-6" /></span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('adm_title')}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {t('adm_system_active')}
            </p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('adm_search')} className="input-field w-64 pl-10" />
        </div>
      </motion.div>

      {/* Digital stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Digital label={t('adm_total')} value={stats.total} tone="bg-amber-500/15 text-amber-600 dark:text-amber-400" icon={<Users className="h-5 w-5" />} />
        <Digital label={t('adm_actives')} value={stats.actives} tone="bg-emerald-500/15 text-emerald-500" icon={<UserCheck className="h-5 w-5" />} />
        <Digital label={t('adm_admins')} value={stats.admins} tone="bg-violet-500/15 text-violet-500" icon={<ShieldCheck className="h-5 w-5" />} />
        <Digital label={t('adm_pending_count')} value={stats.pending} tone="bg-rose-500/15 text-rose-500" icon={<UserPlus className="h-5 w-5" />} />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab('ops')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
            tab === 'ops'
              ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-lg shadow-amber-400/25'
              : 'border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 hover:border-amber-300'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          {t('adm_tab_ops')}
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`relative flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
            tab === 'requests'
              ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-lg shadow-amber-400/25'
              : 'border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 hover:border-amber-300'
          }`}
        >
          <UserPlus className="h-3.5 w-3.5" />
          {t('adm_tab_requests')}
          {pending.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{pending.length}</span>
          )}
        </button>
      </div>

      {/* Lists */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-3">
        {tab === 'requests' ? (
          filterQ(pending).length === 0 ? (
            <p className="glass-card p-8 text-center text-sm text-gray-400 dark:text-zinc-500">{t('adm_none_requests')}</p>
          ) : (
            filterQ(pending).map((u) => (
              <div key={u.id} className="glass-card flex flex-wrap items-center gap-4 p-4">
                <Avatar u={u} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-gray-900 dark:text-white">{u.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={`${chip} bg-gray-500/15 text-gray-500 dark:text-zinc-400`}>{t(ROLE_KEY[u.role])}</span>
                    <span className={`${chip} bg-amber-500/15 text-amber-600 dark:text-amber-400`}>{t('adm_status_pending')}</span>
                    {u.email && <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-zinc-500"><Mail className="h-3 w-3" />{u.email}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approve(u)} className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white transition hover:brightness-110 active:scale-95">
                    <Check className="h-4 w-4" />{t('usr_pending_approve')}
                  </button>
                  <button onClick={() => deleteUser(u.id)} className="flex items-center gap-1.5 rounded-xl border border-rose-400/50 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-rose-500 transition hover:bg-rose-500/10 active:scale-95">
                    <X className="h-4 w-4" />{t('usr_pending_reject')}
                  </button>
                </div>
              </div>
            ))
          )
        ) : filterQ(ops).length === 0 ? (
          <p className="glass-card p-8 text-center text-sm text-gray-400 dark:text-zinc-500">{t('adm_none_users')}</p>
        ) : (
          filterQ(ops).map((u) => (
            <div key={u.id} className="glass-card flex flex-wrap items-center gap-4 p-4">
              <Avatar u={u} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-gray-900 dark:text-white">{u.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`${chip} bg-gray-500/15 text-gray-500 dark:text-zinc-400`}>{t(ROLE_KEY[u.role])}</span>
                  {u.active ? (
                    <span className={`${chip} bg-emerald-500/15 text-emerald-500`}>{t('adm_active_chip')}</span>
                  ) : (
                    <span className={`${chip} bg-rose-500/15 text-rose-500`}>{t('adm_blocked')}</span>
                  )}
                  {u.email && <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-zinc-500"><Mail className="h-3 w-3" />{u.email}</span>}
                </div>
              </div>
              {u.role !== 'Administrateur' && (
                u.active ? (
                  <button onClick={() => updateUser(u.id, { active: false })} className="flex items-center gap-1.5 rounded-xl border border-rose-400/50 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-rose-500 transition hover:bg-rose-500/10 active:scale-95">
                    <Ban className="h-4 w-4" />{t('adm_block')}
                  </button>
                ) : (
                  <button onClick={() => updateUser(u.id, { active: true })} className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white transition hover:brightness-110 active:scale-95">
                    <Check className="h-4 w-4" />{t('adm_unblock')}
                  </button>
                )
              )}
            </div>
          ))
        )}
      </motion.div>

      {/* Résultat d'approbation */}
      <Modal open={!!approval} onClose={() => setApproval(null)} title={t('usr_pending_approved')}>
        {approval && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-zinc-200">
              <b>{approval.user.name}</b>{approval.user.email ? ` · ${approval.user.email}` : ''}
            </p>
            {approval.temp ? (
              <>
                <div className={`rounded-xl border p-3 text-sm ${approval.emailSent ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'}`}>
                  {approval.emailSent ? `✓ ${t('usr_pending_email_sent')}` : t('usr_pending_email_failed')}
                </div>
                <div>
                  <p className="field-label">{t('usr_pending_temp_pw')}</p>
                  <p className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center font-mono text-lg font-bold tracking-widest text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white">{approval.temp}</p>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                ✓ {t('usr_pending_pw_ok')}
              </div>
            )}
            <button onClick={() => setApproval(null)} className="btn-primary w-full">{t('usr_pending_close')}</button>
          </div>
        )}
      </Modal>
    </>
  )
}

export default function AdministrationPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
