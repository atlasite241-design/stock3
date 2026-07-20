'use client'

import { useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Banknote, HandCoins, Plus, Printer } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { CLIENT_PAYMENT_META, fmtDH, useDroguerie, type ClientPayment } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, clients, clientPayments, settings, settleCredit } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [newOpen, setNewOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<ClientPayment['method']>('especes')
  const [receipt, setReceipt] = useState<ClientPayment | null>(null)
  const [methodFilter, setMethodFilter] = useState('tous')

  if (!ready) {
    return <Loader />
  }

  const debtors = clients.filter((c) => c.credit > 0)
  const selectedClient = clients.find((c) => c.id === clientId)

  const visiblePayments = clientPayments
    .filter((p) => methodFilter === 'tous' || p.method === methodFilter)
    .sort((a, b) => b.date.localeCompare(a.date))

  const totalCollected = clientPayments.reduce((a, p) => a + p.amount, 0)
  const totalToday = clientPayments
    .filter((p) => new Date(p.date).toDateString() === new Date().toDateString())
    .reduce((a, p) => a + p.amount, 0)

  const submitPayment = () => {
    if (!clientId) {
      toast(t('clip_toast_choose_client'), 'error')
      return
    }
    const amt = parseFloat(amount.replace(',', '.')) || 0
    if (amt <= 0) {
      toast(t('clip_toast_invalid_amount'), 'error')
      return
    }
    settleCredit(clientId, amt, method)
    toast(`✓ ${t('clip_toast_registered')} ${fmtDH(amt)} ${t('clip_toast_registered_suffix')}`)
    setNewOpen(false)
    setReceipt({
      id: 'preview',
      date: new Date().toISOString(),
      clientId,
      clientName: selectedClient?.name ?? '',
      amount: amt,
      method,
      note: t('clip_note_credit'),
    })
    setClientId('')
    setAmount('')
    setMethod('especes')
  }

  const cards = [
    { label: t('clip_total_collected'), value: fmtDH(totalCollected), icon: HandCoins, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
    { label: t('clip_collected_today'), value: fmtDH(totalToday), icon: Banknote, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
  ]

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('clip_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('clip_subtitle')}</p>
        </div>
        <button onClick={() => setNewOpen(true)} className="btn-primary" disabled={debtors.length === 0}>
          <Plus className="h-4 w-4" />
          {t('clip_new_payment')}
        </button>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
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

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'tous', label: t('clip_all') },
          { key: 'especes', label: t('pay_method_especes') },
          { key: 'carte', label: t('pay_method_carte') },
          { key: 'virement', label: t('pay_method_virement') },
          { key: 'cheque', label: t('pay_method_cheque') },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => setMethodFilter(m.key)}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              methodFilter === m.key
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-lg shadow-amber-400/25'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:bg-amber-50 dark:border-white/10 dark:bg-[#12121a] dark:text-zinc-400 dark:hover:bg-white/5'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('clip_col_date')}</th>
                <th className="px-5 py-3.5">{t('clip_col_client')}</th>
                <th className="px-5 py-3.5">{t('clip_col_method')}</th>
                <th className="px-5 py-3.5">{t('clip_col_amount')}</th>
                <th className="px-5 py-3.5 text-right">{t('clip_col_receipt')}</th>
              </tr>
            </thead>
            <tbody>
              {visiblePayments.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">
                    {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white">{p.clientName}</td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-lg bg-gray-100 dark:bg-white/10 px-2 py-1 text-xs font-semibold text-gray-600 dark:text-zinc-400">
                      {CLIENT_PAYMENT_META[p.method].label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {fmtDH(p.amount)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setReceipt(p)}
                      className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-sky-50 hover:text-sky-600"
                      title={t('clip_print_receipt')}
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {visiblePayments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('clip_none')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* New payment modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title={t('clip_new_payment')} maxWidth="max-w-sm">
        <div className="space-y-4">
          <div>
            <label className="field-label">{t('clip_client_credit_label')}</label>
            <Select
              value={clientId}
              onChange={setClientId}
              placeholder={t('clip_choose')}
              options={[
                { value: '', label: t('clip_choose') },
                ...debtors.map((c) => ({ value: c.id, label: `${c.name} (${fmtDH(c.credit)} ${t('clip_due_suffix')})` })),
              ]}
            />
          </div>
          <div>
            <label className="field-label">{t('clip_amount_received')}</label>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('clip_payment_method')}</label>
            <Select
              value={method}
              onChange={(v) => setMethod(v as ClientPayment['method'])}
              options={[
                { value: 'especes', label: t('pay_method_especes') },
                { value: 'carte', label: t('pay_method_carte') },
                { value: 'virement', label: t('pay_method_virement') },
                { value: 'cheque', label: t('pay_method_cheque') },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={() => setNewOpen(false)} className="btn-secondary">
              {t('clip_cancel')}
            </button>
            <button onClick={submitPayment} className="btn-primary">
              <HandCoins className="h-4 w-4" />
              {t('clip_collect')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Receipt */}
      <Modal open={!!receipt} onClose={() => setReceipt(null)} title={t('clip_receipt_title')} maxWidth="max-w-sm">
        {receipt && (
          <>
            <div className="print-area rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-4 font-mono text-sm">
              <p className="text-center text-base font-bold text-gray-900">{settings.storeName}</p>
              <p className="text-center text-xs text-gray-500">{settings.address}</p>
              <div className="my-3 border-t border-dashed border-gray-300" />
              <p className="text-xs text-gray-600">
                {new Date(receipt.date).toLocaleString('fr-FR')}
              </p>
              <p className="mt-1 text-xs text-gray-600">{t('clip_receipt_client')} {receipt.clientName}</p>
              <p className="text-xs text-gray-600">{t('clip_receipt_method')} {CLIENT_PAYMENT_META[receipt.method].label}</p>
              <div className="my-3 border-t border-dashed border-gray-300" />
              <div className="flex justify-between text-base font-bold text-gray-900">
                <span>{t('clip_receipt_amount')}</span>
                <span className="tabular-nums">{fmtDH(receipt.amount)}</span>
              </div>
              <p className="mt-3 text-center text-xs text-gray-500">{t('clip_receipt_thanks')}</p>
            </div>
            <button onClick={() => window.print()} className="btn-primary mt-4 w-full">
              <Printer className="h-4 w-4" />
              {t('clip_print')}
            </button>
          </>
        )}
      </Modal>
    </>
  )
}

export default function PaiementsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
