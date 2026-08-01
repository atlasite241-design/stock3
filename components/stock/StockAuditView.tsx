'use client'

// Vue d'analyse de stock réutilisable.
//
// Les écrans « Contrôle » et « Réapprovisionnement » sont tous la même chose :
// une sélection de produits du magasin actif, expliquée, triée, exportable.
// Ce composant porte cette mécanique une seule fois ; chaque page se contente
// de fournir son filtre, ses colonnes et son message de liste vide.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Download, FileSpreadsheet, MapPin, Printer, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Loader from '@/components/Loader'
import { availableStock, fmtDH, useDroguerie, type Product, type StockMovement } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

export interface AuditColumn {
  key: string
  /** Clé de traduction du titre de colonne (jamais un texte figé). */
  label: TKey
  align?: 'left' | 'center' | 'right'
  /** Valeur affichée ; `raw` sert au tri et à l'export. */
  render: (p: Product, ctx: AuditContext) => React.ReactNode
  raw: (p: Product, ctx: AuditContext) => string | number
}

export interface AuditContext {
  /** Mouvements du magasin actif, du plus récent au plus ancien. */
  movements: StockMovement[]
  /** Date du dernier mouvement par produit (ms), 0 si aucun. */
  lastMove: Map<string, number>
  /** Quantité sortie sur 90 jours, par produit. */
  out90: Map<string, number>
  now: number
  /** Traduction, pour les libellés produits par les colonnes. */
  t: (k: TKey) => string
}

export default function StockAuditView({
  title, subtitle, icon: Icon, accent = 'amber',
  filter, columns, emptyLabel, note, defaultSort,
}: {
  title: TKey
  subtitle: TKey
  icon: LucideIcon
  accent?: 'amber' | 'rose' | 'violet' | 'cyan' | 'emerald'
  filter: (p: Product, ctx: AuditContext) => boolean
  columns: AuditColumn[]
  emptyLabel: TKey
  /** Encart d'explication (méthode de calcul, limite connue…). */
  note?: TKey
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
}) {
  const { ready, products, movements, activeStoreId, activeStore } = useDroguerie()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(defaultSort ?? { key: columns[0].key, dir: 'asc' as const })

  // Contexte d'analyse : calculé une fois pour toutes les lignes.
  const ctx = useMemo<AuditContext>(() => {
    const now = Date.now()
    const mine = movements.filter((m) => !m.storeId || m.storeId === activeStoreId)
    const lastMove = new Map<string, number>()
    const out90 = new Map<string, number>()
    const since = now - 90 * 86400000
    const OUT = new Set(['vente', 'sortie', 'transfert_out'])
    for (const m of mine) {
      const ts = new Date(m.date).getTime()
      if (!lastMove.has(m.productId) || ts > (lastMove.get(m.productId) ?? 0)) lastMove.set(m.productId, ts)
      if (OUT.has(m.type) && ts >= since) out90.set(m.productId, (out90.get(m.productId) ?? 0) + Math.abs(m.qty))
    }
    return { movements: mine, lastMove, out90, now, t }
  }, [movements, activeStoreId, t])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = products
      .filter((p) => !activeStoreId || !p.storeId || p.storeId === activeStoreId)
      .filter((p) => filter(p, ctx))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q) || (p.category ?? '').toLowerCase().includes(q))
    const col = columns.find((c) => c.key === sort.key) ?? columns[0]
    return list.sort((a, b) => {
      const va = col.raw(a, ctx), vb = col.raw(b, ctx)
      const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'fr')
      return sort.dir === 'asc' ? r : -r
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, activeStoreId, query, sort, ctx])

  if (!ready) return <Loader />

  const headers = [t('sa_col_barcode'), t('sa_col_product'), ...columns.map((c) => t(c.label))]
  const dataRows = () => rows.map((p) => [p.barcode, p.name, ...columns.map((c) => c.raw(p, ctx))])

  const exportCsv = () => {
    const csv = [headers, ...dataRows()].map((r) => r.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `${t(title)}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  const exportXlsx = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows()])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Stock'); XLSX.writeFile(wb, `${t(title)}.xlsx`)
  }

  const tone = {
    amber: 'text-amber-500', rose: 'text-rose-500', violet: 'text-violet-500',
    cyan: 'text-cyan-500', emerald: 'text-emerald-500',
  }[accent]

  return (
    <>
      <style>{`@media print { aside, header.app-header, .no-print { display:none !important } main { padding:0 !important } }`}</style>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Icon className={`h-6 w-6 ${tone}`} />{t(title)}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">
            {t(subtitle)} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button onClick={exportCsv} disabled={rows.length === 0} className="btn-secondary disabled:opacity-40"><Download className="h-4 w-4" />CSV</button>
          <button onClick={exportXlsx} disabled={rows.length === 0} className="btn-secondary disabled:opacity-40"><FileSpreadsheet className="h-4 w-4" />Excel</button>
          <button onClick={() => window.print()} disabled={rows.length === 0} className="btn-secondary disabled:opacity-40"><Printer className="h-4 w-4" />PDF</button>
        </div>
      </motion.div>

      {note && (
        <div className="rounded-xl border border-dashed border-gray-200 p-3 text-xs text-gray-500 dark:border-white/15 dark:text-zinc-400">
          {t(note)}
        </div>
      )}

      <div className="glass-card flex flex-wrap items-center gap-3 p-3 no-print">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('prod_search_placeholder')} className="input-field pl-9" />
        </div>
        <span className="text-sm font-semibold tabular-nums text-gray-600 dark:text-zinc-300">
          {rows.length.toLocaleString('fr-FR')} {t('wr_col_count').toLowerCase()}
        </span>
      </div>

      <div className="glass-card overflow-x-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Icon className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t(emptyLabel)}</p>
          </div>
        ) : (
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                <th className="px-4 py-3">{t('wms_code')}</th>
                <th className="px-4 py-3">{t('wms_zone_name')}</th>
                {columns.map((c) => (
                  <th key={c.key} className={`px-4 py-3 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}>
                    <button
                      onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'asc' ? 'desc' : 'asc' }))}
                      className="transition hover:text-gray-700 dark:hover:text-zinc-200"
                    >
                      {t(c.label)}{sort.key === c.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{p.barcode || '—'}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-gray-900 dark:text-white">{p.name}</p>
                    {p.emplacementComplet && (
                      <Link href={`/magasins/explorateur?code=${encodeURIComponent(p.emplacementComplet)}`}
                        className="flex w-fit items-center gap-1 font-mono text-[10px] text-amber-600 hover:underline dark:text-amber-400">
                        <MapPin className="h-3 w-3" />{p.emplacementComplet}
                      </Link>
                    )}
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-2.5 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}>
                      {c.render(p, ctx)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows.length > 500 && (
          <p className="p-2 text-center text-[11px] text-gray-400">
            {t('af_more')} {(rows.length - 500).toLocaleString('fr-FR')} — {t('wr_note')}
          </p>
        )}
      </div>
    </>
  )
}

