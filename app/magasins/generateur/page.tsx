'use client'

import { useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { AlertTriangle, Boxes, Layers, Sparkles, Wand2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { depotShortCode, storeShortCode, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, activeStore, activeStoreId, stores, depots, zones, allees, rayons, generateSubStructure } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [zoneId, setZoneId] = useState('')
  const [alleeId, setAlleeId] = useState('')
  const [c, setC] = useState({ rayons: 2, etageres: 2, niveaux: 2, positions: 5 })
  const [confirm, setConfirm] = useState(false)

  const storeZones = useMemo(() => zones.filter((z) => z.storeId === activeStoreId).sort((a, b) => a.code.localeCompare(b.code, 'fr')), [zones, activeStoreId])
  const zoneAllees = useMemo(() => allees.filter((a) => a.zoneId === zoneId).sort((a, b) => a.code.localeCompare(b.code, 'fr')), [allees, zoneId])
  const alleeHasStructure = rayons.some((r) => r.alleeId === alleeId)

  const storeCode = useMemo(() => storeShortCode(Math.max(0, stores.findIndex((s) => s.id === activeStoreId))), [stores, activeStoreId])
  const depotCode = useMemo(() => {
    const zDepot = zones.find((z) => z.id === zoneId)?.depotId
    const idx = depots.filter((x) => x.storeId === activeStoreId).findIndex((x) => x.id === zDepot)
    const dep = depots.find((x) => x.id === zDepot)
    return dep?.code || depotShortCode(idx < 0 ? 0 : idx)
  }, [zones, depots, zoneId, activeStoreId])

  if (!ready) return <Loader />

  const R = Math.max(0, Math.floor(c.rayons)), E = Math.max(0, Math.floor(c.etageres)), N = Math.max(0, Math.floor(c.niveaux)), P = Math.max(0, Math.floor(c.positions))
  const nR = R, nE = R * E, nN = R * E * N, nP = R * E * N * P
  const total = nR + nE + nN + nP
  const heavy = total > 800
  const zoneCode = storeZones.find((z) => z.id === zoneId)?.code ?? '?'
  const alleeCode = zoneAllees.find((a) => a.id === alleeId)?.code ?? '01'
  const sampleCode = `${storeCode}-${depotCode}-${zoneCode}-${alleeCode}-R01-E01-N01-P001`

  const run = () => {
    const res = generateSubStructure(alleeId, activeStoreId, c)
    setConfirm(false)
    if (!res.ok) { toast(res.error === 'exists' ? t('gen_exists') : t('gen_empty'), 'error'); return }
    toast(`✓ ${res.total} ${t('gen_created')}`)
    setAlleeId('')
  }

  const field = (label: string, key: keyof typeof c) => (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{label}</span>
      <input type="number" min={0} max={99} value={c[key]} onChange={(e) => setC({ ...c, [key]: Number(e.target.value) })} className="input-field text-center" />
    </label>
  )

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <Wand2 className="h-6 w-6 text-amber-500" />{t('gen_title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('gen_subtitle')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span></p>
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Configuration */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{t('wms_zone')}</span>
              <Select value={zoneId} onChange={(v) => { setZoneId(v); setAlleeId('') }} placeholder={`— ${t('wms_zone')} —`}
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

          <div>
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
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />{t('gen_exists')}
            </div>
          )}
        </motion.div>

        {/* Aperçu */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card space-y-4 p-5 lg:sticky lg:top-20 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('gen_preview')}</p>
          <div className="space-y-1.5 text-sm">
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
          <div className="rounded-lg bg-gray-50 p-2.5 dark:bg-white/5">
            <p className="text-[10px] font-semibold uppercase text-gray-400">{t('gen_sample')}</p>
            <p className="break-all font-mono text-xs font-bold text-amber-600 dark:text-amber-400">{sampleCode}</p>
          </div>
          {heavy && <p className="flex items-start gap-1.5 text-[11px] text-rose-500"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('gen_heavy')}</p>}
          <button onClick={() => setConfirm(true)} disabled={!alleeId || alleeHasStructure || total === 0} className="btn-primary w-full disabled:opacity-50">
            <Sparkles className="h-4 w-4" />{t('gen_generate')}
          </button>
        </motion.div>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title={t('gen_confirm_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">{t('gen_confirm_desc')}</p>
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-white/10 dark:bg-white/5">
          <Boxes className="h-5 w-5 text-amber-500" />
          <span className={`text-3xl font-extrabold tabular-nums ${heavy ? 'text-rose-500' : 'text-amber-600 dark:text-amber-400'}`}>{total}</span>
          <span className="text-sm text-gray-500 dark:text-zinc-400">{t('gen_elements')}</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setConfirm(false)} className="btn-secondary">{t('mag_cancel')}</button>
          <button onClick={run} className="btn-primary"><Sparkles className="h-4 w-4" />{t('gen_generate')}</button>
        </div>
      </Modal>
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
