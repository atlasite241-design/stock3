'use client'

import { useState } from 'react'
import Loader from '@/components/Loader'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Banknote, Pencil, Plus, Trash2, Truck, Wallet } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { fmtDH, useDroguerie, type Supplier } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, suppliers, purchases, updateSupplier, deleteSupplier, paySupplier } =
    useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)
  const [payTarget, setPayTarget] = useState<Supplier | null>(null)
  const [payAmount, setPayAmount] = useState('')

  if (!ready) {
    return <Loader />
  }

  const totalDebt = suppliers.reduce((a, s) => a + s.balance, 0)

  const openEdit = (s: Supplier) => {
    setEditingId(s.id)
    setForm({ name: s.name, phone: s.phone, address: s.address })
    setModalOpen(true)
  }

  const saveForm = () => {
    if (!editingId) return
    if (!form.name.trim()) {
      toast(t('fli_toast_name_required'), 'error')
      return
    }
    updateSupplier(editingId, { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() })
    toast(`✓ ${form.name} ${t('fli_toast_modified')}`)
    setModalOpen(false)
  }

  const doPay = () => {
    if (!payTarget) return
    const amount = parseFloat(payAmount.replace(',', '.')) || 0
    if (amount <= 0) {
      toast(t('fli_toast_invalid_amount'), 'error')
      return
    }
    paySupplier(payTarget.id, amount)
    toast(`✓ ${t('fli_toast_payment')} ${fmtDH(Math.min(amount, payTarget.balance))} ${t('fli_toast_registered')}`)
    setPayTarget(null)
  }

  const ordersOf = (id: string) => purchases.filter((p) => p.supplierId === id).length

  const cards = [
    { label: t('fli_kpi_suppliers'), value: String(suppliers.length), icon: Truck, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    {
      label: t('fli_kpi_debts'),
      value: fmtDH(totalDebt),
      icon: Wallet,
      cls: totalDebt > 0 ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
    },
    {
      label: t('fli_kpi_orders_placed'),
      value: String(purchases.length),
      icon: Banknote,
      cls: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    },
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('fli_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('fli_subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/achats" className="btn-secondary">
            <Truck className="h-4 w-4" />
            {t('fli_orders')}
          </Link>
          <Link href="/fournisseurs/nouveau" className="btn-primary">
            <Plus className="h-4 w-4" />
            {t('fli_add')}
          </Link>
        </div>
      </motion.div>

      {/* Summary cards */}
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
            <p className="mt-1 text-[24px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
              {c.value}
            </p>
          </motion.div>
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
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('fli_col_supplier')}</th>
                <th className="px-5 py-3.5">{t('fli_col_phone')}</th>
                <th className="px-5 py-3.5">{t('fli_col_orders')}</th>
                <th className="px-5 py-3.5">{t('fli_col_total_bought')}</th>
                <th className="px-5 py-3.5">{t('fli_col_balance_due')}</th>
                <th className="px-5 py-3.5 text-right">{t('fli_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="group border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-gray-900">
                        <Truck className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{s.name}</p>
                        <p className="truncate text-xs text-gray-400 dark:text-zinc-500">{s.address || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">{s.phone || '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">{ordersOf(s.id)}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                    {fmtDH(s.totalPurchased)}
                  </td>
                  <td className="px-5 py-3.5">
                    {s.balance > 0 ? (
                      <span className="rounded-lg border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                        {fmtDH(s.balance)}
                      </span>
                    ) : (
                      <span className="rounded-lg border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {t('fli_up_to_date')}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {s.balance > 0 && (
                        <button
                          onClick={() => {
                            setPayTarget(s)
                            setPayAmount(String(s.balance))
                          }}
                          className="btn-secondary !h-8 !px-2.5 text-xs"
                        >
                          <Banknote className="h-3.5 w-3.5" />
                          {t('fli_pay')}
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(s)}
                        className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-400"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(s)}
                        className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('fli_none')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('fli_edit_title')}
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">{t('fli_name')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ex: Droguerie Centrale SARL"
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('fli_phone')}</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="05 22 XX XX XX"
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('fli_address')}</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder={t('fli_address_placeholder')}
              className="input-field"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">
              {t('fli_cancel')}
            </button>
            <button onClick={saveForm} className="btn-primary">
              {t('fli_save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Pay modal */}
      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title={t('fli_pay_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <span className="font-semibold text-gray-900 dark:text-white">{payTarget?.name}</span> — {t('fli_balance_due_label')}{' '}
          <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">{fmtDH(payTarget?.balance ?? 0)}</span>
        </p>
        <div className="mt-4">
          <label className="field-label">{t('fli_amount_dh')}</label>
          <input
            type="number"
            min="0"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            className="input-field"
            autoFocus
          />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setPayTarget(null)} className="btn-secondary">
            {t('fli_cancel')}
          </button>
          <button onClick={doPay} className="btn-primary">
            <Banknote className="h-4 w-4" />
            {t('fli_pay')}
          </button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('fli_delete_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <span className="font-semibold text-gray-900 dark:text-white">{deleteTarget?.name}</span> {t('fli_delete_desc')}
          {deleteTarget && deleteTarget.balance > 0 && (
            <span className="mt-1 block font-semibold text-rose-600 dark:text-rose-400">
              {t('fli_delete_balance_warning')} {fmtDH(deleteTarget.balance)}.
            </span>
          )}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
            {t('fli_cancel')}
          </button>
          <button
            onClick={() => {
              deleteSupplier(deleteTarget!.id)
              toast(`${deleteTarget!.name} ${t('fli_toast_deleted')}`)
              setDeleteTarget(null)
            }}
            className="btn-danger"
          >
            <Trash2 className="h-4 w-4" />
            {t('fli_delete')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function FournisseursPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
