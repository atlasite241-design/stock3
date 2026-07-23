'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronLeft, FolderTree, Search, Upload, X } from 'lucide-react'
import Modal from './Modal'
import { useLanguage } from '@/lib/i18n'

export interface PickerRow {
  category?: string
  subcategory?: string
}

/**
 * Sélection en deux temps avant un import CSV : d'abord les catégories, puis les
 * sous-catégories des catégories retenues. Évite d'importer des dizaines de
 * milliers de références dont la droguerie n'a pas l'usage au démarrage.
 */
export default function ImportPicker<T extends PickerRow>({
  open,
  rows,
  onCancel,
  onConfirm,
}: {
  open: boolean
  rows: T[]
  onCancel: () => void
  onConfirm: (selected: T[]) => void
}) {
  const { t } = useLanguage()
  const [step, setStep] = useState<'cat' | 'sub'>('cat')
  const [cats, setCats] = useState<Set<string>>(new Set())
  const [subs, setSubs] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  const catName = (r: PickerRow) => (r.category || '').trim() || '—'
  const subName = (r: PickerRow) => (r.subcategory || '').trim() || '—'

  // Comptage en un seul passage sur le fichier.
  const { catCounts, subCounts } = useMemo(() => {
    const catCounts = new Map<string, number>()
    const subCounts = new Map<string, Map<string, number>>()
    for (const r of rows) {
      const c = catName(r)
      catCounts.set(c, (catCounts.get(c) ?? 0) + 1)
      let m = subCounts.get(c)
      if (!m) { m = new Map(); subCounts.set(c, m) }
      const s = subName(r)
      m.set(s, (m.get(s) ?? 0) + 1)
    }
    return { catCounts, subCounts }
  }, [rows])

  const catList = useMemo(
    () => [...catCounts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr')),
    [catCounts]
  )

  // Sous-catégories des seules catégories retenues, préfixées par leur catégorie.
  const subList = useMemo(() => {
    const out: { key: string; cat: string; sub: string; n: number }[] = []
    for (const c of cats) {
      for (const [s, n] of subCounts.get(c) ?? []) out.push({ key: `${c}›${s}`, cat: c, sub: s, n })
    }
    return out.sort((a, b) => a.cat.localeCompare(b.cat, 'fr') || a.sub.localeCompare(b.sub, 'fr'))
  }, [cats, subCounts])

  const q = query.trim().toLowerCase()
  const visibleCats = q ? catList.filter(([c]) => c.toLowerCase().includes(q)) : catList
  const visibleSubs = q ? subList.filter((x) => `${x.cat} ${x.sub}`.toLowerCase().includes(q)) : subList

  const selectedCount = useMemo(() => {
    if (step === 'cat') {
      let n = 0
      for (const c of cats) n += catCounts.get(c) ?? 0
      return n
    }
    let n = 0
    for (const x of subList) if (subs.has(x.key)) n += x.n
    return n
  }, [step, cats, subs, catCounts, subList])

  const toggle = (set: Set<string>, key: string, apply: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    apply(next)
  }

  const goToSubs = () => {
    // Par défaut toutes les sous-catégories des catégories retenues sont cochées.
    const all = new Set<string>()
    for (const c of cats) for (const [s] of subCounts.get(c) ?? []) all.add(`${c}›${s}`)
    setSubs(all)
    setQuery('')
    setStep('sub')
  }

  const confirm = () => {
    onConfirm(rows.filter((r) => cats.has(catName(r)) && subs.has(`${catName(r)}›${subName(r)}`)))
  }

  const reset = () => { setStep('cat'); setCats(new Set()); setSubs(new Set()); setQuery('') }
  const cancel = () => { reset(); onCancel() }

  return (
    <Modal open={open} onClose={cancel} title={step === 'cat' ? t('imp_pick_title_cat') : t('imp_pick_title_sub')} maxWidth="max-w-2xl">
      <p className="text-sm text-gray-500 dark:text-zinc-400">
        {step === 'cat' ? t('imp_pick_desc_cat') : t('imp_pick_desc_sub')}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('imp_pick_search')} className="input-field pl-10" />
        </div>
        <button
          onClick={() =>
            step === 'cat'
              ? setCats(new Set(catList.map(([c]) => c)))
              : setSubs(new Set(subList.map((x) => x.key)))
          }
          className="btn-secondary !h-10"
        >
          <Check className="h-4 w-4" />
          {t('imp_pick_all')}
        </button>
        <button
          onClick={() => (step === 'cat' ? setCats(new Set()) : setSubs(new Set()))}
          className="btn-secondary !h-10"
        >
          <X className="h-4 w-4" />
          {t('imp_pick_none')}
        </button>
      </div>

      <div className="mt-3 max-h-[45vh] overflow-y-auto rounded-xl border border-gray-100 dark:border-white/10">
        {step === 'cat'
          ? visibleCats.map(([c, n]) => (
              <label key={c} className="flex cursor-pointer items-center gap-3 border-b border-gray-50 px-4 py-2.5 last:border-0 hover:bg-amber-50/40 dark:border-white/5 dark:hover:bg-white/5">
                <input type="checkbox" checked={cats.has(c)} onChange={() => toggle(cats, c, setCats)} className="h-4 w-4 accent-amber-500" />
                <FolderTree className="h-4 w-4 shrink-0 text-amber-500" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-white">{c}</span>
                <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600 tabular-nums dark:bg-white/10 dark:text-zinc-400">{n}</span>
              </label>
            ))
          : visibleSubs.map((x) => (
              <label key={x.key} className="flex cursor-pointer items-center gap-3 border-b border-gray-50 px-4 py-2.5 last:border-0 hover:bg-amber-50/40 dark:border-white/5 dark:hover:bg-white/5">
                <input type="checkbox" checked={subs.has(x.key)} onChange={() => toggle(subs, x.key, setSubs)} className="h-4 w-4 accent-amber-500" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="text-gray-400 dark:text-zinc-500">{x.cat} › </span>
                  <span className="font-semibold text-gray-900 dark:text-white">{x.sub}</span>
                </span>
                <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600 tabular-nums dark:bg-white/10 dark:text-zinc-400">{x.n}</span>
              </label>
            ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-zinc-400 tabular-nums">
          {rows.length} {t('imp_pick_in_file')}
        </span>
        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
          {selectedCount} {t('imp_pick_products')}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button onClick={cancel} className="btn-secondary">{t('imp_pick_cancel')}</button>
        {step === 'sub' && (
          <button onClick={() => { setQuery(''); setStep('cat') }} className="btn-secondary">
            <ChevronLeft className="h-4 w-4" />
            {t('imp_pick_back')}
          </button>
        )}
        {step === 'cat' ? (
          <button onClick={goToSubs} disabled={cats.size === 0} className="btn-primary disabled:opacity-40">
            {t('imp_pick_next')}
          </button>
        ) : (
          <button onClick={confirm} disabled={selectedCount === 0} className="btn-primary disabled:opacity-40">
            <Upload className="h-4 w-4" />
            {t('imp_pick_import')} ({selectedCount})
          </button>
        )}
      </div>
    </Modal>
  )
}
