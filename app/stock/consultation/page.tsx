'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Loader from '@/components/Loader'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Camera, CheckCircle2, MapPin, Package, PackageX, ScanLine, Tag } from 'lucide-react'
import AppShell from '@/components/AppShell'
import CameraScanner from '@/components/CameraScanner'
import { availableStock, fmtDH, useDroguerie, type Product } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, resolveLocation } = useDroguerie()
  const { t } = useLanguage()

  const [code, setCode] = useState('')
  const [current, setCurrent] = useState<Product | null>(null)
  const [notFound, setNotFound] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Index O(1) code-barres → produit (évite un find() sur 19 000 lignes).
  const byBarcode = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of products) if (p.barcode) m.set(p.barcode, p)
    return m
  }, [products])

  useEffect(() => { if (ready) inputRef.current?.focus() }, [ready])

  const lookup = (raw: string) => {
    const c = raw.trim()
    if (!c) return
    const found = byBarcode.get(c) ?? products.find((p) => p.barcode === c) ?? null
    if (found) { setCurrent(found); setNotFound(null) }
    else { setCurrent(null); setNotFound(c) }
    setCode('')
    inputRef.current?.focus()
  }

  if (!ready) return <Loader />

  const loc = current ? resolveLocation(current) : null
  const s = current ? availableStock(current) : 0
  const status = !current ? null : s === 0 ? 'out' : s <= current.minStock ? 'low' : 'ok'

  const statusChip = {
    ok: { cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300', icon: CheckCircle2, label: t('consult_ok') },
    low: { cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300', icon: AlertTriangle, label: t('consult_low') },
    out: { cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300', icon: PackageX, label: t('consult_out') },
  } as const

  const locParts = loc
    ? [
        { label: t('wms_depot'), n: loc.depot },
        { label: t('wms_zone'), n: loc.zone },
        { label: t('wms_allee'), n: loc.allee },
        { label: t('wms_rayon'), n: loc.rayon },
        { label: t('wms_etagere'), n: loc.etagere },
        { label: t('wms_niveau'), n: loc.niveau },
        { label: t('wms_position'), n: loc.position },
      ].filter((x) => x.n)
    : []

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <ScanLine className="h-6 w-6 text-amber-500" />
          {t('consult_title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('consult_subtitle')}</p>
      </motion.div>

      {/* Barre de scan */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card flex items-center gap-2 p-3">
        <div className="relative flex-1">
          <ScanLine className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-500" />
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') lookup(code) }}
            placeholder={t('consult_scan_ph')}
            className="input-field h-12 pl-11 text-lg font-mono"
            autoComplete="off"
          />
        </div>
        <button onClick={() => setCameraOpen(true)} className="btn-secondary h-12 shrink-0" title={t('consult_camera')}>
          <Camera className="h-5 w-5" />
        </button>
      </motion.div>

      {/* Résultat */}
      <AnimatePresence mode="wait">
        {notFound && (
          <motion.div key="nf" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="glass-card flex flex-col items-center gap-3 p-10 text-center">
            <PackageX className="h-12 w-12 text-rose-400" />
            <p className="text-sm text-gray-600 dark:text-zinc-300">{t('consult_not_found')}</p>
            <p className="font-mono text-lg font-bold text-rose-500">{notFound}</p>
          </motion.div>
        )}

        {current && (
          <motion.div key={current.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-4 lg:grid-cols-[280px_1fr]">
            {/* Photo + prix */}
            <div className="glass-card flex flex-col items-center gap-4 p-5">
              <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-gray-100 dark:bg-white/5">
                {current.image ? <img src={current.image} alt={current.name} className="h-full w-full object-cover" /> : <Package className="h-16 w-16 text-gray-300" />}
              </div>
              <div className="text-center">
                <p className="text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">{fmtDH(current.price)}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500">{t('consult_cost')} : {fmtDH(current.cost)}</p>
              </div>
            </div>

            {/* Infos */}
            <div className="space-y-4">
              <div className="glass-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{current.name}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 dark:text-zinc-400">
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs dark:bg-white/10">{current.category}</span>
                      {current.brand && <span>{current.brand}</span>}
                      <span className="font-mono text-xs">{current.barcode}</span>
                    </p>
                  </div>
                  {status && (() => { const S = statusChip[status]; return (
                    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${S.cls}`}>
                      <S.icon className="h-4 w-4" />{S.label}
                    </span>
                  )})()}
                </div>

                {/* Stock */}
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-white/5">
                    <p className={`text-2xl font-extrabold tabular-nums ${s === 0 ? 'text-rose-500' : status === 'low' ? 'text-amber-500' : 'text-gray-900 dark:text-white'}`}>{s}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('consult_available')}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-white/5">
                    <p className="text-2xl font-extrabold tabular-nums text-gray-900 dark:text-white">{current.stock}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('consult_physical')}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-white/5">
                    <p className="text-2xl font-extrabold tabular-nums text-gray-500 dark:text-zinc-400">{current.reserved ?? 0}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('consult_reserved')}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-white/5">
                    <p className="text-2xl font-extrabold tabular-nums text-gray-500 dark:text-zinc-400">{current.minStock}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('consult_min')}</p>
                  </div>
                </div>
                {current.unit && <p className="mt-3 text-xs text-gray-400 dark:text-zinc-500"><Tag className="mr-1 inline h-3 w-3" />{t('consult_unit')} : {current.unit}</p>}
              </div>

              {/* Emplacement */}
              <div className="glass-card p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-zinc-200">
                  <MapPin className="h-4 w-4 text-amber-500" />{t('wms_emplacement')}
                </h3>
                {loc && loc.code ? (
                  <>
                    <p className="mt-2 font-mono text-lg font-bold text-amber-600 dark:text-amber-400">{loc.code}</p>
                    {locParts.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {locParts.map((x, i) => (
                          <span key={i} className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs dark:bg-amber-500/10">
                            <span className="text-gray-400 dark:text-zinc-500">{x.label} : </span>
                            <span className="font-mono font-bold text-amber-700 dark:text-amber-300">{x.n!.code}</span>
                            {x.n!.name ? <span className="text-gray-500 dark:text-zinc-400"> · {x.n!.name}</span> : null}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-gray-400 dark:text-zinc-500">{t('consult_no_location')}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {!current && !notFound && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass-card flex flex-col items-center gap-3 p-16 text-center">
            <ScanLine className="h-12 w-12 text-gray-200 dark:text-zinc-700" />
            <p className="text-sm text-gray-400 dark:text-zinc-500">{t('consult_idle')}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <CameraScanner open={cameraOpen} onClose={() => setCameraOpen(false)} onDetect={(c) => { setCameraOpen(false); lookup(c) }} />
    </>
  )
}

export default function ConsultationPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
