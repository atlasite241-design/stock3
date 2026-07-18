'use client'

import { useMemo } from 'react'
import { Bell, PackageX, TriangleAlert } from 'lucide-react'
import MobileSubShell from '@/components/MobileSubShell'
import { availableStock, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export default function MobileNotificationsPage() {
  const { products } = useDroguerie()
  const { t } = useLanguage()

  const notifs = useMemo(() => {
    return products
      .filter((p) => availableStock(p) <= p.minStock)
      .sort((a, b) => availableStock(a) - availableStock(b))
      .map((p) => ({ p, out: availableStock(p) <= 0 }))
  }, [products])

  return (
    <MobileSubShell title={t('mob_notif_title')} subtitle={t('mob_notif_subtitle')}>
      {notifs.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300"><Bell className="h-7 w-7" /></span>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('mob_notif_none')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifs.map(({ p, out }) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl m-card p-4 backdrop-blur-xl">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${out ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300'}`}>
                {out ? <PackageX className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{p.name}</p>
                <p className={`text-xs ${out ? 'text-rose-400' : 'text-amber-400'}`}>{out ? t('mob_notif_out') : t('mob_notif_low')} · {availableStock(p)}/{p.minStock}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </MobileSubShell>
  )
}
