'use client'

import Loader from '@/components/Loader'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Minus, Plus, RotateCcw, ScanLine, Search, X } from 'lucide-react'
import MobileShell from '@/components/MobileShell'
import CameraScanner from '@/components/CameraScanner'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, applyInventory } = useDroguerie()
  const { t } = useLanguage()

  const [counts, setCounts] = useState<Record<string, number>>({})
  const [scanOpen, setScanOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [flash, setFlash] = useState('')
  const [done, setDone] = useState(false)

  const say = (msg: string) => {
    setFlash(msg)
    setTimeout(() => setFlash(''), 1600)
  }

  const bump = (productId: string, delta: number) => {
    setCounts((c) => {
      const next = Math.max(0, (c[productId] ?? 0) + delta)
      return { ...c, [productId]: next }
    })
  }
  const setCount = (productId: string, value: number) => setCounts((c) => ({ ...c, [productId]: Math.max(0, value) }))

  const onDetect = (code: string) => {
    const p = products.find((x) => x.barcode && x.barcode === code.trim())
    if (!p) {
      say(t('mob_inv_not_found'))
      return
    }
    bump(p.id, 1)
    say(`${p.name} +1`)
  }

  const rows = useMemo(() => {
    return Object.keys(counts)
      .map((id) => {
        const p = products.find((x) => x.id === id)
        if (!p) return null
        return { p, counted: counts[id], gap: counts[id] - p.stock }
      })
      .filter(Boolean) as { p: (typeof products)[number]; counted: number; gap: number }[]
  }, [counts, products])

  const q = query.trim().toLowerCase()
  const searchResults = q
    ? products.filter((p) => (p.name.toLowerCase().includes(q) || p.barcode.includes(q)) && !(p.id in counts)).slice(0, 8)
    : []

  const apply = () => {
    const payload = Object.entries(counts).map(([productId, counted]) => ({ productId, counted }))
    if (payload.length === 0) return
    applyInventory(payload)
    setDone(true)
  }

  if (!ready) return <Loader className="!min-h-0 h-64" />

  if (done) {
    return (
      <motion.section initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mt-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-8 text-center backdrop-blur-xl">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
          <Check className="h-9 w-9" strokeWidth={2.5} />
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{t('mob_inv_applied')}</h2>
        <button
          onClick={() => { setDone(false); setCounts({}) }}
          className="mt-8 h-12 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 font-bold text-slate-900 transition active:scale-[0.98]"
        >
          {t('mob_done')}
        </button>
      </motion.section>
    )
  }

  return (
    <>
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('mob_inv_title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('mob_inv_subtitle')}</p>
      </motion.section>

      {/* Scan CTA */}
      <button
        onClick={() => setScanOpen(true)}
        className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-lg font-bold text-slate-900 shadow-[0_8px_30px_rgb(var(--c-amber-500)/0.4)] transition active:scale-[0.98]"
      >
        <ScanLine className="h-6 w-6" strokeWidth={2.5} />
        {t('mob_inv_scan_cta')}
      </button>

      {flash && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-center text-sm font-semibold text-amber-200">{flash}</p>
      )}

      {/* Manual search */}
      <section className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('mob_search')}
          className="h-11 w-full rounded-2xl border border-slate-200 dark:border-amber-500/20 bg-slate-100 dark:bg-white/5 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-amber-400/60"
        />
        {searchResults.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 dark:border-amber-500/20 bg-white dark:bg-slate-900">
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => { bump(p.id, 1); setQuery('') }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-slate-100 dark:bg-white/5"
              >
                <span className="truncate text-sm text-slate-900 dark:text-white">{p.name}</span>
                <Plus className="h-4 w-4 shrink-0 text-amber-400" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Counted list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-amber-400/80">{t('mob_inv_counted')} · {rows.length}</h3>
          {rows.length > 0 && (
            <button onClick={() => setCounts({})} className="flex items-center gap-1 text-xs font-semibold text-rose-400">
              <RotateCcw className="h-3.5 w-3.5" />{t('mob_inv_reset')}
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="rounded-2xl m-card p-6 text-center text-sm text-slate-500 dark:text-slate-400">{t('mob_empty')}</p>
        ) : (
          rows.map(({ p, counted, gap }) => (
            <div key={p.id} className="rounded-2xl m-card p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 truncate font-semibold text-slate-900 dark:text-white">{p.name}</p>
                <button onClick={() => setCount(p.id, 0)} className="text-slate-500"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span>{t('mob_inv_theoretical')}: <b className="text-slate-700 dark:text-slate-200 tabular-nums">{p.stock}</b></span>
                  <span className={gap === 0 ? 'text-slate-500 dark:text-slate-400' : gap > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {t('mob_inv_gap')}: <b className="tabular-nums">{gap > 0 ? '+' : ''}{gap}</b>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => bump(p.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white"><Minus className="h-4 w-4" /></button>
                  <input
                    inputMode="numeric"
                    value={counted}
                    onChange={(e) => setCount(p.id, parseInt(e.target.value || '0', 10) || 0)}
                    className="h-8 w-12 rounded-lg bg-slate-100 dark:bg-white/5 text-center text-sm font-bold text-slate-900 dark:text-white outline-none"
                  />
                  <button onClick={() => bump(p.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      {rows.length > 0 && (
        <button
          onClick={apply}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 font-bold text-slate-900 transition active:scale-[0.98]"
        >
          <Check className="h-5 w-5" strokeWidth={2.5} />
          {t('mob_inv_apply')}
        </button>
      )}

      <CameraScanner open={scanOpen} onClose={() => setScanOpen(false)} onDetect={onDetect} />
    </>
  )
}

export default function MobileInventairePage() {
  return (
    <MobileShell>
      <Content />
    </MobileShell>
  )
}
