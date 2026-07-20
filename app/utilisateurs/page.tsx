'use client'

import { useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Check, Mail, Pencil, Plus, ShieldCheck, Trash2, UserCog, UserPlus, X } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { useDroguerie, type AppUser } from '@/lib/store'
import { hashSecret } from '@/lib/auth'
import { useLanguage, type TKey } from '@/lib/i18n'

// Mot de passe temporaire lisible (sans caractères ambigus).
const TEMP_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function genTempPassword(): string {
  let s = ''
  for (let i = 0; i < 8; i++) s += TEMP_CHARS[Math.floor(Math.random() * TEMP_CHARS.length)]
  return s
}

const ROLES: AppUser['role'][] = ['Administrateur', 'Gérant', 'Caissier', 'Vendeur']
const ROLE_LABEL_KEY: Record<AppUser['role'], TKey> = {
  Administrateur: 'usr_role_admin',
  Gérant: 'usr_role_manager',
  Caissier: 'usr_role_cashier',
  Vendeur: 'usr_role_seller',
}

const ROLE_META: Record<AppUser['role'], { chip: string }> = {
  Administrateur: { chip: 'border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400' },
  Gérant: { chip: 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  Caissier: { chip: 'border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/10 text-sky-700' },
  Vendeur: { chip: 'border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' },
}

// Permission matrix per role
const PERMISSION_KEYS: { key: string; labelKey: TKey }[] = [
  { key: 'pos', labelKey: 'usr_perm_pos' },
  { key: 'produits', labelKey: 'usr_perm_products' },
  { key: 'stock', labelKey: 'usr_perm_stock' },
  { key: 'achats', labelKey: 'usr_perm_purchases' },
  { key: 'rapports', labelKey: 'usr_perm_reports' },
  { key: 'caisse', labelKey: 'usr_perm_register' },
  { key: 'parametres', labelKey: 'usr_perm_settings' },
]

const ROLE_PERMS: Record<AppUser['role'], string[]> = {
  Administrateur: PERMISSION_KEYS.map((p) => p.key),
  Gérant: ['pos', 'produits', 'stock', 'achats', 'rapports', 'caisse'],
  Caissier: ['pos', 'caisse', 'stock'],
  Vendeur: ['pos', 'produits'],
}

function Content() {
  const { ready, users, activity, addUser, updateUser, deleteUser } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [tab, setTab] = useState<'equipe' | 'permissions' | 'journal'>('equipe')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<{ name: string; phone: string; role: AppUser['role']; active: boolean }>({
    name: '',
    phone: '',
    role: 'Caissier',
    active: true,
  })
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null)
  const [approval, setApproval] = useState<{ user: AppUser; temp: string; emailSent: boolean } | null>(null)

  const pending = users.filter((u) => u.pendingApproval)

  // Approbation. Deux cas :
  //  - Le compte a déjà un mot de passe (inscription complète) → simple activation.
  //  - Sinon → mot de passe temporaire (changement obligatoire) + email de bienvenue.
  const approve = async (u: AppUser) => {
    if (u.passwordHash) {
      updateUser(u.id, { active: true, pendingApproval: false })
      window.dispatchEvent(new CustomEvent('droguerie-sync-pull'))
      setApproval({ user: u, temp: '', emailSent: false })
      toast(`✓ ${t('usr_pending_approved')}`)
      return
    }
    const temp = genTempPassword()
    updateUser(u.id, { active: true, pendingApproval: false, passwordHash: hashSecret(temp), mustChangePassword: true })
    window.dispatchEvent(new CustomEvent('droguerie-sync-pull'))
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

  const reject = (u: AppUser) => {
    deleteUser(u.id)
    window.dispatchEvent(new CustomEvent('droguerie-sync-pull'))
  }

  if (!ready) {
    return <Loader />
  }

  const openAdd = () => {
    setEditingId(null)
    setForm({ name: '', phone: '', role: 'Caissier', active: true })
    setModalOpen(true)
  }

  const openEdit = (u: AppUser) => {
    setEditingId(u.id)
    setForm({ name: u.name, phone: u.phone, role: u.role, active: u.active })
    setModalOpen(true)
  }

  const saveForm = () => {
    if (!form.name.trim()) {
      toast(t('usr_toast_name_required'), 'error')
      return
    }
    if (editingId) {
      updateUser(editingId, form)
      toast(`✓ ${form.name} ${t('usr_toast_modified')}`)
    } else {
      addUser(form)
      toast(`✓ ${form.name} ${t('usr_toast_added')}`)
    }
    setModalOpen(false)
  }

  const tabs = [
    { key: 'equipe' as const, label: t('usr_tab_team') },
    { key: 'permissions' as const, label: t('usr_tab_permissions') },
    { key: 'journal' as const, label: t('usr_tab_journal') },
  ]

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('usr_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('usr_subtitle')}</p>
        </div>
        {tab === 'equipe' && (
          <button onClick={openAdd} className="btn-primary">
            <Plus className="h-4 w-4" />
            {t('usr_add')}
          </button>
        )}
      </motion.div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              tab === t.key
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-lg shadow-amber-400/25'
                : 'border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 hover:border-amber-300 hover:bg-amber-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Demandes de compte en attente d'approbation */}
      {pending.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card border-l-4 border-l-amber-400 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            <UserPlus className="h-4 w-4" />
            {t('usr_pending_title')} · {pending.length}
          </h3>
          <div className="space-y-2.5">
            {pending.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-white/5 dark:bg-white/[0.03]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{u.name}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-gray-500 dark:text-zinc-400"><Mail className="h-3 w-3" />{u.email || '—'}</p>
                </div>
                <button onClick={() => approve(u)} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white transition hover:brightness-110 active:scale-95">
                  <Check className="h-3.5 w-3.5" />{t('usr_pending_approve')}
                </button>
                <button onClick={() => reject(u)} className="flex items-center gap-1.5 rounded-lg border border-rose-300 px-3.5 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 active:scale-95 dark:border-rose-500/40 dark:text-rose-400 dark:hover:bg-rose-500/10">
                  <X className="h-3.5 w-3.5" />{t('usr_pending_reject')}
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Résultat d'approbation : mot de passe temporaire + statut email */}
      <Modal open={!!approval} onClose={() => setApproval(null)} title={t('usr_pending_approved')}>
        {approval && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-zinc-200">
              <b>{approval.user.name}</b> · {approval.user.email}
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

      {/* Team */}
      {tab === 'equipe' && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  <th className="px-5 py-3.5">{t('usr_col_employee')}</th>
                  <th className="px-5 py-3.5">{t('usr_col_phone')}</th>
                  <th className="px-5 py-3.5">{t('usr_col_role')}</th>
                  <th className="px-5 py-3.5">{t('usr_col_status')}</th>
                  <th className="px-5 py-3.5 text-right">{t('usr_col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="group border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-xs font-bold text-gray-900">
                          {u.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{u.name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">{u.phone || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${ROLE_META[u.role].chip}`}>
                        {t(ROLE_LABEL_KEY[u.role])}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => updateUser(u.id, { active: !u.active })}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold transition ${
                          u.active
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
                            : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-zinc-400 hover:bg-gray-200'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${u.active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {u.active ? t('usr_active') : t('usr_inactive')}
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-400"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(u)}
                          className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Permissions matrix */}
      {tab === 'permissions' && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-card overflow-hidden"
        >
          <div className="border-b border-gray-100 dark:border-white/10 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
              <ShieldCheck className="h-4 w-4 text-amber-500" />
              {t('usr_permissions_matrix')}
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">{t('usr_permissions_desc')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  <th className="px-5 py-3.5">{t('usr_col_permission')}</th>
                  {ROLES.map((r) => (
                    <th key={r} className="px-5 py-3.5 text-center">
                      {t(ROLE_LABEL_KEY[r])}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_KEYS.map((perm) => (
                  <tr key={perm.key} className="border-b border-gray-50">
                    <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-white">{t(perm.labelKey)}</td>
                    {ROLES.map((r) => (
                      <td key={r} className="px-5 py-3 text-center">
                        {ROLE_PERMS[r].includes(perm.key) ? (
                          <Check className="mx-auto h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                        ) : (
                          <X className="mx-auto h-4 w-4 text-gray-300" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Activity log */}
      {tab === 'journal' && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-card p-6"
        >
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('usr_activity_log')}</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t('usr_activity_desc')}</p>
          <div className="mt-4 space-y-1">
            {activity.slice(0, 40).map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-amber-50/50">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-zinc-400">
                  <UserCog className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{a.action}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500">{a.user}</p>
                </div>
                <span className="shrink-0 pt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">
                  {new Date(a.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}{' '}
                  {new Date(a.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {activity.length === 0 && <p className="py-6 text-center text-sm text-gray-400 dark:text-zinc-500">{t('usr_no_activity')}</p>}
          </div>
        </motion.div>
      )}

      {/* Add/edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? t('usr_edit_title') : t('usr_add_title')}
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">{t('usr_full_name')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ex: Hamid Tazi"
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('usr_col_phone')}</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="06 XX XX XX XX"
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('usr_role_label')}</label>
            <Select
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v as AppUser['role'] })}
              options={ROLES.map((r) => ({ value: r, label: t(ROLE_LABEL_KEY[r]) }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 dark:border-white/15 text-amber-500 focus:ring-amber-400"
            />
            {t('usr_account_active')}
          </label>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">
              {t('usr_cancel')}
            </button>
            <button onClick={saveForm} className="btn-primary">
              {editingId ? t('usr_save') : t('usr_add_btn')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('usr_delete_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <span className="font-semibold text-gray-900 dark:text-white">{deleteTarget?.name}</span> {t('usr_delete_desc')}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
            {t('usr_cancel')}
          </button>
          <button
            onClick={() => {
              deleteUser(deleteTarget!.id)
              toast(`${deleteTarget!.name} ${t('usr_toast_deleted')}`)
              setDeleteTarget(null)
            }}
            className="btn-danger"
          >
            <Trash2 className="h-4 w-4" />
            {t('usr_delete')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function UtilisateursPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
