'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Boxes, Building2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Select from '@/components/Select'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, stores, allProducts } = useDroguerie()
  const { t } = useLanguage()
  const [filter, setFilter] = useState('all')

  const perStore = useMemo(
    () =>
      stores.map((s) => {
        const prods = allProducts.filter((p) => p.storeId === s.id)
        return {
          store: s,
          count: prods.length,
          value: prods.reduce((a, p) => a + p.cost * p.stock, 0),
          outOfStock: prods.filter((p) => p.stock <= 0).length,
          products: prods,
        }
      }),
    [stores, allProducts]
  )

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const rows = perStore
    .filter((ps) => filter === 'all' || ps.store.id === filter)
    .flatMap((ps) => ps.products.map((p) => ({ store: ps.store, product: p })))
    .sort((a, b) => a.store.name.localeCompare(b.store.name) || a.product.name.localeCompare(b.product.name))

  const grandTotal = rows.reduce((a, r) => a + r.product.cost * r.product.stock, 0)

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Boxes className="h-6 w-6 text-amber-500" />
            {t('sbs_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('sbs_subtitle')}</p>
        </div>
        <Select
          className="w-56"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: t('mag_all_stores') }, ...stores.map((s) => ({ value: s.id, label: s.name }))]}
        />
      </motion.div>

      {/* Per-store summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {perStore
          .filter((ps) => filter === 'all' || ps.store.id === filter)
          .map((ps, i) => (
            <motion.div
              key={ps.store.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.35 }}
              className="glass-card p-5"
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-amber-500" />
                <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">{ps.store.name}</h3>
              </div>
              <p className="mt-3 text-2xl font-black text-gray-900 dark:text-white tabular-nums">{fmtDH(ps.value)}</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{t('sbs_total_value')}</p>
              <div className="mt-3 flex gap-4 text-xs">
                <span className="text-gray-600 dark:text-zinc-400">{ps.count} {t('sbs_references')}</span>
                {ps.outOfStock > 0 && <span className="font-semibold text-rose-500">{ps.outOfStock} {t('sbs_out_of_stock')}</span>}
              </div>
            </motion.div>
          ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3">{t('sbs_col_product')}</th>
                <th className="px-5 py-3">{t('mag_col_store')}</th>
                <th className="px-5 py-3 text-right">{t('sbs_col_stock')}</th>
                <th className="px-5 py-3 text-right">{t('sbs_col_value')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.store.id + r.product.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-5 py-2.5 font-medium text-gray-900 dark:text-white">{r.product.name}</td>
                  <td className="px-5 py-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                      <Building2 className="h-3 w-3 text-amber-500" />
                      {r.store.name}
                    </span>
                  </td>
                  <td className={`px-5 py-2.5 text-right font-semibold tabular-nums ${r.product.stock <= 0 ? 'text-rose-500' : r.product.stock <= r.product.minStock ? 'text-amber-500' : 'text-gray-900 dark:text-white'}`}>
                    {r.product.stock}
                  </td>
                  <td className="px-5 py-2.5 text-right font-semibold text-gray-700 dark:text-zinc-300 tabular-nums">{fmtDH(r.product.cost * r.product.stock)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-xs text-gray-400 dark:text-zinc-500">{t('mag_none')}</td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-100 bg-amber-50 dark:border-white/10 dark:bg-amber-500/10">
                  <td colSpan={3} className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white">{t('sbs_total_value')}</td>
                  <td className="px-5 py-3 text-right text-base font-black text-gray-900 dark:text-white tabular-nums">{fmtDH(grandTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </motion.div>
    </>
  )
}

export default function StockParMagasinPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
