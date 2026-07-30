'use client'

// Étape 4 — Éditeur interactif du brouillon.
// Renommer une zone, ajouter/supprimer une allée ou un rayon, régler les
// compteurs (étagères / niveaux / positions) et déplacer un rayon par
// glisser-déposer. Le glisser-déposer utilise l'API HTML5 native : aucune
// dépendance supplémentaire.

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import type { DraftRayon, StructureDraft } from '@/lib/storevision/types'

export interface EditorActions {
  renameZone: (zoneId: string, patch: { name?: string; code?: string; type?: 'commerciale' | 'logistique' }) => void
  removeZone: (zoneId: string) => void
  addZone: () => void
  addAllee: (zoneId: string) => void
  removeAllee: (zoneId: string, alleeId: string) => void
  renameAllee: (zoneId: string, alleeId: string, name: string) => void
  addRayon: (zoneId: string, alleeId: string) => void
  removeRayon: (zoneId: string, alleeId: string, rayonId: string) => void
  setCounts: (rayonId: string, patch: Partial<Pick<DraftRayon, 'etageres' | 'niveaux' | 'positions' | 'name'>>) => void
  moveRayon: (rayonId: string, target: { zoneId: string; alleeId: string; beforeRayonId?: string }) => void
}

/** Petit compteur −/+ (module-level : ne remonte pas les champs à chaque frappe). */
function Counter({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-1">
      <span className="text-[10px] font-semibold text-gray-400 dark:text-zinc-500">{label}</span>
      <span className="flex items-center overflow-hidden rounded-md border border-gray-200 dark:border-white/10">
        <button type="button" onClick={() => onChange(Math.max(1, value - 1))} className="px-1.5 text-gray-500 transition hover:bg-gray-100 dark:hover:bg-white/10">−</button>
        <input
          value={value}
          onChange={(e) => onChange(Math.max(1, Math.min(max, Number(e.target.value.replace(/\D/g, '')) || 1)))}
          className="w-8 bg-transparent text-center text-[11px] font-bold tabular-nums text-gray-800 dark:text-zinc-100"
        />
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="px-1.5 text-gray-500 transition hover:bg-gray-100 dark:hover:bg-white/10">+</button>
      </span>
    </label>
  )
}

