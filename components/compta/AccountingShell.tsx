'use client'

// Cadre commun aux écrans de comptabilité : sélection de période, calcul des
// écritures, contrôle d'équilibre et export. Chaque écran ne fournit que sa
// vue sur les données déjà calculées.

import { useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Download, FileSpreadsheet, Printer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Loader from '@/components/Loader'
import { useDroguerie } from '@/lib/store'
import { buildEntries, totals, type Entry } from '@/lib/accounting'
import { useLanguage, type TKey } from '@/lib/i18n'

export interface AccountingData {
  entries: Entry[]
  from: string
  to: string
  vatRate: number
}

/** Bornes du mois, du trimestre ou de l'année en cours. */
function periodBounds(kind: 'month' | 'quarter' | 'year'): { from: string; to: string } {
  const n = new Date()
  const y = n.getFullYear()
  const start =
    kind === 'month' ? new Date(y, n.getMonth(), 1)
    : kind === 'quarter' ? new Date(y, Math.floor(n.getMonth() / 3) * 3, 1)
    : new Date(y, 0, 1)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { from: iso(start), to: iso(n) }
}

export default function AccountingShell({
  title, subtitle, icon: Icon, children, exportRows, exportName,
}: {
  title: TKey
  subtitle: TKey
  icon: LucideIcon
  children: (d: AccountingData) => ReactNode
  /** Lignes à exporter, construites par l'écran depuis les données reçues. */
  exportRows?: (d: AccountingData) => (string | number)[][]
  exportName?: string
}) {
  const { ready, sales, purchases, clientPayments, supplierPayments, expenses, revenues, settings, activeStoreId, activeStore } = useDroguerie()
  const { t } = useLanguage()
  const [preset, setPreset] = useState<'month' | 'quarter' | 'year' | 'custom'>('month')
  const [custom, setCustom] = useState(() => periodBounds('year'))

  const { from, to } = preset === 'custom' ? custom : periodBounds(preset)

  const data = useMemo<AccountingData>(() => {
    const mine = <T extends { storeId?: string }>(l: T[]) => l.filter((x) => !activeStoreId || !x.storeId || x.storeId === activeStoreId)
    const vatRate = Number(settings.tva) || 20
    return {
      entries: buildEntries({
        sales: mine(sales), purchases: mine(purchases),
        clientPayments: mine(clientPayments), supplierPayments: mine(supplierPayments),
        expenses: mine(expenses), revenues: mine(revenues), vatRate,
      }, from, to),
      from, to, vatRate,
    }
  }, [sales, purchases, clientPayments, supplierPayments, expenses, revenues, settings.tva, activeStoreId, from, to])

  const ctrl = useMemo(() => totals(data.entries), [data.entries])

  if (!ready) return <Loader />

  const doExport = async (kind: 'csv' | 'xlsx') => {
    if (!exportRows) return
    const rows = exportRows(data)
    const name = `${exportName ?? 'comptabilite'}-${from}_${to}`
    if (kind === 'csv') {
      const csv = rows.map((r) => r.join(';')).join('\n')
      const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a'); a.href = url; a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(url)
    } else {
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Compta'); XLSX.writeFile(wb, `${name}.xlsx`)
    }
  }

  const PRESETS: { k: typeof preset; label: TKey }[] = [
    { k: 'month', label: 'cp_p_month' },
    { k: 'quarter', label: 'cp_p_quarter' },
    { k: 'year', label: 'cp_p_year' },
    { k: 'custom', label: 'cp_p_custom' },
  ]

  return (
    <>
      <style>{`@media print { aside, header.app-header, .no-print { display:none !important } main { padding:0 !important } }`}</style>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Icon className="h-6 w-6 text-amber-500" />{t(title)}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">
            {t(subtitle)} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        {exportRows && (
          <div className="flex flex-wrap gap-2 no-print">
            <button onClick={() => doExport('csv')} className="btn-secondary"><Download className="h-4 w-4" />CSV</button>
            <button onClick={() => doExport('xlsx')} className="btn-secondary"><FileSpreadsheet className="h-4 w-4" />Excel</button>
            <button onClick={() => window.print()} className="btn-secondary"><Printer className="h-4 w-4" />PDF</button>
          </div>
        )}
      </motion.div>

      <div className="glass-card flex flex-wrap items-center gap-3 p-3 no-print">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.k} onClick={() => setPreset(p.k)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${preset === p.k ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-zinc-300'}`}>
              {t(p.label)}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="input-field w-auto py-1 text-xs" />
            <span className="text-xs text-gray-400">→</span>
            <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="input-field w-auto py-1 text-xs" />
          </div>
        )}
        <span className="ml-auto text-xs tabular-nums text-gray-500 dark:text-zinc-400">
          {new Date(from).toLocaleDateString('fr-FR')} → {new Date(to).toLocaleDateString('fr-FR')} · {data.entries.length.toLocaleString('fr-FR')} {t('cp_entries')}
        </span>
      </div>

      {/* Contrôle d'équilibre : en partie double, tout déséquilibre est une anomalie. */}
      {!ctrl.balanced && (
        <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{t('cp_unbalanced')} — {ctrl.debit.toFixed(2)} / {ctrl.credit.toFixed(2)}
        </p>
      )}

      {children(data)}

      <p className="text-xs text-gray-400 dark:text-zinc-500 no-print">{t('cp_derived')}</p>
    </>
  )
}
