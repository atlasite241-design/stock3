'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Loader from '@/components/Loader'
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Briefcase,
  CheckSquare,
  ClipboardList,
  Package,
  Save,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Square,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useToast } from '@/components/Toast'
import { useDroguerie } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'
import {
  ALL_PERMISSION_KEYS,
  LOCKED_ADMIN_PERMISSIONS,
  PERMISSION_CATALOG,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_NAMES,
  type Lang,
  type RoleName,
} from '@/lib/permissions'

const ROLE_LABEL_KEY: Record<RoleName, TKey> = {
  Administrateur: 'usr_role_admin',
  Gérant: 'usr_role_manager',
  Magasinier: 'usr_role_stockman',
  Caissier: 'usr_role_cashier',
  Vendeur: 'usr_role_seller',
}
const ROLE_DESC_KEY: Record<RoleName, TKey> = {
  Administrateur: 'perm_role_desc_admin',
  Gérant: 'perm_role_desc_manager',
  Magasinier: 'perm_role_desc_stockman',
  Caissier: 'perm_role_desc_cashier',
  Vendeur: 'perm_role_desc_seller',
}
const ROLE_ICON: Record<RoleName, LucideIcon> = {
  Administrateur: ShieldCheck,
  Gérant: Briefcase,
  Magasinier: Boxes,
  Caissier: Wallet,
  Vendeur: ShoppingCart,
}
const CATEGORY_ICON: Record<string, LucideIcon> = {
  Package, ShoppingCart, Wallet, Users, Truck, ClipboardList, Boxes, BarChart3, Settings,
}

