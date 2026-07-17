'use client'

import { motion } from 'framer-motion'
import AppShell from '@/components/AppShell'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, sales } = useDroguerie()
  const { t } = useLanguage()

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const prodMap = new Map<string, { name: string; category: string; qty: number; revenue: number }>()
  products.forEach((p) => prodMap.set(p.id, { name: p.name, category: p.category, qty: 0, revenue: 0 }))
  sales.forEach((s) =>
    s.items.forEach((i) => {
      const e = prodMap.get(i.productId)
      if (!e) return
      e.qty += i.qty
      e.revenue += i.price * i.qty
    })
  )
  const ranked = Array.from(prodMap.values())
    .filter((p) => p.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 50)

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('rptp_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('rptp_subtitle')}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('rptp_col_rank')}</th>
                <th className="px-5 py-3.5">{t('rptp_col_product')}</th>
                <th className="px-5 py-3.5">{t('rptp_col_category')}</th>
                <th className="px-5 py-3.5">{t('rptp_col_qty')}</th>
                <th className="px-5 py-3.5">{t('rptp_col_revenue')}</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((p, i) => (
                <tr key={p.name} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10 text-xs font-bold text-amber-600 dark:text-amber-400">
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white">{p.name}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">{p.category}</td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{p.qty}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtDH(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </>
  )
}

export default function RapportTopProduitsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
