'use client'

// Assistant « Créer un magasin à partir de photos » — orchestrateur.
//
// Enchaîne : Import → Analyse → Détections → Éditeur → Aperçu 3D → Validation.
// Il ne contient QUE l'enchaînement et l'état ; l'analyse (lib/storevision) et
// chaque écran (components/storevision) sont indépendants et réutilisables.

import { useCallback, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Camera, Check, CircleDot, Loader2, RotateCcw, ScanSearch, Sparkles, Wand2,
} from 'lucide-react'
import Loader from '@/components/Loader'
import { useToast } from '@/components/Toast'
import { useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'
import { getVisionProvider } from '@/lib/storevision/provider'
import {
  addAllee as dAddAllee, addRayon as dAddRayon, addZone as dAddZone, applyGlobalCounts,
  computeTotals, draftFromAnalysis, draftToWmsTree, moveRayon as dMoveRayon,
  removeAllee as dRemoveAllee, removeRayon as dRemoveRayon, removeZone as dRemoveZone,
  renameAllee as dRenameAllee, renameZone as dRenameZone, setRayonCounts,
} from '@/lib/storevision/draft'
import type { SourceImage, StructureDraft, VisionAnalysis } from '@/lib/storevision/types'
import StepImport from './StepImport'
import StepDetections from './StepDetections'
import StepEditor, { type EditorActions } from './StepEditor'
import StepValidate, { type CommitTarget } from './StepValidate'

// La 3D n'est chargée qu'à l'étape d'aperçu (three.js ~1 Mo).
const Explorer3D = dynamic(() => import('@/components/wms3d/Explorer3D'), { ssr: false, loading: () => <Loader /> })

type StepId = 'import' | 'analyze' | 'detect' | 'edit' | 'preview' | 'validate'
const ORDER: StepId[] = ['import', 'analyze', 'detect', 'edit', 'preview', 'validate']

export default function PhotoStoreWizard() {
  const { t } = useLanguage()
  const toast = useToast()
  const d = useDroguerie()

  const [step, setStep] = useState<StepId>('import')
  const [images, setImages] = useState<SourceImage[]>([])
  const [analysis, setAnalysis] = useState<VisionAnalysis | null>(null)
  const [draft, setDraft] = useState<StructureDraft | null>(null)
  const [progress, setProgress] = useState({ ratio: 0, stage: '' })
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState<CommitTarget>({ mode: 'active' })
  const abort = useRef<AbortController | null>(null)

  const totals = useMemo(() => (draft ? computeTotals(draft) : null), [draft])
  const previewTree = useMemo(() => (draft ? draftToWmsTree(draft) : null), [draft])
  const idx = ORDER.indexOf(step)

  /* ------------------------------ Analyse ------------------------------- */
  const runAnalysis = useCallback(async () => {
    if (images.length === 0) return
    setStep('analyze')
    setBusy(true)
    setProgress({ ratio: 0, stage: 'sv_stage_prepare' })
    abort.current = new AbortController()
    try {
      const provider = getVisionProvider()
      const res = await provider.analyze(images, {
        signal: abort.current.signal,
        onProgress: (ratio, stage) => setProgress({ ratio, stage }),
      })
      setAnalysis(res)
      const proposed = draftFromAnalysis(res, d.activeStore?.name || t('sv_default_store_name'))
      setDraft(proposed)
      if (proposed.zones.length === 0) {
        toast(t('sv_warn_no_rack'), 'error')
        setStep('import')
        return
      }
      setStep('detect')
    } catch (e) {
      if ((e as Error)?.message !== 'aborted') toast(t('sv_analyze_failed'), 'error')
      setStep('import')
    } finally {
      setBusy(false)
    }
  }, [images, d.activeStore, t, toast])

  /* ---------------------------- Mutations ------------------------------- */
  const actions: EditorActions = useMemo(() => ({
    renameZone: (id, patch) => setDraft((s) => (s ? dRenameZone(s, id, patch) : s)),
    removeZone: (id) => setDraft((s) => (s ? dRemoveZone(s, id) : s)),
    addZone: () => setDraft((s) => (s ? dAddZone(s) : s)),
    addAllee: (z) => setDraft((s) => (s ? dAddAllee(s, z) : s)),
    removeAllee: (z, a) => setDraft((s) => (s ? dRemoveAllee(s, z, a) : s)),
    renameAllee: (z, a, n) => setDraft((s) => (s ? dRenameAllee(s, z, a, n) : s)),
    addRayon: (z, a) => setDraft((s) => (s ? dAddRayon(s, z, a) : s)),
    removeRayon: (z, a, r) => setDraft((s) => (s ? dRemoveRayon(s, z, a, r) : s)),
    setCounts: (r, patch) => setDraft((s) => (s ? setRayonCounts(s, r, patch) : s)),
    moveRayon: (r, tgt) => setDraft((s) => (s ? dMoveRayon(s, r, tgt) : s)),
  }), [])

  /* ------------------------------ Commit -------------------------------- */
  const commit = useCallback(() => {
    if (!draft || !totals) return
    setBusy(true)
    try {
      let storeId = d.activeStoreId
      if (target.mode === 'new') {
        const created = d.addStore({ name: target.name.trim(), code: (target.code || target.name.slice(0, 3)).toUpperCase() })
        storeId = created.id
      }
      const res = d.commitStructureTree(
        storeId,
        draft.zones.map((z) => ({
          code: z.code, name: z.name, type: z.type,
          allees: z.allees.map((a) => ({
            code: a.code, name: a.name,
            rayons: a.rayons.map((r) => ({ code: r.code, name: r.name, etageres: r.etageres, niveaux: r.niveaux, positions: r.positions })),
          })),
        }))
      )
      if (!res.ok) { toast(t('sv_commit_none'), 'error'); return }
      if (target.mode === 'new') d.switchStore(storeId)
      toast(`✓ ${res.total.toLocaleString('fr-FR')} ${t('gen_created')}`)
      // Repart à zéro : le brouillon a été matérialisé.
      setImages([]); setAnalysis(null); setDraft(null); setStep('import')
    } finally {
      setBusy(false)
    }
  }, [draft, totals, d, target, t, toast])

  /* -------------------------------- UI ---------------------------------- */
  const STEPS: { id: StepId; label: string; icon: typeof Camera }[] = [
    { id: 'import', label: t('sv_step_import'), icon: Camera },
    { id: 'analyze', label: t('sv_step_analyze'), icon: ScanSearch },
    { id: 'detect', label: t('sv_step_detect'), icon: CircleDot },
    { id: 'edit', label: t('sv_step_edit'), icon: Wand2 },
    { id: 'preview', label: t('sv_step_preview'), icon: Sparkles },
    { id: 'validate', label: t('sv_step_validate'), icon: Check },
  ]

  const canNext = step === 'import' ? images.length > 0
    : step === 'detect' || step === 'edit' || step === 'preview' ? !!draft
    : false

  const goNext = () => {
    if (step === 'import') { void runAnalysis(); return }
    const next = ORDER[idx + 1]
    if (next) setStep(next)
  }
  const goBack = () => {
    // On ne revient jamais sur l'écran d'analyse (transitoire).
    const prev = ORDER[idx - 1] === 'analyze' ? 'import' : ORDER[idx - 1]
    if (prev) setStep(prev)
  }

  return (
    <div className="space-y-4">
      {/* Fil des étapes */}
      <div className="flex flex-wrap items-center gap-1.5">
        {STEPS.map((s, i) => {
          const done = i < idx
          const cur = s.id === step
          const Icon = s.icon
          return (
            <button key={s.id}
              onClick={() => { if (done && s.id !== 'analyze') setStep(s.id) }}
              disabled={!done || s.id === 'analyze'}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
                cur ? 'bg-amber-500 text-white shadow'
                  : done ? 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400'
                  : 'bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-zinc-600'
              }`}>
              {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </button>
          )
        })}
      </div>

      <div className="glass-card p-4 sm:p-5">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
            {step === 'import' && (
              <>
                <StepImport images={images} onChange={setImages} />
                <p className="mt-4 rounded-xl bg-indigo-50/70 px-3 py-2 text-[11px] text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                  {getVisionProvider().simulated ? t('sv_engine_simulated') : t('sv_engine_real')}
                </p>
              </>
            )}

            {step === 'analyze' && (
              <div className="flex flex-col items-center gap-4 py-12">
                <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
                <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">{t('sv_analyzing')}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  {progress.stage ? t(progress.stage as Parameters<typeof t>[0]) : ''}
                </p>
                <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500"
                    animate={{ width: `${Math.round(progress.ratio * 100)}%` }} transition={{ duration: 0.3 }} />
                </div>
                <button onClick={() => abort.current?.abort()} className="btn-secondary">{t('mag_cancel')}</button>
              </div>
            )}

            {step === 'detect' && analysis && draft && (
              <StepDetections analysis={analysis} draft={draft} onRenameZone={(id, patch) => actions.renameZone(id, patch)} />
            )}

            {step === 'edit' && draft && <StepEditor draft={draft} actions={actions} />}

            {step === 'preview' && previewTree && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 dark:text-zinc-400">{t('sv_preview_hint')}</p>
                <Explorer3D tree={previewTree} className="relative h-[460px] rounded-2xl" />
              </div>
            )}

            {step === 'validate' && draft && totals && (
              <StepValidate
                draft={draft} totals={totals} target={target} onTarget={setTarget}
                onGlobal={(patch) => setDraft((s) => (s ? applyGlobalCounts(s, patch) : s))}
                activeStoreName={d.activeStore?.name ?? '—'} busy={busy} onCommit={commit}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      {step !== 'analyze' && (
        <div className="flex items-center justify-between gap-2">
          <button onClick={goBack} disabled={idx === 0} className="btn-secondary disabled:opacity-40">
            <ArrowLeft className="h-4 w-4" />{t('sv_back')}
          </button>
          <div className="flex items-center gap-2">
            {draft && totals && (
              <span className="hidden text-[11px] tabular-nums text-gray-400 dark:text-zinc-500 sm:inline">
                {totals.zones} {t('wms_zones').toLowerCase()} · {totals.positions.toLocaleString('fr-FR')} {t('wms_positions').toLowerCase()}
              </span>
            )}
            {(step === 'detect' || step === 'edit' || step === 'preview') && (
              <button onClick={() => { setImages([]); setAnalysis(null); setDraft(null); setStep('import') }} className="btn-secondary">
                <RotateCcw className="h-4 w-4" />{t('sv_restart')}
              </button>
            )}
            {step !== 'validate' && (
              <button onClick={goNext} disabled={!canNext} className="btn-primary disabled:opacity-40">
                {step === 'import' ? <><ScanSearch className="h-4 w-4" />{t('sv_analyze_now')}</> : <>{t('sv_next')}<ArrowRight className="h-4 w-4" /></>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
