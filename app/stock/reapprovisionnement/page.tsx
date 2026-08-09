'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { ClipboardList, MapPin, PackageSearch, Printer, Search } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/auth-context'
import { effectivePermissions, type RoleName } from '@/lib/permissions'
import { availableStock, fmtDH, useDroguerie, type PurchaseRequestItem } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, products, activeStore, locationSortKey, settings, addPurchaseRequest } = useDroguerie()
  const { session, currentUser } = useAuth()
  const { t } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [onlyLocated, setOnlyLocated] = useState(false)
  const [selection, setSelection] = useState<Set<string>>(new Set())

  // Produits sous le seuil (rupture ou faible), triés par emplacement physique.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products
      .filter((p) => availableStock(p) <= p.minStock)
      .filter((p) => !onlyLocated || p.emplacementComplet)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q) || (p.emplacementComplet ?? '').toLowerCase().includes(q))
      .sort((a, b) => locationSortKey(a).localeCompare(locationSortKey(b), 'fr') || a.name.localeCompare(b.name, 'fr'))
  }, [products, query, onlyLocated, locationSortKey])

  if (!ready) return <Loader />

  const needed = (stock: number, min: number) => Math.max(0, min - stock)

  /*
   * Le tableau est plafonne a 300 lignes pour ne pas figer le navigateur :
   * « tout selectionner » ne porte donc QUE sur ce qui est affiche. Selectionner
   * en silence 14 000 lignes invisibles fabriquerait une demande que personne
   * n'a relue.
   */
  const affichees = rows.slice(0, 300)
  const toutSelectionne = affichees.length > 0 && affichees.every((p) => selection.has(p.id))

  const basculer = (id: string) =>
    setSelection((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const choisis = rows.filter((p) => selection.has(p.id))
  const coutChoisi = choisis.reduce((a, p) => a + needed(availableStock(p), p.minStock) * p.cost, 0)

  // Demander est une permission d'ACHAT, pas de stock : le magasinier qui voit
  // la rupture n'est pas forcement celui qui engage la commande.
  const peutDemander = effectivePermissions(
    currentUser?.permissions,
    (session?.role ?? 'Vendeur') as RoleName,
    settings.rolePermissions
  ).has('purch.request')

  const creerDemande = () => {
    const items: PurchaseRequestItem[] = choisis
      .map((p) => ({
        productId: p.id,
        name: p.name,
        barcode: p.barcode || undefined,
        // Quantite manquante pour revenir au seuil, en unite de STOCK.
        qty: needed(availableStock(p), p.minStock),
      }))
      .filter((i) => i.qty > 0)
    if (items.length === 0) {
      toast(t('reappro_toast_nothing'), 'error')
      return
    }
    const r = addPurchaseRequest({ items, motif: t('reappro_da_motif') })
    toast(`✓ ${r?.ref ?? ''} ${t('reappro_toast_da_created')}`)
    setSelection(new Set())
    router.push('/achats/demandes')
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4 no-print">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <PackageSearch className="h-6 w-6 text-amber-500" />
            {t('reappro_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('reappro_subtitle')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => window.print()} disabled={rows.length === 0} className="btn-secondary disabled:opacity-50">
            <Printer className="h-4 w-4" />
            {t('reappro_print')}
          </button>
          {peutDemander && (
            <button onClick={creerDemande} disabled={choisis.length === 0} className="btn-primary disabled:opacity-40">
              <ClipboardList className="h-4 w-4" />
              {t('reappro_create_da')}
              {choisis.length > 0 && <span className="tabular-nums"> ({choisis.length})</span>}
            </button>
          )}
        </div>
      </motion.div>

      <div className="flex flex-wrap items-center gap-3 no-print">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('reappro_search')} className="input-field pl-10" />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-zinc-400">
          <input type="checkbox" checked={onlyLocated} onChange={(e) => setOnlyLocated(e.target.checked)} className="h-4 w-4 accent-amber-500" />
          {t('reappro_only_located')}
        </label>
        <span className="ml-auto text-sm font-semibold text-gray-500 dark:text-zinc-400 tabular-nums">{rows.length} {t('reappro_count')}</span>
      </div>

      {choisis.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-sm dark:border-amber-500/20 dark:bg-amber-500/10 no-print">
          <span className="font-semibold text-amber-800 dark:text-amber-300 tabular-nums">
            {choisis.length} {t('reappro_selected')}
          </span>
          <span className="text-amber-700 dark:text-amber-400 tabular-nums">{fmtDH(coutChoisi)}</span>
          <button onClick={() => setSelection(new Set())} className="ml-auto text-xs font-semibold text-amber-700 underline dark:text-amber-400">
            {t('reappro_clear_selection')}
          </button>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card print-area overflow-hidden">
        <div className="hidden print:block px-5 pt-4 text-lg font-bold">{t('reappro_title')} — {activeStore?.name}</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="w-10 px-5 py-3 no-print">
                  <input
                    type="checkbox"
                    checked={toutSelectionne}
                    onChange={(e) =>
                      setSelection((s) => {
                        const n = new Set(s)
                        affichees.forEach((p) => (e.target.checked ? n.add(p.id) : n.delete(p.id)))
                        return n
                      })
                    }
                    title={t('reappro_select_visible')}
                    className="h-4 w-4 accent-amber-500"
                  />
                </th>
                <th className="px-5 py-3">{t('wms_emplacement')}</th>
                <th className="px-5 py-3">{t('reappro_col_product')}</th>
                <th className="px-5 py-3 text-center">{t('reappro_col_stock')}</th>
                <th className="px-5 py-3 text-center">{t('reappro_col_min')}</th>
                <th className="px-5 py-3 text-center">{t('reappro_col_needed')}</th>
                <th className="px-5 py-3 text-right">{t('reappro_col_cost')}</th>
              </tr>
            </thead>
            <tbody>
              {affichees.map((p) => {
                const s = availableStock(p)
                return (
                  <tr key={p.id} className={`border-b border-gray-50 last:border-0 dark:border-white/5 hover:bg-amber-50/40 dark:hover:bg-white/5 ${selection.has(p.id) ? 'bg-amber-50/60 dark:bg-amber-500/[0.07]' : ''}`}>
                    <td className="px-5 py-2.5 no-print">
                      <input
                        type="checkbox"
                        checked={selection.has(p.id)}
                        onChange={() => basculer(p.id)}
                        className="h-4 w-4 accent-amber-500"
                      />
                    </td>
                    <td className="px-5 py-2.5">
                      {p.emplacementComplet
                        ? <span className="flex items-center gap-1 font-mono text-xs text-amber-600 dark:text-amber-400"><MapPin className="h-3 w-3" />{p.emplacementComplet}</span>
                        : <span className="text-xs text-gray-300 dark:text-zinc-600">{t('reappro_no_location')}</span>}
                    </td>
                    <td className="px-5 py-2.5">
                      <p className="font-semibold text-gray-900 dark:text-white">{p.name}</p>
                      <p className="font-mono text-[11px] text-gray-400 dark:text-zinc-500">{p.barcode || '—'}</p>
                    </td>
                    <td className={`px-5 py-2.5 text-center font-bold tabular-nums ${s === 0 ? 'text-rose-500' : 'text-amber-500'}`}>{s}</td>
                    <td className="px-5 py-2.5 text-center tabular-nums text-gray-500 dark:text-zinc-400">{p.minStock}</td>
                    <td className="px-5 py-2.5 text-center font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+{needed(s, p.minStock)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-gray-600 dark:text-zinc-400">{fmtDH(needed(s, p.minStock) * p.cost)}</td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('reappro_none')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Le tableau est plafonné pour ne pas figer le navigateur ; le dire
            évite de prendre une liste tronquée pour la liste complète. */}
        {rows.length > 300 && (
          <p className="border-t border-gray-100 px-4 py-2 text-center text-[11px] text-gray-400 dark:border-white/10 dark:text-zinc-500">
            300 / {rows.length.toLocaleString('fr-FR')} — {t('rpst_capped')}
          </p>
        )}
      </motion.div>
    </>
  )
}

export default function ReapproPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
