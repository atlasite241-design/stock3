'use client'

import { motion } from 'framer-motion'
import Loader from '@/components/Loader'
import { AlertTriangle, Boxes, PackageX, TrendingUp } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { fmtDH, useDroguerie, type Product } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products } = useDroguerie()
  const { t } = useLanguage()

  if (!ready) {
    return <Loader />
  }

  const stockValue = products.reduce((a, p) => a + p.cost * p.stock, 0)
  const outOfStock = products.filter((p) => p.stock === 0).length
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length

  const statusOf = (p: Product) => (p.stock === 0 ? 'out' : p.stock <= p.minStock ? 'low' : 'ok')
  const STATUS_LABEL: Record<string, string> = { ok: t('rpst_status_ok'), low: t('rpst_status_low'), out: t('rpst_status_out') }
  const STATUS_CHIP: Record<string, string> = {
    ok: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    low: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    out: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
  }

  const cards = [
    { label: t('rpst_kpi_value'), value: fmtDH(stockValue), icon: TrendingUp, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
    { label: t('rpst_kpi_products'), value: String(products.length), icon: Boxes, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('rpst_kpi_out_of_stock'), value: String(outOfStock), icon: PackageX, cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' },
    { label: t('rpst_kpi_low_stock'), value: String(lowStock), icon: AlertTriangle, cls: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  ]

  const sorted = [...products].sort((a, b) => a.stock - b.stock)

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('rpst_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('rpst_subtitle')}</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.4 }} className="glass-card glass-card-hover p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.cls}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{c.label}</p>
            <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">{c.value}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('rpst_col_product')}</th>
                <th className="px-5 py-3.5">{t('rpst_col_category')}</th>
                <th className="px-5 py-3.5">{t('rpst_col_stock')}</th>
                <th className="px-5 py-3.5">{t('rpst_col_min')}</th>
                <th className="px-5 py-3.5">{t('rpst_col_value')}</th>
                <th className="px-5 py-3.5">{t('rpst_col_status')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const s = statusOf(p)
                return (
                  <tr key={p.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                    <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white">{p.name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">{p.category}</td>
                    <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{p.stock}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-zinc-400 tabular-nums">{p.minStock}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-zinc-300 tabular-nums">{fmtDH(p.cost * p.stock)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-lg px-2 py-1 text-xs font-bold ${STATUS_CHIP[s]}`}>{STATUS_LABEL[s]}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </>
  )
}

export default function RapportStockPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
