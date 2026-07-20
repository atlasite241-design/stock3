'use client'

import { useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Banknote, FileWarning, Printer, Search } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import InvoiceDocument from '@/components/InvoiceDocument'
import { useToast } from '@/components/Toast'
import { fmtDH, useDroguerie, type Purchase } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, purchases, payPurchase, settings } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('toutes')
  const [payTarget, setPayTarget] = useState<Purchase | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [method, setMethod] = useState<'especes' | 'carte' | 'virement' | 'cheque'>('especes')
  const [printTarget, setPrintTarget] = useState<Purchase | null>(null)

  if (!ready) {
    return <Loader />
  }

  const invoices = purchases.filter((p) => p.status === 'recue' || p.status === 'retournee')
  const unpaid = invoices.reduce((a, p) => a + (p.total - p.paid), 0)

  // Sequential invoice number (FAC-YYYY-N) — oldest invoice gets the configured start number.
  const invoicesByDate = [...invoices].sort((a, b) => a.date.localeCompare(b.date))
  const invoiceNumberOf = (p: Purchase) => {
    const idx = Math.max(0, invoicesByDate.findIndex((x) => x.id === p.id))
    const year = new Date(p.date).getFullYear()
    return `${settings.invoicePrefix}${year}-${settings.invoiceStartNumber + idx}`
  }

  const visible = invoices
    .filter((p) => {
      if (statusFilter === 'payees') return p.paid >= p.total
      if (statusFilter === 'impayees') return p.paid === 0
      if (statusFilter === 'partielles') return p.paid > 0 && p.paid < p.total
      return true
    })
    .filter((p) => {
      const q = query.trim().toLowerCase()
      return !q || p.ref.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q)
    })

  const confirmPay = () => {
    if (!payTarget) return
    const amount = parseFloat(payAmount.replace(',', '.')) || 0
    if (amount <= 0) {
      toast(t('inv_toast_invalid_amount'), 'error')
      return
    }
    payPurchase(payTarget.id, amount, method)
    toast(`✓ ${t('inv_toast_payment_recorded')} ${payTarget.ref}`)
    setPayTarget(null)
    setMethod('especes')
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('inv_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('inv_subtitle')}
            {unpaid > 0 && <span className="ml-2 font-semibold text-rose-500 dark:text-rose-400">{t('inv_unpaid_prefix')} {fmtDH(unpaid)}</span>}
          </p>
        </div>
      </motion.div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('inv_search_placeholder')}
            className="input-field pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'toutes', label: t('inv_all') },
            { value: 'payees', label: t('inv_paid') },
            { value: 'partielles', label: t('inv_partial') },
            { value: 'impayees', label: t('inv_unpaid') },
          ]}
          className="w-auto min-w-[160px]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('inv_col_ref')}</th>
                <th className="px-5 py-3.5">{t('inv_col_supplier')}</th>
                <th className="px-5 py-3.5">{t('inv_col_total')}</th>
                <th className="px-5 py-3.5">{t('inv_col_paid')}</th>
                <th className="px-5 py-3.5">{t('inv_col_remaining')}</th>
                <th className="px-5 py-3.5 text-right">{t('inv_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const reste = p.total - p.paid
                return (
                  <tr key={p.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                    <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{p.ref}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-zinc-300">{p.supplierName}</td>
                    <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(p.total)}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtDH(p.paid)}</td>
                    <td className="px-5 py-3.5">
                      {reste > 0 ? (
                        <span className="rounded-lg border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                          {fmtDH(reste)}
                        </span>
                      ) : (
                        <span className="rounded-lg border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {t('inv_settled')}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPrintTarget(p)}
                          className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-sky-50 hover:text-sky-600"
                          title={t('inv_print')}
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        {reste > 0 && (
                          <button
                            onClick={() => {
                              setPayTarget(p)
                              setPayAmount(String(reste))
                            }}
                            className="btn-primary !h-8 !px-2.5 text-xs"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            {t('inv_pay')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    <FileWarning className="mx-auto mb-2 h-6 w-6 text-gray-300" />
                    {t('inv_none_in_view')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Pay modal */}
      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title={t('inv_pay_invoice')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <span className="font-semibold text-gray-900 dark:text-white">{payTarget?.ref}</span> — {t('inv_remaining_prefix')}{' '}
          <span className="font-bold text-rose-500 dark:text-rose-400 tabular-nums">
            {fmtDH((payTarget?.total ?? 0) - (payTarget?.paid ?? 0))}
          </span>
        </p>
        <div className="mt-4">
          <label className="field-label">{t('inv_amount_dh')}</label>
          <input
            type="number"
            min="0"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            className="input-field"
            autoFocus
          />
        </div>
        <div className="mt-4">
          <label className="field-label">{t('inv_payment_method')}</label>
          <Select
            value={method}
            onChange={(v) => setMethod(v as typeof method)}
            options={[
              { value: 'especes', label: t('pay_method_especes') },
              { value: 'carte', label: t('pay_method_carte') },
              { value: 'virement', label: t('pay_method_virement') },
              { value: 'cheque', label: t('pay_method_cheque') },
            ]}
          />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setPayTarget(null)} className="btn-secondary">
            {t('inv_cancel')}
          </button>
          <button onClick={confirmPay} className="btn-primary">
            <Banknote className="h-4 w-4" />
            {t('inv_pay')}
          </button>
        </div>
      </Modal>

      {/* Print modal */}
      <Modal open={!!printTarget} onClose={() => setPrintTarget(null)} title={`${t('inv_invoice_title')} — ${printTarget?.ref ?? ''}`} maxWidth="max-w-2xl">
        {printTarget && (
          <>
            <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-gray-100 dark:border-white/10">
              <InvoiceDocument
                title={t('fdoc_invoice')}
                docNumber={invoiceNumberOf(printTarget)}
                number={printTarget.ref}
                date={printTarget.date}
                partyLabel={t('fdoc_supplier')}
                partyName={printTarget.supplierName}
                lines={printTarget.items.map((i) => ({
                  label: i.name,
                  qty: i.qty,
                  unit: i.sku,
                  puHT: i.cost,
                  tvaPct: i.tva ?? 0,
                }))}
                paid={printTarget.paid}
                showBalance
              />
            </div>
            <button onClick={() => window.print()} className="btn-primary mt-4 w-full">
              <Printer className="h-4 w-4" />
              {t('inv_print')}
            </button>
          </>
        )}
      </Modal>
    </>
  )
}

export default function FacturesFournisseursPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
