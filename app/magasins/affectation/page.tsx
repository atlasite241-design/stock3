'use client'

// Affectation du catalogue aux emplacements.
//
// Étape finale de la démarche « magasin depuis photos » : la structure existe,
// le catalogue existe, cet écran fait le lien. On apparie chaque catégorie à
// une zone (proposition automatique, corrigeable), on calcule un PLAN complet,
// on l'affiche, et rien n'est écrit tant que l'utilisateur n'a pas validé.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertTriangle, ArrowRight, Boxes, Check, Eraser, MapPin, PackageSearch, Sparkles, Wand2,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import DangerConfirm from '@/components/DangerConfirm'
import Loader from '@/components/Loader'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { buildEmplacementCode, depotShortCode, storeShortCode, useDroguerie } from '@/lib/store'
import { buildMappings, buildPlan, type FreeSlot, type Mapping } from '@/lib/storevision/assign'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const d = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [overrides, setOverrides] = useState<Record<string, string | null>>({})
  const [strategy, setStrategy] = useState<'fill' | 'spread'>('fill')
  const [onlyUnplaced, setOnlyUnplaced] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const sid = d.activeStoreId

  const zones = useMemo(
    () => d.zones.filter((z) => z.storeId === sid && (z.active ?? true)).sort((a, b) => a.code.localeCompare(b.code, 'fr')),
    [d.zones, sid]
  )

  // Produits concernés : ceux du magasin actif, éventuellement limités à ceux
  // qui n'ont pas encore d'emplacement.
  const products = useMemo(
    () => d.products.filter((p) => (!p.storeId || p.storeId === sid) && (!onlyUnplaced || !p.emplacementComplet)),
    [d.products, sid, onlyUnplaced]
  )

  // Positions libres (aucun produit n'y pointe), dans l'ordre de parcours.
  const freeSlots = useMemo<FreeSlot[]>(() => {
    const taken = new Set(d.products.filter((p) => p.positionId).map((p) => p.positionId as string))
    const storeCode = storeShortCode(Math.max(0, d.stores.findIndex((s) => s.id === sid)))
    const storeDepots = d.depots.filter((x) => x.storeId === sid)
    const sortC = <T extends { code: string }>(l: T[]) => l.slice().sort((a, b) => a.code.localeCompare(b.code, 'fr'))

    const out: FreeSlot[] = []
    for (const z of zones) {
      const dep = (z.depotId && storeDepots.find((x) => x.id === z.depotId)) || storeDepots[0]
      const depCode = dep?.code || depotShortCode(Math.max(0, storeDepots.findIndex((x) => x.id === dep?.id)))
      for (const a of sortC(d.allees.filter((x) => x.zoneId === z.id)))
        for (const r of sortC(d.rayons.filter((x) => x.alleeId === a.id)))
          for (const e of sortC(d.etageres.filter((x) => x.rayonId === r.id)))
            for (const n of sortC(d.niveaux.filter((x) => x.etagereId === e.id)))
              for (const po of sortC(d.positions.filter((x) => x.niveauId === n.id))) {
                if (taken.has(po.id)) continue
                out.push({
                  positionId: po.id, zoneId: z.id, alleeId: a.id, rayonId: r.id,
                  etagereId: e.id, niveauId: n.id,
                  code: buildEmplacementCode({ storeCode, depot: depCode, zone: z.code, allee: a.code, rayon: r.code, etagere: e.code, niveau: n.code, position: po.code }),
                })
              }
    }
    return out
  }, [zones, d.allees, d.rayons, d.etageres, d.niveaux, d.positions, d.products, d.depots, d.stores, sid])

  // Correspondances proposées, écrasées par les choix de l'utilisateur.
  const mappings = useMemo<Mapping[]>(() => {
    const base = buildMappings(products, zones.map((z) => ({ id: z.id, code: z.code, name: z.name })))
    return base.map((m) => (m.category in overrides ? { ...m, zoneId: overrides[m.category], auto: false } : m))
  }, [products, zones, overrides])

  const plan = useMemo(() => buildPlan(products, mappings, freeSlots, strategy), [products, mappings, freeSlots, strategy])

  const noZone = plan.unplaced.filter((u) => u.reason === 'no_zone').length
  const noSpace = plan.unplaced.filter((u) => u.reason === 'no_space').length

  if (!d.ready) return <Loader />

  const apply = () => {
    if (plan.rows.length === 0) return
    setBusy(true)
    try {
      const slotById = new Map(freeSlots.map((s) => [s.positionId, s]))
      const rows = plan.rows.map((r) => {
        const s = slotById.get(r.positionId)!
        return {
          productId: r.productId, zoneId: s.zoneId, alleeId: s.alleeId, rayonId: s.rayonId,
          etagereId: s.etagereId, niveauId: s.niveauId, positionId: s.positionId, emplacementComplet: s.code,
        }
      })
      const n = d.bulkAssignLocations(rows)
      toast(`✓ ${n.toLocaleString('fr-FR')} ${t('af_toast_done')}`)
    } finally {
      setBusy(false)
    }
  }

  const noStructure = freeSlots.length === 0 && d.positions.filter((p) => p.storeId === sid).length === 0

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <PackageSearch className="h-6 w-6 text-amber-500" />{t('af_title')}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">{t('af_subtitle')}</p>
      </motion.div>

      {noStructure ? (
        <div className="glass-card flex flex-col items-center gap-3 p-10 text-center">
          <Boxes className="h-12 w-12 text-gray-300 dark:text-zinc-700" />
          <p className="text-sm text-gray-600 dark:text-zinc-300">{t('af_no_structure')}</p>
          <Link href="/magasins/assistant-photos" className="btn-primary"><Wand2 className="h-4 w-4" />{t('af_go_wizard')}</Link>
        </div>
      ) : (
        <>
          {/* Compteurs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { v: products.length, l: t('af_products'), c: 'text-gray-900 dark:text-white' },
              { v: freeSlots.length, l: t('af_free_slots'), c: 'text-indigo-600 dark:text-indigo-400' },
              { v: plan.rows.length, l: t('af_will_place'), c: 'text-emerald-600 dark:text-emerald-400' },
              { v: plan.unplaced.length, l: t('af_unplaced'), c: plan.unplaced.length ? 'text-rose-500' : 'text-gray-400' },
            ].map((s, i) => (
              <div key={i} className="glass-card p-4 text-center">
                <p className={`text-2xl font-extrabold tabular-nums ${s.c}`}>{s.v.toLocaleString('fr-FR')}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Options */}
          <div className="glass-card flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-200">
              <input type="checkbox" checked={onlyUnplaced} onChange={(e) => setOnlyUnplaced(e.target.checked)} className="h-4 w-4 accent-amber-500" />
              {t('af_only_unplaced')}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">{t('af_strategy')}</span>
              <div className="w-52">
                <Select value={strategy} onChange={(v) => setStrategy(v as 'fill' | 'spread')}
                  options={[{ value: 'fill', label: t('af_strategy_fill') }, { value: 'spread', label: t('af_strategy_spread') }]} />
              </div>
            </div>
            <button onClick={() => setConfirmClear(true)} className="btn-secondary ml-auto">
              <Eraser className="h-4 w-4" />{t('af_clear')}
            </button>
          </div>

          {/* Correspondances catégorie → zone */}
          <div className="glass-card overflow-hidden">
            <div className="border-b border-gray-100 p-4 dark:border-white/10">
              <h2 className="text-sm font-bold text-gray-800 dark:text-zinc-100">{t('af_mapping_title')}</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t('af_mapping_hint')}</p>
            </div>
            <div className="max-h-[24rem] overflow-y-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="sticky top-0 bg-white/90 backdrop-blur dark:bg-[#12121a]/90">
                  <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                    <th className="px-4 py-2.5">{t('wr_col_category')}</th>
                    <th className="px-4 py-2.5 text-center">{t('wr_col_count')}</th>
                    <th className="px-4 py-2.5">{t('wms_zone')}</th>
                    <th className="px-4 py-2.5 text-center">{t('af_status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr key={m.category} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                      <td className="px-4 py-2 font-semibold text-gray-800 dark:text-zinc-100">{m.category}</td>
                      <td className="px-4 py-2 text-center tabular-nums text-gray-500">{m.productCount}</td>
                      <td className="px-4 py-2">
                        <Select
                          value={m.zoneId ?? ''}
                          onChange={(v) => setOverrides((o) => ({ ...o, [m.category]: v || null }))}
                          options={[{ value: '', label: `— ${t('af_no_zone')} —` }, ...zones.map((z) => ({ value: z.id, label: `${z.code} · ${z.name}` }))]}
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        {!m.zoneId ? <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{t('af_ignored')}</span>
                          : m.auto ? <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">{t('af_auto')}</span>
                          : <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">{t('af_manual')}</span>}
                      </td>
                    </tr>
                  ))}
                  {mappings.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">{t('af_no_products')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Aperçu du plan */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="glass-card overflow-hidden">
              <h3 className="border-b border-gray-100 p-3 text-xs font-bold uppercase tracking-wide text-gray-400 dark:border-white/10 dark:text-zinc-500">
                {t('af_preview')} ({plan.rows.length.toLocaleString('fr-FR')})
              </h3>
              <div className="max-h-72 overflow-y-auto">
                {plan.rows.slice(0, 200).map((r) => (
                  <div key={r.productId} className="flex items-center gap-2 border-b border-gray-50 px-3 py-1.5 text-xs last:border-0 dark:border-white/5">
                    <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-zinc-200">{r.productName}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-amber-500" />
                    <span className="shrink-0 font-mono text-[10px] text-amber-600 dark:text-amber-400">{r.code}</span>
                  </div>
                ))}
                {plan.rows.length === 0 && <p className="p-6 text-center text-xs text-gray-400">{t('af_nothing')}</p>}
                {plan.rows.length > 200 && <p className="p-2 text-center text-[10px] text-gray-400">{t('af_more')} {(plan.rows.length - 200).toLocaleString('fr-FR')}</p>}
              </div>
            </div>

            <div className="glass-card overflow-hidden">
              <h3 className="border-b border-gray-100 p-3 text-xs font-bold uppercase tracking-wide text-gray-400 dark:border-white/10 dark:text-zinc-500">
                {t('af_unplaced')} ({plan.unplaced.length.toLocaleString('fr-FR')})
              </h3>
              {plan.unplaced.length > 0 && (
                <div className="flex flex-wrap gap-2 border-b border-gray-50 p-2.5 text-[10px] dark:border-white/5">
                  {noZone > 0 && <span className="rounded-md bg-rose-50 px-2 py-0.5 font-bold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{noZone} · {t('af_reason_no_zone')}</span>}
                  {noSpace > 0 && <span className="rounded-md bg-amber-50 px-2 py-0.5 font-bold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">{noSpace} · {t('af_reason_no_space')}</span>}
                </div>
              )}
              <div className="max-h-64 overflow-y-auto">
                {plan.unplaced.slice(0, 200).map((u) => (
                  <div key={u.productId} className="flex items-center gap-2 border-b border-gray-50 px-3 py-1.5 text-xs last:border-0 dark:border-white/5">
                    <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-zinc-200">{u.productName}</span>
                    <span className="shrink-0 text-[10px] text-gray-400">{u.category || '—'}</span>
                  </div>
                ))}
                {plan.unplaced.length === 0 && <p className="p-6 text-center text-xs text-emerald-600 dark:text-emerald-400">🎉 {t('af_all_placed')}</p>}
              </div>
            </div>
          </div>

          {noSpace > 0 && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{t('af_warn_space')}
            </p>
          )}

          <button onClick={apply} disabled={busy || plan.rows.length === 0} className="btn-primary w-full disabled:opacity-50">
            {busy ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Check className="h-4 w-4" />}
            {busy ? t('af_applying') : `${t('af_apply')} · ${plan.rows.length.toLocaleString('fr-FR')} ${t('af_products').toLowerCase()}`}
          </button>

          <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500">
            <MapPin className="h-3.5 w-3.5" />{t('af_footer')}
          </p>
        </>
      )}

      <DangerConfirm
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          const n = d.clearProductLocations(sid)
          setConfirmClear(false)
          toast(n > 0 ? `✓ ${n} ${t('af_cleared')}` : t('af_nothing'))
        }}
        title={t('af_clear')}
        description={t('af_clear_desc')}
        actionLabel={t('af_clear')}
      />
    </>
  )
}

export default function AffectationPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
