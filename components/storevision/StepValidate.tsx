'use client'

// Étape 6 — Récapitulatif et création.
// Compteurs par niveau, ajustement global avant validation, choix de la cible
// (magasin actif ou nouveau magasin) et garde-fou sur les gros volumes.

import { motion } from 'framer-motion'
import { AlertTriangle, Building2, Layers, Sparkles, Store } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import type { DraftTotals, StructureDraft } from '@/lib/storevision/types'

export type CommitTarget = { mode: 'active' } | { mode: 'new'; name: string; code: string }

export default function StepValidate({
  draft, totals, target, onTarget, onGlobal, activeStoreName, busy, onCommit,
}: {
  draft: StructureDraft
  totals: DraftTotals
  target: CommitTarget
  onTarget: (t: CommitTarget) => void
  /** Applique un réglage global des compteurs à tous les rayons. */
  onGlobal: (patch: { etageres?: number; niveaux?: number; positions?: number }) => void
  activeStoreName: string
  busy: boolean
  onCommit: () => void
}) {
  const { t } = useLanguage()
  // Au-delà de ce volume, la synchro écrit beaucoup de lignes : on avertit.
  const heavy = totals.total > 20000
  const canCommit = totals.zones > 0 && !busy && (target.mode === 'active' || target.name.trim().length > 1)

  const cards: { k: keyof DraftTotals; label: string; accent: string }[] = [
    { k: 'zones', label: t('wms_zones'), accent: 'text-amber-600 dark:text-amber-400' },
    { k: 'allees', label: t('wms_allees'), accent: 'text-indigo-600 dark:text-indigo-400' },
    { k: 'rayons', label: t('wms_rayons'), accent: 'text-emerald-600 dark:text-emerald-400' },
    { k: 'etageres', label: t('wms_etageres'), accent: 'text-cyan-600 dark:text-cyan-400' },
    { k: 'niveaux', label: t('wms_niveaux'), accent: 'text-violet-600 dark:text-violet-400' },
    { k: 'positions', label: t('wms_positions'), accent: 'text-rose-600 dark:text-rose-400' },
  ]

  return (
    <div className="space-y-4">
      {/* Compteurs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c, i) => (
          <motion.div key={c.k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="rounded-2xl border border-gray-100 p-3 text-center dark:border-white/10">
            <p className={`text-2xl font-extrabold tabular-nums ${c.accent}`}>{totals[c.k].toLocaleString('fr-FR')}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{c.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Réglage global */}
      <div className="rounded-2xl border border-gray-100 p-4 dark:border-white/10">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
          <Layers className="h-3.5 w-3.5" />{t('sv_global_counts')}
        </h3>
        <p className="mb-3 text-[11px] text-gray-500 dark:text-zinc-400">{t('sv_global_hint')}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {([['etageres', t('wms_etageres'), 20], ['niveaux', t('wms_niveaux'), 12], ['positions', t('wms_positions'), 60]] as const).map(([key, label, max]) => (
            <label key={key} className="block">
              <span className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{label}</span>
              <input type="number" min={1} max={max} placeholder="—"
                onChange={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= max) onGlobal({ [key]: v }) }}
                className="input-field text-center" />
            </label>
          ))}
        </div>
      </div>

      {/* Cible */}
      <div className="rounded-2xl border border-gray-100 p-4 dark:border-white/10">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
          <Store className="h-3.5 w-3.5" />{t('sv_target')}
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <button onClick={() => onTarget({ mode: 'active' })}
            className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
              target.mode === 'active' ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-500/10' : 'border-gray-200 hover:border-amber-300 dark:border-white/10'
            }`}>
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>
              <span className="block text-sm font-semibold text-gray-800 dark:text-zinc-100">{t('sv_target_active')}</span>
              <span className="block text-[11px] text-gray-500 dark:text-zinc-400">{activeStoreName}</span>
            </span>
          </button>
          <button onClick={() => onTarget({ mode: 'new', name: draft.storeName, code: '' })}
            className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
              target.mode === 'new' ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-500/10' : 'border-gray-200 hover:border-amber-300 dark:border-white/10'
            }`}>
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>
              <span className="block text-sm font-semibold text-gray-800 dark:text-zinc-100">{t('sv_target_new')}</span>
              <span className="block text-[11px] text-gray-500 dark:text-zinc-400">{t('sv_target_new_hint')}</span>
            </span>
          </button>
        </div>
        {target.mode === 'new' && (
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px]">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{t('mag_name')}</span>
              <input value={target.name} onChange={(e) => onTarget({ mode: 'new', name: e.target.value, code: target.code })}
                className="input-field" placeholder={t('sv_store_name_ph')} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{t('mag_code')}</span>
              <input value={target.code} maxLength={4} onChange={(e) => onTarget({ mode: 'new', name: target.name, code: e.target.value.toUpperCase() })}
                className="input-field text-center font-mono uppercase" placeholder="MG2" />
            </label>
          </div>
        )}
      </div>

      {heavy && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{t('sv_heavy_warn')}
        </p>
      )}

      <button onClick={onCommit} disabled={!canCommit} className="btn-primary w-full disabled:opacity-50">
        <Sparkles className="h-4 w-4" />
        {busy ? t('sv_creating') : `${t('sv_create_store')} · ${totals.total.toLocaleString('fr-FR')} ${t('gen_elements')}`}
      </button>
    </div>
  )
}
