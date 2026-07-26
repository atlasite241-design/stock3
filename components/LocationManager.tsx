'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Loader from '@/components/Loader'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { buildEmplacementCode, storeShortCode, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

// Un « niveau » de la hiérarchie d'emplacements. `pf` = champ qui référence le parent.
type LevelKey = 'zone' | 'allee' | 'rayon' | 'etagere' | 'niveau' | 'position'
interface Item { id: string; storeId: string; code: string; name?: string; [k: string]: unknown }

/**
 * Gestion générique d'un niveau d'emplacement (Allée, Rayon, Étagère, Niveau,
 * Emplacement). Sélection EN CASCADE des parents, puis liste + CRUD des éléments
 * du parent choisi, avec aperçu du code d'emplacement complet.
 */
export default function LocationManager({
  level,
  title,
  subtitle,
  icon: Icon,
  codePlaceholder,
  namePlaceholder,
}: {
  level: Exclude<LevelKey, 'zone'>
  title: string
  subtitle: string
  icon: LucideIcon
  codePlaceholder: string
  namePlaceholder?: string
}) {
  const d = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  // Chaîne complète. Chaque entrée expose sa liste et ses actions.
  const asItems = (a: unknown) => a as unknown as Item[]
  const chain = [
    { key: 'zone' as const, items: asItems(d.zones), pf: '', add: d.addZone, upd: d.updateZone, del: d.deleteZone, label: t('wms_zone') },
    { key: 'allee' as const, items: asItems(d.allees), pf: 'zoneId', add: d.addAllee, upd: d.updateAllee, del: d.deleteAllee, label: t('wms_allee') },
    { key: 'rayon' as const, items: asItems(d.rayons), pf: 'alleeId', add: d.addRayon, upd: d.updateRayon, del: d.deleteRayon, label: t('wms_rayon') },
    { key: 'etagere' as const, items: asItems(d.etageres), pf: 'rayonId', add: d.addEtagere, upd: d.updateEtagere, del: d.deleteEtagere, label: t('wms_etagere') },
    { key: 'niveau' as const, items: asItems(d.niveaux), pf: 'etagereId', add: d.addNiveau, upd: d.updateNiveau, del: d.deleteNiveau, label: t('wms_niveau') },
    { key: 'position' as const, items: asItems(d.positions), pf: 'niveauId', add: d.addPosition, upd: d.updatePosition, del: d.deletePosition, label: t('wms_position') },
  ]
  const ti = chain.findIndex((c) => c.key === level)
  const target = chain[ti]
  const ancestors = chain.slice(0, ti) // du plus haut (zone) au parent direct

  const [sel, setSel] = useState<Record<string, string>>({}) // key niveau → id sélectionné
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ code: '', name: '' })

  const storeCode = useMemo(() => {
    const idx = d.stores.findIndex((s) => s.id === d.activeStoreId)
    return storeShortCode(idx < 0 ? 0 : idx)
  }, [d.stores, d.activeStoreId])

  if (!d.ready) return <Loader />

  // Options d'un niveau ancêtre, filtrées par la sélection de son propre parent.
  const optionsFor = (li: number) => {
    const lvl = chain[li]
    return lvl.items
      .filter((it) => it.storeId === d.activeStoreId)
      .filter((it) => li === 0 || it[lvl.pf] === sel[chain[li - 1].key])
      .sort((a, b) => a.code.localeCompare(b.code, 'fr'))
  }

  // Le parent direct est-il choisi ? (tous les ancêtres sélectionnés)
  const parentKey = chain[ti - 1].key
  const parentId = sel[parentKey]
  const parentReady = ancestors.every((_, i) => sel[chain[i].key])

  // Sélectionner un niveau réinitialise les niveaux inférieurs.
  const pick = (li: number, id: string) => {
    setSel((s) => {
      const next: Record<string, string> = { ...s, [chain[li].key]: id }
      for (let j = li + 1; j < chain.length; j++) delete next[chain[j].key]
      return next
    })
  }

  const list = parentReady
    ? target.items.filter((it) => it.storeId === d.activeStoreId && it[target.pf] === parentId).sort((a, b) => a.code.localeCompare(b.code, 'fr'))
    : []

  // Code d'emplacement complet à partir de la chaîne sélectionnée + un code donné.
  const codeOf = (li: number) => (chain[li].items.find((it) => it.id === sel[chain[li].key])?.code) ?? ''
  const previewCode = (code: string) =>
    buildEmplacementCode({
      storeCode,
      zone: codeOf(0),
      allee: ti >= 1 ? (ti === 1 ? code : codeOf(1)) : undefined,
      rayon: ti >= 2 ? (ti === 2 ? code : codeOf(2)) : undefined,
      etagere: ti >= 3 ? (ti === 3 ? code : codeOf(3)) : undefined,
      niveau: ti >= 4 ? (ti === 4 ? code : codeOf(4)) : undefined,
      position: ti >= 5 ? (ti === 5 ? code : codeOf(5)) : undefined,
    })

  const openNew = () => { setEditId(null); setForm({ code: '', name: '' }); setOpen(true) }
  const openEdit = (it: Item) => { setEditId(it.id); setForm({ code: it.code, name: (it.name as string) ?? '' }); setOpen(true) }

  const save = () => {
    const code = form.code.trim().toUpperCase()
    if (!code || !parentId) return
    if (list.some((it) => it.code.toUpperCase() === code && it.id !== editId)) { toast(t('wms_code_exists'), 'error'); return }
    if (editId) (target.upd as (id: string, v: Record<string, unknown>) => void)(editId, { code, name: form.name.trim() })
    else (target.add as unknown as (v: Record<string, unknown>) => void)({ storeId: d.activeStoreId, [target.pf]: parentId, code, name: form.name.trim() })
    toast(t('mag_saved'))
    setOpen(false)
  }

  const remove = (it: Item) => {
    const res = (target.del as (id: string) => { ok: boolean }) (it.id)
    if (res && res.ok === false) { toast(t('wms_has_children'), 'error'); return }
    toast(t('mag_delete'))
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Icon className="h-6 w-6 text-amber-500" />
            {title}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {subtitle} — <span className="font-semibold text-amber-600 dark:text-amber-400">{d.activeStore?.name}</span>
          </p>
        </div>
        <button onClick={openNew} disabled={!parentReady} className="btn-primary disabled:opacity-40">
          <Plus className="h-4 w-4" />
          {t('wms_add')}
        </button>
      </motion.div>

      {/* Cascade de sélection des parents */}
      <div className="glass-card flex flex-wrap items-end gap-3 p-4">
        {ancestors.map((lvl, li) => (
          <div key={lvl.key} className="min-w-[150px] flex-1">
            <label className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{lvl.label}</label>
            <Select
              value={sel[lvl.key] ?? ''}
              onChange={(v) => pick(li, v)}
              placeholder={`— ${lvl.label} —`}
              options={[{ value: '', label: `— ${lvl.label} —` }, ...optionsFor(li).map((it) => ({ value: it.id, label: `${it.code}${it.name ? ' · ' + it.name : ''}` }))]}
            />
          </div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card overflow-hidden">
        {!parentReady ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <Icon className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('wms_pick_parents')}</p>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <Icon className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('wms_none')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  <th className="px-5 py-3">{t('wms_code')}</th>
                  <th className="px-5 py-3">{t('wms_zone_name')}</th>
                  <th className="px-5 py-3">{t('wms_emplacement')}</th>
                  <th className="px-5 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((it) => (
                  <tr key={it.id} className="border-b border-gray-50 last:border-0 dark:border-white/5 hover:bg-amber-50/40 dark:hover:bg-white/5">
                    <td className="px-5 py-3"><span className="rounded-md bg-amber-50 px-2 py-0.5 font-mono text-sm font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{it.code}</span></td>
                    <td className="px-5 py-3 text-gray-700 dark:text-zinc-300">{(it.name as string) || '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-zinc-400">{previewCode(it.code)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(it)} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-amber-400"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(it)} className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? t('wms_edit') : t('wms_add')} maxWidth="max-w-sm">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('wms_code')}</span>
            <input className="input-field font-mono uppercase" value={form.code} maxLength={4} placeholder={codePlaceholder} onChange={(e) => setForm({ ...form, code: e.target.value })} autoFocus />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('wms_zone_name')} ({t('wms_optional')})</span>
            <input className="input-field" value={form.name} placeholder={namePlaceholder} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          {form.code.trim() && (
            <p className="text-xs text-gray-400 dark:text-zinc-500">{t('wms_emplacement')} : <span className="font-mono text-amber-600 dark:text-amber-400">{previewCode(form.code.trim().toUpperCase())}</span></p>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
          <button onClick={save} disabled={!form.code.trim()} className="btn-primary disabled:opacity-50"><Save className="h-4 w-4" />{t('mag_save')}</button>
        </div>
      </Modal>
    </>
  )
}
