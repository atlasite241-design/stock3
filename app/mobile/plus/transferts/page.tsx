'use client'

import { useMemo, useState } from 'react'
import { ArrowLeftRight, ArrowRight, PackageCheck } from 'lucide-react'
import MobileSubShell from '@/components/MobileSubShell'
import { useDroguerie } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { useLanguage } from '@/lib/i18n'

export default function MobileTransfertsPage() {
  const { transfers, stores, activeStoreId, receiveTransfer } = useDroguerie()
  const { currentUser, session } = useAuth()
  const { t } = useLanguage()
  const [flash, setFlash] = useState('')

  const who = currentUser?.name ?? session?.name ?? 'Gérant'
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? '—'

  const incoming = useMemo(
    () => transfers.filter((tr) => tr.destStoreId === activeStoreId && tr.status === 'expedie'),
    [transfers, activeStoreId]
  )
  const others = useMemo(
    () => transfers
      .filter((tr) => (tr.destStoreId === activeStoreId || tr.sourceStoreId === activeStoreId) && tr.status !== 'expedie')
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 15),
    [transfers, activeStoreId]
  )

  const receive = (id: string) => {
    const tr = transfers.find((x) => x.id === id)
    if (!tr) return
    const received = tr.items.map((i) => ({ productId: i.productId, receivedQty: i.transferredQty }))
    const res = receiveTransfer(id, received, who, '')
    if (res.ok) {
      setFlash(t('mob_tr_received'))
      setTimeout(() => setFlash(''), 1800)
    }
  }

  return (
    <MobileSubShell title={t('mob_tr_title')} subtitle={t('mob_tr_subtitle')}>
      {flash && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-center text-sm font-semibold text-emerald-300">{flash}</p>}

      {incoming.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-amber-400/80">{t('mob_tr_incoming')} · {incoming.length}</h3>
          {incoming.map((tr) => (
            <div key={tr.id} className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.1] p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{tr.ref}</p>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">{tr.items.length} réf.</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="truncate">{storeName(tr.sourceStoreId)}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span className="truncate font-semibold text-slate-900 dark:text-white">{storeName(tr.destStoreId)}</span>
              </div>
              <button
                onClick={() => receive(tr.id)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-2.5 text-sm font-bold text-slate-900 transition active:scale-[0.98]"
              >
                <PackageCheck className="h-4 w-4" />{t('mob_tr_receive')}
              </button>
            </div>
          ))}
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('mob_tr_title')}</h3>
          {others.map((tr) => (
            <div key={tr.id} className="flex items-center gap-3 rounded-2xl m-card p-4 backdrop-blur-xl">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300"><ArrowLeftRight className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{tr.ref}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{storeName(tr.sourceStoreId)} → {storeName(tr.destStoreId)}</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-200 dark:bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">{tr.status}</span>
            </div>
          ))}
        </section>
      )}

      {incoming.length === 0 && others.length === 0 && (
        <p className="rounded-2xl m-card p-6 text-center text-sm text-slate-500 dark:text-slate-400">{t('mob_tr_none')}</p>
      )}
    </MobileSubShell>
  )
}
