'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Boxes, Minus, PackageX, Plus, TrendingUp, Truck } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { fmtDH, useDroguerie, type Product } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

type Filter = 'tous' | 'faible' | 'rupture'

function StockContent() {
  const { ready, products, adjustStock } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('tous')
  const [restockTarget, setRestockTarget] = useState<Product | null>(null)
  const [restockQty, setRestockQty] = useState('10')

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.minStock)
  const outOfStock = products.filter((p) => p.stock === 0)
  const stockValue = products.reduce((a, p) => a + p.cost * p.stock, 0)

  const cards = [
    { label: t('stock_catalog_products'), value: String(products.length), icon: Boxes, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('stock_value'), value: fmtDH(stockValue), icon: TrendingUp, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
    { label: t('stock_low'), value: String(lowStock.length), icon: AlertTriangle, cls: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
    { label: t('stock_out_of_stock'), value: String(outOfStock.length), icon: PackageX, cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' },
  ]

  const filters: { key: Filter; label: string }[] = [
    { key: 'tous', label: `${t('stock_filter_all')} (${products.length})` },
    { key: 'faible', label: `${t('stock_filter_low')} (${lowStock.length})` },
    { key: 'rupture', label: `${t('stock_filter_ruptures')} (${outOfStock.length})` },
  ]

  const visible = [...products]
    .filter((p) =>
      filter === 'faible' ? p.stock > 0 && p.stock <= p.minStock : filter === 'rupture' ? p.stock === 0 : true
    )
    .sort((a, b) => a.stock - b.stock)

  const statut = (p: Product) =>
    p.stock === 0
      ? { label: t('stock_status_out'), cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20' }
      : p.stock <= p.minStock
        ? { label: t('stock_status_low'), cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' }
        : { label: t('stock_status_ok'), cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' }

  const confirmRestock = () => {
    if (!restockTarget) return
    const qty = Math.max(1, Math.round(parseFloat(restockQty.replace(',', '.')) || 0))
    adjustStock(restockTarget.id, qty)
    toast(`✓ ${restockTarget.name} : +${qty} ${t('stock_toast_restocked')}`)
    setRestockTarget(null)
    setRestockQty('10')
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('stock_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('stock_subtitle')}</p>
      </motion.div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.4 }}
            className="glass-card glass-card-hover p-5"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.cls}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{c.label}</p>
            <p className="mt-1 text-[24px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
              {c.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              filter === f.key
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-lg shadow-amber-400/25'
                : 'border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 hover:border-amber-300 hover:bg-amber-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('stock_col_product')}</th>
                <th className="px-5 py-3.5">{t('stock_col_level')}</th>
                <th className="px-5 py-3.5">{t('stock_col_status')}</th>
                <th className="px-5 py-3.5">{t('stock_col_adjust')}</th>
                <th className="px-5 py-3.5 text-right">{t('stock_col_restock')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const s = statut(p)
                return (
                  <tr key={p.id} className="border-b border-gray-50 transition-colors hover:bg-amber-50/40">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500">{p.category}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                          <div
                            className={`h-full rounded-full ${
                              p.stock === 0
                                ? 'bg-rose-500'
                                : p.stock <= p.minStock
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, (p.stock / (p.minStock * 3 || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{p.stock}</span>
                        <span className="text-xs text-gray-400 dark:text-zinc-500 tabular-nums">{t('stock_min_abbr')} {p.minStock}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${s.cls}`}>{s.label}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => adjustStock(p.id, -1)}
                          disabled={p.stock === 0}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => adjustStock(p.id, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setRestockTarget(p)}
                        className="btn-secondary !h-8 !px-3 text-xs"
                      >
                        <Truck className="h-3.5 w-3.5" />
                        {t('stock_restock_btn')}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('stock_no_products_in_filter')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Restock modal */}
      <Modal
        open={!!restockTarget}
        onClose={() => setRestockTarget(null)}
        title={t('stock_restock_title')}
        maxWidth="max-w-sm"
      >
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <span className="font-semibold text-gray-900 dark:text-white">{restockTarget?.name}</span> — {t('stock_current_stock')}{' '}
          <span className="font-bold tabular-nums">{restockTarget?.stock}</span>
        </p>
        <div className="mt-4">
          <label className="field-label">{t('stock_qty_to_add')}</label>
          <input
            type="number"
            min="1"
            value={restockQty}
            onChange={(e) => setRestockQty(e.target.value)}
            className="input-field"
            autoFocus
          />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setRestockTarget(null)} className="btn-secondary">
            {t('stock_cancel')}
          </button>
          <button onClick={confirmRestock} className="btn-primary">
            <Truck className="h-4 w-4" />
            {t('stock_add')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function StockPage() {
  return (
    <AppShell>
      <StockContent />
    </AppShell>
  )
}
