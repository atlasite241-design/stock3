'use client'

// Comptage rapide : on scanne (ou saisit) un code-barres, on tape la quantité
// comptée, et on passe au suivant. Les écarts sont accumulés et appliqués en
// une seule validation — on ne modifie jamais le stock article par article.

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Check, ScanLine, Trash2, Undo2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import CameraScanner from '@/components/CameraScanner'
import Loader from '@/components/Loader'
import { useToast } from '@/components/Toast'
import { availableStock, useDroguerie, type Product } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

interface Line { productId: string; name: string; theoretical: number; counted: number }

function Content() {
  const { ready, products, activeStoreId, adjustStock } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [code, setCode] = useState('')
  const [qty, setQty] = useState('')
  const [pending, setPending] = useState<Product | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [cameraOpen, setCameraOpen] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)

  const byBarcode = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of products) {
      if (!p.barcode) continue
      if (!activeStoreId || !p.storeId || p.storeId === activeStoreId) m.set(p.barcode, p)
    }
    return m
  }, [products, activeStoreId])

  useEffect(() => { if (ready) codeRef.current?.focus() }, [ready])

  const lookup = (raw: string) => {
    const c = raw.trim()
    if (!c) return
    const found = byBarcode.get(c)
    if (!found) { toast(`${t('sk_cnt_unknown')} : ${c}`, 'error'); setCode(''); return }
    setPending(found)
    setQty('')
    setCode('')
    setTimeout(() => qtyRef.current?.focus(), 50)
  }

  const addLine = () => {
    if (!pending) return
    const counted = Math.max(0, Math.round(Number(qty.replace(',', '.')) || 0))
    setLines((l) => [
      { productId: pending.id, name: pending.name, theoretical: availableStock(pending), counted },
      ...l.filter((x) => x.productId !== pending.id),
    ])
    setPending(null); setQty('')
    codeRef.current?.focus()
  }

  const totals = useMemo(() => {
    const diff = lines.reduce((a, l) => a + (l.counted - l.theoretical), 0)
    const ecarts = lines.filter((l) => l.counted !== l.theoretical).length
    return { diff, ecarts }
  }, [lines])

  const validate = () => {
    let n = 0
    for (const l of lines) {
      const delta = l.counted - l.theoretical
      if (delta !== 0) { adjustStock(l.productId, delta, t('sk_cnt_title')); n++ }
    }
    toast(n > 0 ? `✓ ${n} ${t('sk_cnt_fixed')}` : t('sk_cnt_nothing'))
    setLines([])
  }

  if (!ready) return <Loader />

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <ScanLine className="h-6 w-6 text-amber-500" />{t('sk_cnt_title')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('sk_cnt_sub')}</p>
      </motion.div>

      <div className="glass-card flex flex-wrap items-end gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <ScanLine className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-500" />
          <input
            ref={codeRef} value={code} onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') lookup(code) }}
            placeholder={t('sk_cnt_scan')} className="input-field h-12 pl-11 font-mono text-lg" autoComplete="off"
          />
        </div>
        <button onClick={() => setCameraOpen(true)} className="btn-secondary h-12 shrink-0"><Camera className="h-5 w-5" /></button>
      </div>

      <AnimatePresence>
        {pending && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass-card p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-gray-900 dark:text-white">{pending.name}</p>
                <p className="text-xs text-gray-400">
                  {t('sk_cnt_theoretical')} : <span className="font-bold tabular-nums">{availableStock(pending)}</span>
                </p>
              </div>
              <div className="w-32">
                <label className="field-label">{t('sk_cnt_counted')}</label>
                <input ref={qtyRef} type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addLine() }} className="input-field text-center text-lg font-bold" />
              </div>
              <button onClick={addLine} disabled={qty === ''} className="btn-primary h-11 disabled:opacity-40">
                <Check className="h-4 w-4" />{t('sk_cnt_add')}
              </button>
              <button onClick={() => setPending(null)} className="btn-secondary h-11"><Undo2 className="h-4 w-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {lines.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { v: lines.length, l: t('sk_cnt_items'), c: 'text-gray-900 dark:text-white' },
              { v: totals.ecarts, l: t('sk_cnt_with_gap'), c: totals.ecarts ? 'text-amber-500' : 'text-gray-400' },
              { v: `${totals.diff > 0 ? '+' : ''}${totals.diff}`, l: t('sk_cnt_net'), c: totals.diff < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400' },
            ].map((s, i) => (
              <div key={i} className="glass-card p-3 text-center">
                <p className={`text-xl font-extrabold tabular-nums ${s.c}`}>{s.v}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
              </div>
            ))}
          </div>

          <div className="glass-card overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                  <th className="px-4 py-3">{t('sa_col_product')}</th>
                  <th className="px-4 py-3 text-center">{t('sk_cnt_theoretical')}</th>
                  <th className="px-4 py-3 text-center">{t('sk_cnt_counted')}</th>
                  <th className="px-4 py-3 text-center">{t('sk_cnt_gap')}</th><th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const d = l.counted - l.theoretical
                  return (
                    <tr key={l.productId} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                      <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{l.name}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-gray-500">{l.theoretical}</td>
                      <td className="px-4 py-2.5 text-center font-bold tabular-nums text-gray-900 dark:text-white">{l.counted}</td>
                      <td className={`px-4 py-2.5 text-center font-bold tabular-nums ${d === 0 ? 'text-gray-300' : d < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {d > 0 ? '+' : ''}{d}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => setLines((x) => x.filter((y) => y.productId !== l.productId))}
                          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button onClick={validate} className="btn-primary w-full">
            <Check className="h-4 w-4" />{t('sk_cnt_validate')} ({totals.ecarts})
          </button>
        </>
      )}

      <CameraScanner open={cameraOpen} onClose={() => setCameraOpen(false)} onDetect={(c) => { setCameraOpen(false); lookup(c) }} />
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
