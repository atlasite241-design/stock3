'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import MobileShell from '@/components/MobileShell'
import ProductImage from '@/components/ProductImage'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

type Filter = 'all' | 'low' | 'out'

function Content() {
  const { ready, products } = useDroguerie()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const summary = useMemo(() => ({
    refs: products.length,
    value: products.reduce((a, p) => a + p.cost * p.stock, 0),
    out: products.filter((p) => p.stock <= 0).length,
    low: products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length,
  }), [products])

  if (!ready) return <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-400">…</div>

  const q = query.trim().toLowerCase()
  const list = products
    .filter((p) => (filter === 'all' ? true : filter === 'out' ? p.stock <= 0 : p.stock <= p.minStock))
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.category.toLowerCase().includes(q))
    .sort((a, b) => a.stock - b.stock)

  const statusOf = (stock: number, min: number) =>
    stock <= 0 ? { key: t('mob_status_out'), cls: 'bg-rose-500/20 text-rose-400', bar: 'bg-rose-500' } : stock <= min ? { key: t('mob_status_low'), cls: 'bg-amber-500/20 text-amber-400', bar: 'bg-amber-400' } : { key: t('mob_status_ok'), cls: 'bg-emerald-500/20 text-emerald-400', bar: 'bg-emerald-400' }

  const chips: { key: Filter; label: string; count?: number }[] = [
    { key: 'all', label: t('mob_filter_all') },
    { key: 'low', label: t('mob_filter_low'), count: summary.low },
    { key: 'out', label: t('mob_filter_out'), count: summary.out },
  ]

  return (
    <>
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('mob_stock_title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('mob_stock_subtitle')}</p>
      </motion.section>

      {/* Summary */}
      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl m-card p-4 backdrop-blur-xl">
          <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{summary.refs}</p>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('mob_refs')}</p>
        </div>
        <div className="rounded-2xl m-card p-4 backdrop-blur-xl">
          <p className="truncate text-lg font-bold text-slate-900 dark:text-white tabular-nums">{fmtDH(summary.value)}</p>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('mob_stock_value_label')}</p>
        </div>
        <div className="rounded-2xl m-card p-4 backdrop-blur-xl">
          <p className={`text-lg font-bold tabular-nums ${summary.out > 0 ? 'text-rose-400' : 'text-slate-900 dark:text-white'}`}>{summary.out}</p>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('mob_ruptures')}</p>
        </div>
      </section>

      {/* Search */}
      <section className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('mob_search_product')}
          className="h-11 w-full rounded-2xl border border-slate-200 dark:border-sky-500/20 bg-slate-100 dark:bg-white/5 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-400/60"
        />
      </section>

      {/* Filter chips */}
      <section className="-mt-4 flex gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              filter === c.key ? 'bg-sky-500/20 text-sky-300 shadow-[0_0_10px_rgba(14,165,233,0.15)]' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'
            }`}
          >
            {c.label}
            {c.count !== undefined && c.count > 0 && (
              <span className="rounded-full bg-rose-500/80 px-1.5 text-[10px] font-bold text-white">{c.count}</span>
            )}
          </button>
        ))}
      </section>

      {/* Product list */}
      <section className="space-y-3">
        {list.slice(0, 60).map((p) => {
          const st = statusOf(p.stock, p.minStock)
          const pct = Math.min(100, p.minStock > 0 ? (p.stock / (p.minStock * 2)) * 100 : p.stock > 0 ? 100 : 0)
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl m-card p-4 backdrop-blur-xl">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-sky-500/20">
                <ProductImage image={p.image} category={p.category} alt={p.name} fit={p.image ? 'contain' : 'cover'} iconSize="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900 dark:text-white">{p.name}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                    <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400">{t('mob_min')} {p.minStock}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-bold text-slate-900 dark:text-white tabular-nums">{p.stock}</p>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${st.cls}`}>{st.key}</span>
              </div>
            </div>
          )
        })}
        {list.length === 0 && (
          <p className="rounded-2xl m-card p-6 text-center text-sm text-slate-500 dark:text-slate-400">{t('mob_no_products_found')}</p>
        )}
      </section>
    </>
  )
}

export default function MobileStockPage() {
  return (
    <MobileShell>
      <Content />
    </MobileShell>
  )
}
