'use client'

import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Building2, Check, Package, Pencil, Plus, Save, Trash2, TrendingUp, Users, Warehouse } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import StoreForm, { storeToForm, type StoreFormValues } from '@/components/StoreForm'
import { useToast } from '@/components/Toast'
import { fmtDH, useDroguerie, type Store } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, stores, activeStoreId, allProducts, allSales, allPurchases, updateStore, deleteStore, switchStore } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [editing, setEditing] = useState<Store | null>(null)
  const [form, setForm] = useState<StoreFormValues | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Store | null>(null)

  const stats = useMemo(() => {
    const map: Record<string, { products: number; stockValue: number; ca: number; clients: number; suppliers: number; outOfStock: number }> = {}
    stores.forEach((s) => {
      const prods = allProducts.filter((p) => p.storeId === s.id)
      const sales = allSales.filter((x) => x.storeId === s.id)
      const purch = allPurchases.filter((x) => x.storeId === s.id)
      map[s.id] = {
        products: prods.length,
        stockValue: prods.reduce((a, p) => a + p.cost * p.stock, 0),
        ca: sales.reduce((a, x) => a + x.total, 0),
        clients: new Set(sales.map((x) => x.clientId).filter(Boolean)).size,
        suppliers: new Set(purch.map((x) => x.supplierId).filter(Boolean)).size,
        outOfStock: prods.filter((p) => p.stock <= 0).length,
      }
    })
    return map
  }, [stores, allProducts, allSales, allPurchases])

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const openEdit = (s: Store) => {
    setEditing(s)
    setForm(storeToForm(s))
  }

  const saveEdit = () => {
    if (!editing || !form) return
    updateStore(editing.id, { ...form })
    toast(t('mag_saved'))
    setEditing(null)
    setForm(null)
  }

  const doDelete = () => {
    if (!confirmDelete) return
    if (stores.length <= 1) {
      toast(t('mag_delete_last'))
      setConfirmDelete(null)
      return
    }
    deleteStore(confirmDelete.id)
    toast(t('mag_delete'))
    setConfirmDelete(null)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Building2 className="h-6 w-6 text-amber-500" />
            {t('mag_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('mag_subtitle')}</p>
        </div>
        <Link href="/magasins/nouveau" className="btn-primary">
          <Plus className="h-4 w-4" />
          {t('mag_new')}
        </Link>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stores.map((s, i) => {
          const st = stats[s.id]
          const isActive = s.id === activeStoreId
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.35 }}
              className={`glass-card flex flex-col overflow-hidden ${isActive ? 'ring-2 ring-amber-400/60' : ''}`}
            >
              <div className="flex items-start gap-3 border-b border-gray-100 p-5 dark:border-white/10">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-gray-900">
                  {s.logoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logoDataUrl} alt={s.name} className="h-full w-full object-contain" />
                  ) : (
                    <Building2 className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-bold text-gray-900 dark:text-white">{s.name}</h3>
                    {isActive && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">{t('mag_current')}</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
                    <span className="font-mono font-semibold">{s.code}</span>
                    {s.city ? ` · ${s.city}` : ''}
                  </p>
                  <span className={`mt-1.5 inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${s.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400' : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400'}`}>
                    {s.active ? t('mag_active') : t('mag_inactive')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-px bg-gray-100 dark:bg-white/5">
                <Stat icon={<Package className="h-3.5 w-3.5" />} label={t('mag_stat_products')} value={String(st?.products ?? 0)} />
                <Stat icon={<Warehouse className="h-3.5 w-3.5" />} label={t('mag_stat_stock_value')} value={fmtDH(st?.stockValue ?? 0)} />
                <Stat icon={<TrendingUp className="h-3.5 w-3.5" />} label={t('mag_stat_ca')} value={fmtDH(st?.ca ?? 0)} />
                <Stat icon={<Users className="h-3.5 w-3.5" />} label={t('mag_stat_clients')} value={String(st?.clients ?? 0)} />
              </div>

              <div className="mt-auto flex items-center gap-2 p-4">
                {isActive ? (
                  <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-50 py-2 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                    <Check className="h-4 w-4" />
                    {t('mag_current')}
                  </span>
                ) : (
                  <button onClick={() => switchStore(s.id)} className="btn-secondary flex-1 justify-center">
                    {t('mag_open')}
                  </button>
                )}
                <button onClick={() => openEdit(s)} className="rounded-xl border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white" title={t('mag_edit_title')}>
                  <Pencil className="h-4 w-4" />
                </button>
                {stores.length > 1 && (
                  <button onClick={() => setConfirmDelete(s)} className="rounded-xl border border-rose-200 p-2 text-rose-500 transition hover:bg-rose-50 dark:border-rose-500/20 dark:hover:bg-rose-500/10" title={t('mag_delete')}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={t('mag_edit_title')} maxWidth="max-w-3xl">
        {form && <StoreForm value={form} onChange={setForm} />}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setEditing(null)} className="btn-secondary">{t('mag_cancel')}</button>
          <button onClick={saveEdit} className="btn-primary">
            <Save className="h-4 w-4" />
            {t('mag_save')}
          </button>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={t('mag_delete')}>
        <p className="text-sm text-gray-600 dark:text-zinc-300">{t('mag_delete_confirm')}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setConfirmDelete(null)} className="btn-secondary">{t('mag_cancel')}</button>
          <button onClick={doDelete} className="btn-danger">
            <Trash2 className="h-4 w-4" />
            {t('mag_delete')}
          </button>
        </div>
      </Modal>
    </>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3 dark:bg-[#12121a]">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
        {icon}
        {label}
      </span>
      <p className="mt-1 truncate text-sm font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  )
}

export default function MagasinsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
