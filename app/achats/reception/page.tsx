'use client'

import { useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Eye, PackageCheck, Search } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { fmtDH, useDroguerie, type Purchase, type PurchaseItem } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const STATE_OPTIONS: { key: PurchaseItem['receptionState']; labelKey: TKey }[] = [
  { key: 'conforme', labelKey: 'recep_state_conforme' },
  { key: 'manquant', labelKey: 'recep_state_manquant' },
  { key: 'endommage', labelKey: 'recep_state_endommage' },
]

function Content() {
  const { ready, purchases, validateReception } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<Purchase | null>(null)
  const [receiveTarget, setReceiveTarget] = useState<Purchase | null>(null)
  const [rows, setRows] = useState<Record<string, { qty: string; state: PurchaseItem['receptionState']; note: string }>>({})
  const [employee, setEmployee] = useState('')
  const [depot, setDepot] = useState('')

  if (!ready) {
    return <Loader />
  }

  const pending = purchases
    .filter((p) => p.status === 'en_attente' || p.status === 'partiellement_recue')
    .filter((p) => {
      const q = query.trim().toLowerCase()
      return !q || p.ref.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q)
    })

  const openReceive = (p: Purchase) => {
    setReceiveTarget(p)
    setEmployee('')
    setDepot('')
    const init: Record<string, { qty: string; state: PurchaseItem['receptionState']; note: string }> = {}
    p.items.forEach((i) => {
      const remaining = Math.max(0, i.qty - (i.receivedQty ?? 0))
      init[i.productId] = { qty: String(remaining), state: 'conforme', note: '' }
    })
    setRows(init)
  }

  const confirmReceive = () => {
    if (!receiveTarget) return
    const received = Object.entries(rows)
      .map(([productId, r]) => ({ productId, receivedQty: Math.max(0, Math.round(parseFloat(r.qty.replace(',', '.')) || 0)), state: r.state, note: r.note }))
      .filter((r) => r.receivedQty > 0)
    if (received.length === 0) {
      toast(t('recep_nothing_to_receive'), 'error')
      return
    }
    validateReception(receiveTarget.id, received, { employee, depot })
    toast(`✓ ${receiveTarget.ref} ${t('recep_toast_validated')}`)
    setReceiveTarget(null)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('recep_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('recep_subtitle')}</p>
      </motion.div>

      <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('recep_search_placeholder')}
          className="input-field pl-10"
        />
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('recep_col_ref')}</th>
                <th className="px-5 py-3.5">{t('recep_col_supplier')}</th>
                <th className="px-5 py-3.5">{t('recep_col_order_date')}</th>
                <th className="px-5 py-3.5">{t('recep_col_items')}</th>
                <th className="px-5 py-3.5">{t('recep_col_total')}</th>
                <th className="px-5 py-3.5">{t('po_col_status')}</th>
                <th className="px-5 py-3.5 text-right">{t('recep_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{p.ref}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-zinc-300">{p.supplierName}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">
                    {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">{p.items.reduce((a, i) => a + i.qty, 0)}</td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(p.total)}</td>
                  <td className="px-5 py-3.5">
                    {p.status === 'partiellement_recue' && (
                      <span className="rounded-lg border border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/10 px-2 py-1 text-xs font-bold text-sky-700 dark:text-sky-400">
                        {t('po_status_partial')}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setDetail(p)} className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-sky-50 hover:text-sky-600" title={t('recep_view_detail')}>
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => openReceive(p)} className="btn-primary !h-8 !px-2.5 text-xs">
                        <PackageCheck className="h-3.5 w-3.5" />
                        {t('recep_receive')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('recep_none_pending')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`${t('recep_order_prefix')} ${detail?.ref ?? ''}`} maxWidth="max-w-sm">
        {detail && (
          <div className="space-y-2">
            {detail.items.map((i) => (
              <div key={i.productId} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{i.name}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 tabular-nums">
                    {t('recep_col_ordered')}: {i.qty} · {t('recep_col_received_so_far')}: {i.receivedQty ?? 0}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(i.cost * i.qty)}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Reception validation modal */}
      <Modal open={!!receiveTarget} onClose={() => setReceiveTarget(null)} title={`${t('recep_validate')} — ${receiveTarget?.ref ?? ''}`} maxWidth="max-w-4xl">
        {receiveTarget && (
          <div className="space-y-4">
            {receiveTarget.status === 'partiellement_recue' && (
              <p className="rounded-xl bg-sky-50 dark:bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-700 dark:text-sky-400">{t('recep_status_partial')}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">{t('recep_employee')}</label>
                <input type="text" value={employee} onChange={(e) => setEmployee(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="field-label">{t('recep_depot')}</label>
                <input type="text" value={depot} onChange={(e) => setDepot(e.target.value)} className="input-field" />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                    <th className="px-3 py-2.5">{t('bl_designation')}</th>
                    <th className="px-3 py-2.5 text-center">{t('recep_col_ordered')}</th>
                    <th className="px-3 py-2.5 text-center">{t('recep_col_received_so_far')}</th>
                    <th className="px-3 py-2.5 text-center">{t('recep_col_receive_now')}</th>
                    <th className="px-3 py-2.5">{t('recep_col_state')}</th>
                    <th className="px-3 py-2.5">{t('recep_col_note')}</th>
                  </tr>
                </thead>
                <tbody>
                  {receiveTarget.items.map((i) => {
                    const row = rows[i.productId] ?? { qty: '0', state: 'conforme' as const, note: '' }
                    const remaining = Math.max(0, i.qty - (i.receivedQty ?? 0))
                    return (
                      <tr key={i.productId} className="border-b border-gray-50 dark:border-white/5">
                        <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white">{i.name}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-400">{i.qty}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-400">{i.receivedQty ?? 0}</td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            value={row.qty}
                            onChange={(e) => setRows({ ...rows, [i.productId]: { ...row, qty: e.target.value } })}
                            className="input-field !h-9 w-20 text-center"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <Select
                            value={row.state ?? 'conforme'}
                            onChange={(v) => setRows({ ...rows, [i.productId]: { ...row, state: v as PurchaseItem['receptionState'] } })}
                            options={STATE_OPTIONS.map((o) => ({ value: o.key as string, label: t(o.labelKey) }))}
                            className="!h-9 min-w-[120px]"
                          />
                        </td>
                        <td className="min-w-[160px] px-3 py-2.5">
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => setRows({ ...rows, [i.productId]: { ...row, note: e.target.value } })}
                            className="input-field !h-9 w-full"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button onClick={() => setReceiveTarget(null)} className="btn-secondary">
                {t('recep_cancel')}
              </button>
              <button onClick={confirmReceive} className="btn-primary">
                <PackageCheck className="h-4 w-4" />
                {t('recep_validate')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

export default function ReceptionPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
