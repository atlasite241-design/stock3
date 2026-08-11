'use client'

// Tableau de bord Inventaire : l'état du contrôle du stock en un coup d'œil —
// inventaires en cours / en attente de validation / terminés, articles
// contrôlés, écarts et leur valeur, plus gros écarts, derniers inventaires.

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  BadgeCheck,
  ClipboardCheck,
  ClipboardList,
  Eye,
  Gauge,
  Plus,
  RefreshCcw,
  Scale,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import { usePermissions } from '@/lib/access'
import { fmtDH, INVENTORY_META, inventoryDiffs, useDroguerie, type InventoryStatus } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const STATUS_KEY: Record<InventoryStatus, TKey> = {
  brouillon: 'inv_status_brouillon',
  controle: 'inv_status_controle',
  valide: 'inv_status_valide',
  annule: 'inv_status_annule',
}

function Content() {
  const { ready, inventories, products, activeStore } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const router = useRouter()

  const cost = useMemo(() => new Map(products.map((p) => [p.id, p.cost])), [products])

  const stats = useMemo(() => {
    const enCours = inventories.filter((i) => i.status === 'brouillon')
    const enAttente = inventories.filter((i) => i.status === 'controle')
    const valides = inventories.filter((i) => i.status === 'valide')
    let articles = 0, ecarts = 0, valeur = 0
    const topGaps: { name: string; ref: string; d: number; v: number }[] = []
    for (const inv of valides) {
      articles += inv.lines.filter((l) => l.countedAt).length
      for (const l of inventoryDiffs(inv)) {
        ecarts++
        const d = l.counted - l.theoretical
        const v = d * (cost.get(l.productId) ?? 0)
        valeur += v
        topGaps.push({ name: l.productName, ref: inv.ref, d, v })
      }
    }
    topGaps.sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    return { enCours, enAttente, valides, articles, ecarts, valeur, topGaps: topGaps.slice(0, 8) }
  }, [inventories, cost])

  const recents = useMemo(
    () => [...inventories].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    [inventories]
  )

  if (!ready) return <Loader />

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Gauge className="h-6 w-6 text-amber-500" />
            {t('inv_dash_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('inv_dash_sub')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        {can('stock.inventory_create') && (
          <div className="flex flex-wrap gap-2">
            <Link href="/stock/inventaires/physique" className="btn-secondary">
              <ClipboardList className="h-4 w-4" />
              {t('inv_new_phys')}
            </Link>
            <Link href="/stock/inventaires/tournant" className="btn-primary">
              <Plus className="h-4 w-4" />
              {t('inv_new_cycle')}
            </Link>
          </div>
        )}
      </motion.div>

      {/* Statuts */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { v: stats.enCours.length, l: t('inv_dash_open'), icon: ClipboardList, cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500' },
          { v: stats.enAttente.length, l: t('inv_dash_pending'), icon: ClipboardCheck, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
          { v: stats.valides.length, l: t('inv_dash_done'), icon: BadgeCheck, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500' },
        ].map((c, i) => (
          <motion.div key={c.l} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.4 }}
            className="glass-card glass-card-hover p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.cls}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{c.l}</p>
            <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white">{c.v}</p>
          </motion.div>
        ))}
      </div>

      {/* Compteurs cumulés (inventaires validés) */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { v: String(stats.articles), l: t('inv_dash_articles'), c: 'text-gray-900 dark:text-white' },
          { v: String(stats.ecarts), l: t('inv_dash_gaps'), c: stats.ecarts ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white' },
          { v: fmtDH(stats.valeur), l: t('inv_dash_gap_value'), c: stats.valeur < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-4 text-center">
            <p className={`text-xl font-extrabold tabular-nums ${s.c}`}>{s.v}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* À valider en priorité */}
        <div className="glass-card p-5">
          <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
            <ClipboardCheck className="h-4 w-4 text-amber-500" />
            {t('inv_dash_pending')}
          </p>
          {stats.enAttente.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400 dark:text-zinc-500">{t('inv_dash_none')}</p>
          ) : (
            <div className="space-y-2">
              {stats.enAttente.map((i) => (
                <button key={i.id} onClick={() => router.push(`/stock/inventaires/details?id=${i.id}`)}
                  className="flex w-full items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5 text-left transition hover:border-amber-300 hover:bg-amber-50 dark:border-white/10 dark:hover:bg-white/5">
                  <span className="font-semibold text-gray-900 dark:text-white">{i.ref}</span>
                  <span className="text-xs text-gray-500">{inventoryDiffs(i).length} {t('inv_dash_gaps_short')}</span>
                  <Eye className="h-4 w-4 text-gray-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Plus gros écarts (validés) */}
        <div className="glass-card p-5">
          <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {t('inv_dash_top_gaps')}
          </p>
          {stats.topGaps.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400 dark:text-zinc-500">{t('inv_dash_none')}</p>
          ) : (
            <div className="space-y-2">
              {stats.topGaps.map((g, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-white/10">
                  <span className="min-w-0 flex-1 truncate font-semibold text-gray-900 dark:text-white">{g.name}</span>
                  <span className="mx-2 text-xs text-gray-400">{g.ref}</span>
                  <span className={`font-bold tabular-nums ${g.d < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {g.d > 0 ? '+' : ''}{g.d} · {fmtDH(g.v)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Derniers inventaires */}
      <div className="glass-card overflow-x-auto">
        <p className="flex items-center gap-2 px-4 pt-4 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
          <Scale className="h-4 w-4 text-amber-500" />
          {t('inv_dash_recent')}
        </p>
        {recents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <RefreshCcw className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('inv_dash_empty')}</p>
          </div>
        ) : (
          <table className="mt-2 w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                <th className="px-4 py-3">{t('inv_c_ref')}</th>
                <th className="px-4 py-3">{t('inv_col_type')}</th>
                <th className="px-4 py-3">{t('inv_col_date')}</th>
                <th className="px-4 py-3 text-center">{t('inv_kpi_gaps')}</th>
                <th className="px-4 py-3">{t('inv_c_status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {recents.map((i) => (
                <tr key={i.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2.5 font-semibold text-amber-600 dark:text-amber-400">{i.ref}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{i.kind === 'physique' ? t('inv_type_phys') : t('inv_type_cycle')}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(i.date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{inventoryDiffs(i).length}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${INVENTORY_META[i.status].chip}`}>
                      {t(STATUS_KEY[i.status])}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => router.push(`/stock/inventaires/details?id=${i.id}`)} className="btn-secondary !px-3 !py-1.5 text-xs">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-center">
        <Link href="/stock/inventaires/historique" className="text-sm font-semibold text-amber-600 transition hover:text-amber-500 dark:text-amber-400">
          {t('inv_dash_view_history')} →
        </Link>
      </div>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
