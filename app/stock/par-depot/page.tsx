'use client'

import { useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Search, Warehouse } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Select from '@/components/Select'
import { fmtDH, useDroguerie, type Product } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, movements, depots, stores, activeStoreId } = useDroguerie()
  const { t } = useLanguage()
  const [depotId, setDepotId] = useState('')
  const [query, setQuery] = useState('')

  const storeName = stores.find((s) => s.id === activeStoreId)?.name ?? '—'
  const storeDepots = useMemo(() => depots.filter((d) => d.storeId === activeStoreId), [depots, activeStoreId])
  const prodById = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of products) m.set(p.id, p)
    return m
  }, [products])

  // Balance par (dépôt → produit) reconstituée depuis le journal des mouvements.
  const byDepot = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const m of movements) {
      if (!m.depotId) continue
      if ((m.storeId ?? activeStoreId) !== activeStoreId) continue
      const d = map.get(m.depotId) ?? new Map<string, number>()
      d.set(m.productId, (d.get(m.productId) ?? 0) + m.qty)
      map.set(m.depotId, d)
    }
    return map
  }, [movements, activeStoreId])

  if (!ready) return <Loader />

  const selected = depotId || storeDepots[0]?.id || ''
  const balance = byDepot.get(selected) ?? new Map<string, number>()
  const q = query.trim().toLowerCase()
  const rows = [...balance.entries()]
    .map(([id, qty]) => ({ p: prodById.get(id), qty }))
    .filter((r): r is { p: Product; qty: number } => !!r.p && r.qty > 0)
    .filter((r) => !q || r.p.name.toLowerCase().includes(q) || r.p.barcode.includes(q))
    .sort((a, b) => a.p.name.localeCompare(b.p.name, 'fr'))

  const totalQty = rows.reduce((s, r) => s + r.qty, 0)
  const totalValue = rows.reduce((s, r) => s + r.qty * r.p.cost, 0)

  // Résumé de tous les dépôts (pour les cartes du haut).
  const depotSummary = storeDepots.map((d) => {
    const bal = byDepot.get(d.id) ?? new Map<string, number>()
    let qte = 0, val = 0
    bal.forEach((n, id) => { if (n > 0) { qte += n; val += n * (prodById.get(id)?.cost ?? 0) } })
    return { d, qte, val }
  })

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <Warehouse className="h-6 w-6 text-amber-500" />
          {t('sd_title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          {t('sd_subtitle')} · <span className="font-semibold text-amber-600 dark:text-amber-400">{storeName}</span>
        </p>
      </motion.div>

      {storeDepots.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 p-12 text-center">
          <Warehouse className="h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500 dark:text-zinc-400">{t('sd_no_depot')}</p>
        </div>
      ) : (
        <>
          {/* Cartes résumé par dépôt */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {depotSummary.map(({ d, qte, val }) => {
              const active = selected === d.id
              return (
                <button key={d.id} onClick={() => setDepotId(d.id)}
                  className={`glass-card p-4 text-left transition ${active ? 'ring-2 ring-amber-400' : 'hover:ring-1 hover:ring-amber-300'}`}>
                  <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white"><Warehouse className="h-4 w-4 text-amber-500" />{d.name}</p>
                  <div className="mt-2 flex items-end justify-between">
                    <div><p className="text-[11px] text-gray-400 dark:text-zinc-500">{t('sd_qty')}</p><p className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">{qte}</p></div>
                    <div className="text-right"><p className="text-[11px] text-gray-400 dark:text-zinc-500">{t('sd_value')}</p><p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtDH(val)}</p></div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Filtres */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-56"><Select value={selected} onChange={setDepotId} options={storeDepots.map((d) => ({ value: d.id, label: d.name }))} /></div>
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('sd_search')} className="input-field pl-10" />
            </div>
            <span className="ml-auto text-sm font-semibold text-gray-500 dark:text-zinc-400 tabular-nums">{rows.length} · {totalQty} · {fmtDH(totalValue)}</span>
          </div>

          {/* Tableau */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                    <th className="px-4 py-3">{t('sd_col_barcode')}</th>
                    <th className="px-4 py-3">{t('sd_col_name')}</th>
                    <th className="px-4 py-3 text-right">{t('sd_col_cost')}</th>
                    <th className="px-4 py-3 text-center">{t('sd_col_qty')}</th>
                    <th className="px-4 py-3 text-right">{t('sd_col_value')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ p, qty }) => (
                    <tr key={p.id} className="border-b border-gray-50 last:border-0 dark:border-white/5 hover:bg-amber-50/40 dark:hover:bg-white/5">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500 dark:text-zinc-400">{p.barcode || '—'}</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{p.name}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500 dark:text-zinc-400 tabular-nums">{fmtDH(p.cost)}</td>
                      <td className="px-4 py-2.5 text-center font-bold tabular-nums text-gray-900 dark:text-white">{qty}</td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums text-gray-900 dark:text-white">{fmtDH(qty * p.cost)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('sd_empty')}</td></tr>}
                </tbody>
              </table>
            </div>
          </motion.div>
          <p className="text-xs text-gray-400 dark:text-zinc-500">{t('sd_note')}</p>
        </>
      )}
    </>
  )
}

export default function StockParDepotPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
