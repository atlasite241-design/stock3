'use client'

import { useSearchParams } from 'next/navigation'

import { useEffect, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { ArrowDownCircle, ArrowUpCircle, Plus, Search, SlidersHorizontal } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import Pagination from '@/components/Pagination'
import { MOVEMENT_META, roundQty, useDroguerie, type StockMovement } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

type TypeFilter = 'tous' | StockMovement['type']

function Content() {
  const { ready, products, movements, addMovement } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [filter, setFilter] = useState<TypeFilter>('tous')
  const [query, setQuery] = useState('')
  const [productId, setProductId] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ type: 'entree' as 'entree' | 'sortie' | 'ajustement', productId: '', qty: '1', sens: '+', note: '' })

  // Relu a chaque changement d'URL : « Entrees » puis « Sorties » depuis le
  // menu restaient sur le meme filtre, le composant n'etant pas remonte.
  const typeParam = useSearchParams().get('type')
  useEffect(() => {
    if (typeParam === 'entree' || typeParam === 'sortie' || typeParam === 'ajustement') {
      setFilter(typeParam)
      setForm((f) => ({ ...f, type: typeParam }))
    } else {
      setFilter('tous')
    }
  }, [typeParam])

  if (!ready) {
    return <Loader />
  }

  const filters: { key: TypeFilter; label: string }[] = [
    { key: 'tous', label: t('mv_filter_all') },
    { key: 'entree', label: t('mv_filter_in') },
    { key: 'sortie', label: t('mv_filter_out') },
    { key: 'ajustement', label: t('mv_filter_adjust') },
    { key: 'vente', label: t('mv_filter_sales') },
    { key: 'reception', label: t('mv_filter_receptions') },
    { key: 'retour', label: t('mv_filter_returns') },
    { key: 'inventaire', label: t('mv_filter_inventory') },
  ]

  /*
   * SOLDE COURANT : quand un article est choisi, chaque ligne montre le stock
   * APRÈS le mouvement. Il se déroule à rebours depuis le stock actuel — et il
   * se calcule sur TOUS les mouvements de l'article, avant les autres filtres,
   * sinon une recherche qui masque des lignes fausserait la colonne.
   */
  const produitChoisi = productId ? products.find((p) => p.id === productId) : null
  let annotes: (StockMovement & { solde?: number })[] = movements
  if (produitChoisi) {
    let solde = produitChoisi.stock
    annotes = movements
      .filter((m) => m.productId === productId)
      .map((m) => {
        const ligne = { ...m, solde }
        solde = roundQty(solde - m.qty)
        return ligne
      })
  }

  const visible = annotes.filter((m) => {
    // Le réapprovisionnement est une entrée de stock → il apparaît aussi sous « Entrées ».
    const okType = filter === 'tous' || m.type === filter || (filter === 'entree' && m.type === 'reappro')
    const q = query.trim().toLowerCase()
    return okType && (!q || m.productName.toLowerCase().includes(q) || m.note.toLowerCase().includes(q) || (m.user ?? '').toLowerCase().includes(q))
  })
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const submit = () => {
    if (!form.productId) {
      toast(t('mv_toast_choose_product'), 'error')
      return
    }
    const p = products.find((x) => x.id === form.productId)
    if (!p) return
    const qty = Math.max(1, Math.round(parseFloat(form.qty.replace(',', '.')) || 0))
    let signed = qty
    if (form.type === 'sortie') signed = -qty
    if (form.type === 'ajustement' && form.sens === '-') signed = -qty
    if (signed < 0 && qty > p.stock) {
      toast(`${t('mv_toast_insufficient')} ${p.name} ${t('mv_toast_only_has')} ${p.stock} ${t('mv_toast_in_stock')}`, 'error')
      return
    }
    addMovement(form.productId, form.type, signed, form.note.trim() || (form.type === 'entree' ? t('mv_note_manual_in') : form.type === 'sortie' ? t('mv_note_manual_out') : t('mv_note_manual_adjust')))
    toast(`✓ ${MOVEMENT_META[form.type].label} ${t('mv_toast_recorded')} ${p.name} (${signed > 0 ? '+' : ''}${signed})`)
    setModalOpen(false)
    setForm({ ...form, qty: '1', note: '' })
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            {t('mv_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('mv_subtitle')}
          </p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          {t('mv_new')}
        </button>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              filter === f.key
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-lg shadow-amber-400/25'
                : 'border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 hover:border-amber-300 hover:bg-amber-50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex min-w-[200px] flex-wrap items-center gap-2">
          <Select
            value={productId}
            onChange={(v) => { setProductId(v); setPage(1) }}
            placeholder={t('mv_all_products')}
            options={[
              { value: '', label: t('mv_all_products') },
              ...products.map((p) => ({ value: p.id, label: p.name })),
            ]}
            className="w-auto min-w-[200px]"
          />
          <div className="relative min-w-[180px]">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1) }}
              placeholder={t('mv_search_placeholder')}
              className="input-field pl-10"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('mv_col_date')}</th>
                <th className="px-5 py-3.5">{t('mv_col_product')}</th>
                <th className="px-5 py-3.5">{t('mv_col_type')}</th>
                <th className="px-5 py-3.5">{t('mv_col_qty')}</th>
                {produitChoisi && <th className="px-5 py-3.5 text-right">{t('mv_col_balance')}</th>}
                <th className="px-5 py-3.5">{t('mv_col_user')}</th>
                <th className="px-5 py-3.5">{t('mv_col_note')}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((m) => (
                <tr key={m.id} className="border-b border-gray-50 transition-colors hover:bg-amber-50/40">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {new Date(m.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">
                      {new Date(m.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-white">{m.productName}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${MOVEMENT_META[m.type].chip}`}>
                      {MOVEMENT_META[m.type].label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 text-sm font-bold tabular-nums ${
                        m.qty >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                      }`}
                    >
                      {m.qty >= 0 ? (
                        <ArrowUpCircle className="h-4 w-4" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4" />
                      )}
                      {m.qty > 0 ? `+${m.qty}` : m.qty}
                    </span>
                  </td>
                  {produitChoisi && (
                    <td className={`px-5 py-3.5 text-right text-sm font-bold tabular-nums ${(m.solde ?? 0) < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>
                      {m.solde}
                    </td>
                  )}
                  <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-zinc-400">{m.user || '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-zinc-400">{m.note || '—'}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={produitChoisi ? 7 : 6} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('mv_none')}
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

      {/* New movement modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('mv_new_title')}>
        <div className="space-y-4">
          <div>
            <label className="field-label">{t('mv_type_label')}</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'entree' as const, label: t('mv_type_in_short') },
                { key: 'sortie' as const, label: t('mv_type_out_short') },
                { key: 'ajustement' as const, label: t('mv_type_adjust_short') },
              ].map((nt) => (
                <button
                  key={nt.key}
                  onClick={() => setForm({ ...form, type: nt.key })}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold transition ${
                    form.type === nt.key
                      ? 'border-amber-400 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300'
                      : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-500 dark:text-zinc-400 hover:border-amber-200'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {nt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label">{t('mv_product_required')}</label>
            <Select
              value={form.productId}
              onChange={(v) => setForm({ ...form, productId: v })}
              placeholder={t('mv_choose_product')}
              options={[
                { value: '', label: t('mv_choose_product') },
                ...products.map((p) => ({ value: p.id, label: `${p.name} (${t('mv_stock_label')} ${p.stock})` })),
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">{t('mv_qty_label')}</label>
              <input
                type="number"
                min="1"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
                className="input-field"
              />
            </div>
            {form.type === 'ajustement' && (
              <div>
                <label className="field-label">{t('mv_direction')}</label>
                <Select
                  value={form.sens}
                  onChange={(v) => setForm({ ...form, sens: v })}
                  options={[
                    { value: '+', label: t('mv_add') },
                    { value: '-', label: t('mv_remove') },
                  ]}
                />
              </div>
            )}
          </div>
          <div>
            <label className="field-label">{t('mv_col_note')}</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={t('mv_note_placeholder')}
              className="input-field"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">
              {t('mv_cancel')}
            </button>
            <button onClick={submit} className="btn-primary">
              {t('mv_save')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default function MouvementsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
