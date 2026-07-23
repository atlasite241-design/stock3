'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, FolderTree, Search, Upload, X } from 'lucide-react'
import Modal from './Modal'
import { useLanguage } from '@/lib/i18n'

export interface PickerRow {
  name?: string
  barcode?: string
  category?: string
  subcategory?: string
}

const PAGE_SIZE = 50

/**
 * Sélection en trois temps avant un import CSV :
 *   1. les catégories,
 *   2. les sous-catégories des catégories retenues + une limite de produits
 *      par sous-catégorie (les N premiers sont pré-cochés),
 *   3. l'ajustement produit par produit.
 * Évite d'importer des dizaines de milliers de références inutiles au démarrage.
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
  const [step, setStep] = useState<'cat' | 'sub' | 'prod'>('cat')
  const [cats, setCats] = useState<Set<string>>(new Set())
  const [subs, setSubs] = useState<Set<string>>(new Set())
  const [maxPerSub, setMaxPerSub] = useState(20)
  const [candidates, setCandidates] = useState<number[]>([])
  const [chosen, setChosen] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const catName = (r: PickerRow) => (r.category || '').trim() || '—'
  const subName = (r: PickerRow) => (r.subcategory || '').trim() || '—'

  // Un seul passage sur le fichier : comptages + index des lignes par sous-catégorie.
  const { catCounts, subCounts, idxBySub } = useMemo(() => {
    const catCounts = new Map<string, number>()
    const subCounts = new Map<string, Map<string, number>>()
    const idxBySub = new Map<string, number[]>()
    rows.forEach((r, i) => {
      const c = catName(r)
      const s = subName(r)
      catCounts.set(c, (catCounts.get(c) ?? 0) + 1)
      let m = subCounts.get(c)
      if (!m) { m = new Map(); subCounts.set(c, m) }
      m.set(s, (m.get(s) ?? 0) + 1)
      const k = `${c}›${s}`
      let a = idxBySub.get(k)
      if (!a) { a = []; idxBySub.set(k, a) }
      a.push(i)
    })
    return { catCounts, subCounts, idxBySub }
  }, [rows])

  const catList = useMemo(
    () => [...catCounts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr')),
    [catCounts]
  )

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

  const visibleProds = useMemo(() => {
    if (!q) return candidates
    return candidates.filter((i) => {
      const r = rows[i]
      return `${r.name ?? ''} ${r.barcode ?? ''}`.toLowerCase().includes(q)
    })
  }, [candidates, rows, q])

  const pageCount = Math.max(1, Math.ceil(visibleProds.length / PAGE_SIZE))
  const pageItems = visibleProds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const selectedCount = useMemo(() => {
    if (step === 'cat') {
      let n = 0
      for (const c of cats) n += catCounts.get(c) ?? 0
      return n
    }
    if (step === 'sub') {
      let n = 0
      for (const x of subList) if (subs.has(x.key)) n += Math.min(x.n, maxPerSub)
      return n
    }
    return chosen.size
  }, [step, cats, subs, chosen, catCounts, subList, maxPerSub])

  const toggle = (set: Set<string>, key: string, apply: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    apply(next)
  }

  const toggleIdx = (i: number) => {
    const next = new Set(chosen)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setChosen(next)
  }

  const goToSubs = () => {
    const all = new Set<string>()
    for (const c of cats) for (const [s] of subCounts.get(c) ?? []) all.add(`${c}›${s}`)
    setSubs(all)
    setQuery('')
    setStep('sub')
  }

  const goToProducts = () => {
    const cand: number[] = []
    const pre = new Set<number>()
    for (const x of subList) {
      if (!subs.has(x.key)) continue
      const idxs = idxBySub.get(x.key) ?? []
      cand.push(...idxs)
      idxs.slice(0, maxPerSub).forEach((i) => pre.add(i))
    }
    setCandidates(cand)
    setChosen(pre)
    setQuery('')
    setPage(1)
    setStep('prod')
  }

  const confirm = () => onConfirm(rows.filter((_, i) => chosen.has(i)))

  const reset = () => {
    setStep('cat'); setCats(new Set()); setSubs(new Set()); setChosen(new Set())
    setCandidates([]); setQuery(''); setPage(1); setMaxPerSub(20)
  }
  const cancel = () => { reset(); onCancel() }

  const title = step === 'cat' ? t('imp_pick_title_cat') : step === 'sub' ? t('imp_pick_title_sub') : t('imp_pick_title_prod')
  const desc = step === 'cat' ? t('imp_pick_desc_cat') : step === 'sub' ? t('imp_pick_desc_sub') : t('imp_pick_desc_prod')

  const selectAll = () => {
    if (step === 'cat') setCats(new Set(catList.map(([c]) => c)))
    else if (step === 'sub') setSubs(new Set(subList.map((x) => x.key)))
    else setChosen(new Set(visibleProds))
  }
  const selectNone = () => {
    if (step === 'cat') setCats(new Set())
    else if (step === 'sub') setSubs(new Set())
    else setChosen(new Set())
  }

  return (
    <Modal open={open} onClose={cancel} title={title} maxWidth="max-w-2xl">
      <p className="text-sm text-gray-500 dark:text-zinc-400">{desc}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder={t('imp_pick_search')}
            className="input-field pl-10"
          />
        </div>
        <button onClick={selectAll} className="btn-secondary !h-10">
          <Check className="h-4 w-4" />
          {t('imp_pick_all')}
        </button>
        <button onClick={selectNone} className="btn-secondary !h-10">
          <X className="h-4 w-4" />
          {t('imp_pick_none')}
        </button>
      </div>

      {step === 'sub' && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-gray-900 dark:text-white">{t('imp_pick_max')}</label>
            <input
              type="number"
              min="1"
              value={maxPerSub}
              onChange={(e) => setMaxPerSub(Math.max(1, Math.round(Number(e.target.value) || 1)))}
              className="input-field !h-9 w-24 text-center"
            />
          </div>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-zinc-400">{t('imp_pick_max_hint')}</p>
        </div>
      )}

      <div className="mt-3 max-h-[42vh] overflow-y-auto rounded-xl border border-gray-100 dark:border-white/10">
        {step === 'cat' &&
          visibleCats.map(([c, n]) => (
            <label key={c} className="flex cursor-pointer items-center gap-3 border-b border-gray-50 px-4 py-2.5 last:border-0 hover:bg-amber-50/40 dark:border-white/5 dark:hover:bg-white/5">
              <input type="checkbox" checked={cats.has(c)} onChange={() => toggle(cats, c, setCats)} className="h-4 w-4 accent-amber-500" />
              <FolderTree className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-white">{c}</span>
              <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600 tabular-nums dark:bg-white/10 dark:text-zinc-400">{n}</span>
            </label>
          ))}

        {step === 'sub' &&
          visibleSubs.map((x) => (
            <label key={x.key} className="flex cursor-pointer items-center gap-3 border-b border-gray-50 px-4 py-2.5 last:border-0 hover:bg-amber-50/40 dark:border-white/5 dark:hover:bg-white/5">
              <input type="checkbox" checked={subs.has(x.key)} onChange={() => toggle(subs, x.key, setSubs)} className="h-4 w-4 accent-amber-500" />
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="text-gray-400 dark:text-zinc-500">{x.cat} › </span>
                <span className="font-semibold text-gray-900 dark:text-white">{x.sub}</span>
              </span>
              <span className="shrink-0 text-xs text-gray-400 tabular-nums dark:text-zinc-500">{x.n} →</span>
              <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-600 tabular-nums dark:bg-emerald-500/10 dark:text-emerald-400">
                {Math.min(x.n, maxPerSub)}
              </span>
            </label>
          ))}

        {step === 'prod' &&
          pageItems.map((i) => {
            const r = rows[i]
            return (
              <label key={i} className="flex cursor-pointer items-center gap-3 border-b border-gray-50 px-4 py-2.5 last:border-0 hover:bg-amber-50/40 dark:border-white/5 dark:hover:bg-white/5">
                <input type="checkbox" checked={chosen.has(i)} onChange={() => toggleIdx(i)} className="h-4 w-4 accent-amber-500" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-semibold text-gray-900 dark:text-white">{r.name}</span>
                  <span className="ml-2 text-xs text-gray-400 dark:text-zinc-500">{catName(r)} › {subName(r)}</span>
                </span>
                <span className="shrink-0 font-mono text-xs text-gray-400 dark:text-zinc-500">{r.barcode || '—'}</span>
              </label>
            )
          })}
      </div>

      {step === 'prod' && pageCount > 1 && (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-gray-500 tabular-nums dark:text-zinc-400">{visibleProds.length} · {page}/{pageCount}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40 dark:border-white/10">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40 dark:border-white/10">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-gray-500 tabular-nums dark:text-zinc-400">
          {rows.length} {t('imp_pick_in_file')}
        </span>
        <span className="font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
          {selectedCount} {t('imp_pick_products')}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button onClick={cancel} className="btn-secondary">{t('imp_pick_cancel')}</button>
        {step !== 'cat' && (
          <button
            onClick={() => { setQuery(''); setPage(1); setStep(step === 'prod' ? 'sub' : 'cat') }}
            className="btn-secondary"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('imp_pick_back')}
          </button>
        )}
        {step === 'cat' && (
          <button onClick={goToSubs} disabled={cats.size === 0} className="btn-primary disabled:opacity-40">
            {t('imp_pick_next')}
          </button>
        )}
        {step === 'sub' && (
          <button onClick={goToProducts} disabled={subs.size === 0} className="btn-primary disabled:opacity-40">
            {t('imp_pick_next')}
          </button>
        )}
        {step === 'prod' && (
          <button onClick={confirm} disabled={chosen.size === 0} className="btn-primary disabled:opacity-40">
            <Upload className="h-4 w-4" />
            {t('imp_pick_import')} ({chosen.size})
          </button>
        )}
      </div>
    </Modal>
  )
}
