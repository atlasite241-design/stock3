'use client'

// Ossature commune aux 40 écrans RH : en-tête, actions, garde de permission.
// Sans elle, chaque écran réécrirait le même bandeau et la même vérification.

import React from 'react'
import { motion } from 'framer-motion'
import { Lock, type LucideIcon } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import { usePermissions } from '@/lib/access'
import { useLanguage, type TKey } from '@/lib/i18n'
import { useDroguerie } from '@/lib/store'

export function HrHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
}: {
  icon: LucideIcon
  title: TKey
  subtitle?: TKey
  actions?: React.ReactNode
}) {
  const { t } = useLanguage()
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-wrap items-end justify-between gap-4"
    >
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <Icon className="h-6 w-6 text-amber-500" />
          {t(title)}
        </h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">{t(subtitle)}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </motion.div>
  )
}

/**
 * Enveloppe d'écran RH. `perm` est vérifiée ici en plus du masquage du menu :
 * masquer une entrée ne protège rien, l'URL reste tapable.
 */
export default function HrPage({
  icon,
  title,
  subtitle,
  perm,
  actions,
  children,
}: {
  icon: LucideIcon
  title: TKey
  subtitle?: TKey
  perm: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const { ready } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()

  if (!ready) {
    return (
      <AppShell>
        <Loader />
      </AppShell>
    )
  }

  if (!can(perm)) {
    return (
      <AppShell>
        <div className="glass-card flex flex-col items-center gap-3 p-12 text-center">
          <Lock className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
          <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">{t('hr_denied')}</p>
          <p className="max-w-md text-xs text-gray-500 dark:text-zinc-400">{t('hr_denied_sub')}</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <HrHeader icon={icon} title={title} subtitle={subtitle} actions={actions} />
      {children}
    </AppShell>
  )
}

export function HrEmpty({ label }: { label: TKey }) {
  const { t } = useLanguage()
  return <p className="glass-card p-12 text-center text-sm text-gray-500 dark:text-zinc-400">{t(label)}</p>
}

export function HrStats({ cards }: { cards: { label: string; value: string; tone?: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c, i) => (
        <div key={i} className="glass-card p-4">
          <p className={`text-xl font-extrabold tabular-nums ${c.tone ?? 'text-gray-900 dark:text-white'}`}>{c.value}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
            {c.label}
          </p>
        </div>
      ))}
    </div>
  )
}
