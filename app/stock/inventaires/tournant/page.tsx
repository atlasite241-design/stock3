'use client'

// Inventaire tournant : contrôler régulièrement UNE PARTIE du stock sans
// bloquer le magasin. La sélection (catégorie, sous-catégorie, marque,
// emplacement, articles) est bornée (limite), priorisée par rotation ou par
// valeur, et EXCLUT les articles déjà comptés récemment (fenêtre = fréquence) :
// on ne recompte pas inutilement ce qui vient d'être vérifié.

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, Plus, RefreshCcw, X } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import InventoryCountSheet from '@/components/InventoryCountSheet'
import { usePermissions } from '@/lib/access'
import {
  INVENTORY_FREQUENCY_DAYS,
  INVENTORY_META,
  baseQty,
  useDroguerie,
  type InventoryFrequency,
  type InventoryLine,
  type Product,
} from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const STATUS_KEY: Record<string, TKey> = {
  brouillon: 'inv_status_brouillon',
  controle: 'inv_status_controle',
  valide: 'inv_status_valide',
  annule: 'inv_status_annule',
}

const FREQ_KEY: Record<InventoryFrequency, TKey> = {
  quotidien: 'inv_freq_daily',
  hebdomadaire: 'inv_freq_weekly',
  mensuel: 'inv_freq_monthly',
  personnalise: 'inv_freq_custom',
}

