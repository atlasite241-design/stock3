'use client'

import { useMemo } from 'react'
import { PackagePlus } from 'lucide-react'
import MobileSubShell from '@/components/MobileSubShell'
import { availableStock, fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export default function MobileReapproPage() {
  const { products } = useDroguerie()
  const { t } = useLanguage()

  const rows = useMemo(() => {
    return products
      .filter((p) => availableStock(p) <= p.minStock)
      .map((p) => {
        // Cible de réappro : ramener au double du stock minimum (au moins 1).
        const target = Math.max(p.minStock * 2, p.minStock + 1)
        const suggest = Math.max(1, target - availableStock(p))
        return { p, suggest, cost: suggest * p.cost }
      })
      .sort((a, b) => b.cost - a.cost)
  }, [products])

  const totalCost = rows.reduce((a, r) => a + r.cost, 0)

  return (
    <MobileSubShell title={t('mob_restock_title')} subtitle={t('mob_restock_subtitle')}>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-6 text-center text-sm text-emerald-400">{t('mob_restock_none')}</p>
      ) : (
        <>
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.08] p-4 backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-400/80">{t('mob_restock_suggest')} · {rows.length}</p>
            <p className="mt-1 text-xl font-bold text-white tabular-nums">{fmtDH(totalCost)}</p>
          </div>
          <div className="space-y-3">
            {rows.map(({ p, suggest, cost }) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.08] p-4 backdrop-blur-xl">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300"><PackagePlus className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{p.name}</p>
                  <p className="text-xs text-slate-400">Stock: {availableStock(p)} · Min: {p.minStock}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-sky-300 tabular-nums">+{suggest}</p>
                  <p className="text-xs text-slate-400 tabular-nums">{fmtDH(cost)}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </MobileSubShell>
  )
}
