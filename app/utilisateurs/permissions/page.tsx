'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Loader from '@/components/Loader'
import { AlertTriangle, BarChart3, Boxes, Briefcase, Save, Settings, ShieldCheck, ShoppingCart, Wallet, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useToast } from '@/components/Toast'
import { useDroguerie, type AppUser } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const ROLES: AppUser['role'][] = ['Administrateur', 'Gérant', 'Caissier', 'Vendeur']
const ROLE_LABEL_KEY: Record<AppUser['role'], TKey> = {
  Administrateur: 'usr_role_admin',
  Gérant: 'usr_role_manager',
  Caissier: 'usr_role_cashier',
  Vendeur: 'usr_role_seller',
}
const ROLE_DESC_KEY: Record<AppUser['role'], TKey> = {
  Administrateur: 'perm_role_desc_admin',
  Gérant: 'perm_role_desc_manager',
  Caissier: 'perm_role_desc_cashier',
  Vendeur: 'perm_role_desc_seller',
}
const ROLE_ICON: Record<AppUser['role'], LucideIcon> = {
  Administrateur: ShieldCheck,
  Gérant: Briefcase,
  Caissier: Wallet,
  Vendeur: ShoppingCart,
}

// Modules regroupant les 7 permissions de l'app.
const MODULES: { titleKey: TKey; icon: LucideIcon; perms: { key: string; labelKey: TKey }[] }[] = [
  { titleKey: 'perm_module_sales', icon: Wallet, perms: [{ key: 'pos', labelKey: 'usr_perm_pos' }, { key: 'caisse', labelKey: 'usr_perm_register' }] },
  { titleKey: 'perm_module_stock', icon: Boxes, perms: [{ key: 'produits', labelKey: 'usr_perm_products' }, { key: 'stock', labelKey: 'usr_perm_stock' }] },
  { titleKey: 'perm_module_purchases', icon: BarChart3, perms: [{ key: 'achats', labelKey: 'usr_perm_purchases' }, { key: 'rapports', labelKey: 'usr_perm_reports' }] },
  { titleKey: 'perm_module_admin', icon: Settings, perms: [{ key: 'parametres', labelKey: 'usr_perm_settings' }] },
]
const ALL_PERMS = MODULES.flatMap((m) => m.perms.map((p) => p.key))

// Permissions par défaut si aucun réglage sauvegardé.
const DEFAULT_ROLE_PERMS: Record<AppUser['role'], string[]> = {
  Administrateur: ALL_PERMS,
  Gérant: ['pos', 'produits', 'stock', 'achats', 'rapports', 'caisse'],
  Caissier: ['pos', 'caisse', 'stock'],
  Vendeur: ['pos', 'produits'],
}

// L'Administrateur garde toujours ces accès (anti-verrouillage).
const LOCKED_ADMIN = ['parametres']

function Content() {
  const { ready, users, settings, saveSettings } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [selectedRole, setSelectedRole] = useState<AppUser['role']>('Administrateur')
  const [draft, setDraft] = useState<Record<string, string[]>>(DEFAULT_ROLE_PERMS)

  const saved = useMemo<Record<string, string[]>>(
    () => ({ ...DEFAULT_ROLE_PERMS, ...(settings.rolePermissions ?? {}) }),
    [settings.rolePermissions]
  )

  useEffect(() => {
    if (ready) setDraft(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, settings.rolePermissions])

  if (!ready) {
    return <Loader />
  }

  const rolePerms = draft[selectedRole] ?? []
  const isLocked = (permKey: string) => selectedRole === 'Administrateur' && LOCKED_ADMIN.includes(permKey)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  const toggle = (permKey: string) => {
    if (isLocked(permKey)) return
    setDraft((d) => {
      const cur = new Set(d[selectedRole] ?? [])
      if (cur.has(permKey)) cur.delete(permKey)
      else cur.add(permKey)
      return { ...d, [selectedRole]: ALL_PERMS.filter((k) => cur.has(k)) }
    })
  }

  const save = () => {
    saveSettings({ ...settings, rolePermissions: draft })
    toast(`✓ ${t('perm_saved')}`)
  }
  const cancel = () => setDraft(saved)

  const userCount = (role: AppUser['role']) => users.filter((u) => u.role === role).length

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('perm_roles_title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('perm_roles_subtitle')}</p>
      </motion.div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Colonne gauche : rôles */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="space-y-3 lg:col-span-4">
          <h3 className="px-1 text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">{t('perm_available_roles')}</h3>
          {ROLES.map((r) => {
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
                <div className="mt-3">
                  <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    {userCount(r)} {t('perm_users_suffix')}
                  </span>
                </div>
              </button>
            )
          })}
        </motion.div>

        {/* Colonne droite : permissions du rôle sélectionné */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card p-6 lg:col-span-8 sm:p-8">
          <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('perm_config')}</span>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{t('perm_for')} : {t(ROLE_LABEL_KEY[selectedRole])}</h3>
            </div>
            <div className="flex gap-3">
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
            {MODULES.map((mod) => {
              const ModIcon = mod.icon
              return (
                <div key={mod.titleKey} className="space-y-4 rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50/40 dark:bg-white/5 p-5">
                  <div className="flex items-center gap-2 border-b border-gray-100 dark:border-white/10 pb-2">
                    <ModIcon className="h-4 w-4 text-amber-500" />
                    <h5 className="text-sm font-bold text-gray-900 dark:text-white">{t(mod.titleKey)}</h5>
                  </div>
                  <div className="space-y-3.5">
                    {mod.perms.map((perm) => {
                      const on = rolePerms.includes(perm.key)
                      const locked = isLocked(perm.key)
                      return (
                        <div key={perm.key} className={`flex items-center justify-between ${locked ? 'opacity-70' : ''}`}>
                          <span className="text-sm text-gray-700 dark:text-zinc-300">{t(perm.labelKey)}</span>
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
