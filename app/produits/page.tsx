'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Package, Pencil, Plus, Printer, Scissors, Search, Trash2, Wand2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import ProductImage from '@/components/ProductImage'
import CameraScanner from '@/components/CameraScanner'
import { generateEan13 } from '@/components/EAN13'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { exportProductsCSVAsync, fmtDH, useDroguerie, type Product } from '@/lib/store'
import { removeWhiteBackground } from '@/lib/image'
import { useLanguage } from '@/lib/i18n'

const EMPTY_FORM = {
  name: '',
  barcode: '',
  category: '',
  subcategory: '',
  brand: '',
  unit: 'Pièce',
  price: '',
  cost: '',
  stock: '',
  minStock: '5',
  image: '',
}

function ProduitsContent() {
  const { ready, products, categories, subcategories, brands, units, addProduct, updateProduct, deleteProduct } =
    useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Tous')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [exportPct, setExportPct] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const urlConsumed = useRef(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const runExport = async () => {
    if (exportPct !== null) return
    setExportPct(0)
    try {
      await exportProductsCSVAsync(products, (p) => setExportPct(p))
      toast(`✓ ${products.length} ${t('prod_catalog_count')}`)
    } finally {
      setTimeout(() => setExportPct(null), 400)
    }
  }

  useEffect(() => {
    if (urlConsumed.current) return
    urlConsumed.current = true
    const sp = new URLSearchParams(window.location.search)
    const q = sp.get('q')
    if (q) setQuery(q)
    if (sp.get('new') === '1') {
      setEditingId(null)
      const barcode = sp.get('barcode')
      setForm(barcode ? { ...EMPTY_FORM, barcode } : EMPTY_FORM)
      setModalOpen(true)
    }
  }, [])

  const catFilters = useMemo(
    () => ['Tous', ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      const okCat = category === 'Tous' || p.category === category
      const okQuery = !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.brand.toLowerCase().includes(q)
      return okCat && okQuery
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, query, category])

  // Pagination : indispensable pour les gros catalogues (ne pas rendre 50 000 lignes).
  const PAGE_SIZE = 50
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [query, category])

  const openAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (p: Product) => {
    setEditingId(p.id)
    setForm({
      name: p.name,
      barcode: p.barcode,
      category: p.category,
      subcategory: p.subcategory ?? '',
      brand: p.brand,
      unit: p.unit,
      price: String(p.price),
      cost: String(p.cost),
      stock: String(p.stock),
      minStock: String(p.minStock),
      image: p.image ?? '',
    })
    setModalOpen(true)
  }

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, image: String(reader.result) }))
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const cutoutImage = async () => {
    if (!form.image) return
    const out = await removeWhiteBackground(form.image)
    setForm((f) => ({ ...f, image: out }))
    toast(`✓ ${t('prod_photo_cutout_done')}`)
  }

  const num = (v: string) => parseFloat(v.replace(',', '.')) || 0

  const saveForm = () => {
    if (!form.name.trim()) {
      toast(t('prod_toast_name_required'), 'error')
      return
    }
    if (num(form.price) <= 0) {
      toast(t('prod_toast_price_required'), 'error')
      return
    }
    const data = {
      name: form.name.trim(),
      barcode: form.barcode.trim(),
      category: form.category.trim() || 'Divers',
      subcategory: form.subcategory.trim(),
      brand: form.brand.trim(),
      unit: form.unit.trim() || 'Pièce',
      price: num(form.price),
      cost: num(form.cost),
      stock: Math.max(0, Math.round(num(form.stock))),
      minStock: Math.max(0, Math.round(num(form.minStock))),
      image: form.image || undefined,
    }
    if (editingId) {
      updateProduct(editingId, data)
      toast(`✓ ${data.name} ${t('prod_toast_modified')}`)
    } else {
      addProduct(data)
      toast(`✓ ${data.name} ${t('prod_toast_added')}`)
    }
    setModalOpen(false)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteProduct(deleteTarget.id)
    toast(`${deleteTarget.name} ${t('prod_toast_deleted')}`)
    setDeleteTarget(null)
  }

  if (!ready) {
    return <Loader />
  }

  const stockBadge = (p: Product) =>
    p.stock === 0
      ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
      : p.stock <= p.minStock
        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'

  return (
    <>
      {exportPct !== null && (
        <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-2xl border border-amber-200 bg-white/95 p-4 shadow-2xl backdrop-blur dark:border-amber-500/25 dark:bg-[#12121a]/95">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-900 dark:text-white">{t('prod_export_csv')}…</span>
            <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">{exportPct}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all" style={{ width: `${exportPct}%` }} />
          </div>
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('prod_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{products.length} {t('prod_catalog_count')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer className="h-4 w-4" />
            {t('prod_print')}
          </button>
          <button onClick={runExport} disabled={exportPct !== null} className="btn-secondary disabled:opacity-60">
            {exportPct !== null ? `${t('prod_export_csv')}… ${exportPct}%` : t('prod_export_csv')}
          </button>
          <button onClick={openAdd} className="btn-primary">
            <Plus className="h-4 w-4" />
            {t('prod_add')}
          </button>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('prod_search_placeholder')}
            className="input-field pl-10"
          />
        </div>
        <Select
          value={category}
          onChange={setCategory}
          options={catFilters.map((c) => ({ value: c, label: c === 'Tous' ? t('prod_all') : c }))}
          className="w-auto min-w-[160px]"
        />
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="glass-card print-area overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('prod_col_product')}</th>
                <th className="px-5 py-3.5">{t('prod_col_category')}</th>
                <th className="px-5 py-3.5">{t('prod_col_subcategory')}</th>
                <th className="px-5 py-3.5">{t('prod_col_brand_unit')}</th>
                <th className="px-5 py-3.5">{t('prod_col_buy_price')}</th>
                <th className="px-5 py-3.5">{t('prod_col_sell_price')}</th>
                <th className="px-5 py-3.5">{t('prod_col_margin')}</th>
                <th className="px-5 py-3.5">{t('prod_col_stock')}</th>
                <th className="px-5 py-3.5 text-right">{t('prod_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p) => (
                <tr key={p.id} className="group border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-gray-900">
                        <Package className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
                        <p className="font-mono text-xs text-gray-400 dark:text-zinc-500">{p.barcode || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-md bg-gray-100 dark:bg-white/10 px-2 py-1 text-xs font-semibold text-gray-600 dark:text-zinc-400">
                      {p.category}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs text-gray-500 dark:text-zinc-400">{p.subcategory || '—'}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">{p.brand || '—'}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">{p.unit}</p>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">{fmtDH(p.cost)}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                    {fmtDH(p.price)}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {p.cost > 0 ? `${(((p.price - p.cost) / p.cost) * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${stockBadge(p)}`}>
                      {p.stock === 0 ? t('prod_out_of_stock') : `${p.stock} ${p.unit}`}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-400"
                        title={t('prod_edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="rounded-lg p-2 text-gray-400 dark:text-zinc-500 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                        title={t('prod_delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('prod_none_found')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-white/10">
            <p className="text-xs text-gray-500 dark:text-zinc-400 tabular-nums">{filtered.length} · {safePage}/{pageCount}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={safePage === 1} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-500 disabled:opacity-40 dark:border-white/10">«</button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40 dark:border-white/10"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={safePage === pageCount} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40 dark:border-white/10"><ChevronRight className="h-4 w-4" /></button>
              <button onClick={() => setPage(pageCount)} disabled={safePage === pageCount} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-500 disabled:opacity-40 dark:border-white/10">»</button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Add / edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? t('prod_edit_title') : t('prod_add_title')}
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">{t('prod_photo_label')}</label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-black">
                <ProductImage image={form.image || undefined} category={form.category} iconSize="h-7 w-7" />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => imageInputRef.current?.click()} className="btn-secondary !h-9 text-xs">
                    <ImagePlus className="h-3.5 w-3.5" />
                    {t('prod_photo_choose')}
                  </button>
                  {form.image && (
                    <>
                      <button type="button" onClick={cutoutImage} className="btn-secondary !h-9 text-xs">
                        <Scissors className="h-3.5 w-3.5" />
                        {t('prod_photo_cutout')}
                      </button>
                      <button type="button" onClick={() => setForm({ ...form, image: '' })} className="btn-secondary !h-9 text-xs">
                        {t('prod_photo_remove')}
                      </button>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 dark:text-zinc-500">{t('prod_photo_hint')}</p>
              </div>
              <input ref={imageInputRef} type="file" accept="image/png,image/jpeg" onChange={onImageChange} className="hidden" />
            </div>
          </div>
          <div>
            <label className="field-label">{t('prod_name_label')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('prod_name_placeholder')}
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('prod_barcode_label')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                placeholder={t('prod_barcode_placeholder')}
                className="input-field font-mono"
              />
              <button
                onClick={() => setCameraOpen(true)}
                className="btn-secondary shrink-0 !px-3"
                title={t('prod_scan_camera_title')}
              >
                <Camera className="h-4 w-4" />
              </button>
              <button
                onClick={() => setForm({ ...form, barcode: generateEan13() })}
                className="btn-secondary shrink-0 !px-3"
                title={t('prod_generate_ean')}
              >
                <Wand2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="field-label">{t('prod_category_label')}</label>
              <Select
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                placeholder={t('prod_choose')}
                options={[{ value: '', label: t('prod_choose') }, ...categories.map((c) => ({ value: c.name, label: c.name }))]}
              />
            </div>
            <div>
              <label className="field-label">{t('prod_brand_label')}</label>
              <Select
                value={form.brand}
                onChange={(v) => setForm({ ...form, brand: v })}
                placeholder={t('prod_none')}
                options={[{ value: '', label: t('prod_none') }, ...brands.map((b) => ({ value: b.name, label: b.name }))]}
              />
            </div>
            <div>
              <label className="field-label">{t('prod_unit_label')}</label>
              <Select
                value={form.unit}
                onChange={(v) => setForm({ ...form, unit: v })}
                options={units.map((u) => ({ value: u.name, label: u.name }))}
              />
            </div>
          </div>
          <div>
            <label className="field-label">{t('prod_col_subcategory')}</label>
            <Select
              value={form.subcategory || ''}
              onChange={(v) => setForm({ ...form, subcategory: v })}
              placeholder={t('prod_none')}
              options={[
                { value: '', label: t('prod_none') },
                ...subcategories
                  .filter((s) => !form.category || s.name.startsWith(form.category + ' › '))
                  .map((s) => {
                    const short = s.name.split(' › ').pop() || s.name
                    return { value: short, label: short }
                  }),
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">{t('prod_buy_price_label')}</label>
              <input
                type="number"
                min="0"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                placeholder="0.00"
                className="input-field"
              />
            </div>
            <div>
              <label className="field-label">{t('prod_sell_price_label')}</label>
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0.00"
                className="input-field"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">{t('prod_stock_label')}</label>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                placeholder="0"
                className="input-field"
              />
            </div>
            <div>
              <label className="field-label">{t('prod_min_stock_label')}</label>
              <input
                type="number"
                min="0"
                value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                placeholder="5"
                className="input-field"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">
              {t('prod_cancel')}
            </button>
            <button onClick={saveForm} className="btn-primary">
              {t('prod_save')}
            </button>
          </div>
        </div>
      </Modal>

      <CameraScanner
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onDetect={(code) => {
          setForm((f) => ({ ...f, barcode: code }))
          toast(`✓ ${t('prod_toast_scanned')} ${code}`)
        }}
      />

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('prod_delete_confirm_title')}
        maxWidth="max-w-sm"
      >
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <span className="font-semibold text-gray-900 dark:text-white">{deleteTarget?.name}</span> {t('prod_delete_confirm_desc')}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
            {t('prod_cancel')}
          </button>
          <button onClick={confirmDelete} className="btn-danger">
            <Trash2 className="h-4 w-4" />
            {t('prod_delete')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function ProduitsPage() {
  return (
    <AppShell>
      <ProduitsContent />
    </AppShell>
  )
}
