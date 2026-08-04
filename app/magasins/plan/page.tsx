'use client'

import { useSearchParams } from 'next/navigation'

import { useEffect, useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, ChevronRight, Layers, MapPin, Package, PackageX, Store, X } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { availableStock, fmtDH, storeShortCode, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

type Node = { id: string; storeId: string; code: string; name?: string } & Record<string, unknown>

function Content() {
  const d = useDroguerie()
  const { ready, products, stores, activeStore, activeStoreId } = d
  const { t } = useLanguage()

  // Chemin de navigation : ids sélectionnés du haut vers le bas.
  const [path, setPath] = useState<string[]>([])
  const [panel, setPanel] = useState<{ level: number; node: Node } | null>(null)
  // Entrée « Plan imprimable » : on laisse le plan se peindre avant d'ouvrir la
  // boîte d'impression, sinon le navigateur imprime une page vide.
  // Relu a chaque changement d'URL : depuis le plan, l'entree « Plan
  // imprimable » du menu ne declenchait rien.
  const printParam = useSearchParams().get('print')
  useEffect(() => {
    if (printParam !== '1') return
    const id = setTimeout(() => window.print(), 600)
    return () => clearTimeout(id)
  }, [printParam])

  const storeCode = useMemo(() => {
    const idx = stores.findIndex((s) => s.id === activeStoreId)
    return storeShortCode(idx < 0 ? 0 : idx)
  }, [stores, activeStoreId])

  // Configuration des 6 niveaux : collection, champ parent, champ produit, libellé.
  const asNodes = (a: unknown) => a as unknown as Node[]
  const rec = (o: unknown) => o as unknown as Record<string, unknown>
  const chain = useMemo(() => ([
    { items: asNodes(d.zones), parent: null, pf: 'zoneId', label: t('wms_zone') },
    { items: asNodes(d.allees), parent: 'zoneId', pf: 'alleeId', label: t('wms_allee') },
    { items: asNodes(d.rayons), parent: 'alleeId', pf: 'rayonId', label: t('wms_rayon') },
    { items: asNodes(d.etageres), parent: 'rayonId', pf: 'etagereId', label: t('wms_etagere') },
    { items: asNodes(d.niveaux), parent: 'etagereId', pf: 'niveauId', label: t('wms_niveau') },
    { items: asNodes(d.positions), parent: 'niveauId', pf: 'positionId', label: t('wms_position') },
  ]), [d.zones, d.allees, d.rayons, d.etageres, d.niveaux, d.positions, t])

  // Occupation : pour chaque niveau, nombre de produits + nb en réappro par id de nœud.
  const occ = useMemo(() => {
    const maps = chain.map(() => new Map<string, { total: number; reappro: number }>())
    for (const p of products) {
      if (activeStoreId && p.storeId && p.storeId !== activeStoreId) continue
      const low = availableStock(p) <= p.minStock
      chain.forEach((lvl, li) => {
        const id = rec(p)[lvl.pf] as string | undefined
        if (!id) return
        const m = maps[li].get(id) ?? { total: 0, reappro: 0 }
        m.total++
        if (low) m.reappro++
        maps[li].set(id, m)
      })
    }
    return maps
  }, [chain, products, activeStoreId])

  if (!ready) return <Loader />

  const depth = path.length // niveau courant affiché
  const level = chain[depth]

  // Nœuds enfants à afficher au niveau courant.
  const nodes = (level?.items ?? [])
    .filter((n) => n.storeId === activeStoreId)
    .filter((n) => (depth === 0 ? true : (n as Record<string, unknown>)[level.parent as string] === path[depth - 1]))
    .sort((a, b) => a.code.localeCompare(b.code, 'fr'))

  const stat = (li: number, id: string) => occ[li]?.get(id) ?? { total: 0, reappro: 0 }

  // Fil d'Ariane : magasin + chaque nœud sélectionné.
  const crumbs = path.map((id, li) => {
    const n = (chain[li].items as Node[]).find((x) => x.id === id)
    return { li, label: n ? `${n.code}${n.name ? ' · ' + n.name : ''}` : '?' }
  })

  // Code complet d'un nœud ouvert dans le panneau : magasin + ancêtres (path) + nœud.
  const codeAt = (li: number, node: Node) => {
    const parts: string[] = [storeCode]
    for (let j = 0; j < li; j++) {
      const n = (chain[j].items as Node[]).find((x) => x.id === path[j])
      if (n) parts.push(n.code)
    }
    parts.push(node.code)
    return parts.join('-')
  }

  const goto = (li: number) => setPath(path.slice(0, li))
  const enter = (node: Node) => { if (depth < chain.length - 1) setPath([...path, node.id]) ; else setPanel({ level: depth, node }) }
  const showProducts = (node: Node) => setPanel({ level: depth, node })

  // Produits du nœud ouvert dans le panneau.
  const panelProducts = panel
    ? products
        .filter((p) => (!activeStoreId || !p.storeId || p.storeId === activeStoreId) && rec(p)[chain[panel.level].pf] === panel.node.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    : []

  const tileColor = (s: { total: number; reappro: number }) =>
    s.total === 0
      ? 'border-gray-200 bg-gray-50/60 dark:border-white/5 dark:bg-white/[0.02]'
      : s.reappro > 0
      ? 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
      : 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <Layers className="h-6 w-6 text-amber-500" />
          {t('wms_plan_title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          {t('wms_plan_subtitle')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          <span className="ml-1 font-mono text-xs text-gray-400 dark:text-zinc-500">({storeCode})</span>
        </p>
      </motion.div>

      {/* Fil d'Ariane */}
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <button onClick={() => goto(0)} className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition ${depth === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-white/10'}`}>
          <Store className="h-4 w-4" />{storeCode}
        </button>
        {crumbs.map((c) => (
          <span key={c.li} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-zinc-600" />
            <button onClick={() => goto(c.li + 1)} className={`rounded-lg px-2.5 py-1 font-mono transition ${c.li === depth - 1 ? 'font-bold text-amber-600 dark:text-amber-400' : 'text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-white/10'}`}>
              {c.label}
            </button>
          </span>
        ))}
        {level && (
          <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-500 dark:bg-white/10 dark:text-zinc-400">
            {level.label}
          </span>
        )}
      </div>

      {/* Légende */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm border border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10" />{t('wms_plan_stocked')}</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm border border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10" />{t('wms_plan_reappro')}</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm border border-gray-200 bg-gray-50 dark:border-white/5 dark:bg-white/[0.02]" />{t('wms_plan_empty')}</span>
      </div>

      {/* Grille des emplacements */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card p-4 sm:p-5">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <PackageX className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('wms_plan_none')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {nodes.map((n) => {
              const s = stat(depth, n.id)
              const leaf = depth === chain.length - 1
              return (
                <motion.button
                  key={n.id}
                  whileHover={{ y: -2 }}
                  onClick={() => enter(n)}
                  className={`group relative flex flex-col rounded-2xl border p-3.5 text-left transition ${tileColor(s)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-md bg-white/70 px-2 py-0.5 font-mono text-sm font-bold text-gray-800 shadow-sm dark:bg-black/30 dark:text-white">{n.code}</span>
                    {s.reappro > 0 && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />}
                  </div>
                  {n.name && <p className="mt-2 truncate text-xs font-medium text-gray-600 dark:text-zinc-300">{n.name}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <span
                      onClick={(e) => { e.stopPropagation(); if (s.total > 0) showProducts(n) }}
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${s.total > 0 ? 'bg-white/70 text-gray-700 hover:ring-2 hover:ring-amber-400 dark:bg-black/30 dark:text-zinc-200' : 'text-gray-400 dark:text-zinc-600'}`}
                    >
                      <Package className="h-3 w-3" />{s.total}
                    </span>
                    {!leaf && <ChevronRight className="h-4 w-4 text-gray-400 transition group-hover:translate-x-0.5 dark:text-zinc-500" />}
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* Panneau produits */}
      <AnimatePresence>
        {panel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPanel(null)} className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-white/10">
                <div>
                  <p className="flex items-center gap-1.5 font-mono text-sm font-bold text-amber-600 dark:text-amber-400">
                    <MapPin className="h-4 w-4" />{codeAt(panel.level, panel.node)}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{panelProducts.length} {t('wms_plan_products')}</p>
                </div>
                <button onClick={() => setPanel(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {panelProducts.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    <PackageX className="h-8 w-8" />{t('wms_plan_no_products')}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {panelProducts.map((p) => {
                      const s = availableStock(p)
                      const low = s <= p.minStock
                      return (
                        <li key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5 dark:border-white/10">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-white/5">
                            {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-gray-300" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
                            <p className="font-mono text-[11px] text-gray-400 dark:text-zinc-500">{p.barcode || '—'}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold tabular-nums ${s === 0 ? 'text-rose-500' : low ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{s}</p>
                            <p className="text-[11px] text-gray-400 dark:text-zinc-500">{fmtDH(p.price)}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export default function PlanPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
