'use client'

// Historique des inventaires : tous les inventaires du magasin (brouillons,
// en contrôle, validés, annulés) — un validé ne disparaît JAMAIS, c'est le
// procès-verbal qui justifie les ajustements de stock.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, History } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import { fmtDH, INVENTORY_META, inventoryDiffs, useDroguerie, type InventoryStatus } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const STATUS_KEY: Record<string, TKey> = {
  brouillon: 'inv_status_brouillon',
  controle: 'inv_status_controle',
  valide: 'inv_status_valide',
  annule: 'inv_status_annule',
}

function Content() {
  const { ready, inventories, products, activeStore } = useDroguerie()
  const { t } = useLanguage()
  const router = useRouter()
  const [status, setStatus] = useState<InventoryStatus | 'tous'>('tous')

  const cost = useMemo(() => new Map(products.map((p) => [p.id, p.cost])), [products])

  const rows = useMemo(
    () =>
      inventories
        .filter((i) => status === 'tous' || i.status === status)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((i) => {
          const diffs = inventoryDiffs(i)
          return {
            inv: i,
            counted: i.lines.filter((l) => l.countedAt).length,
            gaps: diffs.length,
            value: diffs.reduce((s, l) => s + (l.counted - l.theoretical) * (cost.get(l.productId) ?? 0), 0),
          }
        }),
    [inventories, status, cost]
  )

  if (!ready) return <Loader />

  const filters: { key: InventoryStatus | 'tous'; label: string }[] = [
    { key: 'tous', label: t('inv_filter_all') },
    { key: 'brouillon', label: t('inv_status_brouillon') },
    { key: 'controle', label: t('inv_status_controle') },
    { key: 'valide', label: t('inv_status_valide') },
    { key: 'annule', label: t('inv_status_annule') },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <History className="h-6 w-6 text-amber-500" />
          {t('inv_hist_title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          {t('inv_hist_sub')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
        </p>
      </motion.div>

      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button key={f.key} onClick={() => setStatus(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${status === f.key ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-zinc-300'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-x-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <History className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('inv_hist_empty')}</p>
          </div>
        ) : (
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                <th className="px-4 py-3">{t('inv_c_ref')}</th>
                <th className="px-4 py-3">{t('inv_col_type')}</th>
                <th className="px-4 py-3">{t('inv_col_date')}</th>
                <th className="px-4 py-3 text-center">{t('inv_kpi_counted')}</th>
                <th className="px-4 py-3 text-center">{t('inv_kpi_gaps')}</th>
                <th className="px-4 py-3 text-right">{t('inv_kpi_gap_value')}</th>
                <th className="px-4 py-3">{t('inv_col_by')}</th>
                <th className="px-4 py-3">{t('inv_c_status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map(({ inv, counted, gaps, value }) => (
                <tr key={inv.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2.5 font-semibold text-amber-600 dark:text-amber-400">{inv.ref}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{inv.kind === 'physique' ? t('inv_type_phys') : t('inv_type_cycle')}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(inv.date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{counted}</td>
                  <td className={`px-4 py-2.5 text-center font-bold tabular-nums ${gaps ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>{gaps}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${value < 0 ? 'text-rose-500' : 'text-gray-600 dark:text-zinc-300'}`}>{fmtDH(value)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{inv.validatedBy ?? inv.createdBy ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${INVENTORY_META[inv.status].chip}`}>
                      {t(STATUS_KEY[inv.status])}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => router.push(`/stock/inventaires/details?id=${inv.id}`)} className="btn-secondary !px-3 !py-1.5 text-xs">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
