'use client'

import React, { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Loader from '@/components/Loader'
import { Barcode, Boxes, ChevronLeft, ChevronRight, PackageCheck, RotateCcw, Save, Search, ShieldAlert, Upload } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { useLanguage } from '@/lib/i18n'

const PAGE_SIZE = 12

function Content() {
  const { ready, products, movements, stores, activeStoreId, activeStoreInitialized, initializeStock } = useDroguerie()
  const { currentUser } = useAuth()
  const { t } = useLanguage()
  const toast = useToast()

  const [qty, setQty] = useState<Record<string, number>>({})
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Toutes')
  const [page, setPage] = useState(1)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [blockedOpen, setBlockedOpen] = useState(false)
  const csvRef = useRef<HTMLInputElement>(null)

  const canForce = currentUser?.role === 'Administrateur' || currentUser?.role === 'Gérant'
  const storeName = stores.find((s) => s.id === activeStoreId)?.name ?? '—'

  // Produits déjà initialisés (un mouvement stock_initial existe) → exclus de la liste.
  const initializedIds = useMemo(
    () => new Set(movements.filter((m) => m.type === 'stock_initial').map((m) => m.productId)),
    [movements]
  )

  const categories = useMemo(() => ['Toutes', ...Array.from(new Set(products.map((p) => p.category)))], [products])

  const pending = useMemo(() => products.filter((p) => !initializedIds.has(p.id)), [products, initializedIds])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pending.filter((p) => {
      const okCat = category === 'Toutes' || p.category === category
      const okQ = !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.id.toLowerCase().includes(q)
      return okCat && okQ
    })
  }, [pending, query, category])

  if (!ready) {
    return <Loader />
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const setQ = (id: string, v: number) => setQty((m) => ({ ...m, [id]: Math.max(0, Math.round(v || 0)) }))
  const ref = (id: string) => id.slice(-8).toUpperCase()

  const entries = Object.entries(qty).filter(([id, v]) => v > 0 && !initializedIds.has(id))
  const totalQty = entries.reduce((s, [, v]) => s + v, 0)
  const totalValue = entries.reduce((s, [id, v]) => s + v * (products.find((p) => p.id === id)?.cost ?? 0), 0)

  const onScan = (code: string) => {
    const c = code.trim()
    if (!c) return
    const p = products.find((x) => x.barcode === c)
    if (!p) { toast(`${t('si_toast_not_found')} ${c}`, 'error'); return }
    if (initializedIds.has(p.id)) { toast(`${p.name} — ${t('si_already_prod')}`, 'error'); return }
    setQ(p.id, (qty[p.id] ?? 0) + 1)
    toast(`+1 ${p.name}`)
  }

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result).replace(/^﻿/, '')
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      const byBarcode = new Map(pending.map((p) => [p.barcode, p.id]))
      const next = { ...qty }
      let n = 0
      for (const line of lines) {
        const cols = line.split(/[;,\t]/).map((s) => s.trim())
        if (cols.length < 2) continue
        const code = cols[0].replace(/"/g, '')
        const q = Math.round(parseFloat(cols[1].replace(',', '.')) || 0)
        const id = byBarcode.get(code)
        if (id && q > 0 && !/code|barre|barcode|qte|quant/i.test(code)) { next[id] = q; n++ }
      }
      setQty(next)
      toast(`✓ ${n} ${t('si_toast_imported')}`)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const startValidate = () => {
    if (entries.length === 0) { toast(t('si_toast_empty'), 'error'); return }
    if (activeStoreInitialized && !canForce) { setBlockedOpen(true); return }
    setConfirmOpen(true)
  }

  const doValidate = () => {
    const res = initializeStock(entries.map(([productId, q]) => ({ productId, qty: q })), activeStoreInitialized)
    if (!res.ok) {
      toast(res.error === 'already' ? t('si_already_blocked') : t('si_toast_empty'), 'error')
      setConfirmOpen(false)
      return
    }
    toast(`✓ ${t('si_toast_done')} ${res.count} produit(s) — ${fmtDH(totalValue)}`)
    setQty({})
    setConfirmOpen(false)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Boxes className="h-6 w-6 text-amber-500" />
            {t('si_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('si_subtitle')} · <span className="font-semibold text-amber-600 dark:text-amber-400">{storeName}</span>
            {initializedIds.size > 0 && <span className="tabular-nums"> · {initializedIds.size} {t('si_initialized_count')}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => csvRef.current?.click()} className="btn-secondary">
            <Upload className="h-4 w-4" />
            {t('si_import')}
          </button>
          <button onClick={() => setQty({})} disabled={entries.length === 0} className="btn-secondary disabled:opacity-40">
            <RotateCcw className="h-4 w-4" />
            {t('si_reset')}
          </button>
          <button onClick={startValidate} disabled={entries.length === 0} className="btn-primary disabled:opacity-50">
            <Save className="h-4 w-4" />
            {t('si_validate')} ({entries.length})
          </button>
          <input ref={csvRef} type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onImport} className="hidden" />
        </div>
      </motion.div>

      {activeStoreInitialized && (
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${canForce ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400' : 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400'}`}>
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {canForce ? t('si_already_force') : t('si_already_blocked')}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-card p-5">
          <p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('si_lines_filled')}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{entries.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('si_total_qty')}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{totalQty}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('si_total_value')}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtDH(totalValue)}</p>
        </div>
      </div>

      {/* Filters + scan */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} placeholder={t('si_search')} className="input-field pl-10" />
        </div>
        <Select value={category} onChange={(v) => { setCategory(v); setPage(1) }} options={categories.map((c) => ({ value: c, label: c === 'Toutes' ? t('si_all_cats') : c }))} className="w-auto min-w-[170px]" />
        <div className="relative min-w-[240px] flex-1">
          <Barcode className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
          <input
            type="text"
            placeholder={t('si_scan_ph')}
            onKeyDown={(e) => { if (e.key === 'Enter') { onScan(e.currentTarget.value); e.currentTarget.value = '' } }}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-4 py-3.5">{t('si_col_ref')}</th>
                <th className="px-4 py-3.5">{t('si_col_barcode')}</th>
                <th className="px-4 py-3.5">{t('si_col_name')}</th>
                <th className="px-4 py-3.5">{t('si_col_category')}</th>
                <th className="px-4 py-3.5">{t('si_col_store')}</th>
                <th className="px-4 py-3.5 text-right">{t('si_col_cost')}</th>
                <th className="px-4 py-3.5 text-center">{t('si_col_qty')}</th>
                <th className="px-4 py-3.5 text-right">{t('si_col_value')}</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p) => {
                const q = qty[p.id] ?? 0
                return (
                  <tr key={p.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500 dark:text-zinc-400">{ref(p.id)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500 dark:text-zinc-400">{p.barcode || '—'}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{p.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-md bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-zinc-400">{p.category}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-400">{storeName}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600 dark:text-zinc-400 tabular-nums">{fmtDH(p.cost)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <input type="number" min="0" value={q || ''} onChange={(e) => setQ(p.id, Number(e.target.value))} placeholder="0" className="input-field !h-9 w-24 text-center" />
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-gray-900 dark:text-white tabular-nums">{q > 0 ? fmtDH(q * p.cost) : '—'}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('prod_none_found')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-white/10">
            <p className="text-xs text-gray-500 dark:text-zinc-400 tabular-nums">{filtered.length} · {page}/{pageCount}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40 dark:border-white/10"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40 dark:border-white/10"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </motion.div>
      <p className="text-xs text-gray-400 dark:text-zinc-500">{t('si_import_hint')}</p>

      {/* Confirmation */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('si_confirm_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">{t('si_confirm_desc')}</p>
        <div className="mt-4 rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/5 p-3 text-sm">
          <div className="flex justify-between"><span className="text-gray-500 dark:text-zinc-400">{t('si_lines_filled')}</span><span className="font-bold tabular-nums">{entries.length}</span></div>
          <div className="flex justify-between"><span className="text-gray-500 dark:text-zinc-400">{t('si_total_qty')}</span><span className="font-bold tabular-nums">{totalQty}</span></div>
          <div className="flex justify-between"><span className="text-gray-500 dark:text-zinc-400">{t('si_total_value')}</span><span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtDH(totalValue)}</span></div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setConfirmOpen(false)} className="btn-secondary">{t('si_cancel')}</button>
          <button onClick={doValidate} className="btn-primary"><PackageCheck className="h-4 w-4" />{activeStoreInitialized ? t('si_force_btn') : t('si_validate')}</button>
        </div>
      </Modal>

      {/* Bloqué (non autorisé) */}
      <Modal open={blockedOpen} onClose={() => setBlockedOpen(false)} title={t('si_already_title')} maxWidth="max-w-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400"><ShieldAlert className="h-5 w-5" /></span>
          <p className="text-sm text-gray-600 dark:text-zinc-400">{t('si_already_blocked')}</p>
        </div>
        <button onClick={() => setBlockedOpen(false)} className="btn-primary mt-5 w-full">{t('si_cancel')}</button>
      </Modal>
    </>
  )
}

export default function StockInitialPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
