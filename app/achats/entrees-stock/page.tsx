'use client'

import { useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Boxes, Hash, TrendingUp } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Select from '@/components/Select'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

type Period = '7j' | '30j' | 'tout'

function Content() {
  const { ready, movements, purchases, suppliers } = useDroguerie()
  const { t } = useLanguage()
  const [period, setPeriod] = useState<Period>('30j')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [productQuery, setProductQuery] = useState('')

  if (!ready) {
    return <Loader />
  }

  const now = new Date()
  const cutoff = (days: number) => {
    const d = new Date()
    d.setDate(now.getDate() - days)
    return d
  }

  const findPurchase = (note: string) => purchases.find((p) => note.startsWith(p.ref))
  const findItem = (note: string, productId: string) => findPurchase(note)?.items.find((i) => i.productId === productId)

  const rows = movements
    .filter((m) => m.type === 'entree' || m.type === 'reception')
    .filter((m) => period === 'tout' || new Date(m.date) >= cutoff(period === '7j' ? 6 : 29))
    .map((m) => {
      const po = findPurchase(m.note)
      const item = findItem(m.note, m.productId)
      const cost = item?.cost ?? 0
      return {
        id: m.id,
        date: m.date,
        ref: po?.ref ?? m.note,
        productName: m.productName,
        supplierName: po?.supplierName ?? '—',
        supplierId: po?.supplierId ?? '',
        qty: m.qty,
        cost,
        value: cost * m.qty,
      }
    })
    .filter((r) => !supplierFilter || r.supplierId === supplierFilter)
    .filter((r) => !productQuery.trim() || r.productName.toLowerCase().includes(productQuery.trim().toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date))

  const totalQty = rows.reduce((a, r) => a + r.qty, 0)
  const totalValue = rows.reduce((a, r) => a + r.value, 0)

  const cards = [
    { label: t('pes_kpi_entries'), value: String(rows.length), icon: Hash, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('pes_kpi_qty'), value: String(totalQty), icon: Boxes, cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400' },
    { label: t('pes_kpi_value'), value: fmtDH(totalValue), icon: TrendingUp, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
  ]

  const periods: { key: Period; label: string }[] = [
    { key: '7j', label: t('rp_period_7d') },
    { key: '30j', label: t('rp_period_30d') },
    { key: 'tout', label: t('rp_period_all') },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('pes_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('pes_subtitle')}</p>
      </motion.div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                period === p.key
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-lg shadow-amber-400/25'
                  : 'border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 hover:border-amber-300 hover:bg-amber-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Select
          value={supplierFilter}
          onChange={setSupplierFilter}
          options={[{ value: '', label: t('pes_filter_supplier') }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
          className="w-auto min-w-[200px]"
        />
        <input
          type="text"
          value={productQuery}
          onChange={(e) => setProductQuery(e.target.value)}
          placeholder={t('pes_filter_product')}
          className="input-field min-w-[200px] flex-1 sm:max-w-xs"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
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

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('pes_col_date')}</th>
                <th className="px-5 py-3.5">{t('pes_col_ref')}</th>
                <th className="px-5 py-3.5">{t('pes_col_product')}</th>
                <th className="px-5 py-3.5">{t('pes_col_supplier')}</th>
                <th className="px-5 py-3.5">{t('pes_col_qty')}</th>
                <th className="px-5 py-3.5">{t('pes_col_cost')}</th>
                <th className="px-5 py-3.5">{t('pes_col_value')}</th>
                <th className="px-5 py-3.5">{t('pes_col_user')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 150).map((r) => (
                <tr key={r.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">
                    {new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{r.ref}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-zinc-300">{r.productName}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">{r.supplierName}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{r.qty}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">{fmtDH(r.cost)}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtDH(r.value)}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-zinc-400">ADMIN</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('pes_none')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </>
  )
}

export default function EntreesStockPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
