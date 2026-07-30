'use client'

// Étape 3 — Détections. L'image est recouverte des boîtes trouvées par le
// moteur de vision (murs, entrées, caisses, rayonnages…) et les secteurs
// proposés deviennent des zones renommables.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, FileText, Layers } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { FEATURE_COLOR, FEATURE_LABEL_KEY, type FeatureKind, type VisionAnalysis } from '@/lib/storevision/types'
import type { StructureDraft } from '@/lib/storevision/types'

export default function StepDetections({ analysis, draft, onRenameZone }: {
  analysis: VisionAnalysis
  draft: StructureDraft
  onRenameZone: (zoneId: string, patch: { name?: string; code?: string }) => void
}) {
  const { t } = useLanguage()
  const [imgIdx, setImgIdx] = useState(0)
  const [hidden, setHidden] = useState<Set<FeatureKind>>(new Set())

  const img = analysis.images[imgIdx]
  const kinds = useMemo(() => {
    const m = new Map<FeatureKind, number>()
    for (const f of [...analysis.features, ...analysis.racks]) m.set(f.kind, (m.get(f.kind) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [analysis])

  const boxes = useMemo(
    () => [...analysis.features, ...analysis.racks].filter((f) => f.imageIndex === imgIdx && !hidden.has(f.kind)),
    [analysis, imgIdx, hidden]
  )

  const toggle = (k: FeatureKind) =>
    setHidden((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      {/* Image annotée */}
      <div className="space-y-3">
        {analysis.images.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {analysis.images.map((im, i) => (
              <button key={im.id} onClick={() => setImgIdx(i)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  i === imgIdx ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-zinc-300'
                }`}>
                {i + 1} · {im.kind === 'plan' ? t('sv_kind_plan') : t('sv_kind_photo')}
              </button>
            ))}
          </div>
        )}

        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gray-900 dark:border-white/10">
          {img?.dataUrl ? (
            <img src={img.dataUrl} alt="" className="block w-full" />
          ) : (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-zinc-500">
              <FileText className="h-10 w-10" />
              <p className="text-xs">{t('sv_no_preview')}</p>
            </div>
          )}
          {/* Boîtes en pourcentages : indépendantes de la taille d'affichage. */}
          <div className="absolute inset-0">
            {boxes.map((f) => (
              <motion.div key={f.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                title={`${t(FEATURE_LABEL_KEY[f.kind] as Parameters<typeof t>[0])} · ${Math.round(f.confidence * 100)}%`}
                className="absolute rounded-[3px] border-2"
                style={{
                  left: `${f.box.x * 100}%`, top: `${f.box.y * 100}%`,
                  width: `${f.box.w * 100}%`, height: `${f.box.h * 100}%`,
                  borderColor: FEATURE_COLOR[f.kind],
                  background: `${FEATURE_COLOR[f.kind]}22`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Légende cliquable */}
        <div className="flex flex-wrap gap-1.5">
          {kinds.map(([k, n]) => {
            const off = hidden.has(k)
            return (
              <button key={k} onClick={() => toggle(k)}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${
                  off ? 'border-gray-200 text-gray-400 dark:border-white/10 dark:text-zinc-600' : 'border-transparent text-gray-700 dark:text-zinc-200'
                }`}
                style={off ? undefined : { background: `${FEATURE_COLOR[k]}22` }}>
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: FEATURE_COLOR[k] }} />
                {t(FEATURE_LABEL_KEY[k] as Parameters<typeof t>[0])} <span className="tabular-nums opacity-60">{n}</span>
                {off ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Zones proposées, renommables */}
      <div className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
          <Layers className="h-3.5 w-3.5" />{t('sv_proposed_zones')} ({draft.zones.length})
        </h3>
        <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
          {draft.zones.map((z) => {
            const sector = analysis.sectors.find((s) => s.id === z.sectorId)
            const racks = z.allees.reduce((a, al) => a + al.rayons.length, 0)
            return (
              <div key={z.id} className="rounded-xl border border-gray-100 p-2.5 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <input
                    value={z.code}
                    onChange={(e) => onRenameZone(z.id, { code: e.target.value.toUpperCase().slice(0, 3) })}
                    className="w-12 rounded-md border border-gray-200 bg-transparent px-1.5 py-1 text-center font-mono text-xs font-bold uppercase text-amber-600 dark:border-white/10 dark:text-amber-400"
                  />
                  <input
                    value={z.name}
                    placeholder={t('sv_zone_name_ph')}
                    onChange={(e) => onRenameZone(z.id, { name: e.target.value })}
                    className="min-w-0 flex-1 rounded-md border border-gray-200 bg-transparent px-2 py-1 text-xs font-semibold text-gray-800 dark:border-white/10 dark:text-zinc-100"
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-gray-400 dark:text-zinc-500">
                  {z.allees.length} {t('wms_allees').toLowerCase()} · {racks} {t('wms_rayons').toLowerCase()}
                  {sector ? ` · ${Math.round(sector.confidence * 100)}% ${t('sv_confidence')}` : ''}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
