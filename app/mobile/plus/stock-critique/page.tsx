'use client'

import { useMemo } from 'react'
import { TriangleAlert } from 'lucide-react'
import MobileSubShell from '@/components/MobileSubShell'
import { availableStock, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export default function MobileStockCritiquePage() {
  const { products } = useDroguerie()
  const { t } = useLanguage()

  const { out, low } = useMemo(() => {
    const crit = products
      .filter((p) => availableStock(p) <= p.minStock)
      .sort((a, b) => availableStock(a) - availableStock(b))
    return {
      out: crit.filter((p) => availableStock(p) <= 0),
      low: crit.filter((p) => availableStock(p) > 0),
    }
  }, [products])

  const Row = ({ p, critical }: { p: (typeof products)[number]; critical: boolean }) => (
    <div className={`flex items-center justify-between rounded-2xl m-card p-4 backdrop-blur-xl ${critical ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-amber-500'}`}>
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900 dark:text-white">{p.name}</p>
        <p className={`mt-0.5 text-xs ${critical ? 'text-rose-400' : 'text-amber-400'}`}>Stock: {availableStock(p)} · Min: {p.minStock}</p>
      </div>
      <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase ${critical ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
        {critical ? t('mob_crit_out') : t('mob_crit_low')}
      </span>
    </div>
  )

  return (
    <MobileSubShell title={t('mob_crit_title')} subtitle={t('mob_crit_subtitle')}>
      {out.length === 0 && low.length === 0 && (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-6 text-center text-sm text-emerald-400">{t('mob_crit_none')}</p>
      )}
      {out.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-rose-400/90"><TriangleAlert className="h-4 w-4" />{t('mob_crit_out')} · {out.length}</h3>
          {out.map((p) => <Row key={p.id} p={p} critical />)}
        </section>
      )}
      {low.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">{t('mob_crit_low')} · {low.length}</h3>
          {low.map((p) => <Row key={p.id} p={p} critical={false} />)}
        </section>
      )}
    </MobileSubShell>
  )
}
