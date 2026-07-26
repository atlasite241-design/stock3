'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Loader from '@/components/Loader'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Camera, Check, MapPin, Package, PackageX, ScanLine, Undo2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import CameraScanner from '@/components/CameraScanner'
import LocationPicker, { type ProductLocation } from '@/components/LocationPicker'
import { useToast } from '@/components/Toast'
import { availableStock, useDroguerie, type Product } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

type MoveLog = { id: string; name: string; from: string; to: string }

function Content() {
  const { ready, products, activeStoreId, updateProduct } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [code, setCode] = useState('')
  const [current, setCurrent] = useState<Product | null>(null)
  const [notFound, setNotFound] = useState<string | null>(null)
  const [loc, setLoc] = useState<ProductLocation>({})
  const [cameraOpen, setCameraOpen] = useState(false)
  const [history, setHistory] = useState<MoveLog[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const byBarcode = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of products) if (p.barcode) m.set(p.barcode, p)
    return m
  }, [products])

  useEffect(() => { if (ready) inputRef.current?.focus() }, [ready])

  const pickLoc = (p: Product): ProductLocation => ({
    zoneId: p.zoneId, alleeId: p.alleeId, rayonId: p.rayonId,
    etagereId: p.etagereId, niveauId: p.niveauId, positionId: p.positionId,
    emplacementComplet: p.emplacementComplet,
  })

  const lookup = (raw: string) => {
    const c = raw.trim()
    if (!c) return
    const found = byBarcode.get(c) ?? products.find((p) => p.barcode === c) ?? null
    if (found) { setCurrent(found); setLoc(pickLoc(found)); setNotFound(null) }
    else { setCurrent(null); setNotFound(c) }
    setCode('')
    inputRef.current?.focus()
  }

  const save = () => {
    if (!current) return
    const before = current.emplacementComplet || '—'
    updateProduct(current.id, {
      zoneId: loc.zoneId, alleeId: loc.alleeId, rayonId: loc.rayonId,
      etagereId: loc.etagereId, niveauId: loc.niveauId, positionId: loc.positionId,
      emplacementComplet: loc.emplacementComplet,
    })
    setHistory((h) => [{ id: current.id, name: current.name, from: before, to: loc.emplacementComplet || '—' }, ...h].slice(0, 20))
    toast(`✓ ${current.name} → ${loc.emplacementComplet || t('put_removed')}`)
    setCurrent(null); setLoc({}); setNotFound(null)
    inputRef.current?.focus()
  }

  if (!ready) return <Loader />

  const changed = current
    ? loc.emplacementComplet !== current.emplacementComplet
    : false
  const s = current ? availableStock(current) : 0

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <MapPin className="h-6 w-6 text-amber-500" />
          {t('put_title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('put_subtitle')}</p>
      </motion.div>

      {/* Scan */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card flex items-center gap-2 p-3">
        <div className="relative flex-1">
          <ScanLine className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-500" />
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') lookup(code) }}
            placeholder={t('put_scan_ph')}
            className="input-field h-12 pl-11 text-lg font-mono"
            autoComplete="off"
          />
        </div>
        <button onClick={() => setCameraOpen(true)} className="btn-secondary h-12 shrink-0" title={t('consult_camera')}>
          <Camera className="h-5 w-5" />
        </button>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Produit + picker */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {notFound && (
              <motion.div key="nf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass-card flex flex-col items-center gap-3 p-10 text-center">
                <PackageX className="h-12 w-12 text-rose-400" />
                <p className="text-sm text-gray-600 dark:text-zinc-300">{t('consult_not_found')}</p>
                <p className="font-mono text-lg font-bold text-rose-500">{notFound}</p>
              </motion.div>
            )}

            {current && (
              <motion.div key={current.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass-card p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-white/5">
                    {current.image ? <img src={current.image} alt="" className="h-full w-full object-cover" /> : <Package className="h-7 w-7 text-gray-300" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{current.name}</h2>
                    <p className="font-mono text-xs text-gray-400 dark:text-zinc-500">{current.barcode}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t('put_stock')} : <span className="font-bold tabular-nums">{s}</span></p>
                  </div>
                </div>

                {/* Actuel → Nouveau */}
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 p-3 text-sm dark:bg-white/5">
                  <span className="text-gray-400 dark:text-zinc-500">{t('put_current')} :</span>
                  <span className="font-mono font-bold text-gray-700 dark:text-zinc-200">{current.emplacementComplet || '—'}</span>
                  <ArrowRight className="h-4 w-4 text-amber-500" />
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{loc.emplacementComplet || '—'}</span>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('put_new_location')}</p>
                  <LocationPicker storeId={activeStoreId} value={loc} onChange={setLoc} />
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  {loc.emplacementComplet && (
                    <button onClick={() => setLoc({})} className="btn-secondary" title={t('put_clear')}>
                      <Undo2 className="h-4 w-4" />{t('put_clear')}
                    </button>
                  )}
                  <button onClick={save} disabled={!changed} className="btn-primary disabled:opacity-50">
                    <Check className="h-4 w-4" />{t('put_save')}
                  </button>
                </div>
              </motion.div>
            )}

            {!current && !notFound && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass-card flex flex-col items-center gap-3 p-16 text-center">
                <ScanLine className="h-12 w-12 text-gray-200 dark:text-zinc-700" />
                <p className="text-sm text-gray-400 dark:text-zinc-500">{t('put_idle')}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Historique de session */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-bold text-gray-700 dark:text-zinc-200">{t('put_history')}</h3>
          {history.length === 0 ? (
            <p className="mt-3 text-xs text-gray-400 dark:text-zinc-500">{t('put_history_empty')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {history.map((h, i) => (
                <li key={i} className="rounded-lg border border-gray-100 p-2.5 text-xs dark:border-white/10">
                  <p className="truncate font-semibold text-gray-800 dark:text-zinc-200">{h.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-gray-400 dark:text-zinc-500">
                    {h.from}<ArrowRight className="h-3 w-3 text-amber-500" /><span className="text-amber-600 dark:text-amber-400">{h.to}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <CameraScanner open={cameraOpen} onClose={() => setCameraOpen(false)} onDetect={(c) => { setCameraOpen(false); lookup(c) }} />
    </>
  )
}

export default function RangementPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
