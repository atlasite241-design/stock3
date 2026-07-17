'use client'

import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  PackageCheck,
  Plus,
  Printer,
  Send,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import TransferDocument from '@/components/TransferDocument'
import { useToast } from '@/components/Toast'
import {
  fmtDH,
  transferQty,
  transferValue,
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

const PAGE_SIZE = 10

function Content() {
  const {
    ready,
    transfers,
    stores,
    activeStoreId,
    validateTransfer,
    shipTransfer,
    receiveTransfer,
    deleteTransfer,
  } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [srcFilter, setSrcFilter] = useState('all')
  const [dstFilter, setDstFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [sortDesc, setSortDesc] = useState(true)
  const [page, setPage] = useState(1)

  const [detail, setDetail] = useState<Transfer | null>(null)
  const [printing, setPrinting] = useState<Transfer | null>(null)
  const [action, setAction] = useState<{ transfer: Transfer; type: 'valide' | 'expedie' } | null>(null)
  const [actionComment, setActionComment] = useState('')
  const [receiving, setReceiving] = useState<Transfer | null>(null)
  const [received, setReceived] = useState<Record<string, number>>({})
  const [recvComment, setRecvComment] = useState('')

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? '—'

  const filtered = useMemo(() => {
    let list = [...transfers]
    if (from) list = list.filter((tr) => tr.date.slice(0, 10) >= from)
    if (to) list = list.filter((tr) => tr.date.slice(0, 10) <= to)
    if (srcFilter !== 'all') list = list.filter((tr) => tr.sourceStoreId === srcFilter)
    if (dstFilter !== 'all') list = list.filter((tr) => tr.destStoreId === dstFilter)
    if (statusFilter !== 'all') list = list.filter((tr) => tr.status === statusFilter)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((tr) => tr.ref.toLowerCase().includes(q) || tr.items.some((i) => i.name.toLowerCase().includes(q) || i.barcode.includes(q)))
    }
    list.sort((a, b) => (sortDesc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))
    return list
  }, [transfers, from, to, srcFilter, dstFilter, statusFilter, query, sortDesc])

  const stats = useMemo(() => {
    const ongoing = transfers.filter((tr) => tr.status === 'valide' || tr.status === 'expedie' || tr.status === 'recu').length
    const done = transfers.filter((tr) => tr.status === 'termine').length
    const gaps = transfers.filter((tr) => tr.hasDiscrepancy).length
    const value = transfers.filter((tr) => tr.status !== 'brouillon').reduce((a, tr) => a + transferValue(tr), 0)
    return { ongoing, done, gaps, value }
  }, [transfers])

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const storeOptions = [{ value: 'all', label: t('trf_all_stores') }, ...stores.map((s) => ({ value: s.id, label: s.name }))]
  const statusOptions = [{ value: 'all', label: t('trf_all_status') }, ...TRANSFER_FLOW.map((s) => ({ value: s, label: t(STATUS_KEY[s]) }))]

  const runAction = () => {
    if (!action) return
    const res = action.type === 'valide' ? validateTransfer(action.transfer.id, action.transfer.user, actionComment) : shipTransfer(action.transfer.id, action.transfer.user, actionComment)
    if (!res.ok) {
      toast(res.error === 'insufficient' ? t('trf_err_insufficient') : t('trf_err_same'), 'error')
      return
    }
    toast(action.type === 'valide' ? t('trf_validated') : t('trf_shipped'))
    setAction(null)
    setActionComment('')
    setDetail(null)
  }

  const openReceive = (tr: Transfer) => {
    setReceiving(tr)
    setReceived(Object.fromEntries(tr.items.map((i) => [i.productId, i.transferredQty])))
    setRecvComment('')
  }

  const runReceive = () => {
    if (!receiving) return
    const res = receiveTransfer(receiving.id, receiving.items.map((i) => ({ productId: i.productId, receivedQty: received[i.productId] ?? 0 })), receiving.user, recvComment)
    if (!res.ok) {
      toast(t('trf_err_same'), 'error')
      return
    }
    toast(t('trf_received'))
    setReceiving(null)
    setDetail(null)
  }

  // Which workflow button applies to a row for the active store.
  const rowAction = (tr: Transfer) => {
    if (tr.status === 'brouillon' && tr.sourceStoreId === activeStoreId) return 'validate'
    if (tr.status === 'valide' && tr.sourceStoreId === activeStoreId) return 'ship'
    if (tr.status === 'expedie' && tr.destStoreId === activeStoreId) return 'receive'
    return null
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <ArrowLeftRight className="h-6 w-6 text-amber-500" />
            {t('trf_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('trf_subtitle')}</p>
        </div>
        <Link href="/stock/transferts/nouveau" className="btn-primary">
          <Plus className="h-4 w-4" />
          {t('trf_new')}
        </Link>
      </motion.div>

      {/* Dashboard indicators */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Send className="h-5 w-5" />} tone="sky" label={t('trf_stat_ongoing')} value={String(stats.ongoing)} />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" label={t('trf_stat_done')} value={String(stats.done)} />
        <StatCard icon={<TriangleAlert className="h-5 w-5" />} tone="rose" label={t('trf_stat_gap')} value={String(stats.gaps)} />
        <StatCard icon={<ArrowLeftRight className="h-5 w-5" />} tone="amber" label={t('trf_stat_value')} value={fmtDH(stats.value)} />
      </div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} className="input-field" aria-label={t('trf_filter_from')} />
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} className="input-field" aria-label={t('trf_filter_to')} />
          <Select value={srcFilter} onChange={(v) => { setSrcFilter(v); setPage(1) }} options={storeOptions} placeholder={t('trf_source_short')} />
          <Select value={dstFilter} onChange={(v) => { setDstFilter(v); setPage(1) }} options={storeOptions} placeholder={t('trf_dest_short')} />
          <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1) }} options={statusOptions} />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} placeholder={t('trf_search')} className="input-field" />
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-4 py-3">{t('trf_number')}</th>
                <th className="cursor-pointer select-none px-4 py-3" onClick={() => setSortDesc((v) => !v)}>
                  <span className="inline-flex items-center gap-1">{t('trf_date')}<ChevronDown className={`h-3 w-3 transition-transform ${sortDesc ? '' : 'rotate-180'}`} /></span>
                </th>
                <th className="px-4 py-3">{t('trf_source_short')}</th>
                <th className="px-4 py-3">{t('trf_dest_short')}</th>
                <th className="px-4 py-3 text-center">{t('trf_articles')}</th>
                <th className="px-4 py-3 text-right">{t('trf_total_qty')}</th>
                <th className="px-4 py-3">{t('trf_status')}</th>
                <th className="px-4 py-3">{t('trf_user')}</th>
                <th className="px-4 py-3 text-right">{t('trf_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((tr) => {
                const act = rowAction(tr)
                const qty = transferQty(tr.items, tr.status === 'termine' ? 'receivedQty' : tr.status === 'expedie' ? 'transferredQty' : 'requestedQty')
                return (
                  <tr key={tr.id} className="group border-b border-gray-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-2.5">
                      <button onClick={() => setDetail(tr)} className="font-mono text-xs font-bold text-amber-600 hover:underline dark:text-amber-400">{tr.ref}</button>
                      {tr.hasDiscrepancy && <TriangleAlert className="ml-1 inline h-3.5 w-3.5 text-rose-500" />}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-400">{new Date(tr.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-zinc-300">{storeName(tr.sourceStoreId)}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 text-gray-700 dark:text-zinc-300">
                        <ArrowRight className="h-3 w-3 text-gray-300 dark:text-zinc-600" />
                        {storeName(tr.destStoreId)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-600 dark:text-zinc-400 tabular-nums">{tr.items.length}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white tabular-nums">{qty}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${TRANSFER_META[tr.status].chip}`}>{t(STATUS_KEY[tr.status])}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-400">{tr.user}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {act === 'validate' && (
                          <button onClick={() => { setAction({ transfer: tr, type: 'valide' }); setActionComment('') }} className="rounded-lg border border-sky-200 px-2 py-1 text-xs font-bold text-sky-600 transition hover:bg-sky-50 dark:border-sky-500/20 dark:hover:bg-sky-500/10">{t('trf_action_validate')}</button>
                        )}
                        {act === 'ship' && (
                          <button onClick={() => { setAction({ transfer: tr, type: 'expedie' }); setActionComment('') }} className="rounded-lg border border-amber-200 px-2 py-1 text-xs font-bold text-amber-600 transition hover:bg-amber-50 dark:border-amber-500/20 dark:hover:bg-amber-500/10">{t('trf_action_ship')}</button>
                        )}
                        {act === 'receive' && (
                          <button onClick={() => openReceive(tr)} className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-bold text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-500/20 dark:hover:bg-emerald-500/10">{t('trf_action_receive')}</button>
                        )}
                        <button onClick={() => setDetail(tr)} title={t('trf_action_view')} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-amber-400"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => setPrinting(tr)} title={t('trf_action_print')} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-amber-400"><Printer className="h-4 w-4" /></button>
                        {tr.status === 'brouillon' && tr.sourceStoreId === activeStoreId && (
                          <button onClick={() => { deleteTransfer(tr.id); toast(t('trf_deleted')) }} title={t('trf_action_delete')} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('trf_none')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-white/10">
            <p className="text-xs text-gray-500 dark:text-zinc-400">{filtered.length} · {page}/{pageCount}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40 dark:border-white/10"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40 dark:border-white/10"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${t('trf_detail')} · ${detail.ref}` : ''} maxWidth="max-w-3xl">
        {detail && (
          <DetailView
            transfer={detail}
            storeName={storeName}
            activeStoreId={activeStoreId}
            onPrint={() => setPrinting(detail)}
            onAction={(type) => {
              if (type === 'receive') {
                openReceive(detail)
              } else {
                setAction({ transfer: detail, type: type === 'validate' ? 'valide' : 'expedie' })
                setActionComment('')
              }
              setDetail(null)
            }}
          />
        )}
      </Modal>

      {/* Validate / Ship confirm modal */}
      <Modal open={!!action} onClose={() => setAction(null)} title={action?.type === 'valide' ? t('trf_action_validate') : t('trf_action_ship')}>
        {action && (
          <>
            <p className="text-sm text-gray-600 dark:text-zinc-300">
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{action.transfer.ref}</span> — {storeName(action.transfer.sourceStoreId)} → {storeName(action.transfer.destStoreId)}
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('trf_comment')}</span>
              <input className="input-field" value={actionComment} onChange={(e) => setActionComment(e.target.value)} />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setAction(null)} className="btn-secondary">{t('trf_cancel')}</button>
              <button onClick={runAction} className="btn-primary">{t('trf_confirm')}</button>
            </div>
          </>
        )}
      </Modal>

      {/* Reception modal */}
      <Modal open={!!receiving} onClose={() => setReceiving(null)} title={t('trf_receive_title')} maxWidth="max-w-2xl">
        {receiving && (
          <>
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('trf_receive_desc')}</p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
              <table className="w-full min-w-[440px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                    <th className="px-4 py-2.5">{t('trf_col_name')}</th>
                    <th className="px-4 py-2.5 text-right">{t('trf_col_transferred')}</th>
                    <th className="px-4 py-2.5 text-right">{t('trf_col_received')}</th>
                    <th className="px-4 py-2.5 text-right">{t('trf_col_gap')}</th>
                  </tr>
                </thead>
                <tbody>
                  {receiving.items.map((it) => {
                    const rq = received[it.productId] ?? 0
                    const gap = rq - it.transferredQty
                    return (
                      <tr key={it.productId} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{it.name}</td>
                        <td className="px-4 py-2 text-right text-gray-600 dark:text-zinc-400 tabular-nums">{it.transferredQty}</td>
                        <td className="px-4 py-2 text-right">
                          <input type="number" min={0} value={rq} onChange={(e) => setReceived((r) => ({ ...r, [it.productId]: Math.max(0, Number(e.target.value)) }))} className="input-field h-9 w-20 text-right" />
                        </td>
                        <td className={`px-4 py-2 text-right font-semibold tabular-nums ${gap === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>{gap > 0 ? '+' : ''}{gap}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('trf_comment')}</span>
              <input className="input-field" value={recvComment} onChange={(e) => setRecvComment(e.target.value)} />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setReceiving(null)} className="btn-secondary">{t('trf_cancel')}</button>
              <button onClick={runReceive} className="btn-primary"><PackageCheck className="h-4 w-4" />{t('trf_action_receive')}</button>
            </div>
          </>
        )}
      </Modal>

      {/* Print modal */}
      <Modal open={!!printing} onClose={() => setPrinting(null)} title={t('trf_action_print')} maxWidth="max-w-3xl">
        {printing && (
          <>
            <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-gray-100 dark:border-white/10">
              <TransferDocument transfer={printing} />
            </div>
            <div className="mt-4 flex justify-end gap-2 no-print">
              <button onClick={() => setPrinting(null)} className="btn-secondary">{t('trf_cancel')}</button>
              <button onClick={() => window.print()} className="btn-primary"><Printer className="h-4 w-4" />{t('trf_action_print')}</button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

function StatCard({ icon, tone, label, value }: { icon: React.ReactNode; tone: 'sky' | 'emerald' | 'rose' | 'amber'; label: string; value: string }) {
  const tones: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-500 dark:bg-sky-500/10 dark:text-sky-400',
    emerald: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400',
    rose: 'bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400',
    amber: 'bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400',
  }
  return (
    <div className="glass-card p-5">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div>
      <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">{value}</p>
    </div>
  )
}

function DetailView({
  transfer,
  storeName,
  activeStoreId,
  onPrint,
  onAction,
}: {
  transfer: Transfer
  storeName: (id: string) => string
  activeStoreId: string
  onPrint: () => void
  onAction: (type: 'validate' | 'ship' | 'receive') => void
}) {
  const { t } = useLanguage()
  const currentIdx = TRANSFER_FLOW.indexOf(transfer.status)

  // Contextual next step for the active store.
  const act: 'validate' | 'ship' | 'receive' | null =
    transfer.status === 'brouillon' && transfer.sourceStoreId === activeStoreId
      ? 'validate'
      : transfer.status === 'valide' && transfer.sourceStoreId === activeStoreId
        ? 'ship'
        : transfer.status === 'expedie' && transfer.destStoreId === activeStoreId
          ? 'receive'
          : null

  // When an action exists but the wrong store is active, explain why it's unavailable.
  const blockedHint =
    !act && transfer.status === 'expedie' && transfer.destStoreId !== activeStoreId
      ? t('trf_only_dest_action')
      : !act && (transfer.status === 'brouillon' || transfer.status === 'valide') && transfer.sourceStoreId !== activeStoreId
        ? t('trf_only_source_action')
        : ''
  return (
    <div className="space-y-5">
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

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-gray-100 p-3 dark:border-white/10">
          <p className="text-[10px] font-bold uppercase text-gray-400">{t('trf_source')}</p>
          <p className="font-semibold text-gray-900 dark:text-white">{storeName(transfer.sourceStoreId)}</p>
        </div>
        <div className="rounded-xl border border-gray-100 p-3 dark:border-white/10">
          <p className="text-[10px] font-bold uppercase text-gray-400">{t('trf_dest')}</p>
          <p className="font-semibold text-gray-900 dark:text-white">{storeName(transfer.destStoreId)}</p>
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        {blockedHint ? (
          <p className="text-xs text-gray-400 dark:text-zinc-500">{blockedHint}</p>
        ) : (
          <span />
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onPrint} className="btn-secondary"><Printer className="h-4 w-4" />{t('trf_action_print')}</button>
          {act === 'validate' && (
            <button onClick={() => onAction('validate')} className="btn-primary"><CheckCircle2 className="h-4 w-4" />{t('trf_action_validate')}</button>
          )}
          {act === 'ship' && (
            <button onClick={() => onAction('ship')} className="btn-primary"><Send className="h-4 w-4" />{t('trf_action_ship')}</button>
          )}
          {act === 'receive' && (
            <button onClick={() => onAction('receive')} className="btn-primary"><PackageCheck className="h-4 w-4" />{t('trf_action_receive')}</button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TransfertsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
