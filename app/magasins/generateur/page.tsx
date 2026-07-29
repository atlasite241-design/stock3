'use client'

import { useEffect, useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Boxes, CheckCircle2, Layers, Loader2, Merge, RefreshCw, Sparkles, Store, Wand2, X } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { depotShortCode, storeShortCode, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

type Mode = 'new' | 'merge' | 'replace'
type Counts = { rayons: number; etageres: number; niveaux: number; positions: number }

function Content() {
  const { ready, activeStoreId, stores, depots, zones, allees, rayons, switchStore, generateSubStructure } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [depotId, setDepotId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [alleeId, setAlleeId] = useState('')
  const [c, setC] = useState({ rayons: 5, etageres: 6, niveaux: 5, positions: 20 })
  const [choose, setChoose] = useState(false)   // modale mode (fusionner/remplacer)
  const [confirmNew, setConfirmNew] = useState(false)
  const [progress, setProgress] = useState<{ counts: Counts; phase: number } | null>(null)

  const storeDepots = useMemo(() => depots.filter((x) => x.storeId === activeStoreId), [depots, activeStoreId])
  const firstDepotId = storeDepots[0]?.id
  const curDepot = depotId || firstDepotId || ''
  const storeZones = useMemo(
    () => zones.filter((z) => z.storeId === activeStoreId && (z.depotId === curDepot || (!z.depotId && curDepot === firstDepotId))).sort((a, b) => a.code.localeCompare(b.code, 'fr')),
    [zones, activeStoreId, curDepot, firstDepotId]
  )
  const zoneAllees = useMemo(() => allees.filter((a) => a.zoneId === zoneId).sort((a, b) => a.code.localeCompare(b.code, 'fr')), [allees, zoneId])
  const alleeHasStructure = rayons.some((r) => r.alleeId === alleeId)

  const storeCode = useMemo(() => storeShortCode(Math.max(0, stores.findIndex((s) => s.id === activeStoreId))), [stores, activeStoreId])
  const depotCode = useMemo(() => {
    const idx = storeDepots.findIndex((x) => x.id === curDepot)
    return storeDepots.find((x) => x.id === curDepot)?.code || depotShortCode(idx < 0 ? 0 : idx)
  }, [storeDepots, curDepot])

  useEffect(() => { setZoneId(''); setAlleeId('') }, [curDepot])
  useEffect(() => { setAlleeId('') }, [zoneId])

  if (!ready) return <Loader />

  const R = Math.max(0, Math.floor(c.rayons)), E = Math.max(0, Math.floor(c.etageres)), N = Math.max(0, Math.floor(c.niveaux)), P = Math.max(0, Math.floor(c.positions))
  const nR = R, nE = R * E, nN = R * E * N, nP = R * E * N * P
  const total = nR + nE + nN + nP
  const heavy = total > 3000
  const zone = storeZones.find((z) => z.id === zoneId)
  const alleeCode = zoneAllees.find((a) => a.id === alleeId)?.code ?? '01'
  const sampleCode = `${storeCode}-${depotCode}-${zone?.code ?? '?'}-${alleeCode}-R01-E01-N01-P001`

  const doGenerate = (mode: Mode) => {
    setChoose(false); setConfirmNew(false)
    const res = generateSubStructure(alleeId, activeStoreId, c, mode)
    if (!res.ok || !res.counts) { toast(res.error === 'empty' ? t('gen_empty') : t('gen_exists'), 'error'); return }
    const counts = res.counts
    setProgress({ counts, phase: 0 })
    let i = 0
    const tick = () => {
      i += 1
      setProgress({ counts, phase: i })
      if (i < 4) setTimeout(tick, 420)
      else setTimeout(() => { setProgress(null); toast(`✓ ${counts.rayons + counts.etageres + counts.niveaux + counts.positions} ${t('gen_created')}`); setAlleeId('') }, 1100)
    }
    setTimeout(tick, 420)
  }

  const onGenerateClick = () => {
    if (!alleeId || total === 0) return
    if (alleeHasStructure) setChoose(true)
    else setConfirmNew(true)
  }

  const field = (label: string, key: keyof typeof c) => (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{label}</span>
      <input type="number" min={0} max={99} value={c[key]} onChange={(e) => setC({ ...c, [key]: Number(e.target.value) })} className="input-field text-center" />
    </label>
  )

  const PHASES = [
    { label: t('wms_rayon'), v: progress?.counts.rayons ?? 0 },
    { label: t('wms_etagere'), v: progress?.counts.etageres ?? 0 },
    { label: t('wms_niveau'), v: progress?.counts.niveaux ?? 0 },
    { label: t('wms_position'), v: progress?.counts.positions ?? 0 },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <Wand2 className="h-6 w-6 text-amber-500" />{t('gen_title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('gen_subtitle')}</p>
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Assistant */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/40 bg-white/70 p-5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-zinc-400"><Store className="h-3 w-3" />{t('si_confirm_store')}</span>
              <Select value={activeStoreId} onChange={switchStore} options={stores.map((s, i) => ({ value: s.id, label: `${s.name} (${storeShortCode(i)})` }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{t('wms_depot')}</span>
              <Select value={curDepot} onChange={setDepotId} options={storeDepots.map((x, i) => ({ value: x.id, label: `${x.code || depotShortCode(i)} · ${x.name}` }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{t('wms_zone')}</span>
              <Select value={zoneId} onChange={setZoneId} placeholder={`— ${t('wms_zone')} —`}
                options={[{ value: '', label: `— ${t('wms_zone')} —` }, ...storeZones.map((z) => ({ value: z.id, label: `${z.code} · ${z.name}` }))]} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{t('wms_allee')}</span>
              <div className={zoneId ? '' : 'pointer-events-none opacity-40'}>
                <Select value={alleeId} onChange={setAlleeId} placeholder={`— ${t('wms_allee')} —`}
                  options={[{ value: '', label: `— ${t('wms_allee')} —` }, ...zoneAllees.map((a) => ({ value: a.id, label: `${a.code}${a.name ? ' · ' + a.name : ''}` }))]} />
              </div>
            </label>
          </div>

          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500"><Layers className="h-3.5 w-3.5" />{t('gen_counts')}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {field(t('wms_rayon'), 'rayons')}
              {field(t('wms_etagere'), 'etageres')}
              {field(t('wms_niveau'), 'niveaux')}
              {field(t('wms_position'), 'positions')}
            </div>
            <p className="mt-2 text-[11px] text-gray-400 dark:text-zinc-500">{t('gen_counts_hint')}</p>
          </div>

          {alleeId && alleeHasStructure && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />{t('gen_has_structure')}
            </div>
          )}
        </motion.div>

        {/* Résumé */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-white/40 bg-white/70 p-5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5 lg:sticky lg:top-20 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('gen_preview')}</p>
          {zone && <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-zinc-100">{zone.code} · {zone.name}</p>}
          <div className="mt-2 space-y-1.5 text-sm">
            <Row label={t('wms_rayon')} v={nR} />
            <Row label={t('wms_etagere')} v={nE} />
            <Row label={t('wms_niveau')} v={nN} />
            <Row label={t('wms_position')} v={nP} />
            <div className="my-1 border-t border-gray-100 dark:border-white/10" />
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-800 dark:text-zinc-100">{t('gen_total')}</span>
              <span className={`text-2xl font-extrabold tabular-nums ${heavy ? 'text-rose-500' : 'text-amber-600 dark:text-amber-400'}`}>{total}</span>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-gray-50 p-2.5 dark:bg-white/5">
            <p className="text-[10px] font-semibold uppercase text-gray-400">{t('gen_sample')}</p>
            <p className="break-all font-mono text-xs font-bold text-amber-600 dark:text-amber-400">{sampleCode}</p>
          </div>
          {heavy && <p className="mt-2 flex items-start gap-1.5 text-[11px] text-rose-500"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('gen_heavy')}</p>}
          <button onClick={onGenerateClick} disabled={!alleeId || total === 0} className="btn-primary mt-4 w-full disabled:opacity-50">
            <Sparkles className="h-4 w-4" />{t('gen_generate')}
          </button>
        </motion.div>
      </div>

      {/* Confirmation (allée vide) */}
      <Modal open={confirmNew} onClose={() => setConfirmNew(false)} title={t('gen_confirm_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">{t('gen_confirm_desc')}</p>
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-white/10 dark:bg-white/5">
          <Boxes className="h-5 w-5 text-amber-500" />
          <span className={`text-3xl font-extrabold tabular-nums ${heavy ? 'text-rose-500' : 'text-amber-600 dark:text-amber-400'}`}>{total}</span>
          <span className="text-sm text-gray-500 dark:text-zinc-400">{t('gen_elements')}</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setConfirmNew(false)} className="btn-secondary">{t('mag_cancel')}</button>
          <button onClick={() => doGenerate('new')} className="btn-primary"><Sparkles className="h-4 w-4" />{t('gen_generate')}</button>
        </div>
      </Modal>

      {/* Choix de mode (allée déjà structurée) */}
      <Modal open={choose} onClose={() => setChoose(false)} title={t('gen_dup_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">{t('gen_dup_desc')}</p>
        <div className="mt-4 space-y-2">
          <button onClick={() => doGenerate('merge')} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left transition hover:border-amber-300 dark:border-white/10">
            <Merge className="h-5 w-5 shrink-0 text-emerald-500" />
            <span><span className="block text-sm font-semibold text-gray-800 dark:text-zinc-100">{t('gen_merge')}</span><span className="block text-[11px] text-gray-500 dark:text-zinc-400">{t('gen_merge_desc')}</span></span>
          </button>
          <button onClick={() => doGenerate('replace')} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left transition hover:border-rose-300 dark:border-white/10">
            <RefreshCw className="h-5 w-5 shrink-0 text-rose-500" />
            <span><span className="block text-sm font-semibold text-gray-800 dark:text-zinc-100">{t('gen_replace')}</span><span className="block text-[11px] text-gray-500 dark:text-zinc-400">{t('gen_replace_desc')}</span></span>
          </button>
          <button onClick={() => setChoose(false)} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left transition hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5">
            <X className="h-5 w-5 shrink-0 text-gray-400" />
            <span className="text-sm font-semibold text-gray-800 dark:text-zinc-100">{t('mag_cancel')}</span>
          </button>
        </div>
      </Modal>

      {/* Progression */}
      <AnimatePresence>
        {progress && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-sm rounded-2xl border border-white/40 bg-white/90 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#12121a]/90">
              <h3 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
                {progress.phase >= 4 ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Loader2 className="h-5 w-5 animate-spin text-amber-500" />}
                {progress.phase >= 4 ? t('gen_done') : t('gen_generating')}
              </h3>
              <div className="mt-4 space-y-2.5">
                {PHASES.map((ph, i) => {
                  const state = progress.phase > i ? 'done' : progress.phase === i ? 'run' : 'pending'
                  return (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${state === 'done' ? 'bg-emerald-500 text-white' : state === 'run' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-400 dark:bg-white/10'}`}>
                        {state === 'done' ? <CheckCircle2 className="h-3.5 w-3.5" /> : state === 'run' ? <Loader2 className="h-3 w-3 animate-spin" /> : ''}
                      </span>
                      <span className={`flex-1 ${state === 'pending' ? 'text-gray-400 dark:text-zinc-600' : 'text-gray-700 dark:text-zinc-200'}`}>{t('gen_creating')} {ph.label.toLowerCase()}…</span>
                      <span className={`font-mono text-xs tabular-nums ${state === 'pending' ? 'text-gray-300 dark:text-zinc-700' : 'font-bold text-gray-800 dark:text-zinc-100'}`}>{ph.v}/{ph.v}</span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500" animate={{ width: `${Math.min(100, (progress.phase / 4) * 100)}%` }} transition={{ duration: 0.35 }} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function Row({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center justify-between text-gray-500 dark:text-zinc-400">
      <span>{label}</span><span className="font-semibold tabular-nums text-gray-800 dark:text-zinc-200">{v}</span>
    </div>
  )
}

export default function GenerateurPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
