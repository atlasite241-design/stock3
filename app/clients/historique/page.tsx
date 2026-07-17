'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  HandCoins,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Wallet,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Select from '@/components/Select'
import { CLIENT_PAYMENT_META, fmtDH, PAYMENT_META, useDroguerie } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

type Period = '7j' | '30j' | 'tout'

type TimelineEntry = {
  id: string
  date: string
  type: 'facture' | 'devis' | 'retour' | 'paiement'
  label: string
  amount: number
  positive: boolean
  meta?: string
}

const TYPE_META: Record<TimelineEntry['type'], { icon: typeof Receipt; cls: string; labelKey: TKey }> = {
  facture: { icon: ShoppingCart, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500', labelKey: 'clih_type_invoice' },
  devis: { icon: FileText, cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400', labelKey: 'clih_type_quote' },
  retour: { icon: RotateCcw, cls: 'bg-violet-50 dark:bg-violet-500/10 text-violet-500 dark:text-violet-400', labelKey: 'clih_type_return' },
  paiement: { icon: HandCoins, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400', labelKey: 'clih_type_payment' },
}

function Content() {
  const { ready, clients, sales, quotes, returns, clientPayments } = useDroguerie()
  const { t } = useLanguage()
  const [clientId, setClientId] = useState('')
  const [period, setPeriod] = useState<Period>('30j')

  const client = clients.find((c) => c.id === clientId)

  const cutoff = useMemo(() => {
    if (period === 'tout') return null
    const d = new Date()
    d.setDate(d.getDate() - (period === '7j' ? 6 : 29))
    d.setHours(0, 0, 0, 0)
    return d
  }, [period])

  const timeline: TimelineEntry[] = useMemo(() => {
    if (!client) return []
    const entries: TimelineEntry[] = []

    sales
      .filter((s) => s.clientId === client.id)
      .forEach((s) =>
        entries.push({
          id: s.id,
          date: s.date,
          type: 'facture',
          label: `${t('clih_invoice_prefix')} #${s.id.slice(-5).toUpperCase()} — ${s.items.reduce((a, i) => a + i.qty, 0)} ${t('pos_article_count')}`,
          amount: s.total,
          positive: true,
          meta: PAYMENT_META[s.payment].label,
        })
      )

    quotes
      .filter((q) => q.clientName === client.name)
      .forEach((q) =>
        entries.push({
          id: q.id,
          date: q.date,
          type: 'devis',
          label: `${t('clih_quote_prefix')} ${q.ref}`,
          amount: q.total,
          positive: true,
          meta: q.status,
        })
      )

    returns
      .filter((r) => r.clientName === client.name)
      .forEach((r) =>
        entries.push({
          id: r.id,
          date: r.date,
          type: 'retour',
          label: `${t('clih_return_on_sale')} #${r.saleId.slice(-5).toUpperCase()}`,
          amount: r.total,
          positive: false,
          meta: r.method === 'especes' ? t('clih_refunded_cash') : t('clih_credit_note'),
        })
      )

    clientPayments
      .filter((p) => p.clientId === client.id)
      .forEach((p) =>
        entries.push({
          id: p.id,
          date: p.date,
          type: 'paiement',
          label: `${t('clih_payment_received')} ${CLIENT_PAYMENT_META[p.method].label}`,
          amount: p.amount,
          positive: true,
          meta: p.note,
        })
      )

    return entries
      .filter((e) => !cutoff || new Date(e.date) >= cutoff)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [client, sales, quotes, returns, clientPayments, cutoff])

  const totalAchats = timeline.filter((e) => e.type === 'facture').reduce((a, e) => a + e.amount, 0)

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const periods: { key: Period; label: string }[] = [
    { key: '7j', label: t('poh_period_7d') },
    { key: '30j', label: t('poh_period_30d') },
    { key: 'tout', label: t('poh_period_all') },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('clih_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          {t('clih_subtitle')}
        </p>
      </motion.div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={clientId}
          onChange={setClientId}
          placeholder={t('clih_select_client')}
          className="w-auto min-w-[260px]"
          options={[{ value: '', label: t('clih_select_client') }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
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

      {!client ? (
        <div className="glass-card flex flex-col items-center gap-3 p-10 text-center">
          <Wallet className="h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500 dark:text-zinc-400">{t('clih_select_client_first')}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
              <p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('clih_total_purchases_period')}</p>
              <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
                {fmtDH(totalAchats)}
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-5">
              <p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('clih_total_spent_all')}</p>
              <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
                {fmtDH(client.totalSpent)}
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
              <p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('clih_current_credit')}</p>
              <p className={`mt-1 text-[22px] font-bold leading-none tracking-tight tabular-nums ${client.credit > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {fmtDH(client.credit)}
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="glass-card p-5"
          >
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('clih_timeline')}</h2>
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
                  {t('clih_none_in_period')}
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </>
  )
}

export default function HistoriqueClientPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