export default function StepEditor({ draft, actions }: { draft: StructureDraft; actions: EditorActions }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState<Set<string>>(() => new Set(draft.zones.slice(0, 2).map((z) => z.id)))
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-zinc-400">{t('sv_editor_hint')}</p>
        <button onClick={actions.addZone} className="btn-secondary"><Plus className="h-4 w-4" />{t('sv_add_zone')}</button>
      </div>

      {draft.zones.map((z) => {
        const isOpen = open.has(z.id)
        return (
          <div key={z.id} className="overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10">
            {/* En-tête de zone */}
            <div className="flex flex-wrap items-center gap-2 bg-gray-50/70 p-2.5 dark:bg-white/5">
              <button onClick={() => toggle(z.id)} className="rounded-md p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <input value={z.code} onChange={(e) => actions.renameZone(z.id, { code: e.target.value.toUpperCase().slice(0, 3) })}
                className="w-12 rounded-md border border-gray-200 bg-white px-1.5 py-1 text-center font-mono text-xs font-bold uppercase text-amber-600 dark:border-white/10 dark:bg-transparent dark:text-amber-400" />
              <input value={z.name} placeholder={t('sv_zone_name_ph')} onChange={(e) => actions.renameZone(z.id, { name: e.target.value })}
                className="min-w-[8rem] flex-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-semibold text-gray-800 dark:border-white/10 dark:bg-transparent dark:text-zinc-100" />
              <select value={z.type} onChange={(e) => actions.renameZone(z.id, { type: e.target.value as 'commerciale' | 'logistique' })}
                className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[11px] text-gray-600 dark:border-white/10 dark:bg-transparent dark:text-zinc-300">
                <option value="commerciale">{t('wms_type_commerciale')}</option>
                <option value="logistique">{t('wms_type_logistique')}</option>
              </select>
              <button onClick={() => actions.addAllee(z.id)} className="rounded-md p-1.5 text-gray-400 transition hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10" title={t('sv_add_allee')}>
                <Plus className="h-4 w-4" />
              </button>
              <button onClick={() => actions.removeZone(z.id)} className="rounded-md p-1.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10" title={t('mag_delete')}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Allées */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }} className="divide-y divide-gray-50 dark:divide-white/5">
                  {z.allees.length === 0 && <p className="p-4 text-center text-xs text-gray-400">{t('sv_no_allee')}</p>}
                  {z.allees.map((a) => (
                    <div key={a.id}
                      onDragOver={(e) => { if (dragId) { e.preventDefault(); setDropTarget(a.id) } }}
                      onDragLeave={() => setDropTarget((cur) => (cur === a.id ? null : cur))}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (dragId) actions.moveRayon(dragId, { zoneId: z.id, alleeId: a.id })
                        setDragId(null); setDropTarget(null)
                      }}
                      className={`p-2.5 transition ${dropTarget === a.id ? 'bg-amber-50 dark:bg-amber-500/10' : ''}`}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-gray-600 dark:bg-white/10 dark:text-zinc-300">{a.code}</span>
                        <input value={a.name ?? ''} placeholder={t('sv_allee_name_ph')} onChange={(e) => actions.renameAllee(z.id, a.id, e.target.value)}
                          className="min-w-[7rem] flex-1 rounded-md border border-gray-200 bg-transparent px-2 py-0.5 text-[11px] text-gray-700 dark:border-white/10 dark:text-zinc-200" />
                        <button onClick={() => actions.addRayon(z.id, a.id)} className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 transition hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                          + {t('wms_rayon')}
                        </button>
                        <button onClick={() => actions.removeAllee(z.id, a.id)} className="rounded-md p-1 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Rayons (déplaçables) */}
                      <div className="space-y-1.5">
                        {a.rayons.map((r) => (
                          <div key={r.id}
                            draggable
                            onDragStart={() => setDragId(r.id)}
                            onDragEnd={() => { setDragId(null); setDropTarget(null) }}
                            onDragOver={(e) => { if (dragId && dragId !== r.id) e.preventDefault() }}
                            onDrop={(e) => {
                              e.preventDefault(); e.stopPropagation()
                              if (dragId && dragId !== r.id) actions.moveRayon(dragId, { zoneId: z.id, alleeId: a.id, beforeRayonId: r.id })
                              setDragId(null); setDropTarget(null)
                            }}
                            className={`flex flex-wrap items-center gap-2 rounded-xl border p-2 transition ${
                              dragId === r.id ? 'border-amber-400 opacity-50' : 'border-gray-100 dark:border-white/10'
                            }`}
                          >
                            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-gray-300 active:cursor-grabbing dark:text-zinc-600" />
                            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{r.code}</span>
                            <input value={r.name ?? ''} placeholder={t('sv_rayon_name_ph')} onChange={(e) => actions.setCounts(r.id, { name: e.target.value })}
                              className="min-w-[6rem] flex-1 rounded-md border border-gray-200 bg-transparent px-2 py-0.5 text-[11px] text-gray-700 dark:border-white/10 dark:text-zinc-200" />
                            <Counter label={t('wms_etageres')} value={r.etageres} max={20} onChange={(n) => actions.setCounts(r.id, { etageres: n })} />
                            <Counter label={t('wms_niveaux')} value={r.niveaux} max={12} onChange={(n) => actions.setCounts(r.id, { niveaux: n })} />
                            <Counter label={t('wms_positions')} value={r.positions} max={60} onChange={(n) => actions.setCounts(r.id, { positions: n })} />
                            <span className="text-[10px] tabular-nums text-gray-400 dark:text-zinc-500">
                              = {r.etageres * r.niveaux * r.positions}
                            </span>
                            <button onClick={() => actions.removeRayon(z.id, a.id, r.id)} className="rounded-md p-1 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        {a.rayons.length === 0 && (
                          <p className="rounded-lg border border-dashed border-gray-200 p-2 text-center text-[10px] text-gray-400 dark:border-white/10">
                            {t('sv_drop_here')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
