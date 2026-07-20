'use client'

import React, { useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { ArrowLeftRight, ArrowRight, Printer, TriangleAlert } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import TransferDocument from '@/components/TransferDocument'
import {
  transferQty,
  TRANSFER_FLOW,
  TRANSFER_META,
  useDroguerie,
  type Transfer,
  type TransferStatus,
} from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const STATUS_KEY: Record<TransferStatus, TKey> = {
  brouillon: 'trf_status_brouillon',
  valide: 'trf_status_valide',
  expedie: 'trf_status_expedie',
  recu: 'trf_status_recu',
  termine: 'trf_status_termine',
}

function Content() {
  const { ready, transfers, stores } = useDroguerie()
  const { t } = useLanguage()
  const [selectedRef, setSelectedRef] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [printing, setPrinting] = useState<Transfer | null>(null)

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? '—'

  const sorted = useMemo(() => [...transfers].sort((a, b) => b.date.localeCompare(a.date)), [transfers])

  // Affichage filtré : par date si renseignée, sinon le transfert choisi (défaut = le plus récent).
  const effectiveRef = selectedRef || sorted[0]?.ref || ''
  const list = useMemo(() => {
    if (dateFilter) return sorted.filter((tr) => tr.date.slice(0, 10) === dateFilter)
    return sorted.filter((tr) => tr.ref === effectiveRef)
  }, [sorted, dateFilter, effectiveRef])

  if (!ready) {
    return <Loader />
  }

  const refOptions = sorted.map((tr) => ({ value: tr.ref, label: tr.ref }))

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <ArrowLeftRight className="h-6 w-6 text-amber-500" />
            {t('trfd_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('trfd_subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[190px]">
            <Select
              value={dateFilter ? '' : effectiveRef}
              onChange={(v) => { setSelectedRef(v); setDateFilter('') }}
              options={refOptions}
              placeholder={t('trfd_filter_number')}
            />
          </div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); setSelectedRef('') }}
            className="input-field w-auto"
            aria-label={t('trfd_filter_date')}
          />
          {dateFilter && (
            <button onClick={() => setDateFilter('')} className="btn-secondary !h-9 text-xs">{t('trfd_reset')}</button>
          )}
        </div>
      </motion.div>

      {list.length === 0 && (
        <div className="glass-card p-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('trfd_none')}</div>
      )}

      <div className="space-y-6">
        {list.map((transfer, idx) => {
          const currentIdx = TRANSFER_FLOW.indexOf(transfer.status)
          const totalQty = transferQty(transfer.items, transfer.status === 'termine' ? 'receivedQty' : transfer.status === 'expedie' ? 'transferredQty' : 'requestedQty')
          return (
            <motion.div
              key={transfer.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.3), duration: 0.35 }}
              className="glass-card space-y-5 p-6"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-amber-600 dark:text-amber-400">{transfer.ref}</span>
                  {transfer.hasDiscrepancy && <TriangleAlert className="h-4 w-4 text-rose-500" />}
                  <span className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${TRANSFER_META[transfer.status].chip}`}>{t(STATUS_KEY[transfer.status])}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-zinc-400">
                    {new Date(transfer.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} · {transfer.user} · {transfer.items.length} art. · {totalQty}
                  </span>
                  <button onClick={() => setPrinting(transfer)} className="btn-secondary !h-8 !px-3 text-xs">
                    <Printer className="h-3.5 w-3.5" />
                    {t('trfd_print')}
                  </button>
                </div>
              </div>

              {/* Workflow steps */}
              <div className="flex items-center justify-between gap-1">
                {TRANSFER_FLOW.map((s, i) => (
                  <React.Fragment key={s}>
                    <div className="flex flex-col items-center gap-1">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i <= currentIdx ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-zinc-500'}`}>{i + 1}</div>
                      <span className={`text-[10px] font-semibold ${i <= currentIdx ? 'text-gray-800 dark:text-zinc-200' : 'text-gray-400 dark:text-zinc-500'}`}>{t(STATUS_KEY[s])}</span>
                    </div>
                    {i < TRANSFER_FLOW.length - 1 && <div className={`h-0.5 flex-1 ${i < currentIdx ? 'bg-amber-500' : 'bg-gray-100 dark:bg-white/10'}`} />}
                  </React.Fragment>
                ))}
              </div>

              {/* Source / destination */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-gray-100 p-3 dark:border-white/10">
                  <p className="text-[10px] font-bold uppercase text-gray-400">{t('trf_source')}</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{storeName(transfer.sourceStoreId)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 p-3 dark:border-white/10">
                  <p className="text-[10px] font-bold uppercase text-gray-400">{t('trf_dest')}</p>
                  <p className="flex items-center gap-1 font-semibold text-gray-900 dark:text-white">
                    <ArrowRight className="h-3.5 w-3.5 text-gray-300 dark:text-zinc-600" />
                    {storeName(transfer.destStoreId)}
                  </p>
                </div>
              </div>

              {transfer.hasDiscrepancy && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
                  <TriangleAlert className="h-4 w-4" />
                  {t('trf_discrepancy')}
                </div>
              )}

              {/* Items */}
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                      <th className="px-4 py-2.5">{t('trf_col_name')}</th>
                      <th className="px-4 py-2.5 text-right">{t('trf_col_requested')}</th>
                      <th className="px-4 py-2.5 text-right">{t('trf_col_transferred')}</th>
                      <th className="px-4 py-2.5 text-right">{t('trf_col_received')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfer.items.map((it) => (
                      <tr key={it.productId} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{it.name}</td>
                        <td className="px-4 py-2 text-right text-gray-600 dark:text-zinc-400 tabular-nums">{it.requestedQty}</td>
                        <td className="px-4 py-2 text-right text-gray-600 dark:text-zinc-400 tabular-nums">{it.transferredQty || '—'}</td>
                        <td className="px-4 py-2 text-right text-gray-600 dark:text-zinc-400 tabular-nums">{it.receivedQty ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* History */}
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">{t('trf_history')}</p>
                <div className="space-y-2">
                  {transfer.history.map((h) => (
                    <div key={h.id} className="flex items-start gap-3 text-xs">
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                      <div>
                        <span className="font-semibold text-gray-800 dark:text-zinc-200">{h.action in STATUS_KEY ? t(STATUS_KEY[h.action as TransferStatus]) : h.action}</span>
                        <span className="text-gray-400"> · {new Date(h.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {h.user}</span>
                        {h.comment && <p className="text-gray-500 dark:text-zinc-400">{h.comment}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Print modal */}
      <Modal open={!!printing} onClose={() => setPrinting(null)} title={t('trfd_print')} maxWidth="max-w-3xl">
        {printing && (
          <>
            <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-gray-100 dark:border-white/10">
              <TransferDocument transfer={printing} />
            </div>
            <div className="mt-4 flex justify-end gap-2 no-print">
              <button onClick={() => setPrinting(null)} className="btn-secondary">{t('trf_cancel')}</button>
              <button onClick={() => window.print()} className="btn-primary"><Printer className="h-4 w-4" />{t('trfd_print')}</button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

export default function TransfertsDetailsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
