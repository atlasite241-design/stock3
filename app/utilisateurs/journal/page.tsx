'use client'

import { motion } from 'framer-motion'
import Loader from '@/components/Loader'
import { UserCog } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, activity } = useDroguerie()
  const { t } = useLanguage()

  if (!ready) {
    return <Loader />
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('nav_users_journal')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('usr_activity_desc')}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card p-6">
        <div className="space-y-1">
          {activity.slice(0, 100).map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-amber-50/50 dark:hover:bg-white/5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-zinc-400">
                <UserCog className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {a.action}
                  {a.target ? <span className="text-amber-600 dark:text-amber-400"> — {a.target}</span> : null}
                </p>
                {(a.oldValue || a.newValue) && (
                  <p className="mt-0.5 text-xs tabular-nums">
                    <span className="text-rose-500 line-through dark:text-rose-400">{a.oldValue}</span>
                    <span className="mx-1.5 text-gray-400">→</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{a.newValue}</span>
                  </p>
                )}
                <p className="mt-0.5 text-xs text-gray-400 dark:text-zinc-500">
                  {a.user}
                  {a.storeName ? <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-white/10 dark:text-zinc-400">{a.storeName}</span> : null}
                </p>
              </div>
              <span className="shrink-0 pt-0.5 text-[11px] text-gray-400 dark:text-zinc-500 tabular-nums">
                {new Date(a.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
                {new Date(a.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          {activity.length === 0 && <p className="py-6 text-center text-sm text-gray-400 dark:text-zinc-500">{t('usr_no_activity')}</p>}
        </div>
      </motion.div>
    </>
  )
}

export default function UtilisateursJournalPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
