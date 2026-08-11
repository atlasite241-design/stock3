'use client'

// Feuille de comptage d'un inventaire (physique ou tournant) : recherche,
// scan douchette/caméra, saisie des quantités, motifs d'écart, sauvegarde du
// brouillon et envoi au contrôle. Le théorique est FIGÉ à la première saisie
// d'une ligne — une vente encaissée pendant le comptage ne fausse pas l'écart.

import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ClipboardCheck, Save, ScanBarcode, Search } from 'lucide-react'
import CameraScanner from '@/components/CameraScanner'
import Pagination from '@/components/Pagination'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { usePermissions } from '@/lib/access'
import { fmtDH, useDroguerie, type Inventory, type InventoryLine, type Product } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

// Mêmes motifs que l'écran Ajustements : un écart d'inventaire a les mêmes causes.
const MOTIFS: TKey[] = [
  'sk_adj_r_break', 'sk_adj_r_loss', 'sk_adj_r_theft', 'sk_adj_r_typo',
  'sk_adj_r_return', 'sk_adj_r_gift', 'sk_adj_r_other',
]

const PAGE_SIZE = 50

interface Row {
  productId: string
  name: string
  barcode?: string
  category?: string
  theoretical: number
  cost: number
}

export default function InventoryCountSheet({ inventory, pool }: {
  inventory: Inventory
  /** Produits comptables : tout le catalogue actif (physique) ou la sélection générée (tournant). */
  pool: Product[]
}) {
  const { updateInventory, submitInventory } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()
  const router = useRouter()

  // Saisie : chaîne par produit (vide = pas encore compté) + motif par produit.
  const initial = useMemo(() => {
    const counts: Record<string, string> = {}
    const reasons: Record<string, string> = {}
    for (const l of inventory.lines) {
      if (l.countedAt) counts[l.productId] = String(l.counted)
      if (l.reason) reasons[l.productId] = l.reason
    }
    return { counts, reasons }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory.id])
  const [counts, setCounts] = useState<Record<string, string>>(initial.counts)
  const [reasons, setReasons] = useState<Record<string, string>>(initial.reasons)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [onlyGaps, setOnlyGaps] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const barcodeRef = useRef<HTMLInputElement>(null)

  // Théorique figé : celui de la ligne enregistrée si elle existe, sinon le stock vivant.
  const frozen = useMemo(() => {
    const m = new Map<string, InventoryLine>()
    for (const l of inventory.lines) m.set(l.productId, l)
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory.id])

  const rows: Row[] = useMemo(
    () =>
      pool.map((p) => {
        const line = frozen.get(p.id)
        return {
          productId: p.id,
          name: p.name,
          barcode: p.barcode || undefined,
          category: p.category || undefined,
          theoretical: line ? line.theoretical : p.stock,
          cost: p.cost,
        }
      }),
    [pool, frozen]
  )

  /*
   * INDEX, PAS DE RECHERCHE LINÉAIRE. Chercher chaque produit avec
   * `pool.find()` dans une boucle sur les lignes est quadratique : sur un
   * catalogue de plusieurs dizaines de milliers de références, l'onglet fige
   * avant même d'afficher la feuille. Les deux index sont construits en UNE
   * passe et toutes les recherches deviennent instantanées.
   */
  const rowById = useMemo(() => {
    const m = new Map<string, Row>()
    for (const r of rows) m.set(r.productId, r)
    return m
  }, [rows])

  // Code principal + codes hérités des fusions de doublons.
  const byBarcode = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of pool) {
      if (p.barcode) m.set(p.barcode, p.id)
      for (const b of p.altBarcodes ?? []) m.set(b, p.id)
    }
    return m
  }, [pool])

  const num = (s: string | undefined) => {
    const n = parseFloat((s ?? '').replace(',', '.'))
    return Number.isFinite(n) ? n : NaN
  }
  const gapOf = (r: Row) => {
    const n = num(counts[r.productId])
    return Number.isNaN(n) ? 0 : n - r.theoretical
  }
  const isCounted = (r: Row) => !Number.isNaN(num(counts[r.productId]))

  // La recherche est différée : sur un gros catalogue, filtrer à chaque frappe
  // rendrait la saisie saccadée.
  const deferredQuery = useDeferredValue(query)
  const searched = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.barcode ?? '').includes(q) || (r.category ?? '').toLowerCase().includes(q)
    )
  }, [rows, deferredQuery])

  // Le filtre « écarts uniquement » dépend des quantités saisies : il n'est
  // appliqué QUE s'il est coché, sinon chaque frappe reparcourrait tout le
  // catalogue pour rien.
  const visible = useMemo(
    () => (onlyGaps ? searched.filter((r) => isCounted(r) && gapOf(r) !== 0) : searched),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searched, onlyGaps, counts]
  )

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const paged = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Parcourt les quantités SAISIES (quelques dizaines), pas tout le catalogue :
  // les compteurs se recalculent à chaque frappe.
  const stats = useMemo(() => {
    let counted = 0, gaps = 0, value = 0
    for (const [productId, raw] of Object.entries(counts)) {
      const n = num(raw)
      if (Number.isNaN(n)) continue
      const r = rowById.get(productId)
      if (!r) continue
      counted++
      const d = n - r.theoretical
      if (d !== 0) { gaps++; value += d * r.cost }
    }
    return { counted, gaps, value, total: rows.length }
  }, [counts, rowById, rows.length])

  const handleScan = (code: string) => {
    const c = code.trim()
    if (!c) return
    const id = byBarcode.get(c)
    const r = id ? rowById.get(id) : undefined
    if (!r) { toast(`${t('inv_scan_unknown')} : ${c}`, 'error'); return }
    setCounts((prev) => {
      const cur = num(prev[r.productId])
      return { ...prev, [r.productId]: String(Number.isNaN(cur) ? 1 : cur + 1) }
    })
    toast(`✓ ${r.name}`)
  }

  // Lignes à persister : les produits comptés, PLUS les lignes générées non
  // comptées (tournant) conservées telles quelles — sans ça, chaque sauvegarde
  // de brouillon ferait rétrécir la liste d'articles à contrôler.
  const buildLines = (): InventoryLine[] => {
    const nowIso = new Date().toISOString()
    return rows
      .filter((r) => isCounted(r) || frozen.has(r.productId))
      .map((r) => {
        const prev = frozen.get(r.productId)
        if (!isCounted(r) && prev) return prev
        const value = num(counts[r.productId])
        const unchanged = !!prev?.countedAt && prev.counted === value
        return {
          productId: r.productId,
          productName: r.name,
          barcode: r.barcode,
          category: r.category,
          theoretical: r.theoretical,
          counted: value,
          reason: gapOf(r) !== 0 ? (reasons[r.productId] || undefined) : undefined,
          countedAt: unchanged ? prev.countedAt : nowIso,
          countedBy: unchanged ? prev.countedBy : undefined,
        }
      })
  }

  const saveDraft = () => {
    updateInventory(inventory.id, { lines: buildLines() })
    toast(`✓ ${t('inv_draft_saved')}`)
  }

  const sendToControl = () => {
    const lines = buildLines()
    if (!lines.some((l) => l.countedAt)) { toast(t('inv_nothing_counted'), 'error'); return }
    updateInventory(inventory.id, { lines })
    submitInventory(inventory.id)
    toast(`✓ ${t('inv_sent_control')}`)
    router.push(`/stock/inventaires/details?id=${inventory.id}`)
  }

  const readOnly = inventory.status !== 'brouillon' || !can('stock.inventory_count')

  return (
    <>
      {/* KPIs de progression */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { v: `${stats.counted} / ${stats.total}`, l: t('inv_kpi_counted'), c: 'text-gray-900 dark:text-white' },
          { v: String(stats.gaps), l: t('inv_kpi_gaps'), c: stats.gaps ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white' },
          { v: fmtDH(stats.value), l: t('inv_kpi_gap_value'), c: stats.value < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400' },
          { v: inventory.ref, l: t('inv_kpi_ref'), c: 'text-amber-600 dark:text-amber-400' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-4 text-center">
            <p className={`truncate text-xl font-extrabold tabular-nums ${s.c}`}>{s.v}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Scan + recherche */}
      <div className="flex flex-wrap items-center gap-3">
        {!readOnly && (
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <ScanBarcode className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
            <input
              ref={barcodeRef}
              type="text"
              placeholder={t('inv_scan_placeholder')}
              className="input-field pl-10"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleScan(e.currentTarget.value)
                  e.currentTarget.value = ''
                }
              }}
            />
          </div>
        )}
        {!readOnly && (
          <button onClick={() => setCameraOpen(true)} className="btn-secondary">
            <Camera className="h-4 w-4" />
            {t('inv_scan_camera')}
          </button>
        )}
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder={t('inv_search_ph')}
            className="input-field pl-10"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-zinc-300">
          <input type="checkbox" checked={onlyGaps} onChange={(e) => { setOnlyGaps(e.target.checked); setPage(1) }} className="h-4 w-4 rounded accent-amber-500" />
          {t('inv_only_gaps')}
        </label>
      </div>

      {/* Tableau de comptage */}
      <div className="glass-card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
              <th className="px-4 py-3">{t('inv_col_code')}</th>
              <th className="px-4 py-3">{t('inv_col_name')}</th>
              <th className="px-4 py-3">{t('inv_col_category')}</th>
              <th className="px-4 py-3 text-center">{t('inv_col_theoretical')}</th>
              <th className="px-4 py-3 text-center">{t('inv_col_counted')}</th>
              <th className="px-4 py-3 text-center">{t('inv_col_gap')}</th>
              <th className="px-4 py-3">{t('inv_col_reason')}</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => {
              const counted = isCounted(r)
              const gap = gapOf(r)
              return (
                <tr key={r.productId} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{r.barcode ?? '—'}</td>
                  <td className="px-4 py-2 font-semibold text-gray-900 dark:text-white">{r.name}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{r.category ?? '—'}</td>
                  <td className="px-4 py-2 text-center tabular-nums text-gray-600 dark:text-zinc-300">{r.theoretical}</td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={counts[r.productId] ?? ''}
                      disabled={readOnly}
                      onChange={(e) => setCounts((prev) => ({ ...prev, [r.productId]: e.target.value }))}
                      className="input-field h-9 w-24 text-center tabular-nums"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    {counted && gap !== 0 ? (
                      <span className={`font-bold tabular-nums ${gap < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {gap > 0 ? '+' : ''}{Math.round(gap * 1000) / 1000}
                      </span>
                    ) : counted ? (
                      <span className="text-xs font-semibold text-gray-400">0</span>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {counted && gap !== 0 && !readOnly ? (
                      <Select
                        value={reasons[r.productId] ?? ''}
                        onChange={(v) => setReasons((prev) => ({ ...prev, [r.productId]: v }))}
                        options={[{ value: '', label: t('inv_reason_none') }, ...MOTIFS.map((m) => ({ value: m, label: t(m) }))]}
                        className="w-40"
                      />
                    ) : counted && gap !== 0 && reasons[r.productId] ? (
                      <span className="text-xs text-gray-500">{t(reasons[r.productId] as TKey)}</span>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {paged.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-zinc-400">{t('inv_no_rows')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} total={visible.length} onChange={setPage} />

      {/* Actions */}
      {!readOnly && (
        <div className="flex flex-wrap justify-end gap-3">
          <button onClick={saveDraft} className="btn-secondary">
            <Save className="h-4 w-4" />
            {t('inv_save_draft')}
          </button>
          <button onClick={sendToControl} className="btn-primary">
            <ClipboardCheck className="h-4 w-4" />
            {t('inv_send_control')}
          </button>
        </div>
      )}

      <CameraScanner open={cameraOpen} onClose={() => setCameraOpen(false)} onDetect={handleScan} />
    </>
  )
}