/* ------------------------- Colonnes réutilisables ------------------------- */

export const colStock: AuditColumn = {
  key: 'stock', label: 'sa_col_stock', align: 'center',
  raw: (p) => availableStock(p),
  render: (p) => {
    const s = availableStock(p)
    return <span className={`font-bold tabular-nums ${s < 0 ? 'text-rose-500' : s === 0 ? 'text-rose-400' : s <= p.minStock ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{s}</span>
  },
}

export const colMin: AuditColumn = {
  key: 'min', label: 'sa_col_min', align: 'center',
  raw: (p) => p.minStock,
  render: (p) => <span className="tabular-nums text-gray-500">{p.minStock}</span>,
}

export const colCategory: AuditColumn = {
  key: 'cat', label: 'sa_col_category',
  raw: (p) => p.category ?? '',
  render: (p) => <span className="text-gray-500 dark:text-zinc-400">{p.category || '—'}</span>,
}

export const colValue: AuditColumn = {
  key: 'value', label: 'sa_col_value', align: 'right',
  raw: (p) => Number((availableStock(p) * p.cost).toFixed(2)),
  render: (p) => <span className="tabular-nums text-gray-600 dark:text-zinc-300">{fmtDH(availableStock(p) * p.cost)}</span>,
}

/** Jours écoulés depuis le dernier mouvement (— si le produit n'a jamais bougé). */
export const colLastMove: AuditColumn = {
  key: 'last', label: 'sa_col_lastmove', align: 'center',
  raw: (p, c) => {
    const ts = c.lastMove.get(p.id)
    return ts ? Math.floor((c.now - ts) / 86400000) : 9999
  },
  render: (p, c) => {
    const ts = c.lastMove.get(p.id)
    if (!ts) return <span className="text-xs text-gray-400">{c.t('sa_never')}</span>
    const days = Math.floor((c.now - ts) / 86400000)
    return <span className={`tabular-nums ${days > 180 ? 'text-rose-500' : days > 90 ? 'text-amber-500' : 'text-gray-500'}`}>{days} {c.t('sa_days')}</span>
  },
}
