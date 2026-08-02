'use client'

// Tableau RH générique : recherche, tri, export CSV/Excel, impression.
// Les 40 écrans affichent tous des listes ; les écrire une par une aurait
// produit quarante variantes légèrement différentes du même tableau.

import React, { useMemo, useState } from 'react'
import { ArrowUpDown, Download, FileSpreadsheet, Printer, Search } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

export interface HrColumn<T> {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  /** Valeur affichée. Par défaut, la valeur de tri. */
  render?: (row: T) => React.ReactNode
  /** Valeur triée et exportée. */
  value: (row: T) => string | number
  /** Colonne masquée à l'impression et à l'export (boutons d'action). */
  meta?: boolean
}

export default function HrTable<T extends { id: string }>({
  rows,
  columns,
  search,
  filename,
  empty,
  defaultSort,
  onRowClick,
  footer,
  maxRows = 500,
}: {
  rows: T[]
  columns: HrColumn<T>[]
  /** Texte fouillé par la barre de recherche. Absent = pas de recherche. */
  search?: (row: T) => string
  filename: string
  empty: string
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
  onRowClick?: (row: T) => void
  footer?: React.ReactNode
  maxRows?: number
}) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(defaultSort ?? null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q && search ? rows.filter((r) => search(r).toLowerCase().includes(q)) : rows
    if (!sort) return base
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return base
    return [...base].sort((a, b) => {
      const va = col.value(a)
      const vb = col.value(b)
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'fr')
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [rows, query, sort, columns, search])

  const exportable = columns.filter((c) => !c.meta)
  const sheet = () => [
    exportable.map((c) => c.label),
    ...filtered.map((r) => exportable.map((c) => c.value(r))),
  ]

  const exportCsv = () => {
    const csv = sheet().map((line) => line.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportXlsx = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet(sheet())
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'RH')
    XLSX.writeFile(wb, `${filename}.xlsx`)
  }

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  const alignOf = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left')

  return (
    <>
      <style>{`@media print { aside, header.app-header, .no-print { display:none !important } main { padding:0 !important } }`}</style>

      <div className="glass-card flex flex-wrap items-center gap-3 p-3 no-print">
        {search && (
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 rtl:left-auto rtl:right-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('hr_search')}
              className="input-field pl-9 rtl:pl-3 rtl:pr-9"
            />
          </div>
        )}
        <span className="text-xs font-semibold tabular-nums text-gray-500 dark:text-zinc-400">
          {filtered.length.toLocaleString('fr-FR')}
        </span>
        <div className="flex gap-2">
          <button onClick={exportCsv} disabled={!filtered.length} className="btn-secondary disabled:opacity-40">
            <Download className="h-4 w-4" />CSV
          </button>
          <button onClick={exportXlsx} disabled={!filtered.length} className="btn-secondary disabled:opacity-40">
            <FileSpreadsheet className="h-4 w-4" />Excel
          </button>
          <button onClick={() => window.print()} disabled={!filtered.length} className="btn-secondary disabled:opacity-40">
            <Printer className="h-4 w-4" />PDF
          </button>
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        {filtered.length === 0 ? (
          <p className="p-12 text-center text-sm text-gray-500 dark:text-zinc-400">{empty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                {columns.map((c) => (
                  <th key={c.key} className={`px-4 py-3 ${alignOf(c.align)}`}>
                    <button
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 uppercase transition-colors hover:text-gray-600 dark:hover:text-zinc-300"
                    >
                      {c.label}
                      {sort?.key === c.key && <ArrowUpDown className="h-3 w-3 text-amber-500" />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, maxRows).map((r) => (
                <tr
                  key={r.id}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={`border-b border-gray-50 last:border-0 dark:border-white/5 ${
                    onRowClick ? 'cursor-pointer transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5' : ''
                  }`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-2.5 ${alignOf(c.align)}`}>
                      {c.render ? c.render(r) : c.value(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer}
          </table>
        )}
        {filtered.length > maxRows && (
          <p className="border-t border-gray-100 px-4 py-2 text-center text-[11px] text-gray-400 dark:border-white/10">
            {maxRows} / {filtered.length.toLocaleString('fr-FR')} — {t('hr_truncated')}
          </p>
        )}
      </div>
    </>
  )
}
