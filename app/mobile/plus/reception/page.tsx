'use client'

import { useMemo, useState } from 'react'
import { PackageCheck, ScanLine } from 'lucide-react'
import MobileSubShell from '@/components/MobileSubShell'
import CameraScanner from '@/components/CameraScanner'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export default function MobileReceptionPage() {
  const { purchases, validateReception } = useDroguerie()
  const { t } = useLanguage()
  const [flash, setFlash] = useState('')
  const [scanPoId, setScanPoId] = useState('')

  const pending = useMemo(
    () => purchases.filter((p) => p.status === 'en_attente' || p.status === 'partiellement_recue'),
    [purchases]
  )

  const say = (msg: string) => {
    setFlash(msg)
    setTimeout(() => setFlash(''), 1800)
  }

  const receiveAll = (id: string) => {
    const po = purchases.find((p) => p.id === id)
    if (!po) return
    const received = po.items
      .map((i) => ({ productId: i.productId, receivedQty: Math.max(0, i.qty - (i.receivedQty ?? 0)), state: 'conforme' as const }))
      .filter((r) => r.receivedQty > 0)
    if (received.length === 0) return
    validateReception(id, received)
    say(t('mob_recep_done'))
  }

  // Scan d'un colis : réceptionne +1 unité de l'article correspondant dans le bon.
  const onScanReceive = (code: string) => {
    const po = purchases.find((p) => p.id === scanPoId)
    if (!po) return
    const item = po.items.find((i) => i.barcode && i.barcode === code.trim())
    if (!item) return say(t('mob_inv_not_found'))
    if ((item.receivedQty ?? 0) >= item.qty) return say(`${item.name} ✓`)
    validateReception(po.id, [{ productId: item.productId, receivedQty: 1, state: 'conforme' }])
    say(`${item.name} +1`)
  }

  return (
    <MobileSubShell title={t('mob_recep_title')} subtitle={t('mob_recep_subtitle')}>
      {flash && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-center text-sm font-semibold text-emerald-300">{flash}</p>}

      {pending.length === 0 ? (
        <p className="rounded-2xl m-card p-6 text-center text-sm text-slate-500 dark:text-slate-400">{t('mob_recep_none')}</p>
      ) : (
        <div className="space-y-4">
          {pending.map((po) => {
            const ordered = po.items.reduce((a, i) => a + i.qty, 0)
            const received = po.items.reduce((a, i) => a + (i.receivedQty ?? 0), 0)
            return (
              <div key={po.id} className="rounded-2xl m-card p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{po.ref}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{po.supplierName}</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-sky-300 tabular-nums">{fmtDH(po.total)}</p>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span>{t('mob_recep_ordered')}: <b className="text-slate-700 dark:text-slate-200 tabular-nums">{ordered}</b></span>
                  <span>{t('mob_recep_received')}: <b className="text-emerald-300 tabular-nums">{received}</b></span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {po.items.slice(0, 5).map((i) => (
                    <div key={i.productId} className="flex items-center justify-between text-xs">
                      <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">{i.name}</span>
                      <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{i.receivedQty ?? 0}/{i.qty}</span>
                    </div>
                  ))}
                  {po.items.length > 5 && <p className="text-[11px] text-slate-500">+{po.items.length - 5}…</p>}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setScanPoId(po.id)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 py-2.5 text-sm font-bold text-sky-600 dark:text-sky-300 transition active:scale-[0.98]"
                  >
                    <ScanLine className="h-4 w-4" />{t('mob_scan')}
                  </button>
                  <button
                    onClick={() => receiveAll(po.id)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-500 py-2.5 text-sm font-bold text-slate-900 transition active:scale-[0.98]"
                  >
                    <PackageCheck className="h-4 w-4" />{t('mob_recep_all')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CameraScanner open={!!scanPoId} onClose={() => setScanPoId('')} onDetect={onScanReceive} />
    </MobileSubShell>
  )
}
