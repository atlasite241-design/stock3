'use client'

import { useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { AlertTriangle, Banknote, Eye, FileDown, HandCoins, Pencil, Plus, Printer, Search, Trash2, Users, Wallet, X } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import InvoiceDocument from '@/components/InvoiceDocument'
import { useToast } from '@/components/Toast'
import { creditStatus, daysLate, fmtDH, useDroguerie, type Credit, type CreditInstalment, type CreditStatus } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const VENDOR = 'ADMIN'

const STATUS_CHIP: Record<CreditStatus, string> = {
  paye: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
  partiel: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  retard: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20',
  non_paye: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/20',
}
const STATUS_KEY: Record<CreditStatus, TKey> = {
  paye: 'crd_status_paye',
  partiel: 'crd_status_partiel',
  retard: 'crd_status_retard',
  non_paye: 'crd_status_non_paye',
}

type Period = 'tout' | '7j' | '30j' | 'echus'
type PrintState = { kind: 'list' | 'invoice' | 'history'; credit: Credit | null }

function Content() {
  const { ready, credits, clients, products, settings, payCredit, addManualCredit, updateCredit, deleteCredit } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState<Period>('tout')
  const [statusFilter, setStatusFilter] = useState('tous')

  const [payTarget, setPayTarget] = useState<Credit | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<CreditInstalment['method']>('especes')
  const [payNote, setPayNote] = useState('')

  const [detail, setDetail] = useState<Credit | null>(null)
  const [editTarget, setEditTarget] = useState<Credit | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDue, setEditDue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Credit | null>(null)
  const [printState, setPrintState] = useState<PrintState>({ kind: 'list', credit: null })

  const [newOpen, setNewOpen] = useState(false)
  const [newClient, setNewClient] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newDue, setNewDue] = useState('')
  const [newRef, setNewRef] = useState('')

  if (!ready) {
    return <Loader />
  }

  const now = new Date()
  const cutoff = (days: number) => {
    const d = new Date()
    d.setDate(now.getDate() - days)
    return d
  }

  // Live view (fresh reference) of the credit being detailed, so the modal reflects new payments.
  const liveDetail = detail ? credits.find((c) => c.id === detail.id) ?? detail : null

  const rows = [...credits]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((c) => (statusFilter === 'tous' ? true : creditStatus(c, now) === statusFilter))
    .filter((c) => {
      if (period === 'tout') return true
      if (period === 'echus') return c.amount - c.paid > 0.001 && new Date(c.dueDate) < now
      return new Date(c.date) >= cutoff(period === '7j' ? 6 : 29)
    })
    .filter((c) => {
      const q = query.trim().toLowerCase()
      return !q || c.clientName.toLowerCase().includes(q) || c.invoiceRef.toLowerCase().includes(q) || c.ref.toLowerCase().includes(q)
    })

  const totalCredits = credits.reduce((a, c) => a + c.amount, 0)
  const totalCollected = credits.reduce((a, c) => a + c.paid, 0)
  const totalOutstanding = credits.reduce((a, c) => a + (c.amount - c.paid), 0)
  const debtors = new Set(credits.filter((c) => c.amount - c.paid > 0.001).map((c) => c.clientId)).size
  const lateCount = credits.filter((c) => creditStatus(c, now) === 'retard').length

  const cards = [
    { label: t('crd_kpi_total'), value: fmtDH(totalCredits), icon: Wallet, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('crd_kpi_collected'), value: fmtDH(totalCollected), icon: Banknote, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
    { label: t('crd_kpi_outstanding'), value: fmtDH(totalOutstanding), icon: HandCoins, cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' },
    { label: t('crd_kpi_debtors'), value: String(debtors), icon: Users, cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400' },
    { label: t('crd_kpi_late'), value: String(lateCount), icon: AlertTriangle, cls: lateCount > 0 ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
  ]

  // ---- automatic enrichment from the linked invoice / products -------------
  const enrich = (c: Credit) =>
    c.items.map((i) => {
      const p = products.find((x) => x.id === i.productId)
      const puTTC = i.price
      const tvaPct = settings.tva
      const puHT = puTTC / (1 + tvaPct / 100)
      return {
        ...i,
        barcode: p?.barcode || '—',
        ref: p ? `REF-${p.id.slice(-6).toUpperCase()}` : '—',
        category: p?.category || '—',
        unit: p?.unit || '—',
        puTTC,
        puHT,
        tvaPct,
        discount: 0,
        totalTTC: puTTC * i.qty,
      }
    })

  const totalsOf = (c: Credit) => {
    const lines = enrich(c)
    const subtotalHT = lines.reduce((a, l) => a + l.puHT * l.qty, 0)
    return {
      nbArticles: c.items.length,
      totalQty: c.items.reduce((a, i) => a + i.qty, 0),
      subtotalHT,
      tvaAmount: c.amount - subtotalHT,
      globalDiscount: 0,
      totalTTC: c.amount,
    }
  }

  const clientOf = (c: Credit) => clients.find((x) => x.id === c.clientId)

  const timelineOf = (c: Credit) => {
    const events: { date: string; label: string; detail: string; cls: string }[] = [
      { date: c.date, label: t('crd_ops_created'), detail: c.invoiceRef, cls: 'bg-sky-500' },
    ]
    c.payments.forEach((p) => events.push({ date: p.date, label: t('crd_ops_payment'), detail: `${fmtDH(p.amount)} · ${t(`crd_method_${p.method}` as TKey)}`, cls: 'bg-emerald-500' }))
    if (c.amount - c.paid <= 0.001 && c.payments.length) events.push({ date: c.payments[0].date, label: t('crd_ops_settled'), detail: fmtDH(c.amount), cls: 'bg-emerald-600' })
    if (creditStatus(c, now) === 'retard') events.push({ date: c.dueDate, label: t('crd_ops_overdue'), detail: `${daysLate(c, now)} ${t('al_days_late_suffix')}`, cls: 'bg-rose-500' })
    return events.sort((a, b) => a.date.localeCompare(b.date))
  }

  // ---- actions -------------------------------------------------------------
  const openPay = (c: Credit) => {
    setPayTarget(c)
    setPayAmount(String(c.amount - c.paid))
    setPayMethod('especes')
    setPayNote('')
  }
  const confirmPay = () => {
    if (!payTarget) return
    const amt = parseFloat(payAmount.replace(',', '.')) || 0
    if (amt <= 0) return toast(t('crd_toast_invalid'), 'error')
    payCredit(payTarget.id, amt, payMethod, payNote)
    toast(`✓ ${t('crd_toast_paid')}`)
    setPayTarget(null)
  }

  const openEdit = (c: Credit) => {
    setEditTarget(c)
    setEditAmount(String(c.amount))
    setEditDue(c.dueDate.slice(0, 10))
  }
  const confirmEdit = () => {
    if (!editTarget) return
    const amt = Math.max(0, parseFloat(editAmount.replace(',', '.')) || 0)
    updateCredit(editTarget.id, { amount: amt, dueDate: new Date(editDue).toISOString() })
    toast(`✓ ${t('crd_toast_updated')}`)
    setEditTarget(null)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteCredit(deleteTarget.id)
    toast(`✓ ${t('crd_toast_deleted')}`)
    setDeleteTarget(null)
  }

  const createCredit = () => {
    const amt = parseFloat(newAmount.replace(',', '.')) || 0
    if (!newClient || amt <= 0) return toast(t('crd_toast_invalid'), 'error')
    const due = newDue ? new Date(newDue).toISOString() : (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString() })()
    addManualCredit(newClient, amt, due, newRef)
    toast(`✓ ${t('crd_toast_created')}`)
    setNewOpen(false)
    setNewClient(''); setNewAmount(''); setNewDue(''); setNewRef('')
  }

  const downloadCsv = (name: string, rowsCsv: string[][]) => {
    const csv = rowsCsv.map((r) => r.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportListExcel = () => {
    const header = ['N° Crédit', 'Date', 'Client', 'N° Facture', 'Montant', 'Payé', 'Solde', 'Échéance', 'Retard (j)', 'Statut']
    downloadCsv('credits-clients.csv', [
      header,
      ...rows.map((c) => [c.ref, new Date(c.date).toLocaleDateString('fr-FR'), c.clientName, c.invoiceRef, c.amount.toFixed(2), c.paid.toFixed(2), (c.amount - c.paid).toFixed(2), new Date(c.dueDate).toLocaleDateString('fr-FR'), String(daysLate(c, now)), t(STATUS_KEY[creditStatus(c, now)])]),
    ])
  }

  const exportCreditExcel = (c: Credit) => {
    const header = ['Code-barres', 'Référence', 'Désignation', 'Catégorie', 'Qté', 'Unité', 'PU HT', 'TVA %', 'PU TTC', 'Remise', 'Total TTC']
    downloadCsv(`credit-${c.ref}.csv`, [
      header,
      ...enrich(c).map((l) => [l.barcode, l.ref, l.name, l.category, String(l.qty), l.unit, l.puHT.toFixed(2), String(l.tvaPct), l.puTTC.toFixed(2), '0', l.totalTTC.toFixed(2)]),
    ])
  }

  const doPrint = (state: PrintState) => {
    setPrintState(state)
    setTimeout(() => window.print(), 60)
  }

  const periods: { key: Period; label: string }[] = [
    { key: 'tout', label: t('crd_period_all') },
    { key: '7j', label: t('crd_period_7d') },
    { key: '30j', label: t('crd_period_30d') },
    { key: 'echus', label: t('crd_period_overdue') },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('crd_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('crd_subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportListExcel} className="btn-secondary">
            <FileDown className="h-4 w-4" />
            {t('crd_export_excel')}
          </button>
          <button onClick={() => doPrint({ kind: 'list', credit: null })} className="btn-secondary">
            <Printer className="h-4 w-4" />
            {t('crd_export_pdf')}
          </button>
          <button onClick={() => setNewOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            {t('crd_new')}
          </button>
        </div>
      </motion.div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i, duration: 0.4 }} className="glass-card glass-card-hover p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.cls}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{c.label}</p>
            <p className="mt-1 text-[20px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">{c.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('crd_search')} className="input-field pl-10" />
        </div>
        <Select value={period} onChange={(v) => setPeriod(v as Period)} options={periods.map((p) => ({ value: p.key, label: p.label }))} className="w-auto min-w-[150px]" />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'tous', label: t('crd_all_status') },
            { value: 'non_paye', label: t('crd_status_non_paye') },
            { value: 'partiel', label: t('crd_status_partiel') },
            { value: 'retard', label: t('crd_status_retard') },
            { value: 'paye', label: t('crd_status_paye') },
          ]}
          className="w-auto min-w-[180px]"
        />
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-4 py-3.5">{t('crd_col_ref')}</th>
                <th className="px-4 py-3.5">{t('crd_col_date')}</th>
                <th className="px-4 py-3.5">{t('crd_col_client')}</th>
                <th className="px-4 py-3.5">{t('crd_col_invoice')}</th>
                <th className="px-4 py-3.5">{t('crd_col_amount')}</th>
                <th className="px-4 py-3.5">{t('crd_col_paid')}</th>
                <th className="px-4 py-3.5">{t('crd_col_remaining')}</th>
                <th className="px-4 py-3.5">{t('crd_col_due')}</th>
                <th className="px-4 py-3.5">{t('crd_col_late')}</th>
                <th className="px-4 py-3.5">{t('crd_col_status')}</th>
                <th className="px-4 py-3.5 text-right">{t('crd_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const st = creditStatus(c, now)
                const remaining = c.amount - c.paid
                const late = daysLate(c, now)
                return (
                  <tr key={c.id} onClick={() => setDetail(c)} className="cursor-pointer select-none border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                    <td className="px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{c.ref}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-zinc-400">{new Date(c.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-700 dark:text-zinc-300">{c.clientName}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-zinc-400">{c.invoiceRef}</td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{fmtDH(c.amount)}</td>
                    <td className="px-4 py-3.5 text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtDH(c.paid)}</td>
                    <td className="px-4 py-3.5 text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">{fmtDH(remaining)}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-zinc-400">{new Date(c.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3.5 text-sm tabular-nums">
                      {late > 0 ? <span className="font-bold text-rose-600 dark:text-rose-400">{late}</span> : <span className="text-gray-400 dark:text-zinc-500">0</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${STATUS_CHIP[st]}`}>{t(STATUS_KEY[st])}</span>
                    </td>
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {remaining > 0.001 && (
                          <button onClick={() => openPay(c)} className="btn-primary !h-8 !px-2.5 text-xs">
                            <HandCoins className="h-3.5 w-3.5" />
                            {t('crd_pay')}
                          </button>
                        )}
                        <button onClick={() => setDetail(c)} className="rounded-lg p-2 text-gray-400 dark:text-zinc-400 transition hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-500/10 dark:hover:text-sky-400" title={t('crd_view')}>
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => doPrint({ kind: 'invoice', credit: c })} className="rounded-lg p-2 text-gray-400 dark:text-zinc-400 transition hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-500/10 dark:hover:text-sky-400" title={t('crd_print')}>
                          <Printer className="h-4 w-4" />
                        </button>
                        <button onClick={() => openEdit(c)} className="rounded-lg p-2 text-gray-400 dark:text-zinc-400 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-400" title={t('crd_edit')}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(c)} className="rounded-lg p-2 text-gray-400 dark:text-zinc-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400" title={t('crd_delete')}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('crd_none')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ================= Detailed credit sheet ================= */}
      <Modal open={!!liveDetail} onClose={() => setDetail(null)} title={`${t('crd_detail_title')} — ${liveDetail?.ref ?? ''}`} maxWidth="max-w-6xl">
        {liveDetail && (() => {
          const c = liveDetail
          const st = creditStatus(c, now)
          const totals = totalsOf(c)
          const client = clientOf(c)
          const lines = enrich(c)
          const info: { label: string; value: string }[] = [
            { label: t('crd_d_credit_no'), value: c.ref },
            { label: t('crd_d_invoice_no'), value: c.invoiceRef },
            { label: t('crd_d_invoice_date'), value: new Date(c.date).toLocaleDateString('fr-FR') },
            { label: t('crd_d_client'), value: c.clientName },
            { label: t('crd_d_phone'), value: client?.phone || '—' },
            { label: t('crd_d_address'), value: client?.address || '—' },
            { label: t('crd_d_vendor'), value: VENDOR },
            { label: t('crd_d_payment_mode'), value: t('crd_mode_credit') },
            { label: t('crd_d_due'), value: new Date(c.dueDate).toLocaleDateString('fr-FR') },
          ]
          return (
            <div className="space-y-5 select-none">
              {/* General info */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('crd_d_general')}</p>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50/60 dark:bg-white/5 p-4 sm:grid-cols-3">
                  {info.map((f) => (
                    <div key={f.label}>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{f.label}</p>
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{f.value}</p>
                    </div>
                  ))}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('crd_d_status')}</p>
                    <span className={`mt-0.5 inline-block rounded-lg border px-2 py-0.5 text-xs font-bold ${STATUS_CHIP[st]}`}>{t(STATUS_KEY[st])}</span>
                  </div>
                </div>
              </div>

              {/* Articles table */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('crd_d_articles')}</p>
                <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                        <th className="px-3 py-2">{t('crd_dc_barcode')}</th>
                        <th className="px-3 py-2">{t('crd_dc_ref')}</th>
                        <th className="px-3 py-2">{t('crd_dc_designation')}</th>
                        <th className="px-3 py-2">{t('crd_dc_category')}</th>
                        <th className="whitespace-nowrap px-3 py-2 text-center">{t('crd_dc_qty')}</th>
                        <th className="px-3 py-2">{t('crd_dc_unit')}</th>
                        <th className="whitespace-nowrap px-3 py-2 text-right">{t('crd_dc_pu_ht')}</th>
                        <th className="whitespace-nowrap px-3 py-2 text-center">{t('crd_dc_tva')}</th>
                        <th className="whitespace-nowrap px-3 py-2 text-right">{t('crd_dc_pu_ttc')}</th>
                        <th className="whitespace-nowrap px-3 py-2 text-center">{t('crd_dc_discount')}</th>
                        <th className="whitespace-nowrap px-3 py-2 text-right">{t('crd_dc_total_ttc')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => (
                        <tr key={l.productId} className="border-b border-gray-50 dark:border-white/5">
                          <td className="px-3 py-2 text-xs text-gray-500 dark:text-zinc-400">{l.barcode}</td>
                          <td className="px-3 py-2 text-xs text-gray-500 dark:text-zinc-400">{l.ref}</td>
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{l.name}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-zinc-400">{l.category}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-center font-semibold tabular-nums text-gray-900 dark:text-white">{l.qty}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-zinc-400">{l.unit}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-700 dark:text-zinc-300">{fmtDH(l.puHT)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-center tabular-nums text-gray-600 dark:text-zinc-400">{l.tvaPct}%</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-700 dark:text-zinc-300">{fmtDH(l.puTTC)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-center tabular-nums text-gray-400 dark:text-zinc-500">{l.discount}%</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-white">{fmtDH(l.totalTTC)}</td>
                        </tr>
                      ))}
                      {lines.length === 0 && (
                        <tr><td colSpan={11} className="px-3 py-6 text-center text-xs text-gray-400 dark:text-zinc-500">—</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-4 rounded-xl bg-gradient-to-r from-amber-50 dark:from-amber-500/10 to-yellow-50 dark:to-yellow-500/5 p-4 text-sm">
                  <div className="text-center"><p className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-500">{t('crd_f_nb_articles')}</p><p className="font-bold tabular-nums text-gray-900 dark:text-white">{totals.nbArticles}</p></div>
                  <div className="text-center"><p className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-500">{t('crd_f_total_qty')}</p><p className="font-bold tabular-nums text-gray-900 dark:text-white">{totals.totalQty}</p></div>
                  <div className="text-center"><p className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-500">{t('crd_f_subtotal_ht')}</p><p className="font-bold tabular-nums text-gray-900 dark:text-white">{fmtDH(totals.subtotalHT)}</p></div>
                  <div className="text-center"><p className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-500">{t('crd_f_tva')}</p><p className="font-bold tabular-nums text-gray-900 dark:text-white">{fmtDH(totals.tvaAmount)}</p></div>
                  <div className="text-center"><p className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-500">{t('crd_f_global_discount')}</p><p className="font-bold tabular-nums text-gray-900 dark:text-white">{fmtDH(totals.globalDiscount)}</p></div>
                  <div className="text-center"><p className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">{t('crd_f_total_ttc')}</p><p className="text-base font-black tabular-nums text-gray-900 dark:text-white">{fmtDH(totals.totalTTC)}</p></div>
                </div>
              </div>

              {/* Payment history + Timeline */}
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('crd_ph_title')}</p>
                  <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                          <th className="px-3 py-2">{t('crd_ph_date')}</th>
                          <th className="px-3 py-2">{t('crd_ph_receipt')}</th>
                          <th className="px-3 py-2 text-right">{t('crd_ph_amount')}</th>
                          <th className="px-3 py-2">{t('crd_ph_method')}</th>
                          <th className="px-3 py-2">{t('crd_ph_user')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.payments.map((p) => (
                          <tr key={p.id} className="border-b border-gray-50 dark:border-white/5">
                            <td className="px-3 py-2 text-gray-600 dark:text-zinc-400">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                            <td className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-zinc-300">REC-{p.id.slice(-5).toUpperCase()}</td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtDH(p.amount)}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-zinc-400">{t(`crd_method_${p.method}` as TKey)}</td>
                            <td className="px-3 py-2 text-gray-500 dark:text-zinc-500">{VENDOR}</td>
                          </tr>
                        ))}
                        {c.payments.length === 0 && (
                          <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-400 dark:text-zinc-500">{t('crd_ph_none')}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex justify-between rounded-xl bg-gray-50/60 dark:bg-white/5 px-4 py-2 text-sm">
                    <span className="text-gray-500 dark:text-zinc-400">{t('crd_ph_total_paid')}: <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtDH(c.paid)}</span></span>
                    <span className="text-gray-500 dark:text-zinc-400">{t('crd_ph_remaining')}: <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">{fmtDH(c.amount - c.paid)}</span></span>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('crd_ops_title')}</p>
                  <div className="relative space-y-4 rounded-xl bg-gray-50/60 dark:bg-white/5 p-4 pl-6">
                    <span className="absolute left-[13px] top-4 bottom-4 w-px bg-gray-200 dark:bg-white/10" />
                    {timelineOf(c).map((e, idx) => (
                      <div key={idx} className="relative">
                        <span className={`absolute -left-[18px] top-1 h-2.5 w-2.5 rounded-full ${e.cls} ring-2 ring-white dark:ring-[#12121a]`} />
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">{e.label}</p>
                        <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                          {new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} · {e.detail} · {VENDOR}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 dark:border-white/10 pt-4">
                {c.amount - c.paid > 0.001 && (
                  <button onClick={() => openPay(c)} className="btn-primary">
                    <HandCoins className="h-4 w-4" />
                    {t('crd_btn_add_payment')}
                  </button>
                )}
                <button onClick={() => doPrint({ kind: 'invoice', credit: c })} className="btn-secondary">
                  <Printer className="h-4 w-4" />
                  {t('crd_btn_print_invoice')}
                </button>
                <button onClick={() => doPrint({ kind: 'history', credit: c })} className="btn-secondary">
                  <Printer className="h-4 w-4" />
                  {t('crd_btn_print_history')}
                </button>
                <button onClick={() => exportCreditExcel(c)} className="btn-secondary">
                  <FileDown className="h-4 w-4" />
                  {t('crd_btn_export_excel')}
                </button>
                <button onClick={() => doPrint({ kind: 'history', credit: c })} className="btn-secondary">
                  <FileDown className="h-4 w-4" />
                  {t('crd_btn_export_pdf')}
                </button>
                <button onClick={() => setDetail(null)} className="btn-secondary">
                  <X className="h-4 w-4" />
                  {t('crd_btn_close')}
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Pay modal */}
      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title={t('crd_pay_title')} maxWidth="max-w-sm">
        {payTarget && (
          <div className="space-y-4">
            <div className="rounded-xl bg-gray-50/60 dark:bg-white/5 p-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500 dark:text-zinc-400">{t('crd_pay_client')}</span><span className="font-semibold text-gray-900 dark:text-white">{payTarget.clientName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-zinc-400">{t('crd_pay_invoice')}</span><span className="font-semibold text-gray-900 dark:text-white">{payTarget.invoiceRef}</span></div>
              <div className="mt-1 flex justify-between border-t border-gray-100 dark:border-white/10 pt-1"><span className="text-gray-500 dark:text-zinc-400">{t('crd_remaining_prefix')}</span><span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">{fmtDH(payTarget.amount - payTarget.paid)}</span></div>
            </div>
            <div>
              <label className="field-label">{t('crd_pay_amount')}</label>
              <input type="number" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="input-field" autoFocus />
            </div>
            <div>
              <label className="field-label">{t('crd_pay_method')}</label>
              <Select
                value={payMethod}
                onChange={(v) => setPayMethod(v as CreditInstalment['method'])}
                options={[
                  { value: 'especes', label: t('crd_method_especes') },
                  { value: 'carte', label: t('crd_method_carte') },
                  { value: 'virement', label: t('crd_method_virement') },
                  { value: 'cheque', label: t('crd_method_cheque') },
                ]}
              />
            </div>
            <div>
              <label className="field-label">{t('crd_pay_note')}</label>
              <input type="text" value={payNote} onChange={(e) => setPayNote(e.target.value)} className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button onClick={() => setPayTarget(null)} className="btn-secondary">{t('crd_cancel')}</button>
              <button onClick={confirmPay} className="btn-primary">
                <HandCoins className="h-4 w-4" />
                {t('crd_validate')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* New credit modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title={t('crd_new_title')} maxWidth="max-w-sm">
        <div className="space-y-4">
          <div>
            <label className="field-label">{t('crd_pay_client')}</label>
            <Select value={newClient} onChange={setNewClient} placeholder={t('crd_choose_client')} options={[{ value: '', label: t('crd_choose_client') }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
          </div>
          <div>
            <label className="field-label">{t('crd_new_amount')}</label>
            <input type="number" min="0" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="field-label">{t('crd_new_due')}</label>
            <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="field-label">{t('crd_new_ref')}</label>
            <input type="text" value={newRef} onChange={(e) => setNewRef(e.target.value)} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={() => setNewOpen(false)} className="btn-secondary">{t('crd_cancel')}</button>
            <button onClick={createCredit} className="btn-primary">
              <Plus className="h-4 w-4" />
              {t('crd_validate')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={t('crd_edit_title')} maxWidth="max-w-sm">
        {editTarget && (
          <div className="space-y-4">
            <div>
              <label className="field-label">{t('crd_new_amount')}</label>
              <input type="number" min="0" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="field-label">{t('crd_new_due')}</label>
              <input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button onClick={() => setEditTarget(null)} className="btn-secondary">{t('crd_cancel')}</button>
              <button onClick={confirmEdit} className="btn-primary">{t('crd_validate')}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('crd_delete_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <span className="font-semibold text-gray-900 dark:text-white">{deleteTarget?.ref}</span> — {t('crd_delete_desc')}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">{t('crd_cancel')}</button>
          <button onClick={confirmDelete} className="btn-danger">
            <Trash2 className="h-4 w-4" />
            {t('crd_delete')}
          </button>
        </div>
      </Modal>

      {/* ===== Hidden print sections ===== */}
      {printState.kind === 'invoice' && printState.credit ? (
        <div className="hidden print:block">
          <InvoiceDocument
            title={t('fdoc_invoice')}
            number={printState.credit.invoiceRef}
            date={printState.credit.date}
            partyLabel={t('fdoc_client')}
            partyName={printState.credit.clientName}
            lines={printState.credit.items.map((i) => ({ label: i.name, qty: i.qty, puHT: i.price / (1 + settings.tva / 100), tvaPct: settings.tva }))}
            paid={printState.credit.paid}
            showBalance
          />
        </div>
      ) : (
        <div className="hidden print:block print-area bg-white p-6 text-gray-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-bold">{settings.storeName}</p>
              <p className="text-xs text-gray-500">{settings.address}</p>
            </div>
            <p className="text-base font-bold text-amber-600">{t('crd_title')}</p>
          </div>
          {printState.kind === 'history' && printState.credit ? (
            <div className="text-sm">
              <p className="text-base font-bold">{printState.credit.ref} — {printState.credit.clientName}</p>
              <p className="text-xs text-gray-600">{t('crd_d_invoice_no')}: {printState.credit.invoiceRef} · {t('crd_d_due')}: {new Date(printState.credit.dueDate).toLocaleDateString('fr-FR')}</p>
              <p className="mt-4 text-xs font-bold uppercase text-gray-500">{t('crd_d_articles')}</p>
              <table className="mt-1 w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-gray-300 text-left">
                    <th className="py-1">{t('crd_dc_designation')}</th>
                    <th className="py-1 text-center">{t('crd_dc_qty')}</th>
                    <th className="py-1 text-right">{t('crd_dc_pu_ttc')}</th>
                    <th className="py-1 text-right">{t('crd_dc_total_ttc')}</th>
                  </tr>
                </thead>
                <tbody>
                  {enrich(printState.credit).map((l) => (
                    <tr key={l.productId} className="border-b border-gray-100">
                      <td className="py-1">{l.name}</td>
                      <td className="py-1 text-center">{l.qty}</td>
                      <td className="py-1 text-right">{fmtDH(l.puTTC)}</td>
                      <td className="py-1 text-right">{fmtDH(l.totalTTC)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 text-xs font-bold uppercase text-gray-500">{t('crd_ph_title')}</p>
              <table className="mt-1 w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-gray-300 text-left">
                    <th className="py-1">{t('crd_ph_date')}</th>
                    <th className="py-1">{t('crd_ph_receipt')}</th>
                    <th className="py-1 text-right">{t('crd_ph_amount')}</th>
                    <th className="py-1">{t('crd_ph_method')}</th>
                  </tr>
                </thead>
                <tbody>
                  {printState.credit.payments.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="py-1">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                      <td className="py-1">REC-{p.id.slice(-5).toUpperCase()}</td>
                      <td className="py-1 text-right">{fmtDH(p.amount)}</td>
                      <td className="py-1">{t(`crd_method_${p.method}` as TKey)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex justify-between font-bold">
                <span>{t('crd_ph_total_paid')}: {fmtDH(printState.credit.paid)}</span>
                <span>{t('crd_ph_remaining')}: {fmtDH(printState.credit.amount - printState.credit.paid)}</span>
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th className="py-1 pr-2">{t('crd_col_ref')}</th>
                  <th className="py-1 pr-2">{t('crd_col_client')}</th>
                  <th className="py-1 pr-2">{t('crd_col_invoice')}</th>
                  <th className="py-1 pr-2 text-right">{t('crd_col_amount')}</th>
                  <th className="py-1 pr-2 text-right">{t('crd_col_remaining')}</th>
                  <th className="py-1 pr-2">{t('crd_col_due')}</th>
                  <th className="py-1">{t('crd_col_status')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-1 pr-2 font-semibold">{c.ref}</td>
                    <td className="py-1 pr-2">{c.clientName}</td>
                    <td className="py-1 pr-2">{c.invoiceRef}</td>
                    <td className="py-1 pr-2 text-right">{fmtDH(c.amount)}</td>
                    <td className="py-1 pr-2 text-right">{fmtDH(c.amount - c.paid)}</td>
                    <td className="py-1 pr-2">{new Date(c.dueDate).toLocaleDateString('fr-FR')}</td>
                    <td className="py-1">{t(STATUS_KEY[creditStatus(c, now)])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  )
}

export default function CreditsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
