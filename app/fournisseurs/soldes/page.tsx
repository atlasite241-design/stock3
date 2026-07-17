'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Banknote, Search, Wallet } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { fmtDH, useDroguerie, type Supplier, type SupplierPayment } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

type Status = 'uptodate' | 'partial' | 'due'

const STATUS_CHIP: Record<Status, string> = {
  uptodate: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
  partial: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  due: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20',
}
const STATUS_KEY: Record<Status, TKey> = {
  uptodate: 'fso_status_uptodate',
  partial: 'fso_status_partial',
  due: 'fso_status_due',
}

function Content() {
  const { ready, suppliers, supplierPayments, paySupplier } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('tous')
  const [payTarget, setPayTarget] = useState<Supplier | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [method, setMethod] = useState<SupplierPayment['method']>('especes')

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const statusOf = (s: Supplier): Status => {
    if (s.balance === 0) return 'uptodate'
    const hasPayment = supplierPayments.some((p) => p.supplierId === s.id)
    return hasPayment ? 'partial' : 'due'
  }

  const withBalance = suppliers.filter((s) => s.balance > 0)
  const totalOutstanding = withBalance.reduce((a, s) => a + s.balance, 0)
  const soldeDuCount = withBalance.filter((s) => statusOf(s) === 'due').length

  const visible = withBalance
    .filter((s) => statusFilter === 'tous' || statusOf(s) === statusFilter)
    .filter((s) => {
      const q = query.trim().toLowerCase()
      return !q || s.name.toLowerCase().includes(q) || s.phone.includes(q)
    })
    .sort((a, b) => b.balance - a.balance)

  const openPay = (s: Supplier) => {
    setPayTarget(s)
    setPayAmount(String(s.balance))
    setMethod('especes')
  }

  const confirmPay = () => {
    if (!payTarget) return
    const amount = parseFloat(payAmount.replace(',', '.')) || 0
    if (amount <= 0) {
      toast(t('fso_toast_invalid_amount'), 'error')
      return
    }
    paySupplier(payTarget.id, amount, method)
    toast(`✓ ${t('fso_toast_payment')} ${fmtDH(Math.min(amount, payTarget.balance))} ${t('fso_toast_registered')}`)
    setPayTarget(null)
  }

  const cards = [
    { label: t('fso_kpi_with_balance'), value: String(withBalance.length), icon: Wallet, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('fso_kpi_total_due'), value: fmtDH(totalOutstanding), icon: Banknote, cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' },
    { label: t('fso_kpi_no_payment'), value: String(soldeDuCount), icon: AlertTriangle, cls: soldeDuCount > 0 ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('fso_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('fso_subtitle')}</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
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
            <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
              {c.value}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('fso_search_placeholder')}
            className="input-field pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'tous', label: t('fso_all') },
            { value: 'due', label: t('fso_status_due') },
            { value: 'partial', label: t('fso_status_partial') },
            { value: 'uptodate', label: t('fso_status_uptodate') },
          ]}
          className="w-auto min-w-[200px]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('fso_col_supplier')}</th>
                <th className="px-5 py-3.5">{t('fso_col_balance_due')}</th>
                <th className="px-5 py-3.5">{t('fso_col_total_bought')}</th>
                <th className="px-5 py-3.5">{t('fso_col_status')}</th>
                <th className="px-5 py-3.5 text-right">{t('fso_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const status = statusOf(s)
                return (
                  <tr key={s.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.name}</p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 tabular-nums">{s.phone || '—'}</p>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      {fmtDH(s.balance)}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">
                      {fmtDH(s.totalPurchased)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${STATUS_CHIP[status]}`}>{t(STATUS_KEY[status])}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => openPay(s)} className="btn-secondary !h-8 !px-2.5 text-xs">
                        <Banknote className="h-3.5 w-3.5" />
                        {t('fso_pay')}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('fso_none')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title={t('fso_pay_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <span className="font-semibold text-gray-900 dark:text-white">{payTarget?.name}</span> — {t('fso_balance_due_label')}{' '}
          <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">{fmtDH(payTarget?.balance ?? 0)}</span>
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="field-label">{t('fso_amount_dh')}</label>
            <input
              type="number"
              min="0"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="input-field"
              autoFocus
            />
          </div>
          <div>
            <label className="field-label">{t('fso_payment_method')}</label>
            <Select
              value={method}
              onChange={(v) => setMethod(v as SupplierPayment['method'])}
              options={[
                { value: 'especes', label: t('pay_method_especes') },
                { value: 'carte', label: t('pay_method_carte') },
                { value: 'virement', label: t('pay_method_virement') },
                { value: 'cheque', label: t('pay_method_cheque') },
              ]}
            />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setPayTarget(null)} className="btn-secondary">
            {t('fso_cancel')}
          </button>
          <button onClick={confirmPay} className="btn-primary">
            <Banknote className="h-4 w-4" />
            {t('fso_pay')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function SoldesFournisseursPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
