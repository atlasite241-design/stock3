'use client'

import { useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BellRing,
  Download,
  Eye,
  HandCoins,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { creditStatus, fmtDH, PAYMENT_META, useDroguerie, type Client } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

type FilterKey = 'tous' | 'vip' | 'regulier' | 'retards'
type SortKey = 'name' | 'phone' | 'city' | 'totalSpent' | 'credit'
type Segment = 'VIP' | 'Nouveau' | 'Régulier'

const segmentOf = (c: Client): Segment => {
  if (c.totalSpent >= 3000) return 'VIP'
  if (c.totalSpent < 500) return 'Nouveau'
  return 'Régulier'
}

const SEGMENT_CHIP: Record<string, string> = {
  VIP: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  Nouveau: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/20',
  Régulier: 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-white/10',
}

function ClientsContent() {
  const { ready, clients, sales, credits, updateClient, deleteClient, settleCredit } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const segmentLabel = (s: Segment) => (s === 'VIP' ? t('cli_segment_vip') : s === 'Nouveau' ? t('cli_segment_new') : t('cli_segment_regular'))

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', creditAllowed: 'oui', creditLimit: '0', paymentTermDays: '30' })
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [settleTarget, setSettleTarget] = useState<Client | null>(null)
  const [settleAmount, setSettleAmount] = useState('')
  const [profileTarget, setProfileTarget] = useState<Client | null>(null)
  const [printTarget, setPrintTarget] = useState<Client | null>(null)
  const [filter, setFilter] = useState<FilterKey>('tous')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('Tous')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const lastVisitOf = useMemo(() => {
    const map = new Map<string, string>()
    sales.forEach((s) => {
      if (!s.clientId) return
      const cur = map.get(s.clientId)
      if (!cur || s.date > cur) map.set(s.clientId, s.date)
    })
    return map
  }, [sales])

  if (!ready) {
    return <Loader />
  }

  // A client is "en retard" only when they have a credit whose due date has passed
  // (not simply an outstanding balance — a fresh credit is due later, e.g. in 30 days).
  const overdueClientIds = new Set(credits.filter((cr) => creditStatus(cr) === 'retard').map((cr) => cr.clientId))
  const isLate = (c: Client) => overdueClientIds.has(c.id)

  const totalCredit = clients.reduce((a, c) => a + c.credit, 0)
  const best = [...clients].sort((a, b) => b.totalSpent - a.totalSpent)[0]
  const overdueCount = clients.filter(isLate).length

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const visible = clients
    .filter((c) => {
      if (filter === 'vip') return segmentOf(c) === 'VIP'
      if (filter === 'regulier') return segmentOf(c) === 'Régulier'
      if (filter === 'retards') return isLate(c)
      return true
    })
    .filter((c) => typeFilter === 'Tous' || c.clientType === typeFilter)
    .filter((c) => {
      const q = query.trim().toLowerCase()
      return !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.city.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'totalSpent' || sortKey === 'credit') return (a[sortKey] - b[sortKey]) * dir
      return a[sortKey].localeCompare(b[sortKey]) * dir
    })

  const openEdit = (c: Client) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      phone: c.phone,
      creditAllowed: c.creditAllowed === false ? 'non' : 'oui',
      creditLimit: String(c.creditLimit ?? 0),
      paymentTermDays: String(c.paymentTermDays ?? 30),
    })
    setEditModalOpen(true)
  }

  const saveForm = () => {
    if (!editingId) return
    if (!form.name.trim()) {
      toast(t('cli_toast_name_required'), 'error')
      return
    }
    updateClient(editingId, {
      name: form.name.trim(),
      phone: form.phone.trim(),
      creditAllowed: form.creditAllowed === 'oui',
      creditLimit: Math.max(0, parseFloat(form.creditLimit.replace(',', '.')) || 0),
      paymentTermDays: parseInt(form.paymentTermDays, 10) || 30,
    })
    toast(`✓ ${form.name} ${t('cli_toast_modified')}`)
    setEditModalOpen(false)
  }

  const openSettle = (c: Client) => {
    setSettleTarget(c)
    setSettleAmount(String(c.credit))
  }

  const confirmSettle = () => {
    if (!settleTarget) return
    const amount = parseFloat(settleAmount.replace(',', '.')) || 0
    if (amount <= 0) {
      toast(t('cli_toast_invalid_amount'), 'error')
      return
    }
    settleCredit(settleTarget.id, amount)
    toast(`✓ ${t('cli_toast_settlement')} ${fmtDH(Math.min(amount, settleTarget.credit))} ${t('cli_toast_registered')}`)
    setSettleTarget(null)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteClient(deleteTarget.id)
    toast(`${deleteTarget.name} ${t('cli_toast_deleted')}`)
    setDeleteTarget(null)
  }

  const relancer = (c: Client) => {
    toast(`📞 ${t('cli_toast_reminder')} ${c.name} — ${fmtDH(c.credit)} ${t('cli_toast_due')}`)
  }

  const exportCSV = () => {
    const rows = [['Nom', 'Téléphone', 'Ville', 'Type', 'Segment', 'Total dépensé', 'Points', 'Crédit']]
    clients.forEach((c) =>
      rows.push([c.name, c.phone, c.city, c.clientType, segmentOf(c), c.totalSpent.toFixed(2), String(c.points), c.credit.toFixed(2)])
    )
    const csv = rows.map((r) => r.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'clients-droguerie.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const initials = (name: string) =>
    name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')

  const cards = [
    { label: t('cli_kpi_registered'), value: String(clients.length), icon: Users, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('cli_kpi_credits'), value: fmtDH(totalCredit), icon: Wallet, cls: totalCredit > 0 ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
    { label: t('cli_kpi_best'), value: best?.name ?? '—', icon: HandCoins, cls: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  ]

  const filters: { key: FilterKey; label: string; badge?: number }[] = [
    { key: 'tous', label: t('cli_filter_all') },
    { key: 'vip', label: t('cli_segment_vip') },
    { key: 'regulier', label: t('cli_filter_regular') },
    { key: 'retards', label: t('cli_filter_late'), badge: overdueCount },
  ]

  const profileSales = profileTarget ? sales.filter((s) => s.clientId === profileTarget.id).slice(-8).reverse() : []

  const SortHeader = ({ label, sortField }: { label: string; sortField: SortKey }) => (
    <button
      onClick={() => toggleSort(sortField)}
      className="flex items-center gap-1 transition hover:text-gray-700 dark:hover:text-zinc-200"
    >
      {label}
      {sortKey === sortField ? (
        sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  )

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('cli_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('cli_subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportCSV} className="btn-secondary">
            <Download className="h-4 w-4" />
            {t('cli_export_csv')}
          </button>
          <Link href="/clients/nouveau" className="btn-primary">
            <Plus className="h-4 w-4" />
            {t('cli_add')}
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
            <p className="mt-1 truncate text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white">
              {c.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Segment filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              filter === f.key
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-lg shadow-amber-400/25'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:bg-amber-50 dark:border-white/10 dark:bg-[#12121a] dark:text-zinc-400 dark:hover:bg-white/5'
            }`}
          >
            {f.label}
            {!!f.badge && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {f.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('cli_search_placeholder')}
            className="input-field pl-10"
          />
        </div>
        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'Tous', label: t('cli_all_types') },
            { value: 'Particulier', label: t('cli_type_particulier') },
            { value: 'Professionnel', label: t('cli_type_professionnel') },
            { value: 'VIP', label: t('cli_type_vip') },
          ]}
          className="w-auto min-w-[160px]"
        />
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5"><SortHeader label={t('cli_col_client')} sortField="name" /></th>
                <th className="px-5 py-3.5"><SortHeader label={t('cli_col_city')} sortField="city" /></th>
                <th className="px-5 py-3.5">{t('cli_col_segment')}</th>
                <th className="px-5 py-3.5">{t('cli_col_last_visit')}</th>
                <th className="px-5 py-3.5"><SortHeader label={t('cli_col_total_spent')} sortField="totalSpent" /></th>
                <th className="px-5 py-3.5">{t('cli_col_points')}</th>
                <th className="px-5 py-3.5"><SortHeader label={t('cli_col_credit')} sortField="credit" /></th>
                <th className="px-5 py-3.5 text-right">{t('cli_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const segment = segmentOf(c)
                const overdue = isLate(c)
                const lastVisit = lastVisitOf.get(c.id)
                return (
                  <tr
                    key={c.id}
                    className={`group border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5 ${
                      overdue ? 'border-l-2 border-l-rose-400 dark:border-l-rose-500/60' : ''
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {c.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.image} alt={c.name} className="h-9 w-9 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-xs font-bold text-gray-900">
                            {initials(c.name)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{c.name}</p>
                          <p className="text-xs text-gray-400 dark:text-zinc-500 tabular-nums">{c.phone || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">{c.city || '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${SEGMENT_CHIP[segment]}`}>
                          {segmentLabel(segment)}
                        </span>
                        {overdue && (
                          <span className="flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {t('cli_late_payment')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">
                      {lastVisit
                        ? new Date(lastVisit).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                        : t('cli_no_purchase')}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                      {fmtDH(c.totalSpent)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                        ⭐ {c.points}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {c.credit > 0 ? (
                        <span className="rounded-lg border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                          {fmtDH(c.credit)}
                        </span>
                      ) : (
                        <span className="rounded-lg border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {t('cli_up_to_date')}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {overdue && (
                          <button
                            onClick={() => relancer(c)}
                            className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
                            title={t('cli_relaunch_title')}
                          >
                            <BellRing className="h-3.5 w-3.5" />
                            {t('cli_relaunch')}
                          </button>
                        )}
                        {c.credit > 0 && (
                          <button
                            onClick={() => openSettle(c)}
                            className="btn-secondary !h-8 !px-2.5 text-xs"
                            title={t('cli_settle_title')}
                          >
                            <HandCoins className="h-3.5 w-3.5" />
                            {t('cli_settle')}
                          </button>
                        )}
                        <button
                          onClick={() => setProfileTarget(c)}
                          className="rounded-lg p-2 text-gray-400 dark:text-zinc-400 transition hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-500/10 dark:hover:text-sky-400"
                          title={t('cli_view_profile')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setPrintTarget(c)}
                          className="rounded-lg p-2 text-gray-400 dark:text-zinc-400 transition hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-500/10 dark:hover:text-sky-400"
                          title={t('cli_print_card')}
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="rounded-lg p-2 text-gray-400 dark:text-zinc-400 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-400"
                          title={t('cli_edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="rounded-lg p-2 text-gray-400 dark:text-zinc-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                          title={t('cli_delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('cli_none')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-xs text-gray-400 dark:border-white/10 dark:text-zinc-500">
          <p>
            {t('cli_showing')} {visible.length} {t('cli_on')} {clients.length} {t('cli_registered_count')}
          </p>
        </div>
      </motion.div>

      {/* Edit modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title={t('cli_edit_title')} maxWidth="max-w-sm">
        <div className="space-y-4">
          <div>
            <label className="field-label">{t('cli_full_name')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ex: Ahmed Bennani"
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('cli_phone')}</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="06 XX XX XX XX"
              className="input-field"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t('clin_credit_allowed')}</label>
              <Select
                value={form.creditAllowed}
                onChange={(v) => setForm({ ...form, creditAllowed: v })}
                options={[
                  { value: 'oui', label: t('clin_yes') },
                  { value: 'non', label: t('clin_no') },
                ]}
              />
            </div>
            <div>
              <label className="field-label">{t('clin_credit_limit')}</label>
              <input
                type="number"
                min="0"
                value={form.creditLimit}
                onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                className="input-field"
                disabled={form.creditAllowed === 'non'}
              />
            </div>
          </div>
          <div>
            <label className="field-label">{t('clin_payment_term')}</label>
            <Select
              value={form.paymentTermDays}
              onChange={(v) => setForm({ ...form, paymentTermDays: v })}
              options={[
                { value: '30', label: t('clin_term_30') },
                { value: '60', label: t('clin_term_60') },
                { value: '90', label: t('clin_term_90') },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={() => setEditModalOpen(false)} className="btn-secondary">
              {t('cli_cancel')}
            </button>
            <button onClick={saveForm} className="btn-primary">
              {t('cli_save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Settle credit modal */}
      <Modal
        open={!!settleTarget}
        onClose={() => setSettleTarget(null)}
        title={t('cli_settle_title')}
        maxWidth="max-w-sm"
      >
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <span className="font-semibold text-gray-900 dark:text-white">{settleTarget?.name}</span> {t('cli_owes')}{' '}
          <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">{fmtDH(settleTarget?.credit ?? 0)}</span>
        </p>
        <div className="mt-4">
          <label className="field-label">{t('cli_amount_received')}</label>
          <input
            type="number"
            min="0"
            value={settleAmount}
            onChange={(e) => setSettleAmount(e.target.value)}
            className="input-field"
            autoFocus
          />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setSettleTarget(null)} className="btn-secondary">
            {t('cli_cancel')}
          </button>
          <button onClick={confirmSettle} className="btn-primary">
            <HandCoins className="h-4 w-4" />
            {t('cli_collect')}
          </button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('cli_delete_title')}
        maxWidth="max-w-sm"
      >
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <span className="font-semibold text-gray-900 dark:text-white">{deleteTarget?.name}</span> {t('cli_delete_desc')}
          {deleteTarget && deleteTarget.credit > 0 && (
            <span className="mt-1 block font-semibold text-rose-600 dark:text-rose-400">
              {t('cli_delete_credit_warning')} {fmtDH(deleteTarget.credit)}.
            </span>
          )}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
            {t('cli_cancel')}
          </button>
          <button onClick={confirmDelete} className="btn-danger">
            <Trash2 className="h-4 w-4" />
            {t('cli_delete')}
          </button>
        </div>
      </Modal>

      {/* Client profile */}
      <Modal open={!!profileTarget} onClose={() => setProfileTarget(null)} title={t('cli_profile_title')} maxWidth="max-w-lg">
        {profileTarget && (
          <>
            <div className="flex items-center gap-4">
              {profileTarget.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileTarget.image} alt={profileTarget.name} className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-lg font-bold text-gray-900">
                  {initials(profileTarget.name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-gray-900 dark:text-white">{profileTarget.name}</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 tabular-nums">{profileTarget.phone || '—'}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${SEGMENT_CHIP[segmentOf(profileTarget)]}`}>
                {segmentLabel(segmentOf(profileTarget))}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('cli_spent')}</p>
                <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(profileTarget.totalSpent)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('cli_col_points')}</p>
                <p className="mt-1 text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">⭐ {profileTarget.points}</p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('cli_col_credit')}</p>
                <p className={`mt-1 text-sm font-bold tabular-nums ${profileTarget.credit > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {fmtDH(profileTarget.credit)}
                </p>
              </div>
            </div>

            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
              {t('cli_recent_purchases')}
            </p>
            <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
              {profileSales.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                      {new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500">
                      {s.items.reduce((a, i) => a + i.qty, 0)} {t('pos_article_count')} · {PAYMENT_META[s.payment].label}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(s.total)}</p>
                </div>
              ))}
              {profileSales.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-400 dark:text-zinc-500">{t('cli_no_purchase_recorded')}</p>
              )}
            </div>

            {profileTarget.credit > 0 && (
              <button
                onClick={() => {
                  relancer(profileTarget)
                }}
                className="btn-secondary mt-4 w-full"
              >
                <BellRing className="h-4 w-4" />
                {t('cli_relaunch_title')}
              </button>
            )}
          </>
        )}
      </Modal>

      {/* Printable fiche client */}
      <Modal open={!!printTarget} onClose={() => setPrintTarget(null)} title={t('cli_fiche_title')} maxWidth="max-w-md">
        {printTarget && (
          <>
            <div className="print-area rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-lg font-bold text-gray-900">{printTarget.name}</p>
              <p className="text-xs text-gray-500">{segmentLabel(segmentOf(printTarget))} · {printTarget.clientType}</p>
              <div className="my-3 border-t border-dashed border-gray-300" />
              <div className="space-y-1.5 text-sm text-gray-700">
                <p>{t('cli_phone_label')} <span className="font-semibold">{printTarget.phone || '—'}</span></p>
                <p>{t('cli_email_label')} <span className="font-semibold">{printTarget.email || '—'}</span></p>
                <p>{t('cli_address_label')} <span className="font-semibold">{printTarget.address || '—'}, {printTarget.city || '—'}</span></p>
                {printTarget.cin && <p>{t('cli_cin_label')} <span className="font-semibold">{printTarget.cin}</span></p>}
              </div>
              <div className="my-3 border-t border-dashed border-gray-300" />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] uppercase text-gray-400">{t('cli_spent')}</p>
                  <p className="font-bold text-gray-900">{fmtDH(printTarget.totalSpent)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-gray-400">{t('cli_col_points')}</p>
                  <p className="font-bold text-gray-900">{printTarget.points}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-gray-400">{t('cli_col_credit')}</p>
                  <p className="font-bold text-gray-900">{fmtDH(printTarget.credit)}</p>
                </div>
              </div>
              {printTarget.notes && (
                <>
                  <div className="my-3 border-t border-dashed border-gray-300" />
                  <p className="text-xs text-gray-500">{printTarget.notes}</p>
                </>
              )}
            </div>
            <button onClick={() => window.print()} className="btn-primary mt-4 w-full">
              <Printer className="h-4 w-4" />
              {t('cli_print')}
            </button>
          </>
        )}
      </Modal>
    </>
  )
}

export default function ClientsPage() {
  return (
    <AppShell>
      <ClientsContent />
    </AppShell>
  )
}
