'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { AlertTriangle, BarChart3, Download, FileSpreadsheet, MapPinOff, Package, Printer, Rotate3d } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { availableStock, fmtDH, useDroguerie, type Product } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

type ReportKey = 'by_zone' | 'by_allee' | 'by_rayon' | 'by_etagere' | 'by_niveau' | 'by_position' | 'no_location' | 'mislocated' | 'critical_by_zone' | 'occupancy' | 'top_by_zone'
type AggRow = { code: string; name: string; qty: number; value: number; count: number; critical: number }

function Content() {
  const d = useDroguerie()
  const { ready, products, positions, activeStore, activeStoreId, resolveLocation } = d
  const { t } = useLanguage()
  const [report, setReport] = useState<ReportKey>('by_zone')

  const storeProducts = useMemo(
    () => products.filter((p) => !activeStoreId || !p.storeId || p.storeId === activeStoreId),
    [products, activeStoreId]
  )

  // Rattache chaque produit à sa zone (via resolveLocation → zone).
  const zoneOf = (p: Product) => resolveLocation(p)?.zone ?? null

  // Agrégat générique par nœud (zone / allée / rayon).
  const aggregateBy = (getNode: (p: Product) => { id: string; code: string; name?: string } | null) => {
    const m = new Map<string, AggRow>()
    let noQty = 0, noVal = 0, noCount = 0
    for (const p of storeProducts) {
      const node = getNode(p)
      const s = availableStock(p)
      if (!node) { noQty += s; noVal += s * p.cost; noCount++; continue }
      const e = m.get(node.id) ?? { code: node.code, name: node.name || node.code, qty: 0, value: 0, count: 0, critical: 0 }
      e.qty += s; e.value += s * p.cost; e.count++
      if (s <= p.minStock) e.critical++
      m.set(node.id, e)
    }
    return { rows: [...m.values()].sort((a, b) => b.value - a.value), noZone: { qty: noQty, value: noVal, count: noCount } }
  }

  const byZone = useMemo(() => aggregateBy((p) => zoneOf(p)), [storeProducts]) // eslint-disable-line react-hooks/exhaustive-deps
  const byAllee = useMemo(() => aggregateBy((p) => { const a = resolveLocation(p)?.allee; return a ? { id: a.id, code: a.code, name: a.name } : null }), [storeProducts]) // eslint-disable-line react-hooks/exhaustive-deps
  const byRayon = useMemo(() => aggregateBy((p) => { const r = resolveLocation(p)?.rayon; return r ? { id: r.id, code: r.code, name: r.name } : null }), [storeProducts]) // eslint-disable-line react-hooks/exhaustive-deps
  const byEtagere = useMemo(() => aggregateBy((p) => { const e = resolveLocation(p)?.etagere; return e ? { id: e.id, code: e.code, name: e.name } : null }), [storeProducts]) // eslint-disable-line react-hooks/exhaustive-deps
  const byNiveau = useMemo(() => aggregateBy((p) => { const n = resolveLocation(p)?.niveau; return n ? { id: n.id, code: n.code, name: n.name } : null }), [storeProducts]) // eslint-disable-line react-hooks/exhaustive-deps
  const byPosition = useMemo(() => aggregateBy((p) => { const po = resolveLocation(p)?.position; return po ? { id: po.id, code: p.emplacementComplet || po.code, name: po.name } : null }), [storeProducts]) // eslint-disable-line react-hooks/exhaustive-deps
  const grouped = report === 'by_allee' ? byAllee : report === 'by_rayon' ? byRayon
    : report === 'by_etagere' ? byEtagere : report === 'by_niveau' ? byNiveau : report === 'by_position' ? byPosition
    : byZone

  const noLocation = useMemo(
    () => storeProducts.filter((p) => !p.emplacementComplet).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [storeProducts]
  )

  // Produits mal localisés : ils portent une intention de localisation
  // (emplacement/position/zone) mais celle-ci ne se résout PAS vers une zone
  // valide (référence supprimée, chaîne cassée, ou position inexistante).
  const misLocated = useMemo(() => {
    const posIds = new Set(positions.filter((po) => po.storeId === activeStoreId).map((po) => po.id))
    return storeProducts
      .filter((p) => {
        const hasIntent = !!p.emplacementComplet || !!p.positionId || !!p.zoneId
        if (!hasIntent) return false
        const loc = resolveLocation(p)
        const zoneBroken = !loc?.zone
        const posBroken = !!p.positionId && !posIds.has(p.positionId)
        return zoneBroken || posBroken
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [storeProducts, positions, activeStoreId]) // eslint-disable-line react-hooks/exhaustive-deps

  const criticalByZone = useMemo(() =>
    storeProducts
      .filter((p) => availableStock(p) <= p.minStock)
      .map((p) => ({ p, z: zoneOf(p) }))
      .sort((a, b) => (a.z?.code ?? '~').localeCompare(b.z?.code ?? '~', 'fr') || a.p.name.localeCompare(b.p.name, 'fr'))
  , [storeProducts]) // eslint-disable-line react-hooks/exhaustive-deps

  // Occupation : positions définies vs occupées (au moins un produit).
  const occupancy = useMemo(() => {
    const usedPos = new Set(storeProducts.filter((p) => p.positionId).map((p) => p.positionId))
    const storePositions = positions.filter((po) => po.storeId === activeStoreId)
    const used = storePositions.filter((po) => usedPos.has(po.id)).length
    const totalDefined = storePositions.length
    return { totalDefined, used, free: Math.max(0, totalDefined - used), rate: totalDefined ? Math.round((used / totalDefined) * 100) : 0 }
  }, [storeProducts, positions, activeStoreId])

  if (!ready) return <Loader />

  const REPORTS: { key: ReportKey; label: string; icon: typeof Package }[] = [
    { key: 'by_zone', label: t('wr_by_zone'), icon: BarChart3 },
    { key: 'by_allee', label: t('wr_by_allee'), icon: BarChart3 },
    { key: 'by_rayon', label: t('wr_by_rayon'), icon: BarChart3 },
    { key: 'by_etagere', label: t('wr_by_etagere'), icon: BarChart3 },
    { key: 'by_niveau', label: t('wr_by_niveau'), icon: BarChart3 },
    { key: 'by_position', label: t('wr_by_position'), icon: BarChart3 },
    { key: 'no_location', label: t('wr_no_location'), icon: MapPinOff },
    { key: 'mislocated', label: t('wr_mislocated'), icon: AlertTriangle },
    { key: 'critical_by_zone', label: t('wr_critical'), icon: AlertTriangle },
    { key: 'occupancy', label: t('wr_occupancy'), icon: Package },
    { key: 'top_by_zone', label: t('wr_value_zone'), icon: BarChart3 },
  ]
  const groupedHeader = report === 'by_allee' ? t('wms_allee') : report === 'by_rayon' ? t('wms_rayon')
    : report === 'by_etagere' ? t('wms_etagere') : report === 'by_niveau' ? t('wms_niveau') : report === 'by_position' ? t('wms_position') : t('wms_zone')
  const isGrouped = ['by_zone', 'by_allee', 'by_rayon', 'by_etagere', 'by_niveau', 'by_position', 'top_by_zone'].includes(report)

  // ---- Export ----
  const currentRows = (): { headers: string[]; rows: (string | number)[][]; name: string } => {
    if (report === 'no_location')
      return { name: 'produits-sans-emplacement', headers: ['Code-barres', 'Produit', 'Catégorie', 'Stock', 'Valeur'],
        rows: noLocation.map((p) => [p.barcode, p.name, p.category, availableStock(p), (availableStock(p) * p.cost).toFixed(2)]) }
    if (report === 'critical_by_zone')
      return { name: 'critiques-par-zone', headers: ['Zone', 'Code-barres', 'Produit', 'Stock', 'Seuil'],
        rows: criticalByZone.map(({ p, z }) => [z ? `${z.code} · ${z.name}` : '—', p.barcode, p.name, availableStock(p), p.minStock]) }
    if (report === 'occupancy')
      return { name: 'occupation', headers: ['Indicateur', 'Valeur'],
        rows: [['Positions définies', occupancy.totalDefined], ['Occupées', occupancy.used], ['Libres', occupancy.free], ['Taux %', occupancy.rate]] }
    if (report === 'mislocated')
      return { name: 'produits-mal-localises', headers: ['Code-barres', 'Produit', 'Emplacement (invalide)', 'Stock'],
        rows: misLocated.map((p) => [p.barcode, p.name, p.emplacementComplet || '—', availableStock(p)]) }
    // by_zone / by_allee / by_rayon / by_etagere / by_niveau / by_position / top_by_zone
    const suffix = report === 'by_allee' ? 'allee' : report === 'by_rayon' ? 'rayon' : report === 'by_etagere' ? 'etagere' : report === 'by_niveau' ? 'niveau' : report === 'by_position' ? 'position' : 'zone'
    return { name: `stock-par-${suffix}`, headers: [groupedHeader, 'Nom', 'Produits', 'Quantité', 'Valeur HT', 'Critiques'],
      rows: grouped.rows.map((r) => [r.code, r.name, r.count, r.qty, r.value.toFixed(2), r.critical]) }
  }
  const exportCsv = () => {
    const { headers, rows, name } = currentRows()
    const csv = [headers, ...rows].map((r) => r.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  const exportXlsx = async () => {
    const { headers, rows, name } = currentRows()
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Rapport'); XLSX.writeFile(wb, `${name}.xlsx`)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4 no-print">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <BarChart3 className="h-6 w-6 text-amber-500" />{t('wr_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('wr_subtitle')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} className="btn-secondary"><Download className="h-4 w-4" />CSV</button>
          <button onClick={exportXlsx} className="btn-secondary"><FileSpreadsheet className="h-4 w-4" />Excel</button>
          <button onClick={() => window.print()} className="btn-primary"><Printer className="h-4 w-4" />PDF</button>
        </div>
      </motion.div>

      {/* Sélecteur de rapport */}
      <div className="flex flex-wrap gap-2 no-print">
        {REPORTS.map((r) => (
          <button key={r.key} onClick={() => setReport(r.key)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${report === r.key ? 'border-amber-400 bg-amber-500 text-white' : 'border-gray-200 text-gray-600 hover:border-amber-300 dark:border-white/10 dark:text-zinc-300'}`}>
            <r.icon className="h-4 w-4" />{r.label}
          </button>
        ))}
      </div>

      <div className="print-area glass-card overflow-hidden">
        <div className="hidden px-5 pt-4 text-lg font-bold print:block">{REPORTS.find((r) => r.key === report)?.label} — {activeStore?.name}</div>

        {/* STOCK / VALEUR PAR ZONE / ALLÉE / RAYON */}
        {isGrouped && (
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              <th className="px-5 py-3">{groupedHeader}</th><th className="px-5 py-3">{t('wms_zone_name')}</th>
              <th className="px-5 py-3 text-center">{t('wr_col_count')}</th><th className="px-5 py-3 text-center">{t('wr_col_qty')}</th>
              <th className="px-5 py-3 text-center">{t('wr_col_critical')}</th><th className="px-5 py-3 text-right">{t('wr_col_value')}</th>
            </tr></thead>
            <tbody>
              {grouped.rows.map((r, i) => (
                <tr key={r.code + i} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-5 py-2.5"><span className="rounded-md bg-amber-50 px-2 py-0.5 font-mono text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{r.code}</span></td>
                  <td className="px-5 py-2.5 font-semibold text-gray-900 dark:text-white">{r.name}</td>
                  <td className="px-5 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{r.count}</td>
                  <td className="px-5 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{r.qty}</td>
                  <td className={`px-5 py-2.5 text-center font-bold tabular-nums ${r.critical > 0 ? 'text-rose-500' : 'text-gray-300 dark:text-zinc-600'}`}>{r.critical}</td>
                  <td className="px-5 py-2.5 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtDH(r.value)}</td>
                </tr>
              ))}
              {grouped.noZone.count > 0 && (
                <tr className="bg-rose-50/40 dark:bg-rose-500/5">
                  <td className="px-5 py-2.5 text-gray-400" colSpan={2}>{t('wr_no_zone')}</td>
                  <td className="px-5 py-2.5 text-center tabular-nums text-gray-500">{grouped.noZone.count}</td>
                  <td className="px-5 py-2.5 text-center tabular-nums text-gray-500">{grouped.noZone.qty}</td>
                  <td className="px-5 py-2.5" />
                  <td className="px-5 py-2.5 text-right tabular-nums text-gray-500">{fmtDH(grouped.noZone.value)}</td>
                </tr>
              )}
              {grouped.rows.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">{t('wr_empty')}</td></tr>}
            </tbody>
          </table>
        )}

        {/* PRODUITS SANS EMPLACEMENT */}
        {report === 'no_location' && (
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              <th className="px-5 py-3">{t('wms_code')}</th><th className="px-5 py-3">{t('wms_zone_name')}</th>
              <th className="px-5 py-3">{t('wr_col_category')}</th><th className="px-5 py-3 text-center">{t('wr_col_qty')}</th><th className="px-5 py-3 text-right">{t('wr_col_value')}</th>
            </tr></thead>
            <tbody>
              {noLocation.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-5 py-2.5 font-mono text-xs text-gray-500">{p.barcode || '—'}</td>
                  <td className="px-5 py-2.5 font-semibold text-gray-900 dark:text-white">{p.name}</td>
                  <td className="px-5 py-2.5 text-gray-500 dark:text-zinc-400">{p.category}</td>
                  <td className="px-5 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{availableStock(p)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-gray-600 dark:text-zinc-300">{fmtDH(availableStock(p) * p.cost)}</td>
                </tr>
              ))}
              {noLocation.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">{t('wr_all_located')}</td></tr>}
            </tbody>
          </table>
        )}

        {/* CRITIQUES PAR ZONE */}
        {report === 'critical_by_zone' && (
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              <th className="px-5 py-3">{t('wms_zone')}</th><th className="px-5 py-3">{t('wms_zone_name')}</th>
              <th className="px-5 py-3 text-center">{t('wr_col_qty')}</th><th className="px-5 py-3 text-center">{t('wr_col_min')}</th>
            </tr></thead>
            <tbody>
              {criticalByZone.map(({ p, z }) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-5 py-2.5 font-mono text-xs text-amber-600 dark:text-amber-400">{z ? `${z.code}` : '—'}</td>
                  <td className="px-5 py-2.5 font-semibold text-gray-900 dark:text-white">{p.name}</td>
                  <td className={`px-5 py-2.5 text-center font-bold tabular-nums ${availableStock(p) === 0 ? 'text-rose-500' : 'text-amber-500'}`}>{availableStock(p)}</td>
                  <td className="px-5 py-2.5 text-center tabular-nums text-gray-500">{p.minStock}</td>
                </tr>
              ))}
              {criticalByZone.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">🎉 {t('wr_no_critical')}</td></tr>}
            </tbody>
          </table>
        )}

        {/* PRODUITS MAL LOCALISÉS */}
        {report === 'mislocated' && (
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              <th className="px-5 py-3">{t('wms_code')}</th><th className="px-5 py-3">{t('wms_zone_name')}</th>
              <th className="px-5 py-3">{t('wr_col_bad_location')}</th><th className="px-5 py-3 text-center">{t('wr_col_qty')}</th>
            </tr></thead>
            <tbody>
              {misLocated.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-5 py-2.5 font-mono text-xs text-gray-500">{p.barcode || '—'}</td>
                  <td className="px-5 py-2.5 font-semibold text-gray-900 dark:text-white">{p.name}</td>
                  <td className="px-5 py-2.5 font-mono text-xs">
                    {p.emplacementComplet ? (
                      <Link
                        href={`/magasins/explorateur?code=${encodeURIComponent(p.emplacementComplet)}`}
                        title={t('x3_view_in_3d')}
                        className="flex w-fit items-center gap-1 text-rose-500 transition hover:underline"
                      >
                        {p.emplacementComplet}<Rotate3d className="h-3.5 w-3.5 text-amber-500" />
                      </Link>
                    ) : (
                      <span className="text-rose-500">—</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{availableStock(p)}</td>
                </tr>
              ))}
              {misLocated.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">🎉 {t('wr_all_located_ok')}</td></tr>}
            </tbody>
          </table>
        )}

        {/* OCCUPATION */}
        {report === 'occupancy' && (
          <div className="grid gap-4 p-5 sm:grid-cols-4">
            {[
              { v: occupancy.totalDefined, l: t('wr_positions_defined'), c: 'text-gray-900 dark:text-white' },
              { v: occupancy.used, l: t('wr_positions_used'), c: 'text-emerald-600 dark:text-emerald-400' },
              { v: occupancy.free, l: t('wr_positions_free'), c: 'text-gray-500' },
              { v: `${occupancy.rate}%`, l: t('wr_occupancy_rate'), c: 'text-amber-600 dark:text-amber-400' },
            ].map((s, i) => (
              <div key={i} className="rounded-xl border border-gray-100 p-4 text-center dark:border-white/10">
                <p className={`text-3xl font-extrabold tabular-nums ${s.c}`}>{s.v}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 dark:text-zinc-500 no-print">{t('wr_note')}</p>
    </>
  )
}

export default function WmsReportsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
