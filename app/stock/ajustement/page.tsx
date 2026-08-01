'use client'

// Ajustement de stock : corriger la quantité d'un article en indiquant un motif.
// L'écart est enregistré comme un mouvement, donc traçable et annulable.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Scale, Search } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { availableStock, useDroguerie, type Product } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const MOTIFS: TKey[] = [
  'sk_adj_r_break', 'sk_adj_r_loss', 'sk_adj_r_theft', 'sk_adj_r_typo',
  'sk_adj_r_return', 'sk_adj_r_gift', 'sk_adj_r_other',
]

function Content() {
  const { ready, products, activeStoreId, adjustStock, depots } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const [target, setTarget] = useState('')
  const [motif, setMotif] = useState<TKey>(MOTIFS[0])
  const [depotId, setDepotId] = useState('')
  const [done, setDone] = useState<{ name: string; delta: number } | null>(null)

  const storeDepots = useMemo(() => depots.filter((d) => d.storeId === activeStoreId), [depots, activeStoreId])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return products
      .filter((p) => !activeStoreId || !p.storeId || p.storeId === activeStoreId)
      .filter((p) => p.name.toLowerCase().includes(q) || p.barcode.includes(q))
      .slice(0, 8)
  }, [products, query, activeStoreId])

  if (!ready) return <Loader />

  const current = selected ? availableStock(selected) : 0
  const wanted = Math.max(0, Math.round(Number(target.replace(',', '.')) || 0))
  const delta = selected && target !== '' ? wanted - current : 0

  const apply = () => {
    if (!selected || delta === 0) return
    // Le motif est stocké traduit : la note du mouvement doit rester lisible
    // telle quelle dans l'historique, même si la langue change ensuite.
    adjustStock(selected.id, delta, `${t('sk_adj_title')} : ${t(motif)}`, depotId || undefined)
    setDone({ name: selected.name, delta })
    setSelected(null); setTarget(''); setQuery('')
    toast(`✓ ${selected.name} : ${delta > 0 ? '+' : ''}${delta}`)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <Scale className="h-6 w-6 text-amber-500" />{t('sk_adj_title')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('sk_adj_sub')}</p>
      </motion.div>

      <div className="glass-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null) }}
            placeholder={t('sk_adj_search')}
            className="input-field pl-9"
            autoFocus
          />
        </div>
        {results.length > 0 && !selected && (
          <div className="mt-2 space-y-1">
            {results.map((p) => (
              <button key={p.id} onClick={() => { setSelected(p); setTarget(String(availableStock(p))) }}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-left transition hover:border-amber-300 hover:bg-amber-50/50 dark:border-white/10 dark:hover:bg-white/5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{p.name}</span>
                  <span className="block font-mono text-[11px] text-gray-400">{p.barcode || '—'}</span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-gray-600 dark:text-zinc-300">{availableStock(p)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selected.name}</h2>
          <p className="font-mono text-xs text-gray-400">{selected.barcode}</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">{t('sk_adj_counted')}</label>
              <input type="number" min="0" value={target} onChange={(e) => setTarget(e.target.value)} className="input-field text-center text-lg font-bold" />
            </div>
            <div>
              <label className="field-label">{t('sk_adj_reason')}</label>
              <Select value={motif} onChange={(v) => setMotif(v as TKey)} options={MOTIFS.map((m) => ({ value: m, label: t(m) }))} />
            </div>
          </div>

          {storeDepots.length > 1 && (
            <div className="mt-3">
              <label className="field-label">{t('sk_adj_depot')}</label>
              <Select value={depotId} onChange={setDepotId}
                options={[{ value: '', label: `— ${t('sk_adj_all_depots')} —` }, ...storeDepots.map((d) => ({ value: d.id, label: d.name }))]} />
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-gray-50 p-4 dark:bg-white/5">
            <span className="text-2xl font-extrabold tabular-nums text-gray-400">{current}</span>
            <ArrowRight className="h-5 w-5 text-amber-500 rtl:rotate-180" />
            <span className="text-2xl font-extrabold tabular-nums text-gray-900 dark:text-white">{wanted}</span>
            {delta !== 0 && (
              <span className={`rounded-lg px-2.5 py-1 text-sm font-bold ${delta > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'}`}>
                {delta > 0 ? '+' : ''}{delta}
              </span>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => { setSelected(null); setTarget('') }} className="btn-secondary">{t('mag_cancel')}</button>
            <button onClick={apply} disabled={delta === 0} className="btn-primary disabled:opacity-40">
              <Check className="h-4 w-4" />{t('sk_adj_apply')}
            </button>
          </div>
        </motion.div>
      )}

      {done && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          ✓ {done.name} {t('sk_adj_done')} {done.delta > 0 ? '+' : ''}{done.delta}. {t('sk_adj_see')}
        </p>
      )}
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
