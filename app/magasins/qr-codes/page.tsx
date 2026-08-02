'use client'

// QR codes d'emplacements : une planche imprimable à coller sur les rayonnages.
//
// Le QR encode le CODE COMPLET de l'emplacement, pas une URL : il reste lisible
// par n'importe quel lecteur, y compris hors ligne, et alimente directement les
// écrans de rangement et de consultation par scan.

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Printer, QrCode } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import Select from '@/components/Select'
import { buildEmplacementCode, depotShortCode, storeShortCode, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const SIZES = [
  { value: '3', label: '3 / ligne' },
  { value: '4', label: '4 / ligne' },
  { value: '6', label: '6 / ligne' },
]

function Cell({ code }: { code: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const QR = (await import('qrcode')).default
      if (!alive || !ref.current) return
      // Correction d'erreur élevée : une étiquette collée en rayon se salit,
      // se raye, et doit rester lisible malgré tout.
      await QR.toCanvas(ref.current, code, { errorCorrectionLevel: 'H', margin: 1, width: 180 })
    })()
    return () => { alive = false }
  }, [code])

  return (
    <div className="flex break-inside-avoid flex-col items-center gap-1 rounded-xl border border-gray-200 p-3 dark:border-white/15">
      <canvas ref={ref} className="h-auto w-full max-w-[180px]" />
      <p className="text-center font-mono text-[10px] font-bold leading-tight text-gray-800 dark:text-zinc-100">{code}</p>
    </div>
  )
}

function Content() {
  const d = useDroguerie()
  const { t } = useLanguage()
  const [zoneId, setZoneId] = useState('')
  const [perRow, setPerRow] = useState('4')

  const storeCode = useMemo(
    () => storeShortCode(Math.max(0, d.stores.findIndex((s) => s.id === d.activeStoreId))),
    [d.stores, d.activeStoreId]
  )

  const zones = useMemo(
    () => d.zones.filter((z) => z.storeId === d.activeStoreId).sort((a, b) => a.code.localeCompare(b.code, 'fr')),
    [d.zones, d.activeStoreId]
  )

  /** Codes complets des positions de la zone choisie (ou de tout le magasin). */
  const codes = useMemo(() => {
    if (!d.ready) return []
    const depots = d.depots.filter((x) => x.storeId === d.activeStoreId)
    const out: string[] = []
    const sortC = <T extends { code: string }>(l: T[]) => l.slice().sort((a, b) => a.code.localeCompare(b.code, 'fr'))
    for (const z of zones) {
      if (zoneId && z.id !== zoneId) continue
      const dep = (z.depotId && depots.find((x) => x.id === z.depotId)) || depots[0]
      const depCode = dep?.code || depotShortCode(Math.max(0, depots.findIndex((x) => x.id === dep?.id)))
      for (const a of sortC(d.allees.filter((x) => x.zoneId === z.id)))
        for (const r of sortC(d.rayons.filter((x) => x.alleeId === a.id)))
          for (const e of sortC(d.etageres.filter((x) => x.rayonId === r.id)))
            for (const n of sortC(d.niveaux.filter((x) => x.etagereId === e.id)))
              for (const po of sortC(d.positions.filter((x) => x.niveauId === n.id)))
                out.push(buildEmplacementCode({
                  storeCode, depot: depCode, zone: z.code, allee: a.code,
                  rayon: r.code, etagere: e.code, niveau: n.code, position: po.code,
                }))
    }
    return out
  }, [d, zones, zoneId, storeCode])

  if (!d.ready) return <Loader />

  // Une planche de QR est lourde à générer : au-delà, on impose de filtrer.
  const CAP = 200
  const shown = codes.slice(0, CAP)

  return (
    <>
      <style>{`@media print { aside, header.app-header, .no-print { display:none !important } main { padding:0 !important } }`}</style>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <QrCode className="h-6 w-6 text-amber-500" />{t('qr_title')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">
            {t('qr_sub')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{d.activeStore?.name}</span>
          </p>
        </div>
        <button onClick={() => window.print()} disabled={shown.length === 0} className="btn-primary no-print disabled:opacity-40">
          <Printer className="h-4 w-4" />{t('qr_print')}
        </button>
      </motion.div>

      <div className="glass-card flex flex-wrap items-end gap-3 p-4 no-print">
        <label className="min-w-[200px] flex-1">
          <span className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{t('wms_zone')}</span>
          <Select value={zoneId} onChange={setZoneId}
            options={[{ value: '', label: t('impr_all_zones') }, ...zones.map((z) => ({ value: z.id, label: `${z.code}${z.name ? ' · ' + z.name : ''}` }))]} />
        </label>
        <label className="w-40">
          <span className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{t('qr_per_row')}</span>
          <Select value={perRow} onChange={setPerRow} options={SIZES} />
        </label>
        <span className="ml-auto text-sm font-semibold tabular-nums text-gray-600 dark:text-zinc-300">
          {codes.length.toLocaleString('fr-FR')} {t('qr_codes')}
        </span>
      </div>

      {codes.length > CAP && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 no-print">
          {t('qr_capped')} {CAP}. {t('qr_capped_d')}
        </p>
      )}

      {shown.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 p-12 text-center">
          <QrCode className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
          <p className="text-sm text-gray-500 dark:text-zinc-400">{t('qr_empty')}</p>
        </div>
      ) : (
        <div className="glass-card p-4">
          <div className={`grid gap-3 ${perRow === '3' ? 'grid-cols-2 sm:grid-cols-3' : perRow === '6' ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-4'}`}>
            {shown.map((c) => <Cell key={c} code={c} />)}
          </div>
        </div>
      )}
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
