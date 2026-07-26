'use client'

import { useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { MapPin, Package, Printer } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Select from '@/components/Select'
import { availableStock, storeShortCode, useDroguerie, type Product } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

type LevelKey = 'zone' | 'allee' | 'rayon'

function Content() {
  const d = useDroguerie()
  const { ready, products, zones, stores, activeStore, activeStoreId, resolveLocation, locationSortKey } = d
  const { t } = useLanguage()

  const [level, setLevel] = useState<LevelKey>('rayon')
  const [zoneFilter, setZoneFilter] = useState('')
  const [onlyReappro, setOnlyReappro] = useState(false)

  const storeCode = useMemo(() => {
    const idx = stores.findIndex((s) => s.id === activeStoreId)
    return storeShortCode(idx < 0 ? 0 : idx)
  }, [stores, activeStoreId])

  // Produits localisés du magasin actif, éventuellement filtrés.
  const located = useMemo(() => {
    return products
      .filter((p) => (!activeStoreId || !p.storeId || p.storeId === activeStoreId) && p.emplacementComplet && p.zoneId)
      .filter((p) => !zoneFilter || p.zoneId === zoneFilter)
      .filter((p) => !onlyReappro || availableStock(p) <= p.minStock)
      .sort((a, b) => locationSortKey(a).localeCompare(locationSortKey(b), 'fr') || a.name.localeCompare(b.name, 'fr'))
  }, [products, activeStoreId, zoneFilter, onlyReappro, locationSortKey])

  // Regroupement par niveau choisi : clé = code hiérarchique jusqu'au niveau.
  const groups = useMemo(() => {
    const map = new Map<string, { title: string; items: Product[] }>()
    for (const p of located) {
      const loc = resolveLocation(p)
      if (!loc) continue
      const z = loc.zone, a = loc.allee, r = loc.rayon
      let key = ''
      let title = ''
      if (level === 'zone') {
        key = z ? z.id : '_'
        title = `${storeCode}-${z?.code ?? '?'}${z?.name ? ' · ' + z.name : ''}`
      } else if (level === 'allee') {
        key = `${z?.id}/${a?.id ?? '_'}`
        title = `${storeCode}-${z?.code ?? '?'}-${a?.code ?? '—'}${a?.name ? ' · ' + a.name : ''}`
      } else {
        key = `${z?.id}/${a?.id}/${r?.id ?? '_'}`
        title = `${storeCode}-${z?.code ?? '?'}-${a?.code ?? '—'}-${r?.code ?? '—'}${r?.name ? ' · ' + r.name : ''}`
      }
      const g = map.get(key) ?? { title, items: [] }
      g.items.push(p)
      map.set(key, g)
    }
    return [...map.values()].sort((x, y) => x.title.localeCompare(y.title, 'fr'))
  }, [located, level, storeCode, resolveLocation])

  if (!ready) return <Loader />

  const zoneOpts = [{ value: '', label: t('impr_all_zones') }, ...zones.filter((z) => z.storeId === activeStoreId).sort((a, b) => a.code.localeCompare(b.code, 'fr')).map((z) => ({ value: z.id, label: `${z.code}${z.name ? ' · ' + z.name : ''}` }))]
  const levelOpts: { value: LevelKey; label: string }[] = [
    { value: 'zone', label: t('wms_zone') },
    { value: 'allee', label: t('wms_allee') },
    { value: 'rayon', label: t('wms_rayon') },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4 no-print">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Printer className="h-6 w-6 text-amber-500" />
            {t('impr_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('impr_subtitle')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <button onClick={() => window.print()} disabled={groups.length === 0} className="btn-primary disabled:opacity-50">
          <Printer className="h-4 w-4" />{t('impr_print')}
        </button>
      </motion.div>

      {/* Options */}
      <div className="glass-card flex flex-wrap items-end gap-4 p-4 no-print">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('impr_group_by')}</span>
          <div className="w-44"><Select value={level} onChange={(v) => setLevel(v as LevelKey)} options={levelOpts} /></div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('impr_zone')}</span>
          <div className="w-56"><Select value={zoneFilter} onChange={setZoneFilter} options={zoneOpts} /></div>
        </label>
        <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm text-gray-600 dark:text-zinc-400">
          <input type="checkbox" checked={onlyReappro} onChange={(e) => setOnlyReappro(e.target.checked)} className="h-4 w-4 accent-amber-500" />
          {t('impr_only_reappro')}
        </label>
        <span className="ml-auto pb-2.5 text-sm font-semibold text-gray-500 dark:text-zinc-400 tabular-nums">
          {located.length} {t('impr_products')} · {groups.length} {t('impr_sections')}
        </span>
      </div>

      {/* Aperçu / impression */}
      <div className="print-area space-y-5">
        <div className="hidden print:block">
          <h2 className="text-xl font-bold">{t('impr_title')} — {activeStore?.name}</h2>
          <p className="text-sm text-gray-500">{t('impr_group_by')} : {levelOpts.find((l) => l.value === level)?.label}</p>
        </div>

        {groups.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-3 p-12 text-center no-print">
            <Package className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('impr_none')}</p>
          </div>
        ) : (
          groups.map((g, gi) => (
            <div key={gi} className="glass-card overflow-hidden print:break-inside-avoid">
              <div className="flex items-center gap-2 border-b border-gray-100 bg-amber-50/60 px-5 py-2.5 dark:border-white/10 dark:bg-amber-500/10">
                <MapPin className="h-4 w-4 text-amber-500" />
                <span className="font-mono text-sm font-bold text-amber-700 dark:text-amber-300">{g.title}</span>
                <span className="ml-auto text-xs font-semibold text-gray-400 dark:text-zinc-500 tabular-nums">{g.items.length}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                    <th className="px-5 py-2">{t('wms_emplacement')}</th>
                    <th className="px-5 py-2">{t('impr_col_product')}</th>
                    <th className="px-5 py-2 text-center">{t('impr_col_stock')}</th>
                    <th className="px-5 py-2 text-center">{t('impr_col_min')}</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((p) => {
                    const s = availableStock(p)
                    return (
                      <tr key={p.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                        <td className="px-5 py-2 font-mono text-xs text-amber-600 dark:text-amber-400">{p.emplacementComplet}</td>
                        <td className="px-5 py-2">
                          <span className="font-semibold text-gray-900 dark:text-white">{p.name}</span>
                          <span className="ml-2 font-mono text-[11px] text-gray-400 dark:text-zinc-500">{p.barcode}</span>
                        </td>
                        <td className={`px-5 py-2 text-center font-bold tabular-nums ${s === 0 ? 'text-rose-500' : s <= p.minStock ? 'text-amber-500' : 'text-gray-700 dark:text-zinc-300'}`}>{s}</td>
                        <td className="px-5 py-2 text-center tabular-nums text-gray-500 dark:text-zinc-400">{p.minStock}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </>
  )
}

export default function ImpressionPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
