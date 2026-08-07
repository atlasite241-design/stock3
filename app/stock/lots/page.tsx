'use client'

// Lots & DLC — la couche de traçabilité sous le stock.
//
// Chaque entrée (réception, retour, transfert, écart d'inventaire) est un lot
// daté ; chaque sortie les consomme en FIFO — ou en FEFO (DLC la plus proche
// d'abord) pour les catégories cochées dans Paramètres → Administration.
// Le stock de la fiche reste l'autorité : cette page montre d'où il vient.

import { useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { CalendarClock, Layers, Search } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Pagination from '@/components/Pagination'
import Select from '@/components/Select'
import { fmtDH, useDroguerie, type Lot } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const PAGE_SIZE = 50

function Content() {
  const { ready, lots, products, settings } = useDroguerie()
  const { t, lang } = useLanguage()

  const [productId, setProductId] = useState('')
  const [query, setQuery] = useState('')
  const [ouvertsSeuls, setOuvertsSeuls] = useState(true)
  const [page, setPage] = useState(1)

  const catById = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of products) m.set(p.id, p.category)
    return m
  }, [products])

  if (!ready) {
    return <Loader />
  }

  const fefoCats = settings.fefoCategories ?? []
  const aujourdHui = new Date().toISOString().slice(0, 10)
  const bientot = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const visible = lots
    .filter((l) => !productId || l.productId === productId)
    .filter((l) => !ouvertsSeuls || l.remaining > 0)
    .filter((l) => {
      const q = query.trim().toLowerCase()
      return !q || l.productName.toLowerCase().includes(q) || l.ref.toLowerCase().includes(q)
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const perimes = lots.filter((l) => l.remaining > 0 && l.expiryDate && l.expiryDate < aujourdHui)
  const proches = lots.filter((l) => l.remaining > 0 && l.expiryDate && l.expiryDate >= aujourdHui && l.expiryDate <= bientot)

  const badgeDlc = (l: Lot) => {
    if (!l.expiryDate) return <span className="text-xs text-gray-300 dark:text-zinc-600">—</span>
    const cls = l.expiryDate < aujourdHui
      ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
      : l.expiryDate <= bientot
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
    return (
      <span className={`rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${cls}`}>
        {new Date(l.expiryDate + 'T00:00:00').toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR')}
      </span>
    )
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Layers className="h-6 w-6 text-amber-500" />{t('lot_title')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">{t('lot_subtitle')}</p>
        </div>
      </motion.div>

      {/* Alertes DLC : le FEFO ne sert que si quelqu'un regarde ce qui approche. */}
      {(perimes.length > 0 || proches.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {perimes.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              <CalendarClock className="h-4 w-4" />
              {perimes.length.toLocaleString('fr-FR')} {t('lot_expired')}
            </div>
          )}
          {proches.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              <CalendarClock className="h-4 w-4" />
              {proches.length.toLocaleString('fr-FR')} {t('lot_soon')}
            </div>
          )}
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={productId}
          onChange={(v) => { setProductId(v); setPage(1) }}
          placeholder={t('mv_all_products')}
          options={[
            { value: '', label: t('mv_all_products') },
            ...products.map((p) => ({ value: p.id, label: p.name })),
          ]}
          className="w-auto min-w-[220px]"
        />
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 dark:border-white/10 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={ouvertsSeuls}
            onChange={(e) => { setOuvertsSeuls(e.target.checked); setPage(1) }}
            className="h-4 w-4 accent-amber-500"
          />
          {t('lot_open_only')}
        </label>
        <div className="relative ml-auto min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder={t('mv_search_placeholder')}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
        className="glass-card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[860px]">
            <thead className="thead-fixe">
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('lot_col_product')}</th>
                <th className="px-5 py-3.5">{t('lot_col_ref')}</th>
                <th className="px-5 py-3.5">{t('lot_col_entry')}</th>
                <th className="px-5 py-3.5">{t('lot_col_dlc')}</th>
                <th className="px-5 py-3.5 text-right">{t('lot_col_remaining')}</th>
                <th className="px-5 py-3.5 text-right">{t('lot_col_cost')}</th>
                <th className="px-5 py-3.5">{t('lot_col_mode')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const fefo = fefoCats.includes(catById.get(l.productId) ?? '')
                return (
                  <tr key={l.id} className={`border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5 ${l.remaining <= 0 ? 'opacity-45' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{l.productName}</p>
                      {l.ouverture && (
                        <p className="text-[11px] text-gray-400 dark:text-zinc-500">{t('lot_opening')}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500 dark:text-zinc-400">{l.ref}</td>
                    <td className="px-5 py-3 text-sm tabular-nums text-gray-600 dark:text-zinc-400">
                      {new Date(l.date).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR')}
                    </td>
                    <td className="px-5 py-3">{badgeDlc(l)}</td>
                    <td className="px-5 py-3 text-right text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                      {l.remaining.toLocaleString('fr-FR')}
                      <span className="ml-1 font-normal text-gray-400 dark:text-zinc-500">/ {l.qty.toLocaleString('fr-FR')}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums text-gray-600 dark:text-zinc-400">{fmtDH(l.cost)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-lg px-2 py-1 text-[11px] font-bold ${fefo ? 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-zinc-400'}`}>
                        {fefo ? 'FEFO' : 'FIFO'}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('lot_none')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="border-t border-gray-100 px-5 py-3 dark:border-white/10">
            <Pagination page={safePage} pageCount={pageCount} total={visible.length} onChange={setPage} encadre={false} className="w-full" />
          </div>
        )}
      </motion.div>

      <p className="rounded-xl border border-dashed border-gray-200 p-3 text-[11px] leading-relaxed text-gray-500 dark:border-white/15 dark:text-zinc-400">
        {t('lot_footer_hint')}
      </p>
    </>
  )
}

export default function LotsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
