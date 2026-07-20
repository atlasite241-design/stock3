'use client'

import { motion } from 'framer-motion'
import Loader from '@/components/Loader'
import { ShieldCheck } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useDroguerie, type AppUser } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const ROLES: AppUser['role'][] = ['Administrateur', 'Gérant', 'Magasinier', 'Caissier', 'Vendeur']
const ROLE_LABEL_KEY: Record<AppUser['role'], TKey> = {
  Administrateur: 'usr_role_admin',
  Gérant: 'usr_role_manager',
  Magasinier: 'usr_role_stockman',
  Caissier: 'usr_role_cashier',
  Vendeur: 'usr_role_seller',
}
const ROLE_META: Record<AppUser['role'], { chip: string; icon: string }> = {
  Administrateur: { chip: 'border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400', icon: 'bg-violet-50 dark:bg-violet-500/10 text-violet-500' },
  Gérant: { chip: 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', icon: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500' },
  Magasinier: { chip: 'border-orange-200 dark:border-orange-500/20 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400', icon: 'bg-orange-50 dark:bg-orange-500/10 text-orange-500' },
  Caissier: { chip: 'border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/10 text-sky-700', icon: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500' },
  Vendeur: { chip: 'border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300', icon: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
}
const PERMISSION_KEYS = ['pos', 'produits', 'stock', 'achats', 'rapports', 'caisse', 'parametres']
const ROLE_PERMS: Record<AppUser['role'], string[]> = {
  Administrateur: PERMISSION_KEYS,
  Gérant: ['pos', 'produits', 'stock', 'achats', 'rapports', 'caisse'],
  Magasinier: ['produits', 'stock', 'achats'],
  Caissier: ['pos', 'caisse', 'stock'],
  Vendeur: ['pos', 'produits'],
}

function Content() {
  const { ready, users } = useDroguerie()
  const { t } = useLanguage()

  if (!ready) {
    return <Loader />
  }

  const countByRole = (r: AppUser['role']) => users.filter((u) => u.role === r).length

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('usr_roles_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('usr_roles_subtitle')}</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
        {ROLES.map((r, i) => (
          <motion.div key={r} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.4 }} className="glass-card glass-card-hover p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${ROLE_META[r].icon}`}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="mt-4 text-base font-semibold text-gray-900 dark:text-white">{t(ROLE_LABEL_KEY[r])}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
              {countByRole(r)} {t('usr_roles_col_users').toLowerCase()} · {ROLE_PERMS[r].length}/{PERMISSION_KEYS.length} {t('usr_roles_col_permissions').toLowerCase()}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('usr_roles_col_role')}</th>
                <th className="px-5 py-3.5">{t('usr_roles_col_users')}</th>
                <th className="px-5 py-3.5">{t('usr_roles_col_permissions')}</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5">
                    <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${ROLE_META[r].chip}`}>{t(ROLE_LABEL_KEY[r])}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{countByRole(r)}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">
                    {ROLE_PERMS[r].length}/{PERMISSION_KEYS.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </>
  )
}

export default function UtilisateursRolesPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
