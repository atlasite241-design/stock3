'use client'

import { useSearchParams } from 'next/navigation'

import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Loader from '@/components/Loader'
import {
  AlertTriangle, Barcode, Boxes, CheckCircle2, FileSpreadsheet,
  Keyboard, PackageCheck, Plus, RotateCcw, Save, ScanLine, Search, ShieldAlert, Store, Trash2, Upload, Warehouse, X,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import DecimalInput from '@/components/DecimalInput'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { fmtDH, useDroguerie, type Product, roundQty } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { useLanguage } from '@/lib/i18n'
import Pagination from '@/components/Pagination'

const PAGE_SIZE = 12
type Mode = 'manual' | 'scanqty' | 'scanrepeat' | 'import'
type ImportReport = { ok: number; unknown: string[]; dup: string[] }

function Content() {
  const { ready, products, movements, stores, depots, activeStoreId, activeStoreInitialized, initializeStock } = useDroguerie()
  const { currentUser } = useAuth()
  const { t } = useLanguage()
  const toast = useToast()

  const [mode, setMode] = useState<Mode>('manual')
  // Le menu propose « Import Excel » : l'entrée doit ouvrir l'onglet, pas la
  // page nue, sinon le lien promet un écran qu'il n'affiche pas.
  // Relu a chaque changement d'URL : sinon, deja sur cet ecran, l'entree
  // « Import du stock » du menu n'ouvrait pas l'onglet.
  const modeParam = useSearchParams().get('mode')
  useEffect(() => {
    if (modeParam === 'import' || modeParam === 'scanqty' || modeParam === 'scanrepeat' || modeParam === 'manual') {
      setMode(modeParam)
    }
  }, [modeParam])
  const [qty, setQty] = useState<Record<string, number>>({})
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Toutes')
  const [page, setPage] = useState(1)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [blockedOpen, setBlockedOpen] = useState(false)
  const [scanFound, setScanFound] = useState<Product | null>(null)
  const [scanQtyInput, setScanQtyInput] = useState('1')
  const [report, setReport] = useState<ImportReport | null>(null)
  const [depotId, setDepotId] = useState('')
  const csvRef = useRef<HTMLInputElement>(null)
  const scanRef = useRef<HTMLInputElement>(null)
  const scanQtyRef = useRef<HTMLInputElement>(null)

  const canForce = currentUser?.role === 'Administrateur' || currentUser?.role === 'Gérant'
  const storeName = stores.find((s) => s.id === activeStoreId)?.name ?? '—'
  const storeDepots = useMemo(() => depots.filter((d) => d.storeId === activeStoreId), [depots, activeStoreId])
  const depotName = storeDepots.find((d) => d.id === depotId)?.name ?? '—'

  const initializedIds = useMemo(
    () => new Set(movements.filter((m) => m.type === 'stock_initial').map((m) => m.productId)),
    [movements]
  )
  const categories = useMemo(() => ['Toutes', ...Array.from(new Set(products.map((p) => p.category)))], [products])
  const prodById = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of products) m.set(p.id, p)
    return m
  }, [products])
  const prodByBarcode = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of products) if (p.barcode) m.set(p.barcode, p)
    return m
  }, [products])

  const deferredQuery = useDeferredValue(query)
  const { pageItems, total } = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const start = (page - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    const items: Product[] = []
    let total = 0
    for (const p of products) {
      if (initializedIds.has(p.id)) continue
      if (category !== 'Toutes' && p.category !== category) continue
      if (q && !(p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.id.toLowerCase().includes(q))) continue
      if (total >= start && total < end) items.push(p)
      total++
    }
    return { pageItems: items, total }
  }, [products, initializedIds, category, deferredQuery, page])

  // Focus auto du champ scan quand on entre dans un mode scan.
  useEffect(() => {
    if (mode === 'scanqty' || mode === 'scanrepeat') scanRef.current?.focus()
  }, [mode])
  useEffect(() => {
    if (scanFound) scanQtyRef.current?.focus()
  }, [scanFound])

  if (!ready) return <Loader />

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  /**
   * L'arrondi a l'entier etait systematique : impossible de saisir 87,5 m de
   * cable ou 12,3 kg de sable en stock initial. Les articles marques « vendu en
   * quantite fractionnee » gardent desormais leurs decimales ; les autres
   * restent arrondis, une caisse qui accepterait « 2,5 vis » faussant l'inventaire.
   */
  const fractionne = (id: string) => !!prodById.get(id)?.decimalQty
  const setQ = (id: string, v: number) =>
    setQty((m) => ({ ...m, [id]: Math.max(0, fractionne(id) ? roundQty(v || 0) : Math.round(v || 0)) }))
  const removeEntry = (id: string) => setQty((m) => { const n = { ...m }; delete n[id]; return n })
  const ref = (id: string) => id.slice(-8).toUpperCase()

  const entries = Object.entries(qty).filter(([id, v]) => v > 0 && !initializedIds.has(id))
  const totalQty = entries.reduce((s, [, v]) => s + v, 0)
  const totalValue = entries.reduce((s, [id, v]) => s + v * (prodById.get(id)?.cost ?? 0), 0)
  const gridRows = entries
    .map(([id, v]) => ({ id, p: prodById.get(id), v }))
    .filter((r): r is { id: string; p: Product; v: number } => !!r.p)
    .sort((a, b) => a.p.name.localeCompare(b.p.name, 'fr'))

  // Scanner répétitif : +1 par lecture.
  const onScanRepeat = (code: string) => {
    const c = code.trim()
    if (!c) return
    const p = prodByBarcode.get(c)
    if (!p) { toast(`${t('si_toast_not_found')} ${c}`, 'error'); return }
    if (initializedIds.has(p.id)) { toast(`${p.name} — ${t('si_already_prod')}`, 'error'); return }
    setQ(p.id, (qty[p.id] ?? 0) + 1)
    toast(`+1 ${p.name}`)
  }

  // Scanner + quantité : lecture → affiche le produit → saisie quantité → Ajouter.
  const onScanLookup = (code: string) => {
    const c = code.trim()
    if (!c) return
    const p = prodByBarcode.get(c)
    if (!p) { toast(`${t('si_toast_not_found')} ${c}`, 'error'); setScanFound(null); return }
    if (initializedIds.has(p.id)) { toast(`${p.name} — ${t('si_already_prod')}`, 'error'); return }
    setScanFound(p)
    setScanQtyInput('1')
  }
  const addScanned = () => {
    if (!scanFound) return
    const brut = parseFloat(scanQtyInput.replace(',', '.')) || 0
    const q = fractionne(scanFound.id) ? Math.max(0.001, roundQty(brut)) : Math.max(1, Math.round(brut))
    setQ(scanFound.id, (qty[scanFound.id] ?? 0) + q)
    toast(`✓ ${scanFound.name} (+${q})`)
    setScanFound(null)
    setScanQtyInput('1')
    scanRef.current?.focus()
  }

  // Import : construit un rapport (importés / inconnus / doublons).
  const applyRows = (rows: (string | number)[][]) => {
    const byBarcode = new Map<string, string>()
    for (const p of products) if (p.barcode && !initializedIds.has(p.id)) byBarcode.set(p.barcode, p.id)
    const tmp = new Map<string, number>()
    const seen = new Map<string, number>()
    const unknown = new Set<string>()
    for (const cols of rows) {
      if (!cols || cols.length < 2) continue
      const code = String(cols[0] ?? '').replace(/"/g, '').trim()
      if (!code || /code|barre|barcode|qte|quant/i.test(code)) continue
      const brut = parseFloat(String(cols[1] ?? '').replace(',', '.')) || 0
      seen.set(code, (seen.get(code) ?? 0) + 1)
      const id = byBarcode.get(code)
      if (!id) { unknown.add(code); continue }
      const q = prodById.get(id)?.decimalQty ? roundQty(brut) : Math.round(brut)
      if (q > 0) tmp.set(id, (tmp.get(id) ?? 0) + q)
    }
    if (tmp.size === 0 && unknown.size === 0) { toast(t('si_import_none'), 'error'); return }
    setQty((prev) => { const next = { ...prev }; tmp.forEach((v, id) => (next[id] = v)); return next })
    const dup = [...seen.entries()].filter(([, c]) => c > 1).map(([code]) => code)
    setReport({ ok: tmp.size, unknown: [...unknown], dup })
    if (tmp.size > 0) toast(`✓ ${tmp.size} ${t('si_toast_imported')}`)
  }

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isExcel = /\.xlsx?$/i.test(file.name) || /sheet|excel/i.test(file.type)
    if (isExcel) {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const XLSX = await import('xlsx')
          const wb = XLSX.read(new Uint8Array(reader.result as ArrayBuffer), { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, blankrows: false })
          applyRows(rows)
        } catch { toast(t('si_import_none'), 'error') }
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = () => {
        const text = String(reader.result).replace(/^﻿/, '')
        const rows = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(/[;,\t]/))
        applyRows(rows)
      }
      reader.readAsText(file)
    }
    e.target.value = ''
  }

  const startValidate = () => {
    if (entries.length === 0) { toast(t('si_toast_empty'), 'error'); return }
    if (activeStoreInitialized && !canForce) { setBlockedOpen(true); return }
    setConfirmOpen(true)
  }
  const doValidate = () => {
    const res = initializeStock(entries.map(([productId, q]) => ({ productId, qty: q })), activeStoreInitialized, depotId)
    if (!res.ok) {
      toast(res.error === 'already' ? t('si_already_blocked') : t('si_toast_empty'), 'error')
      setConfirmOpen(false)
      return
    }
    toast(`✓ ${t('si_toast_done')} ${res.count} produit(s) — ${fmtDH(totalValue)}`)
    setQty({}); setReport(null); setConfirmOpen(false)
  }

  const MODES: { key: Mode; label: string; icon: typeof Keyboard }[] = [
    { key: 'manual', label: t('si_mode_manual'), icon: Keyboard },
    { key: 'scanqty', label: t('si_mode_scanqty'), icon: ScanLine },
    { key: 'scanrepeat', label: t('si_mode_scanrepeat'), icon: Barcode },
    { key: 'import', label: t('si_mode_import'), icon: FileSpreadsheet },
  ]

  // JSX (pas un composant) : évite le remontage → les champs quantité gardent le focus.
  const grid = (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-white/10">
        <h3 className="text-sm font-bold text-gray-800 dark:text-zinc-200">{t('si_grid_title')}</h3>
        <span className="text-xs font-semibold text-gray-400 dark:text-zinc-500 tabular-nums">{gridRows.length}</span>
      </div>
      {gridRows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('si_grid_empty')}</p>
      ) : (
        <div className="max-h-[52vh] overflow-y-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="sticky top-0 bg-white dark:bg-[#12121a]">
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-4 py-3">{t('si_col_barcode')}</th>
                <th className="px-4 py-3">{t('si_col_name')}</th>
                <th className="px-4 py-3 text-right">{t('si_col_cost')}</th>
                <th className="px-4 py-3 text-center">{t('si_col_qty')}</th>
                <th className="px-4 py-3 text-right">{t('si_col_value')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {gridRows.map(({ id, p, v }) => (
                <tr key={id} className="border-b border-gray-50 last:border-0 dark:border-white/5 hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-4 py-2 font-mono text-xs text-gray-500 dark:text-zinc-400">{p.barcode || '—'}</td>
                  <td className="px-4 py-2 font-semibold text-gray-900 dark:text-white">{p.name}</td>
                  <td className="px-4 py-2 text-right text-gray-500 dark:text-zinc-400 tabular-nums">{fmtDH(p.cost)}</td>
                  <td className="px-4 py-2 text-center">
                    {fractionne(id)
                      ? <DecimalInput value={v} onChange={(n) => setQ(id, n)} className="input-field !h-9 w-24 text-center" />
                      : <input type="number" min="0" value={v || ''} onChange={(e) => setQ(id, Number(e.target.value))} className="input-field !h-9 w-24 text-center" />}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(v * p.cost)}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => removeEntry(id)} title={t('si_remove')} className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  )

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Boxes className="h-6 w-6 text-amber-500" />
            {t('si_title')}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-gray-500 dark:text-zinc-400">
            {t('si_subtitle')} · <Store className="h-3.5 w-3.5 text-amber-500" /><span className="font-semibold text-amber-600 dark:text-amber-400">{storeName}</span>
            {initializedIds.size > 0 && <span className="tabular-nums"> · {initializedIds.size} {t('si_initialized_count')}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => { setQty({}); setReport(null) }} disabled={entries.length === 0} className="btn-secondary disabled:opacity-40">
            <RotateCcw className="h-4 w-4" />{t('si_reset')}
          </button>
          <button onClick={startValidate} disabled={entries.length === 0} className="btn-primary disabled:opacity-50">
            <Save className="h-4 w-4" />{t('si_validate')} ({entries.length})
          </button>
        </div>
      </motion.div>

      {activeStoreInitialized && (
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${canForce ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400' : 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400'}`}>
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {canForce ? t('si_already_force') : t('si_already_blocked')}
        </div>
      )}

      {/* Dépôt de destination (si le magasin a des dépôts) */}
      {storeDepots.length > 0 && (
        <div className="glass-card flex flex-wrap items-center gap-3 p-4">
          <Warehouse className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('si_depot_label')}</p>
            <p className="text-[11px] text-gray-400 dark:text-zinc-500">{t('si_depot_hint')}</p>
          </div>
          <div className="ml-auto min-w-[220px]">
            <Select value={depotId} onChange={setDepotId} options={[{ value: '', label: t('si_depot_none') }, ...storeDepots.map((d) => ({ value: d.id, label: d.name }))]} />
          </div>
        </div>
      )}

      {/* Sélecteur de mode */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('si_mode_label')}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MODES.map((m) => {
            const active = mode === m.key
            return (
              <button key={m.key} onClick={() => { setMode(m.key); setScanFound(null) }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${active ? 'border-amber-400 bg-amber-500 text-white shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-amber-300 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300'}`}>
                <m.icon className="h-4 w-4 shrink-0" />{m.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-card p-5"><p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('si_lines_filled')}</p><p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{entries.length}</p></div>
        <div className="glass-card p-5"><p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('si_total_qty')}</p><p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{totalQty}</p></div>
        <div className="glass-card p-5"><p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('si_total_value')}</p><p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtDH(totalValue)}</p></div>
      </div>

      {/* ---- MODE: Saisie manuelle ---- */}
      {mode === 'manual' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} placeholder={t('si_search')} className="input-field pl-10" />
            </div>
            <Select value={category} onChange={(v) => { setCategory(v); setPage(1) }} options={categories.map((c) => ({ value: c, label: c === 'Toutes' ? t('si_all_cats') : c }))} className="w-auto min-w-[170px]" />
          </div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                    <th className="px-4 py-3.5">{t('si_col_ref')}</th>
                    <th className="px-4 py-3.5">{t('si_col_barcode')}</th>
                    <th className="px-4 py-3.5">{t('si_col_name')}</th>
                    <th className="px-4 py-3.5">{t('si_col_category')}</th>
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
                        <td className="px-4 py-2.5"><span className="rounded-md bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-zinc-400">{p.category}</span></td>
                        <td className="px-4 py-2.5 text-right text-gray-600 dark:text-zinc-400 tabular-nums">{fmtDH(p.cost)}</td>
                        <td className="px-4 py-2.5 text-center">
                          {p.decimalQty
                            ? <DecimalInput value={q} onChange={(n) => setQ(p.id, n)} placeholder="0" className="input-field !h-9 w-24 text-center" />
                            : <input type="number" min="0" value={q || ''} onChange={(e) => setQ(p.id, Number(e.target.value))} placeholder="0" className="input-field !h-9 w-24 text-center" />}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-gray-900 dark:text-white tabular-nums">{q > 0 ? fmtDH(q * p.cost) : '—'}</td>
                      </tr>
                    )
                  })}
                  {total === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('prod_none_found')}</td></tr>}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-white/10">
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  total={total}
                  onChange={setPage}
                  encadre={false}
                  className="w-full"
                />
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* ---- MODE: Scanner + quantité ---- */}
      {mode === 'scanqty' && (
        <div className="space-y-4">
          <div className="glass-card p-4">
            <p className="mb-2 text-xs text-gray-500 dark:text-zinc-400">{t('si_scanqty_hint')}</p>
            <div className="relative">
              <ScanLine className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-500" />
              <input ref={scanRef} type="text" placeholder={t('si_scan_ph')} autoComplete="off"
                onKeyDown={(e) => { if (e.key === 'Enter') { onScanLookup(e.currentTarget.value); e.currentTarget.value = '' } }}
                className="input-field h-12 pl-11 text-lg font-mono" />
            </div>
            <AnimatePresence>
              {scanFound && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{scanFound.name}</p>
                    <p className="font-mono text-[11px] text-gray-500 dark:text-zinc-400">{scanFound.barcode} · {fmtDH(scanFound.cost)}</p>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-400">{t('si_qty_label')}</label>
                    <input ref={scanQtyRef} type="number" min="0" step={scanFound?.decimalQty ? '0.01' : '1'} value={scanQtyInput}
                      onChange={(e) => setScanQtyInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addScanned() }}
                      className="input-field !h-10 w-24 text-center" />
                  </div>
                  <button onClick={addScanned} className="btn-primary !h-10"><Plus className="h-4 w-4" />{t('si_add')}</button>
                  <button onClick={() => setScanFound(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {grid}
        </div>
      )}

      {/* ---- MODE: Scanner répétitif ---- */}
      {mode === 'scanrepeat' && (
        <div className="space-y-4">
          <div className="glass-card p-4">
            <p className="mb-2 text-xs text-gray-500 dark:text-zinc-400">{t('si_scanrepeat_hint')}</p>
            <div className="relative">
              <Barcode className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-500" />
              <input ref={scanRef} type="text" placeholder={t('si_scan_ph')} autoComplete="off"
                onKeyDown={(e) => { if (e.key === 'Enter') { onScanRepeat(e.currentTarget.value); e.currentTarget.value = '' } }}
                className="input-field h-12 pl-11 text-lg font-mono" />
            </div>
          </div>
          {grid}
        </div>
      )}

      {/* ---- MODE: Import Excel/CSV ---- */}
      {mode === 'import' && (
        <div className="space-y-4">
          <div className="glass-card flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-500/10"><Upload className="h-7 w-7" /></div>
            <button onClick={() => csvRef.current?.click()} className="btn-primary"><FileSpreadsheet className="h-4 w-4" />{t('si_import_choose')}</button>
            <p className="max-w-md text-xs text-gray-400 dark:text-zinc-500">{t('si_import_drop')}</p>
            <input ref={csvRef} type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onImport} className="hidden" />
          </div>

          {report && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
              <h3 className="mb-3 text-sm font-bold text-gray-800 dark:text-zinc-200">{t('si_import_report_title')}</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />{t('si_import_ok')}</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{report.ok}</p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/20 dark:bg-rose-500/10">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400"><AlertTriangle className="h-4 w-4" />{t('si_import_unknown')}</p>
                  <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">{report.unknown.length}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400"><AlertTriangle className="h-4 w-4" />{t('si_import_dup')}</p>
                  <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">{report.dup.length}</p>
                </div>
              </div>
              {report.unknown.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-zinc-400">{t('si_import_unknown')}</p>
                  <div className="flex flex-wrap gap-1.5">{report.unknown.slice(0, 60).map((c) => <span key={c} className="rounded-md bg-rose-50 px-2 py-0.5 font-mono text-[11px] text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{c}</span>)}{report.unknown.length > 60 && <span className="text-[11px] text-gray-400">+{report.unknown.length - 60}…</span>}</div>
                </div>
              )}
              {report.dup.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-zinc-400">{t('si_import_dup')}</p>
                  <div className="flex flex-wrap gap-1.5">{report.dup.slice(0, 60).map((c) => <span key={c} className="rounded-md bg-amber-50 px-2 py-0.5 font-mono text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">{c}</span>)}{report.dup.length > 60 && <span className="text-[11px] text-gray-400">+{report.dup.length - 60}…</span>}</div>
                </div>
              )}
            </motion.div>
          )}
          {grid}
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-zinc-500">{t('si_recorded_hint')}</p>

      {/* Confirmation */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('si_confirm_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">{t('si_confirm_desc')}</p>
        <div className="mt-4 space-y-1.5 rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/5 p-3 text-sm">
          <div className="flex justify-between"><span className="text-gray-500 dark:text-zinc-400">{t('si_confirm_store')}</span><span className="font-semibold text-gray-900 dark:text-white">{storeName}</span></div>
          {storeDepots.length > 0 && <div className="flex justify-between"><span className="text-gray-500 dark:text-zinc-400">{t('si_depot_label')}</span><span className="font-semibold text-gray-900 dark:text-white">{depotName}</span></div>}
          <div className="flex justify-between"><span className="text-gray-500 dark:text-zinc-400">{t('si_confirm_user')}</span><span className="font-semibold text-gray-900 dark:text-white">{currentUser?.name ?? '—'}</span></div>
          <div className="my-1 border-t border-gray-100 dark:border-white/10" />
          <div className="flex justify-between"><span className="text-gray-500 dark:text-zinc-400">{t('si_lines_filled')}</span><span className="font-bold tabular-nums">{entries.length}</span></div>
          <div className="flex justify-between"><span className="text-gray-500 dark:text-zinc-400">{t('si_total_qty')}</span><span className="font-bold tabular-nums">{totalQty}</span></div>
          <div className="flex justify-between"><span className="text-gray-500 dark:text-zinc-400">{t('si_total_value')}</span><span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtDH(totalValue)}</span></div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setConfirmOpen(false)} className="btn-secondary">{t('si_cancel')}</button>
          <button onClick={doValidate} className="btn-primary"><PackageCheck className="h-4 w-4" />{activeStoreInitialized ? t('si_force_btn') : t('si_validate')}</button>
        </div>
      </Modal>

      {/* Bloqué */}
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
