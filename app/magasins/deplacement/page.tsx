'use client'

// Déplacement de produits : réorganiser un rayon d'un coup.
//
// Le Rangement (scan) traite un article à la fois. Ici on sélectionne tout le
// contenu d'un emplacement — ou une sélection libre — et on le transfère
// ailleurs en une seule opération, sans toucher aux quantités.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Check, MapPin, Move, Search } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import LocationPicker, { type ProductLocation } from '@/components/LocationPicker'
import { useToast } from '@/components/Toast'
import { availableStock, useDroguerie, type Product } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const d = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [target, setTarget] = useState<ProductLocation>({})
  const [done, setDone] = useState<number | null>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return d.products
      .filter((p) => !d.activeStoreId || !p.storeId || p.storeId === d.activeStoreId)
      // La recherche porte AUSSI sur le code d'emplacement : c'est ainsi qu'on
      // sélectionne « tout ce qui est en B-01-R02 » d'un seul geste.
      .filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        (p.emplacementComplet ?? '').toLowerCase().includes(q)
      )
      .slice(0, 200)
  }, [d.products, d.activeStoreId, query])

  if (!d.ready) return <Loader />

  const toggle = (id: string) =>
    setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const move = () => {
    if (picked.size === 0 || !target.emplacementComplet) return
    let n = 0
    for (const id of picked) {
      d.moveProductLocation(id, {
        zoneId: target.zoneId, alleeId: target.alleeId, rayonId: target.rayonId,
        etagereId: target.etagereId, niveauId: target.niveauId, positionId: target.positionId,
        emplacementComplet: target.emplacementComplet,
      })
      n++
    }
    setDone(n)
    setPicked(new Set())
    toast(`✓ ${n} ${t('dp_moved')}`)
  }

  const allShown = results.length > 0 && results.every((p) => picked.has(p.id))

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <Move className="h-6 w-6 text-amber-500" />{t('dp_title')}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">{t('dp_sub')}</p>
      </motion.div>

      <div className="glass-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('dp_search')} className="input-field pl-9" autoFocus />
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400 dark:text-zinc-500">{t('dp_hint')}</p>

        {results.length > 0 && (
          <>
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => setPicked((s) => {
                  const n = new Set(s)
                  if (allShown) results.forEach((p) => n.delete(p.id))
                  else results.forEach((p) => n.add(p.id))
                  return n
                })}
                className="text-xs font-bold text-amber-600 hover:underline dark:text-amber-400"
              >
                {allShown ? t('dp_unselect_all') : t('dp_select_all')} ({results.length})
              </button>
              <span className="text-xs font-semibold tabular-nums text-gray-600 dark:text-zinc-300">
                {picked.size} {t('dp_selected')}
              </span>
            </div>

            <div className="mt-2 max-h-80 overflow-y-auto">
              {results.map((p: Product) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 border-b border-gray-50 px-1 py-2 last:border-0 dark:border-white/5">
                  <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 accent-amber-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{p.name}</span>
                    <span className="flex items-center gap-1 font-mono text-[10px] text-gray-400">
                      {p.emplacementComplet ? <><MapPin className="h-3 w-3" />{p.emplacementComplet}</> : t('dp_no_location')}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-500">{availableStock(p)}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {picked.size > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t('dp_target')}</p>
          <LocationPicker storeId={d.activeStoreId} value={target} onChange={setTarget} />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-white/5">
            <span className="font-bold tabular-nums text-gray-700 dark:text-zinc-200">{picked.size} {t('dp_selected')}</span>
            <ArrowRight className="h-4 w-4 text-amber-500 rtl:rotate-180" />
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{target.emplacementComplet || '—'}</span>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setPicked(new Set())} className="btn-secondary">{t('mag_cancel')}</button>
            <button onClick={move} disabled={!target.emplacementComplet} className="btn-primary disabled:opacity-40">
              <Check className="h-4 w-4" />{t('dp_apply')}
            </button>
          </div>
        </motion.div>
      )}

      {done !== null && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          ✓ {done} {t('dp_moved')}
        </p>
      )}
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
