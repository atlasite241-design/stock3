'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import Loader from '@/components/Loader'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Barcode,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MapPin,
  PackagePlus,
  PackageSearch,
  Printer,
  ScanLine,
  Search,
  Square,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import CameraScanner from '@/components/CameraScanner'
import { useToast } from '@/components/Toast'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, applyInventory, locationSortKey } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [byLocation, setByLocation] = useState(false)
  const router = useRouter()

  const [counted, setCounted] = useState<Record<string, string>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const [scanning, setScanning] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [flashIds, setFlashIds] = useState<Record<string, boolean>>({})
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const barcodeRef = useRef<HTMLInputElement>(null)
  const PAGE_SIZE = 50

  // Index code-barres O(1) pour la douchette (évite un find() sur 19 000 produits).
  const prodByBarcode = useMemo(() => {
    const m = new Map<string, (typeof products)[number]>()
    for (const p of products) if (p.barcode) m.set(p.barcode, p)
    return m
  }, [products])

  useEffect(() => {
    if (ready && !initialized) {
      const init: Record<string, string> = {}
      products.forEach((p) => (init[p.id] = String(p.stock)))
      setCounted(init)
      setInitialized(true)
    }
  }, [ready, initialized, products])

  useEffect(() => {
    if (scanning) barcodeRef.current?.focus()
  }, [scanning])

  if (!ready) {
    return <Loader />
  }

  // Écarts calculés sur TOUT le catalogue (pour la validation), en un passage.
  const cnt = (p: (typeof products)[number]) => Math.max(0, Math.round(parseFloat((counted[p.id] ?? '').replace(',', '.')) || 0))
  const diffs = products
    .map((p) => ({ product: p, counted: cnt(p), delta: cnt(p) - p.stock }))
    .filter((r) => r.delta !== 0)

  // Affichage paginé + recherche : sans ça, les 19 000 lignes (une saisie par
  // ligne) étaient toutes rendues → navigation lente vers l'inventaire.
  const deferredQuery = useDeferredValue(query)
  const filtered = (() => {
    const q = deferredQuery.trim().toLowerCase()
    const base = !q ? products : products.filter((p) => p.name.toLowerCase().includes(q) || p.barcode.includes(q))
    if (!byLocation) return base
    return [...base].sort((a, b) => locationSortKey(a).localeCompare(locationSortKey(b), 'fr') || a.name.localeCompare(b.name, 'fr'))
  })()
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const rows = filtered
    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    .map((p) => ({ product: p, counted: cnt(p), delta: cnt(p) - p.stock }))

  const validate = () => {
    applyInventory(diffs.map((r) => ({ productId: r.product.id, counted: r.counted })))
    toast(`✓ ${t('pinv_toast_validated')} ${diffs.length} ${t('pinv_toast_corrected')}`)
    setConfirmOpen(false)
    setInitialized(false)
  }

  const flash = (id: string) => {
    setFlashIds((f) => ({ ...f, [id]: true }))
    setTimeout(() => setFlashIds((f) => ({ ...f, [id]: false })), 900)
  }

  const handleScan = (code: string) => {
    const c = code.trim()
    if (!c) return
    const p = prodByBarcode.get(c)
    if (!p) {
      setNotFoundCode(c)
      return
    }
    const current = Math.max(0, Math.round(parseFloat((counted[p.id] ?? '').replace(',', '.')) || 0))
    const next = current + 1
    setCounted((prev) => ({ ...prev, [p.id]: String(next) }))
    flash(p.id)
    toast(`✓ ${p.name} — ${t('pinv_toast_counted_qty')} ${next}`)
    barcodeRef.current?.focus()
  }

  const goAddProduct = () => {
    if (notFoundCode) router.push(`/produits?new=1&barcode=${encodeURIComponent(notFoundCode)}`)
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            {t('pinv_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('pinv_subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer className="h-4 w-4" />
            {t('pinv_count_sheet')}
          </button>
          {scanning ? (
            <button onClick={() => setScanning(false)} className="btn-danger">
              <Square className="h-4 w-4" />
              {t('pinv_stop_scanner')}
            </button>
          ) : (
            <button onClick={() => setScanning(true)} className="btn-secondary">
              <ScanLine className="h-4 w-4 text-amber-500" />
              {t('pinv_scan')}
            </button>
          )}
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={diffs.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {t('pinv_validate')} ({diffs.length} {diffs.length > 1 ? t('pinv_gaps') : t('pinv_gap')})
          </button>
        </div>
      </motion.div>

      {/* Scanner panel */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="glass-card border-amber-300 dark:border-amber-500/30 p-4 shadow-glow">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-500" />
                  <input
                    ref={barcodeRef}
                    type="text"
                    placeholder={t('pinv_scan_placeholder')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleScan(e.currentTarget.value)
                        e.currentTarget.value = ''
                      }
                    }}
                    className="h-12 w-full rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-white/5 pl-11 pr-4 text-base font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 outline-none transition focus:border-amber-400 focus:bg-white dark:focus:bg-white/[0.08] focus:ring-2 focus:ring-amber-400/25"
                  />
                </div>
                <button
                  onClick={() => setCameraOpen(true)}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-200 dark:border-amber-500/20 bg-white dark:bg-[#12121a] text-amber-500 transition hover:bg-amber-50"
                  title={t('pinv_camera_title')}
                >
                  <Camera className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
                {t('pinv_usb_hint')}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4 }}
        className="glass-card print-area overflow-hidden"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/10 no-print">
          <div className="relative max-w-xs flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1) }}
              placeholder={t('pinv_col_product')}
              className="input-field pl-10"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-zinc-400">
            <input type="checkbox" checked={byLocation} onChange={(e) => { setByLocation(e.target.checked); setPage(1) }} className="h-4 w-4 accent-amber-500" />
            {t('pinv_sort_location')}
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('pinv_col_product')}</th>
                <th className="px-5 py-3.5">{t('pinv_col_theoretical')}</th>
                <th className="px-5 py-3.5">{t('pinv_col_counted')}</th>
                <th className="px-5 py-3.5">{t('pinv_col_gap')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ product: p, delta }) => (
                <motion.tr
                  key={p.id}
                  className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5"
                  animate={{
                    backgroundColor: flashIds[p.id] ? 'rgba(16,185,129,0.16)' : 'rgba(0,0,0,0)',
                  }}
                  transition={{ duration: 0.7 }}
                >
                  <td className="px-5 py-3">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
                    {byLocation && p.emplacementComplet
                      ? <p className="flex items-center gap-1 font-mono text-[11px] text-amber-600 dark:text-amber-400"><MapPin className="h-3 w-3" />{p.emplacementComplet}</p>
                      : <p className="text-xs text-gray-400 dark:text-zinc-500">{p.category}</p>}
                  </td>
                  <td className="px-5 py-3 text-sm font-bold text-gray-700 dark:text-zinc-300 tabular-nums">{p.stock}</td>
                  <td className="px-5 py-3">
                    <input
                      type="number"
                      min="0"
                      value={counted[p.id] ?? ''}
                      onChange={(e) => setCounted({ ...counted, [p.id]: e.target.value })}
                      className="input-field !h-9 w-28"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${
                        delta === 0
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : delta > 0
                            ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400'
                            : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {delta === 0 ? t('pinv_ok') : delta > 0 ? `+${delta}` : delta}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-white/10 no-print">
            <p className="text-xs text-gray-500 dark:text-zinc-400 tabular-nums">{filtered.length} · {page}/{pageCount}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40 dark:border-white/10"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40 dark:border-white/10"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Camera scanner */}
      <CameraScanner open={cameraOpen} onClose={() => setCameraOpen(false)} onDetect={(code) => handleScan(code)} />

      {/* Product not found */}
      <Modal open={!!notFoundCode} onClose={() => setNotFoundCode(null)} title={t('pinv_not_found_title')} maxWidth="max-w-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400">
            <PackageSearch className="h-5 w-5" />
          </span>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            {t('pinv_not_found_prefix')}{' '}
            <span className="font-mono font-semibold text-gray-900 dark:text-white">{notFoundCode}</span>. {t('pinv_not_found_suffix')}
          </p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setNotFoundCode(null)} className="btn-secondary">
            {t('pinv_close')}
          </button>
          <button onClick={goAddProduct} className="btn-primary">
            <PackagePlus className="h-4 w-4" />
            {t('pinv_add_to_catalog')}
          </button>
        </div>
      </Modal>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('pinv_confirm_title')} maxWidth="max-w-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500">
            <ClipboardList className="h-5 w-5" />
          </span>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            {diffs.length} {t('pinv_confirm_desc1')} {t('pinv_confirm_desc2')}
          </p>
        </div>
        <div className="mt-4 max-h-44 space-y-1.5 overflow-y-auto">
          {diffs.map((r) => (
            <div key={r.product.id} className="flex justify-between rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2 text-xs">
              <span className="font-medium text-gray-700 dark:text-zinc-300">{r.product.name}</span>
              <span className={`font-bold tabular-nums ${r.delta > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-500 dark:text-rose-400'}`}>
                {r.product.stock} → {r.counted}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setConfirmOpen(false)} className="btn-secondary">
            {t('pinv_cancel')}
          </button>
          <button onClick={validate} className="btn-primary">
            {t('pinv_validate_action')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function InventairePage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
