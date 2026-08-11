'use client'

/*
 * GARDE D'ACCÈS PARTAGÉE.
 *
 * Elle vivait uniquement dans AppShell : l'interface mobile n'avait donc
 * AUCUN contrôle de droits, alors que /mobile/caisse encaisse et que
 * /mobile/inventaire modifie le stock. Un compte Vendeur muni d'un téléphone
 * disposait de droits qu'on lui refuse sur l'ordinateur.
 *
 * Extraite ici pour que les deux coquilles appliquent exactement la même
 * règle — une seule implémentation, impossible d'en oublier une.
 */

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { routePermission, usePermissions } from '@/lib/access'
import { useLanguage } from '@/lib/i18n'

export default function AccessGuard({ children, home = '/' }: { children: React.ReactNode; home?: string }) {
  const pathname = usePathname()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const required = routePermission(pathname)
  if (required && !can(required)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-xl font-bold text-gray-900 dark:text-white">{t('acc_denied_title')}</h2>
        <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-zinc-400">{t('acc_denied_desc')}</p>
        <Link href={home} className="btn-primary mt-6">
          {t('acc_back_home')}
        </Link>
      </div>
    )
  }
  return <>{children}</>
}
