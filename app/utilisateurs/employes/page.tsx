'use client'

import { useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { useDroguerie, type AppUser } from '@/lib/store'
import { hashSecret } from '@/lib/auth'
import { useLanguage, type TKey } from '@/lib/i18n'

const ROLES: AppUser['role'][] = ['Administrateur', 'Gérant', 'Magasinier', 'Caissier', 'Vendeur']
const ROLE_LABEL_KEY: Record<AppUser['role'], TKey> = {
  Administrateur: 'usr_role_admin',
  Gérant: 'usr_role_manager',
  Magasinier: 'usr_role_stockman',
  Caissier: 'usr_role_cashier',
  Vendeur: 'usr_role_seller',
}
const ROLE_META: Record<AppUser['role'], { chip: string }> = {
  Administrateur: { chip: 'border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400' },
  Gérant: { chip: 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  Magasinier: { chip: 'border-orange-200 dark:border-orange-500/20 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400' },
  Caissier: { chip: 'border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/10 text-sky-700' },
  Vendeur: { chip: 'border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' },
}

function Content() {
  const { ready, users, addUser, updateUser, deleteUser } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<{ name: string; phone: string; role: AppUser['role']; active: boolean; email: string; password: string; pin: string }>({
    name: '',
    phone: '',
    role: 'Caissier',
    active: true,
    email: '',
    password: '',
    pin: '',
  })
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null)

  if (!ready) {
    return <Loader />
  }

  const openAdd = () => {
    setEditingId(null)
    setForm({ name: '', phone: '', role: 'Caissier', active: true, email: '', password: '', pin: '' })
    setModalOpen(true)
  }

  const openEdit = (u: AppUser) => {
    setEditingId(u.id)
    setForm({ name: u.name, phone: u.phone, role: u.role, active: u.active, email: u.email ?? '', password: '', pin: '' })
    setModalOpen(true)
  }

  const saveForm = () => {
    if (!form.name.trim()) {
      toast(t('usr_toast_name_required'), 'error')
      return
    }
    // Champs mot de passe / PIN laissés vides = inchangés. S'ils sont saisis, on hache.
    const data: Partial<AppUser> = { name: form.name, phone: form.phone, role: form.role, active: form.active, email: form.email.trim() || undefined }
    if (form.password.trim()) data.passwordHash = hashSecret(form.password.trim())
    if (form.pin.trim()) data.pinHash = hashSecret(form.pin.trim())
    if (editingId) {
      updateUser(editingId, data)
      toast(`✓ ${form.name} ${t('usr_toast_modified')}`)
    } else {
      addUser({ name: form.name, phone: form.phone, role: form.role, active: form.active, email: data.email, passwordHash: data.passwordHash, pinHash: data.pinHash })
      toast(`✓ ${form.name} ${t('usr_toast_added')}`)
    }
    setModalOpen(false)
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('nav_users_employees')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('usr_subtitle')}</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="h-4 w-4" />
          {t('usr_add')}
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card overflow-hidden">
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
                    <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${ROLE_META[u.role].chip}`}>{t(ROLE_LABEL_KEY[u.role])}</span>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('usr_edit_title') : t('usr_add_title')} maxWidth="max-w-sm">
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

          {/* Identifiants de connexion */}
          <div className="rounded-xl border border-gray-100 p-3 dark:border-white/10">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">{t('auth_credentials')}</p>
            <div className="space-y-3">
              <div>
                <label className="field-label">{t('auth_email')}</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@exemple.com" className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">{t('auth_set_password')}</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••" className="input-field" />
                </div>
                <div>
                  <label className="field-label">{t('auth_set_pin')}</label>
                  <input type="password" inputMode="numeric" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} placeholder="1234" className="input-field" />
                </div>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500">{t('auth_leave_blank')}</p>
            </div>
          </div>

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

export default function UtilisateursEmployesPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