function Content() {
  const { ready, products, sales, inventories, depots, categories, subcategories, brands, activeStoreId, activeStore, addInventory } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const urlId = useSearchParams().get('id')

  const [createOpen, setCreateOpen] = useState(false)
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [brand, setBrand] = useState('')
  const [emplacement, setEmplacement] = useState('')
  const [priority, setPriority] = useState<'rotation' | 'valeur' | ''>('')
  const [limit, setLimit] = useState('50')
  const [frequency, setFrequency] = useState<InventoryFrequency>('hebdomadaire')
  const [customDays, setCustomDays] = useState('15')
  const [depotId, setDepotId] = useState('')
  const [picked, setPicked] = useState<Product[]>([])
  const [pickQuery, setPickQuery] = useState('')

  const storeDepots = depots.filter((d) => d.storeId === activeStoreId)
  const open = inventories
    .filter((i) => i.kind === 'tournant' && (i.status === 'brouillon' || i.status === 'controle'))
    .sort((a, b) => b.date.localeCompare(a.date))
  const current = urlId ? inventories.find((i) => i.id === urlId && i.kind === 'tournant') : undefined

  // Unités vendues sur 90 jours par produit (mesure de rotation).
  const soldQty = useMemo(() => {
    const since = Date.now() - 90 * 86400000
    const m = new Map<string, number>()
    for (const s of sales) {
      if (new Date(s.date).getTime() < since) continue
      for (const i of s.items) m.set(i.productId, (m.get(i.productId) ?? 0) + baseQty(i))
    }
    return m
  }, [sales])

  // Dernière date de comptage VALIDÉ par produit (pour ne pas recompter trop tôt).
  const lastCounted = useMemo(() => {
    const m = new Map<string, number>()
    for (const inv of inventories) {
      if (inv.status !== 'valide') continue
      for (const l of inv.lines) {
        if (!l.countedAt) continue
        const ts = new Date(l.countedAt).getTime()
        if ((m.get(l.productId) ?? 0) < ts) m.set(l.productId, ts)
      }
    }
    return m
  }, [inventories])

  const freqDays = frequency === 'personnalise' ? Math.max(1, parseInt(customDays) || 15) : INVENTORY_FREQUENCY_DAYS[frequency]

  // Aperçu de la sélection : filtres → exclusion « déjà compté récemment » → priorité → limite.
  const selection = useMemo(() => {
    const lim = Math.max(1, parseInt(limit) || 50)
    const windowMs = freqDays * 86400000
    const now = Date.now()
    let pool = products
      .filter((p) => !category || p.category === category)
      .filter((p) => !subcategory || p.subcategory === subcategory)
      .filter((p) => !brand || p.brand === brand)
      .filter((p) => !emplacement.trim() || (p.emplacementComplet ?? '').toUpperCase().startsWith(emplacement.trim().toUpperCase()))
    if (picked.length) {
      const ids = new Set(picked.map((p) => p.id))
      pool = pool.filter((p) => ids.has(p.id))
    }
    const skipped = pool.filter((p) => now - (lastCounted.get(p.id) ?? 0) < windowMs).length
    pool = pool.filter((p) => now - (lastCounted.get(p.id) ?? 0) >= windowMs)
    if (priority === 'rotation') pool = [...pool].sort((a, b) => (soldQty.get(b.id) ?? 0) - (soldQty.get(a.id) ?? 0))
    else if (priority === 'valeur') pool = [...pool].sort((a, b) => b.stock * b.cost - a.stock * a.cost)
    // Sans priorité : les moins récemment comptés d'abord — la file tourne toute seule.
    else pool = [...pool].sort((a, b) => (lastCounted.get(a.id) ?? 0) - (lastCounted.get(b.id) ?? 0))
    return { list: pool.slice(0, lim), skipped, matched: pool.length }
  }, [products, category, subcategory, brand, emplacement, picked, priority, limit, freqDays, lastCounted, soldQty])

  const pickResults = useMemo(() => {
    const q = pickQuery.trim().toLowerCase()
    if (q.length < 2) return []
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? '').includes(q))
      .filter((p) => !picked.some((x) => x.id === p.id))
      .slice(0, 6)
  }, [products, pickQuery, picked])

  if (!ready) return <Loader />

  const create = () => {
    if (!selection.list.length) { toast(t('inv_cy_empty_selection'), 'error'); return }
    // Les lignes sont générées à la création : théorique figé, non comptées
    // (compté = théorique, pas de countedAt) — seul un vrai comptage crée un écart.
    const lines: InventoryLine[] = selection.list.map((p) => ({
      productId: p.id,
      productName: p.name,
      barcode: p.barcode || undefined,
      category: p.category || undefined,
      theoretical: p.stock,
      counted: p.stock,
    }))
    const inv = addInventory('tournant', {
      depotId: depotId || undefined,
      frequency,
      frequencyDays: freqDays,
      scope: {
        categories: category ? [category] : undefined,
        subcategories: subcategory ? [subcategory] : undefined,
        brands: brand ? [brand] : undefined,
        emplacementPrefix: emplacement.trim() || undefined,
        productIds: picked.length ? picked.map((p) => p.id) : undefined,
        priority: priority || undefined,
        limit: Math.max(1, parseInt(limit) || 50),
      },
      lines,
    })
    setCreateOpen(false)
    toast(`✓ ${inv.ref} ${t('inv_created')} — ${lines.length} ${t('inv_cy_generated')}`)
    router.push(`/stock/inventaires/tournant?id=${inv.id}`)
  }

  // Le comptage d'un tournant se limite aux articles générés à la création.
  const pool = current
    ? products.filter((p) => current.lines.some((l) => l.productId === p.id))
    : []

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <RefreshCcw className="h-6 w-6 text-amber-500" />
            {t('inv_cy_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('inv_cy_sub')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        {can('stock.inventory_create') && (
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            {t('inv_new_cycle')}
          </button>
        )}
      </motion.div>

      {current ? (
        current.status === 'brouillon' ? (
          <InventoryCountSheet inventory={current} pool={pool} />
        ) : (
          <div className="glass-card flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {current.ref} — {t(STATUS_KEY[current.status])}
            </p>
            <button onClick={() => router.push(`/stock/inventaires/details?id=${current.id}`)} className="btn-primary">
              <Eye className="h-4 w-4" />
              {t('inv_view_control')}
            </button>
          </div>
        )
      ) : (
        <div className="glass-card overflow-x-auto">
          {open.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <RefreshCcw className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
              <p className="text-sm text-gray-500 dark:text-zinc-400">{t('inv_cy_empty')}</p>
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                  <th className="px-4 py-3">{t('inv_c_ref')}</th>
                  <th className="px-4 py-3">{t('inv_col_date')}</th>
                  <th className="px-4 py-3">{t('inv_freq')}</th>
                  <th className="px-4 py-3 text-center">{t('inv_cy_articles')}</th>
                  <th className="px-4 py-3">{t('inv_c_status')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {open.map((i) => (
                  <tr key={i.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-2.5 font-semibold text-amber-600 dark:text-amber-400">{i.ref}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(i.date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{i.frequency ? t(FREQ_KEY[i.frequency]) : '—'}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{i.lines.length}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${INVENTORY_META[i.status].chip}`}>
                        {t(STATUS_KEY[i.status])}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => router.push(i.status === 'brouillon' ? `/stock/inventaires/tournant?id=${i.id}` : `/stock/inventaires/details?id=${i.id}`)}
                        className="btn-secondary !px-3 !py-1.5 text-xs"
                      >
                        {i.status === 'brouillon' ? t('inv_continue') : t('inv_view_control')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Création : périmètre + priorité + fréquence + aperçu */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('inv_new_cycle')} maxWidth="max-w-lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label">{t('inv_cy_category')}</label>
            <Select value={category} onChange={setCategory}
              options={[{ value: '', label: t('inv_cy_all') }, ...categories.map((c) => ({ value: c.name, label: c.name }))]} />
          </div>
          <div>
            <label className="field-label">{t('inv_cy_subcategory')}</label>
            <Select value={subcategory} onChange={setSubcategory}
              options={[{ value: '', label: t('inv_cy_all') }, ...subcategories.map((c) => ({ value: c.name, label: c.name }))]} />
          </div>
          <div>
            <label className="field-label">{t('inv_cy_brand')}</label>
            <Select value={brand} onChange={setBrand}
              options={[{ value: '', label: t('inv_cy_all') }, ...brands.map((c) => ({ value: c.name, label: c.name }))]} />
          </div>
          <div>
            <label className="field-label">{t('inv_cy_location')}</label>
            <input value={emplacement} onChange={(e) => setEmplacement(e.target.value)} className="input-field uppercase" placeholder="Z01-A02…" />
          </div>
          <div>
            <label className="field-label">{t('inv_cy_priority')}</label>
            <Select value={priority} onChange={(v) => setPriority(v as 'rotation' | 'valeur' | '')}
              options={[
                { value: '', label: t('inv_cy_prio_none') },
                { value: 'rotation', label: t('inv_cy_prio_rotation') },
                { value: 'valeur', label: t('inv_cy_prio_value') },
              ]} />
          </div>
          <div>
            <label className="field-label">{t('inv_cy_limit')}</label>
            <input value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))} className="input-field" inputMode="numeric" />
          </div>
          <div>
            <label className="field-label">{t('inv_freq')}</label>
            <Select value={frequency} onChange={(v) => setFrequency(v as InventoryFrequency)}
              options={(Object.keys(FREQ_KEY) as InventoryFrequency[]).map((f) => ({ value: f, label: t(FREQ_KEY[f]) }))} />
          </div>
          {frequency === 'personnalise' ? (
            <div>
              <label className="field-label">{t('inv_freq_days')}</label>
              <input value={customDays} onChange={(e) => setCustomDays(e.target.value.replace(/\D/g, ''))} className="input-field" inputMode="numeric" />
            </div>
          ) : storeDepots.length > 1 ? (
            <div>
              <label className="field-label">{t('inv_depot')}</label>
              <Select value={depotId} onChange={setDepotId}
                options={[{ value: '', label: t('inv_depot_all') }, ...storeDepots.map((d) => ({ value: d.id, label: d.name }))]} />
            </div>
          ) : null}
        </div>

        {/* Liste d'articles ciblés un à un (optionnelle) */}
        <div className="mt-4">
          <label className="field-label">{t('inv_cy_pick')}</label>
          <input value={pickQuery} onChange={(e) => setPickQuery(e.target.value)} className="input-field" placeholder={t('inv_cy_pick_ph')} />
          {pickResults.length > 0 && (
            <div className="mt-1 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
              {pickResults.map((p) => (
                <button key={p.id} onClick={() => { setPicked((prev) => [...prev, p]); setPickQuery('') }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-amber-50 dark:hover:bg-white/5">
                  {p.name} <span className="text-xs text-gray-400">{p.barcode}</span>
                </button>
              ))}
            </div>
          )}
          {picked.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {picked.map((p) => (
                <span key={p.id} className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                  {p.name}
                  <button onClick={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Aperçu de la génération */}
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <b>{selection.list.length}</b> {t('inv_cy_preview')}
          {selection.skipped > 0 && <> · {selection.skipped} {t('inv_cy_skipped')}</>}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setCreateOpen(false)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={create} className="btn-primary">
            <Plus className="h-4 w-4" />
            {t('inv_cy_generate')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
