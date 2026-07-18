'use client'

import { useMemo, useState } from 'react'
import { PackageCheck } from 'lucide-react'
import MobileSubShell from '@/components/MobileSubShell'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export default function MobileReceptionPage() {
  const { purchases, validateReception } = useDroguerie()
  const { t } = useLanguage()
  const [flash, setFlash] = useState('')

  const pending = useMemo(
    () => purchases.filter((p) => p.status === 'en_attente' || p.status === 'partiellement_recue'),
    [purchases]
  )

  const receiveAll = (id: string) => {
    const po = purchases.find((p) => p.id === id)
    if (!po) return
    const received = po.items
      .map((i) => ({ productId: i.productId, receivedQty: Math.max(0, i.qty - (i.receivedQty ?? 0)), state: 'conforme' as const }))
      .filter((r) => r.receivedQty > 0)
    if (received.length === 0) return
    validateReception(id, received)
    setFlash(t('mob_recep_done'))
    setTimeout(() => setFlash(''), 1800)
  }

  return (
    <MobileSubShell title={t('mob_recep_title')} subtitle={t('mob_recep_subtitle')}>
      {flash && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-center text-sm font-semibold text-emerald-300">{flash}</p>}

      {pending.length === 0 ? (
        <p className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-6 text-center text-sm text-slate-400">{t('mob_recep_none')}</p>
      ) : (
        <div className="space-y-4">
          {pending.map((po) => {
            const ordered = po.items.reduce((a, i) => a + i.qty, 0)
            const received = po.items.reduce((a, i) => a + (i.receivedQty ?? 0), 0)
            return (
              <div key={po.id} className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.08] p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{po.ref}</p>
                    <p className="truncate text-xs text-slate-400">{po.supplierName}</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-sky-300 tabular-nums">{fmtDH(po.total)}</p>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                  <span>{t('mob_recep_ordered')}: <b className="text-slate-200 tabular-nums">{ordered}</b></span>
                  <span>{t('mob_recep_received')}: <b className="text-emerald-300 tabular-nums">{received}</b></span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {po.items.slice(0, 5).map((i) => (
                    <div key={i.productId} className="flex items-center justify-between text-xs">
                      <span className="min-w-0 truncate text-slate-300">{i.name}</span>
                      <span className="shrink-0 tabular-nums text-slate-400">{i.receivedQty ?? 0}/{i.qty}</span>
                    </div>
                  ))}
                  {po.items.length > 5 && <p className="text-[11px] text-slate-500">+{po.items.length - 5}…</p>}
                </div>
                <button
                  onClick={() => receiveAll(po.id)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-500 py-2.5 text-sm font-bold text-slate-900 transition active:scale-[0.98]"
                >
                  <PackageCheck className="h-4 w-4" />{t('mob_recep_all')}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </MobileSubShell>
  )
}
