'use client'

import { motion } from 'framer-motion'
import Loader from '@/components/Loader'
import { ShieldCheck, UserCog } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useDroguerie, type AppUser } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const ROLE_LABEL_KEY: Record<AppUser['role'], TKey> = {
  Administrateur: 'usr_role_admin',
  Gérant: 'usr_role_manager',
  Caissier: 'usr_role_cashier',
  Vendeur: 'usr_role_seller',
}

function Content() {
  const { ready, users, activeStore, activeStoreId, updateUser } = useDroguerie()
  const { t } = useLanguage()

  if (!ready) {
    return <Loader />
  }

  const hasAccess = (u: AppUser) => u.role === 'Administrateur' || (u.storeIds ?? []).includes(activeStoreId)

  const toggle = (u: AppUser) => {
    if (u.role === 'Administrateur') return
    const set = new Set(u.storeIds ?? [])
    if (set.has(activeStoreId)) set.delete(activeStoreId)
    else set.add(activeStoreId)
    updateUser(u.id, { storeIds: [...set] })
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <UserCog className="h-6 w-6 text-amber-500" />
          {t('msu_title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          {t('msu_subtitle')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              <th className="px-5 py-3">{t('usr_col_employee')}</th>
              <th className="px-5 py-3">{t('usr_col_role')}</th>
              <th className="px-5 py-3 text-right">{t('msu_access')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const access = hasAccess(u)
              const isAdmin = u.role === 'Administrateur'
              return (
                <tr key={u.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-gray-900 dark:text-white">{u.name}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">{u.phone}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-700 dark:text-zinc-300">{t(ROLE_LABEL_KEY[u.role])}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-400">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {t('msu_all_stores')}
                        </span>
                      ) : (
                        <button
                          onClick={() => toggle(u)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${access ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-white/15'}`}
                          title={access ? t('msu_has_access') : t('msu_no_access')}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${access ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1'}`} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </motion.div>
    </>
  )
}

export default function StoreUsersPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