function Content() {
  const { ready, users, settings, saveSettings, logActivity } = useDroguerie()
  const { t, lang } = useLanguage()
  const toast = useToast()

  const [selectedRole, setSelectedRole] = useState<RoleName>('Administrateur')
  const [draft, setDraft] = useState<Record<string, string[]>>(ROLE_DEFAULT_PERMISSIONS)

  const saved = useMemo<Record<string, string[]>>(
    () => ({ ...ROLE_DEFAULT_PERMISSIONS, ...(settings.rolePermissions ?? {}) }),
    [settings.rolePermissions]
  )

  useEffect(() => {
    if (ready) setDraft(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, settings.rolePermissions])

  if (!ready) {
    return <Loader />
  }

  const current = new Set(draft[selectedRole] ?? [])
  const isLocked = (key: string) => selectedRole === 'Administrateur' && LOCKED_ADMIN_PERMISSIONS.includes(key)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const activeCount = current.size

  const setRolePerms = (keys: Set<string>) => {
    // conserve l'ordre du catalogue + verrous admin
    LOCKED_ADMIN_PERMISSIONS.forEach((k) => { if (selectedRole === 'Administrateur') keys.add(k) })
    setDraft((d) => ({ ...d, [selectedRole]: ALL_PERMISSION_KEYS.filter((k) => keys.has(k)) }))
  }

  const toggle = (key: string) => {
    if (isLocked(key)) return
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setRolePerms(next)
  }

  const selectAll = () => setRolePerms(new Set(ALL_PERMISSION_KEYS))
  const deselectAll = () => setRolePerms(new Set(selectedRole === 'Administrateur' ? LOCKED_ADMIN_PERMISSIONS : []))

  const toggleCategory = (catKey: string) => {
    const catPerms = PERMISSION_CATALOG.find((c) => c.key === catKey)?.perms.map((p) => p.key) ?? []
    const allOn = catPerms.every((k) => current.has(k))
    const next = new Set(current)
    catPerms.forEach((k) => { if (allOn) { if (!isLocked(k)) next.delete(k) } else next.add(k) })
    setRolePerms(next)
  }

  const save = () => {
    const before = (saved[selectedRole] ?? []).length
    const after = (draft[selectedRole] ?? []).length
    saveSettings({ ...settings, rolePermissions: draft })
    logActivity(t('perm_audit_role'), { target: t(ROLE_LABEL_KEY[selectedRole]), oldValue: `${before} ${t('perm_count_active')}`, newValue: `${after} ${t('perm_count_active')}` })
    toast(`✓ ${t('perm_saved')}`)
  }
  const cancel = () => setDraft(saved)
  const userCount = (role: RoleName) => users.filter((u) => u.role === role).length

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('perm_roles_title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('perm_roles_subtitle')}</p>
      </motion.div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Rôles */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="space-y-3 lg:col-span-4">
          <h3 className="px-1 text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">{t('perm_available_roles')}</h3>
          {ROLE_NAMES.map((r) => {
            const Icon = ROLE_ICON[r]
            const active = r === selectedRole
            return (
              <button
                key={r}
                onClick={() => setSelectedRole(r)}
                className={`w-full rounded-2xl p-5 text-left transition ${
                  active
                    ? 'glass-card border-l-4 border-amber-500 shadow-sm'
                    : 'border border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/5 hover:border-amber-200 dark:hover:border-amber-500/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">{t(ROLE_LABEL_KEY[r])}</h4>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t(ROLE_DESC_KEY[r])}</p>
                  </div>
                  <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-amber-500' : 'text-gray-400 dark:text-zinc-500'}`} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    {userCount(r)} {t('perm_users_suffix')}
                  </span>
                  <span className="rounded-md bg-gray-100 dark:bg-white/10 px-2 py-1 text-[10px] font-bold text-gray-500 dark:text-zinc-400 tabular-nums">
                    {(draft[r] ?? []).length}/{ALL_PERMISSION_KEYS.length}
                  </span>
                </div>
              </button>
            )
          })}
        </motion.div>

        {/* Permissions */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card p-6 lg:col-span-8 sm:p-8">
          <div className="mb-6 flex flex-col gap-4 border-b border-gray-100 dark:border-white/10 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('perm_config')}</span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{t('perm_for')} : {t(ROLE_LABEL_KEY[selectedRole])}</h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400 tabular-nums">{activeCount} / {ALL_PERMISSION_KEYS.length} {t('perm_count_active')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={selectAll} className="btn-secondary !h-9 text-xs">
                  <CheckSquare className="h-3.5 w-3.5" />
                  {t('perm_select_all')}
                </button>
                <button onClick={deselectAll} className="btn-secondary !h-9 text-xs">
                  <Square className="h-3.5 w-3.5" />
                  {t('perm_deselect_all')}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={cancel} disabled={!dirty} className="btn-secondary disabled:opacity-40">
                <X className="h-4 w-4" />
                {t('perm_cancel')}
              </button>
              <button onClick={save} disabled={!dirty} className="btn-primary disabled:opacity-40">
                <Save className="h-4 w-4" />
                {t('perm_save')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {PERMISSION_CATALOG.map((catg) => {
              const CatIcon = CATEGORY_ICON[catg.icon] ?? Package
              const allOn = catg.perms.every((p) => current.has(p.key))
              return (
                <div key={catg.key} className="space-y-3.5 rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50/40 dark:bg-white/5 p-5">
                  <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <CatIcon className="h-4 w-4 text-amber-500" />
                      <h5 className="text-sm font-bold text-gray-900 dark:text-white">{catg[lang as Lang]}</h5>
                    </div>
                    <button
                      onClick={() => toggleCategory(catg.key)}
                      className="text-[11px] font-semibold text-amber-600 hover:underline dark:text-amber-400"
                    >
                      {allOn ? t('perm_deselect_all') : t('perm_select_all')}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {catg.perms.map((perm) => {
                      const on = current.has(perm.key)
                      const locked = isLocked(perm.key)
                      return (
                        <div key={perm.key} className={`flex items-center justify-between gap-3 ${locked ? 'opacity-70' : ''}`}>
                          <span className="text-sm text-gray-700 dark:text-zinc-300">{perm[lang as Lang]}</span>
                          <button
                            onClick={() => toggle(perm.key)}
                            disabled={locked}
                            aria-pressed={on}
                            title={locked ? t('perm_sensitive_title') : undefined}
                            className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${
                              on ? 'bg-amber-500' : 'bg-gray-300 dark:bg-white/15'
                            } ${locked ? 'cursor-not-allowed' : ''}`}
                          >
                            <span className={`absolute top-1 h-3 w-3 rounded-full bg-white shadow-sm transition-all ${on ? 'right-1' : 'left-1'}`} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {selectedRole === 'Administrateur' && (
            <div className="mt-6 flex gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500 dark:text-rose-400" />
              <div>
                <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{t('perm_sensitive_title')}</p>
                <p className="text-xs text-gray-600 dark:text-zinc-400">{t('perm_sensitive_desc')}</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </>
  )
}

export default function UtilisateursPermissionsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
