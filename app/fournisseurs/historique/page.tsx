'use client'

import { useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { HandCoins, RotateCcw, ShoppingBag, Wallet } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Select from '@/components/Select'
import { fmtDH, SUPPLIER_PAYMENT_META, useDroguerie } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

type Period = '7j' | '30j' | 'tout'

type TimelineEntry = {
  id: string
  date: string
  type: 'commande' | 'retour' | 'paiement'
  label: string
  amount: number
  positive: boolean
  meta?: string
}

const TYPE_META: Record<TimelineEntry['type'], { icon: typeof ShoppingBag; cls: string; labelKey: TKey }> = {
  commande: { icon: ShoppingBag, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500', labelKey: 'fhi_order' },
  retour: { icon: RotateCcw, cls: 'bg-violet-50 dark:bg-violet-500/10 text-violet-500 dark:text-violet-400', labelKey: 'fhi_return' },
  paiement: { icon: HandCoins, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400', labelKey: 'fhi_payment' },
}

function Content() {
  const { ready, suppliers, purchases, supplierPayments } = useDroguerie()
  const { t } = useLanguage()
  const [supplierId, setSupplierId] = useState('')
  const [period, setPeriod] = useState<Period>('30j')

  const supplier = suppliers.find((s) => s.id === supplierId)

  const cutoff = useMemo(() => {
    if (period === 'tout') return null
    const d = new Date()
    d.setDate(d.getDate() - (period === '7j' ? 6 : 29))
    d.setHours(0, 0, 0, 0)
    return d
  }, [period])

  const timeline: TimelineEntry[] = useMemo(() => {
    if (!supplier) return []
    const entries: TimelineEntry[] = []

    purchases
      .filter((p) => p.supplierId === supplier.id)
      .forEach((p) =>
        entries.push({
          id: p.id,
          date: p.date,
          type: p.status === 'retournee' ? 'retour' : 'commande',
          label: `${t('fhi_po_prefix')} ${p.ref} — ${p.items.reduce((a, i) => a + i.qty, 0)} ${t('pos_article_count')}`,
          amount: p.total,
          positive: p.status !== 'retournee',
          meta: p.status === 'recue' ? t('fhi_status_received') : p.status === 'en_attente' ? t('fhi_status_pending') : t('fhi_status_returned'),
        })
      )

    supplierPayments
      .filter((p) => p.supplierId === supplier.id)
      .forEach((p) =>
        entries.push({
          id: p.id,
          date: p.date,
          type: 'paiement',
          label: `${t('fhi_payment_sent')} ${SUPPLIER_PAYMENT_META[p.method].label}`,
          amount: p.amount,
          positive: false,
          meta: p.note,
        })
      )

    return entries
      .filter((e) => !cutoff || new Date(e.date) >= cutoff)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [supplier, purchases, supplierPayments, cutoff])

  const totalCommandes = timeline.filter((e) => e.type === 'commande').reduce((a, e) => a + e.amount, 0)

  if (!ready) {
    return <Loader />
  }

  const periods: { key: Period; label: string }[] = [
    { key: '7j', label: t('poh_period_7d') },
    { key: '30j', label: t('poh_period_30d') },
    { key: 'tout', label: t('poh_period_all') },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('fhi_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          {t('fhi_subtitle')}
        </p>
      </motion.div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={supplierId}
          onChange={setSupplierId}
          placeholder={t('fhi_select_supplier')}
          className="w-auto min-w-[260px]"
          options={[{ value: '', label: t('fhi_select_supplier') }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
        />
        <div className="flex gap-2">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                period === p.key
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-lg shadow-amber-400/25'
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:bg-amber-50 dark:border-white/10 dark:bg-[#12121a] dark:text-zinc-400 dark:hover:bg-white/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!supplier ? (
        <div className="glass-card flex flex-col items-center gap-3 p-10 text-center">
          <Wallet className="h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500 dark:text-zinc-400">{t('fhi_select_first')}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
              <p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('fhi_total_orders_period')}</p>
              <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
                {fmtDH(totalCommandes)}
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-5">
              <p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('fhi_total_bought_all')}</p>
              <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
                {fmtDH(supplier.totalPurchased)}
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
              <p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('fhi_balance_due')}</p>
              <p className={`mt-1 text-[22px] font-bold leading-none tracking-tight tabular-nums ${supplier.balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {fmtDH(supplier.balance)}
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="glass-card p-5"
          >
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('fhi_timeline')}</h2>
            <div className="mt-4 space-y-2">
              {timeline.map((e) => {
                const meta = TYPE_META[e.type]
                return (
                  <div key={`${e.type}-${e.id}`} className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.cls}`}>
                      <meta.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{e.label}</p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500">
                        {new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {e.meta ? ` · ${e.meta}` : ''}
                      </p>
                    </div>
                    <p className={`shrink-0 text-sm font-bold tabular-nums ${e.positive ? 'text-gray-900 dark:text-white' : 'text-rose-500 dark:text-rose-400'}`}>
                      {e.positive ? '' : '−'}
                      {fmtDH(e.amount)}
                    </p>
                  </div>
                )
              })}
              {timeline.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                  {t('fhi_none_in_period')}
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </>
  )
}

export default function HistoriqueFournisseurPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
