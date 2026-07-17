'use client'

import { motion } from 'framer-motion'
import { Check, ShieldCheck, X } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useDroguerie, type AppUser } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const ROLES: AppUser['role'][] = ['Administrateur', 'Gérant', 'Caissier', 'Vendeur']
const ROLE_LABEL_KEY: Record<AppUser['role'], TKey> = {
  Administrateur: 'usr_role_admin',
  Gérant: 'usr_role_manager',
  Caissier: 'usr_role_cashier',
  Vendeur: 'usr_role_seller',
}
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
  const { ready } = useDroguerie()
  const { t } = useLanguage()

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('nav_users_permissions')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('usr_permissions_desc')}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card overflow-hidden">
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
                <tr key={perm.key} className="border-b border-gray-50 dark:border-white/5">
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
