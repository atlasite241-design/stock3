'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Eye, FileDown, Pencil, Plus, Printer, Search, Send, Trash2, Truck } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { fmtDH, useDroguerie, type Purchase, type PurchaseItem } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const STATUS_KEY: Record<Purchase['status'], TKey> = {
  en_attente: 'po_status_pending',
  partiellement_recue: 'po_status_partial',
  recue: 'po_status_received',
  retournee: 'po_status_returned',
}
const STATUS_CHIP: Record<Purchase['status'], string> = {
  en_attente: 'border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
  partiellement_recue: 'border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400',
  recue: 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  retournee: 'border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400',
}

const lineTotal = (i: PurchaseItem) => i.cost * i.qty * (1 - (i.discount ?? 0) / 100) * (1 + (i.tva ?? 0) / 100)

function Content() {
  const { ready, products, suppliers, purchases, addPurchase, updatePurchase, deletePurchase } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [newOpen, setNewOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState('')
  const [supplierRef, setSupplierRef] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [note, setNote] = useState('')
  const [globalDiscount, setGlobalDiscount] = useState('0')
  const [lines, setLines] = useState<PurchaseItem[]>([])
  const [lineProduct, setLineProduct] = useState('')
  const [lineQty, setLineQty] = useState('10')
  const [lineDiscount, setLineDiscount] = useState('0')
  const [lineTva, setLineTva] = useState('20')
  const [detail, setDetail] = useState<Purchase | null>(null)
  const [printTarget, setPrintTarget] = useState<Purchase | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('tous')

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const visible = purchases
    .filter((p) => statusFilter === 'tous' || p.status === statusFilter)
    .filter((p) => {
      const q = query.trim().toLowerCase()
      return !q || p.ref.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q) || (p.supplierRef ?? '').toLowerCase().includes(q)
    })

  const resetForm = () => {
    setEditingId(null)
    setSupplierId('')
    setSupplierRef('')
    setExpectedDate('')
    setNote('')
    setGlobalDiscount('0')
    setLines([])
    setLineProduct('')
    setLineQty('10')
    setLineDiscount('0')
    setLineTva('20')
  }

  const openAdd = () => {
    resetForm()
    setNewOpen(true)
  }

  const openEdit = (p: Purchase) => {
    setEditingId(p.id)
    setSupplierId(p.supplierId)
    setSupplierRef(p.supplierRef ?? '')
    setExpectedDate(p.expectedDate ?? '')
    setNote(p.note ?? '')
    setGlobalDiscount(String(p.globalDiscount ?? 0))
    setLines(p.items)
    setNewOpen(true)
  }

  const addLine = () => {
    const p = products.find((x) => x.id === lineProduct)
    if (!p) {
      toast(t('po_toast_choose_product'), 'error')
      return
    }
    const qty = Math.max(1, Math.round(parseFloat(lineQty.replace(',', '.')) || 0))
    const discount = Math.max(0, parseFloat(lineDiscount.replace(',', '.')) || 0)
    const tva = Math.max(0, parseFloat(lineTva.replace(',', '.')) || 0)
    setLines((ls) => {
      const ex = ls.find((l) => l.productId === p.id)
      return ex
        ? ls.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + qty } : l))
        : [...ls, { productId: p.id, name: p.name, barcode: p.barcode, cost: p.cost, qty, discount, tva }]
    })
    setLineProduct('')
    setLineQty('10')
  }

  const subTotalHT = lines.reduce((a, l) => a + l.cost * l.qty * (1 - (l.discount ?? 0) / 100), 0)
  const tvaTotal = lines.reduce((a, l) => a + l.cost * l.qty * (1 - (l.discount ?? 0) / 100) * ((l.tva ?? 0) / 100), 0)
  const gDiscount = Math.max(0, parseFloat(globalDiscount.replace(',', '.')) || 0)
  const totalTTC = (subTotalHT + tvaTotal) * (1 - gDiscount / 100)

  const saveOrder = () => {
    if (!supplierId) {
      toast(t('po_toast_choose_supplier'), 'error')
      return
    }
    if (lines.length === 0) {
      toast(t('po_toast_add_product'), 'error')
      return
    }
    const meta = { supplierRef: supplierRef || undefined, expectedDate: expectedDate || undefined, note: note || undefined, globalDiscount: gDiscount || undefined }
    if (editingId) {
      updatePurchase(editingId, { supplierId, supplierName: suppliers.find((s) => s.id === supplierId)?.name, items: lines, ...meta })
      toast(`✓ ${t('po_toast_updated')}`)
    } else {
      const po = addPurchase(supplierId, lines, meta)
      toast(`✓ ${t('po_order_prefix')} ${po?.ref ?? ''} ${t('po_toast_created')}`)
    }
    setNewOpen(false)
    resetForm()
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deletePurchase(deleteTarget.id)
    toast(`✓ ${deleteTarget.ref} ${t('po_toast_deleted')}`)
    setDeleteTarget(null)
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('po_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('po_subtitle')}</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="h-4 w-4" />
          {t('po_new_order')}
        </button>
      </motion.div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('po_search_placeholder')}
            className="input-field pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'tous', label: t('po_all') },
            { value: 'en_attente', label: t('po_status_pending') },
            { value: 'partiellement_recue', label: t('po_status_partial') },
            { value: 'recue', label: t('po_status_received') },
            { value: 'retournee', label: t('po_status_returned') },
          ]}
          className="w-auto min-w-[180px]"
        />
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('po_col_ref')}</th>
                <th className="px-5 py-3.5">{t('po_col_supplier')}</th>
                <th className="px-5 py-3.5">{t('po_col_items')}</th>
                <th className="px-5 py-3.5">{t('po_col_total')}</th>
                <th className="px-5 py-3.5">{t('po_col_status')}</th>
                <th className="px-5 py-3.5 text-right">{t('po_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className="group border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{p.ref}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">
                      {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-zinc-300">{p.supplierName}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">
                    {p.items.reduce((a, i) => a + i.qty, 0)}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(p.total)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${STATUS_CHIP[p.status]}`}>
                      {t(STATUS_KEY[p.status])}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {(p.status === 'en_attente' || p.status === 'partiellement_recue') && (
                        <Link href="/achats/reception" className="btn-secondary !h-8 !px-2.5 text-xs">
                          <Truck className="h-3.5 w-3.5" />
                          {t('po_receive')}
                        </Link>
                      )}
                      <button onClick={() => setPrintTarget(p)} className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-500/10 dark:hover:text-sky-400" title={t('po_print')}>
                        <Printer className="h-4 w-4" />
                      </button>
                      {p.status === 'en_attente' && (
                        <>
                          <button onClick={() => openEdit(p)} className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-400" title={t('po_edit')}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(p)} className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400" title={t('po_delete')}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setDetail(p)}
                        className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-400"
                        title={t('po_details')}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('po_none_in_view')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* New / edit order modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title={editingId ? t('po_edit_title') : t('po_new_supplier_order')} maxWidth="max-w-3xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">{t('po_number_label')}</label>
              <input type="text" disabled value={editingId ? purchases.find((p) => p.id === editingId)?.ref ?? '' : t('po_number_auto')} className="input-field opacity-60" />
            </div>
            <div>
              <label className="field-label">{t('po_date_label')}</label>
              <input type="text" disabled value={new Date().toLocaleDateString('fr-FR')} className="input-field opacity-60" />
            </div>
            <div>
              <label className="field-label">{t('po_supplier_required')}</label>
              <Select
                value={supplierId}
                onChange={setSupplierId}
                placeholder={t('po_choose')}
                options={[{ value: '', label: t('po_choose') }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
              />
            </div>
            <div>
              <label className="field-label">{t('po_supplier_ref_label')}</label>
              <input type="text" value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="field-label">{t('po_expected_date_label')}</label>
              <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="field-label">{t('po_global_discount')}</label>
              <input type="number" min="0" max="100" value={globalDiscount} onChange={(e) => setGlobalDiscount(e.target.value)} className="input-field" />
            </div>
          </div>
          <div>
            <label className="field-label">{t('po_note_label')}</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input-field resize-none" />
          </div>

          <div>
            <label className="field-label">{t('po_add_products')}</label>
            <div className="flex flex-wrap gap-2">
              <Select
                value={lineProduct}
                onChange={setLineProduct}
                placeholder={t('po_product_placeholder')}
                className="min-w-[200px] flex-1"
                options={[
                  { value: '', label: t('po_product_placeholder') },
                  ...products.map((p) => ({ value: p.id, label: `${p.name} (${t('po_buy_abbr')} ${fmtDH(p.cost)})` })),
                ]}
              />
              <input type="number" min="1" value={lineQty} onChange={(e) => setLineQty(e.target.value)} placeholder={t('po_col_qty')} className="input-field w-20" />
              <input type="number" min="0" value={lineDiscount} onChange={(e) => setLineDiscount(e.target.value)} placeholder={t('po_col_discount')} className="input-field w-20" />
              <input type="number" min="0" value={lineTva} onChange={(e) => setLineTva(e.target.value)} placeholder={t('po_col_tva')} className="input-field w-20" />
              <button onClick={addLine} className="btn-secondary shrink-0 !px-3">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {lines.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                    <th className="px-3 py-2">{t('po_col_barcode')}</th>
                    <th className="px-3 py-2">{t('po_col_designation')}</th>
                    <th className="px-3 py-2 text-center">{t('po_col_qty')}</th>
                    <th className="px-3 py-2 text-right">{t('po_col_cost')}</th>
                    <th className="px-3 py-2 text-center">{t('po_col_discount')}</th>
                    <th className="px-3 py-2 text-center">{t('po_col_tva')}</th>
                    <th className="px-3 py-2 text-right">{t('po_col_line_total')}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.productId} className="border-b border-gray-50 dark:border-white/5">
                      <td className="px-3 py-2 text-xs text-gray-500 dark:text-zinc-400">{l.barcode || '—'}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{l.name}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{l.qty}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtDH(l.cost)}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{l.discount ?? 0}%</td>
                      <td className="px-3 py-2 text-center tabular-nums">{l.tva ?? 0}%</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{fmtDH(lineTotal(l))}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => setLines(lines.filter((x) => x.productId !== l.productId))} className="rounded p-1 text-gray-400 dark:text-zinc-500 hover:bg-rose-50 hover:text-rose-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {lines.length > 0 && (
            <div className="space-y-1 rounded-xl bg-gradient-to-r from-amber-50 dark:from-amber-500/10 to-yellow-50 dark:to-yellow-500/5 p-4">
              <div className="flex justify-between text-sm text-gray-600 dark:text-zinc-400">
                <span>{t('po_subtotal_ht')}</span>
                <span className="tabular-nums">{fmtDH(subTotalHT)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-zinc-400">
                <span>{t('po_tva_total')}</span>
                <span className="tabular-nums">{fmtDH(tvaTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-amber-200/50 dark:border-white/10 pt-1.5 text-base font-bold text-gray-900 dark:text-white">
                <span>{t('po_total_ttc')}</span>
                <span className="tabular-nums">{fmtDH(totalTTC)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={() => setNewOpen(false)} className="btn-secondary">
              {t('po_cancel')}
            </button>
            <button onClick={saveOrder} className="btn-primary">
              <Truck className="h-4 w-4" />
              {editingId ? t('po_save') : t('po_create_order')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`${t('po_order_prefix')} ${detail?.ref ?? ''}`} maxWidth="max-w-sm">
        {detail && (
          <>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              {new Date(detail.date).toLocaleString('fr-FR')} — {detail.supplierName}
            </p>
            <div className="mt-3 space-y-2">
              {detail.items.map((i) => (
                <div key={i.productId} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{i.name}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 tabular-nums">
                      {i.qty} × {fmtDH(i.cost)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(lineTotal(i))}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1 rounded-xl bg-gradient-to-r from-amber-50 dark:from-amber-500/10 to-yellow-50 dark:to-yellow-500/5 p-4">
              <div className="flex justify-between text-sm text-gray-600 dark:text-zinc-400">
                <span>{t('po_col_status')}</span>
                <span className="font-semibold">{t(STATUS_KEY[detail.status])}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-zinc-400">
                <span>{t('po_paid')}</span>
                <span className="font-semibold tabular-nums">{fmtDH(detail.paid)}</span>
              </div>
              <div className="flex justify-between pt-1 text-base font-bold text-gray-900 dark:text-white">
                <span>{t('po_col_total')}</span>
                <span className="tabular-nums">{fmtDH(detail.total)}</span>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* Print / PDF / Send modal */}
      <Modal open={!!printTarget} onClose={() => setPrintTarget(null)} title={`${t('po_order_prefix')} ${printTarget?.ref ?? ''}`} maxWidth="max-w-md">
        {printTarget && (
          <>
            <div className="print-area rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{t('po_order_prefix')}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{printTarget.supplierName}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-amber-600 dark:text-amber-400">{printTarget.ref}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{new Date(printTarget.date).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
              {printTarget.supplierRef && (
                <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
                  {t('po_supplier_ref_label')}: {printTarget.supplierRef}
                </p>
              )}
              {printTarget.expectedDate && (
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  {t('po_expected_date_label')}: {new Date(printTarget.expectedDate).toLocaleDateString('fr-FR')}
                </p>
              )}
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10 text-left text-[11px] font-bold uppercase text-gray-400 dark:text-zinc-500">
                    <th className="py-2">{t('po_col_designation')}</th>
                    <th className="py-2 text-right">{t('po_col_qty')}</th>
                    <th className="py-2 text-right">{t('po_col_line_total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {printTarget.items.map((i) => (
                    <tr key={i.productId} className="border-b border-gray-100 dark:border-white/10">
                      <td className="py-2 text-gray-800 dark:text-zinc-100">{i.name}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{i.qty}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{fmtDH(lineTotal(i))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex justify-between text-base font-bold text-gray-900 dark:text-white">
                <span>{t('po_total_ttc')}</span>
                <span className="tabular-nums">{fmtDH(printTarget.total)}</span>
              </div>
              {printTarget.note && <p className="mt-3 text-xs text-gray-500 dark:text-zinc-400">{printTarget.note}</p>}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button onClick={() => window.print()} className="btn-secondary">
                <Printer className="h-4 w-4" />
                {t('po_print')}
              </button>
              <button onClick={() => window.print()} className="btn-secondary">
                <FileDown className="h-4 w-4" />
                {t('po_export_pdf')}
              </button>
              <button
                onClick={() => {
                  toast(t('po_toast_send_ready'))
                  window.print()
                }}
                className="btn-primary"
              >
                <Send className="h-4 w-4" />
                {t('po_send_supplier')}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('po_delete_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <span className="font-semibold text-gray-900 dark:text-white">{deleteTarget?.ref}</span> {t('po_delete_desc')}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
            {t('po_cancel')}
          </button>
          <button onClick={confirmDelete} className="btn-danger">
            <Trash2 className="h-4 w-4" />
            {t('po_delete')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function AchatsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
