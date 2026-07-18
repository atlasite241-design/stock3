'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import MobileSubShell from '@/components/MobileSubShell'
import ProductImage from '@/components/ProductImage'
import { availableStock, fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export default function MobileProduitsPage() {
  const { products } = useDroguerie()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const list = useMemo(
    () => products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q)).slice(0, 100),
    [products, q]
  )

  return (
    <MobileSubShell title={t('mob_prod_title')} subtitle={t('mob_prod_subtitle')}>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('mob_search')}
          className="h-11 w-full rounded-2xl border border-sky-500/20 bg-white/5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-400/60"
        />
      </div>

      <div className="space-y-3">
        {list.map((p) => {
          const avail = availableStock(p)
          const low = avail <= p.minStock
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.08] p-3 backdrop-blur-xl">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-sky-500/20 bg-slate-900/60">
                <ProductImage image={p.image} category={p.category} alt={p.name} fit={p.image ? 'contain' : 'cover'} iconSize="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{p.name}</p>
                <p className="text-xs text-slate-400">{p.category}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-sky-300 tabular-nums">{fmtDH(p.price)}</p>
                <p className={`text-xs tabular-nums ${low ? 'text-rose-400' : 'text-slate-400'}`}>{t('mob_prod_stock')}: {avail}</p>
              </div>
            </div>
          )
        })}
        {list.length === 0 && <p className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-6 text-center text-sm text-slate-400">{t('mob_empty')}</p>}
      </div>
    </MobileSubShell>
  )
}
