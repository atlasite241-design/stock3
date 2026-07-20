'use client'

import React, { useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, Plus, Save, Search, Trash2, X } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { availableStock, useDroguerie, type TransferItem } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, stores, depots, users, allProducts, activeStoreId, addTransfer } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const router = useRouter()

  const otherStore = stores.find((s) => s.id !== activeStoreId)
  const [sourceStoreId, setSourceStoreId] = useState(activeStoreId)
  const [sourceDepotId, setSourceDepotId] = useState('')
  const [destStoreId, setDestStoreId] = useState(otherStore?.id ?? '')
  const [destDepotId, setDestDepotId] = useState('')
  const [user, setUser] = useState(users.find((u) => u.active)?.name ?? 'Yassir A.')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<TransferItem[]>([])
  const [search, setSearch] = useState('')

  const sourceProducts = useMemo(() => allProducts.filter((p) => p.storeId === sourceStoreId), [allProducts, sourceStoreId])

  if (!ready) {
    return <Loader />
  }

  const sourceDepots = depots.filter((d) => d.storeId === sourceStoreId)
  const destDepots = depots.filter((d) => d.storeId === destStoreId)
  const availableOf = (productId: string) => {
    const p = sourceProducts.find((x) => x.id === productId)
    return p ? availableStock(p) : 0
  }

  const matches =
    search.trim().length > 0
      ? sourceProducts
          .filter((p) => {
            const q = search.toLowerCase()
            return (p.name.toLowerCase().includes(q) || p.barcode.includes(q)) && !items.some((i) => i.productId === p.id)
          })
          .slice(0, 8)
      : []

  const addItem = (productId: string) => {
    const p = sourceProducts.find((x) => x.id === productId)
    if (!p) return
    setItems((prev) => [
      ...prev,
      { productId: p.id, barcode: p.barcode, sku: p.barcode, name: p.name, cost: p.cost, lot: p.lot, serial: p.serial, requestedQty: 1, transferredQty: 0 },
    ])
    setSearch('')
  }

  const setQty = (productId: string, qty: number) => {
    const max = availableOf(productId)
    const clamped = Math.max(0, Math.min(qty, max))
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, requestedQty: clamped } : i)))
  }

  const removeItem = (productId: string) => setItems((prev) => prev.filter((i) => i.productId !== productId))

  const sameLocation = sourceStoreId === destStoreId && (sourceDepotId || '') === (destDepotId || '')
  const anyOverStock = items.some((i) => i.requestedQty > availableOf(i.productId))
  const canSave = items.length > 0 && !!destStoreId && !sameLocation && !anyOverStock && items.every((i) => i.requestedQty > 0)

  const save = () => {
    if (sameLocation) return toast(t('trf_err_same'), 'error')
    if (items.length === 0) return toast(t('trf_err_no_items'), 'error')
    if (anyOverStock) return toast(t('trf_err_insufficient'), 'error')
    const res = addTransfer({ sourceStoreId, sourceDepotId: sourceDepotId || undefined, destStoreId, destDepotId: destDepotId || undefined, user, note, items })
    if ('error' in res) {
      toast(res.error === 'same_location' ? t('trf_err_same') : t('trf_err_insufficient'), 'error')
      return
    }
    toast(t('trf_created'))
    router.push('/stock/transferts')
  }

  const storeOptions = stores.map((s) => ({ value: s.id, label: s.name }))

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <ArrowLeftRight className="h-6 w-6 text-amber-500" />
          {t('trf_new_title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('trf_subtitle')}</p>
      </motion.div>

      {/* General info */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">{t('trf_general_info')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label={t('trf_number')}>
            <input className="input-field text-gray-400" value={t('trf_number') + ' · Auto'} disabled readOnly />
          </Field>
          <Field label={t('trf_source')}>
            <Select value={sourceStoreId} onChange={(v) => { setSourceStoreId(v); setSourceDepotId(''); setItems([]) }} options={storeOptions} />
          </Field>
          <Field label={t('trf_dest')}>
            <Select value={destStoreId} onChange={(v) => { setDestStoreId(v); setDestDepotId('') }} options={storeOptions} placeholder={t('trf_dest_short')} />
          </Field>
          {sourceDepots.length > 0 && (
            <Field label={`${t('trf_source_short')} · ${t('dep_title')}`}>
              <Select value={sourceDepotId} onChange={setSourceDepotId} options={[{ value: '', label: '—' }, ...sourceDepots.map((d) => ({ value: d.id, label: d.name }))]} />
            </Field>
          )}
          {destDepots.length > 0 && (
            <Field label={`${t('trf_dest_short')} · ${t('dep_title')}`}>
              <Select value={destDepotId} onChange={setDestDepotId} options={[{ value: '', label: '—' }, ...destDepots.map((d) => ({ value: d.id, label: d.name }))]} />
            </Field>
          )}
          <Field label={t('trf_user')}>
            <Select value={user} onChange={setUser} options={users.map((u) => ({ value: u.name, label: u.name }))} />
          </Field>
          <label className="block sm:col-span-2 xl:col-span-3">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('trf_note')}</span>
            <input className="input-field" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
        {sameLocation && <p className="mt-3 text-xs font-semibold text-rose-500">{t('trf_err_same')}</p>}
      </motion.div>

      {/* Products */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="glass-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('trf_products')}</h2>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('trf_search_product')}
              className="input-field pl-9"
            />
            {matches.length > 0 && (
              <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#12121a]">
                {matches.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addItem(p.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-amber-50 dark:hover:bg-amber-500/10"
                  >
                    <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-zinc-100">{p.name}</span>
                    <span className="shrink-0 text-xs text-gray-400">{availableStock(p)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-3 py-2.5">{t('trf_col_barcode')}</th>
                <th className="px-3 py-2.5">{t('trf_col_name')}</th>
                <th className="px-3 py-2.5 text-right">{t('trf_col_available')}</th>
                <th className="px-3 py-2.5 text-right">{t('trf_col_requested')}</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const avail = availableOf(it.productId)
                const over = it.requestedQty > avail
                return (
                  <tr key={it.productId} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                    <td className="px-3 py-2 font-mono text-xs text-gray-500 dark:text-zinc-400">{it.barcode || '—'}</td>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{it.name}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${avail <= 0 ? 'text-rose-500' : 'text-gray-700 dark:text-zinc-300'}`}>{avail}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        max={avail}
                        value={it.requestedQty}
                        onChange={(e) => setQty(it.productId, Number(e.target.value))}
                        className={`input-field h-9 w-20 text-right ${over ? 'border-rose-400 text-rose-500' : ''}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeItem(it.productId)} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-xs text-gray-400 dark:text-zinc-500">
                    <Plus className="mx-auto mb-1 h-5 w-5 opacity-40" />
                    {t('trf_add_product')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {anyOverStock && <p className="mt-3 text-xs font-semibold text-rose-500">{t('trf_err_qty')}</p>}
      </motion.div>

      <div className="flex justify-end gap-2">
        <button onClick={() => router.push('/stock/transferts')} className="btn-secondary">
          <X className="h-4 w-4" />
          {t('trf_cancel')}
        </button>
        <button onClick={save} disabled={!canSave} className="btn-primary disabled:opacity-50">
          <Save className="h-4 w-4" />
          {t('trf_save_draft')}
        </button>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  )
}

export default function NouveauTransfertPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
