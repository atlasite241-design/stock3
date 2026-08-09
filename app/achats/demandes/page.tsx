'use client'

// Demandes d'achat (DA) — le document interne en amont du bon de commande.
//
//   Brouillon → Soumise → Approuvée → Convertie en BC → Clôturée
//                        ↘ Refusée
//
// La conversion fabrique UN BC PAR FOURNISSEUR sans ressaisie : chaque ligne
// approuvée reçoit son fournisseur, le regroupement fait le reste. Qui peut
// demander : permission « Demande d'achat » (purch.request). Qui décide et
// convertit : permission « Bon de commande » (purch.order).

import { useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Check, ChevronDown, ChevronRight, ChevronUp, ClipboardList, CornerDownRight, Plus, Search, Send, Trash2, X } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/auth-context'
import { effectivePermissions, type RoleName } from '@/lib/permissions'
import {
  fmtDH,
  useDroguerie,
  type PurchaseItem,
  type PurchaseRequest,
  type PurchaseRequestItem,
  type PurchaseRequestStatus,
  type SaleUnit,
} from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const STATUS_META: Record<PurchaseRequestStatus, { labelKey: TKey; chip: string }> = {
  brouillon: { labelKey: 'da_st_draft', chip: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400' },
  soumise: { labelKey: 'da_st_submitted', chip: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400' },
  approuvee: { labelKey: 'da_st_approved', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400' },
  refusee: { labelKey: 'da_st_refused', chip: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400' },
  convertie: { labelKey: 'da_st_converted', chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400' },
  cloturee: { labelKey: 'da_st_closed', chip: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-400' },
}

function Content() {
  const {
    ready, products, suppliers, purchases, settings, purchaseRequests,
    addPurchaseRequest, updatePurchaseRequest, deletePurchaseRequest,
    submitPurchaseRequest, decidePurchaseRequest, convertPurchaseRequest, closePurchaseRequest,
  } = useDroguerie()
  const { session, currentUser } = useAuth()
  const { t, lang } = useLanguage()
  const toast = useToast()

  const [filter, setFilter] = useState<'toutes' | PurchaseRequestStatus>('toutes')
  const [query, setQuery] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)

  // Création / édition (brouillon uniquement)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [lines, setLines] = useState<PurchaseRequestItem[]>([])
  const [motif, setMotif] = useState('')
  const [neededBy, setNeededBy] = useState('')
  const [lineProduct, setLineProduct] = useState('')
  const [lineUnit, setLineUnit] = useState('')
  const [lineQty, setLineQty] = useState('1')
  const [lineSupplier, setLineSupplier] = useState('')

  // Décision (approbation / refus)
  const [decideTarget, setDecideTarget] = useState<PurchaseRequest | null>(null)
  const [decideComment, setDecideComment] = useState('')

  // Conversion : fournisseur par ligne
  const [convertTarget, setConvertTarget] = useState<PurchaseRequest | null>(null)
  const [convertSuppliers, setConvertSuppliers] = useState<Record<number, string>>({})

  const prodById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  if (!ready) {
    return <Loader />
  }

  /*
   * Qui décide : la permission « Bon de commande » — celui qui peut engager
   * l'enseigne auprès d'un fournisseur peut approuver une demande interne.
   */
  const perms = effectivePermissions(
    currentUser?.permissions,
    (session?.role ?? 'Vendeur') as RoleName,
    settings.rolePermissions
  )
  const peutDecider = perms.has('purch.order')

  const visible = purchaseRequests
    .filter((r) => filter === 'toutes' || r.status === filter)
    .filter((r) => {
      const q = query.trim().toLowerCase()
      return !q || r.ref.toLowerCase().includes(q) || r.requesterName.toLowerCase().includes(q)
        || r.items.some((i) => i.name.toLowerCase().includes(q))
    })

  const uniteOptions = (productId: string): { value: string; label: string }[] => {
    const p = prodById.get(productId)
    if (!p) return []
    return [
      { value: '', label: p.unit || t('pos_unit_piece') },
      ...(p.saleUnits ?? []).map((u: SaleUnit) => ({ value: u.name, label: `${u.name} ×${u.factor}` })),
    ]
  }

  const resetModal = () => {
    setEditingId(null); setLines([]); setMotif(''); setNeededBy('')
    setLineProduct(''); setLineUnit(''); setLineQty('1'); setLineSupplier('')
  }

  const openCreate = () => { resetModal(); setModalOpen(true) }

  const openEdit = (r: PurchaseRequest) => {
    setEditingId(r.id); setLines(r.items); setMotif(r.motif ?? ''); setNeededBy(r.neededBy ?? '')
    setLineProduct(''); setLineUnit(''); setLineQty('1'); setLineSupplier('')
    setModalOpen(true)
  }

  const addLine = () => {
    const p = prodById.get(lineProduct)
    if (!p) {
      toast(t('da_toast_choose_product'), 'error')
      return
    }
    const unit = (p.saleUnits ?? []).find((u) => u.name === lineUnit)
    const qty = Math.max(1, Math.round(parseFloat(lineQty.replace(',', '.')) || 1))
    const key = `${p.id}|${unit?.name ?? ''}`
    if (lines.some((l) => `${l.productId}|${l.unitName ?? ''}` === key)) {
      toast(t('da_toast_line_exists'), 'error')
      return
    }
    setLines([...lines, {
      productId: p.id,
      name: p.name,
      barcode: p.barcode || undefined,
      qty,
      unitName: unit?.name,
      unitFactor: unit?.factor,
      supplierId: lineSupplier || undefined,
    }])
    setLineProduct(''); setLineUnit(''); setLineQty('1')
  }

  const saveRequest = () => {
    if (lines.length === 0) {
      toast(t('da_toast_no_lines'), 'error')
      return
    }
    if (editingId) {
      updatePurchaseRequest(editingId, { items: lines, motif: motif.trim() || undefined, neededBy: neededBy || undefined })
      toast(`✓ ${t('da_toast_updated')}`)
    } else {
      const r = addPurchaseRequest({ items: lines, motif: motif.trim() || undefined, neededBy: neededBy || undefined })
      toast(`✓ ${r?.ref ?? ''} ${t('da_toast_created')}`)
    }
    setModalOpen(false)
    resetModal()
  }

  const decide = (ok: boolean) => {
    if (!decideTarget) return
    decidePurchaseRequest(decideTarget.id, ok, decideComment.trim() || undefined)
    toast(ok ? `✓ ${decideTarget.ref} ${t('da_toast_approved')}` : `${decideTarget.ref} ${t('da_toast_refused')}`)
    setDecideTarget(null)
    setDecideComment('')
  }

  const openConvert = (r: PurchaseRequest) => {
    setConvertTarget(r)
    const init: Record<number, string> = {}
    r.items.forEach((it, idx) => { init[idx] = it.supplierId ?? '' })
    setConvertSuppliers(init)
  }

  const runConvert = () => {
    if (!convertTarget) return
    if (convertTarget.items.some((_, idx) => !convertSuppliers[idx])) {
      toast(t('da_toast_supplier_missing'), 'error')
      return
    }
    // Regroupement par fournisseur : chaque groupe devient UN bon de commande.
    const parFournisseur = new Map<string, PurchaseItem[]>()
    convertTarget.items.forEach((it, idx) => {
      const sid = convertSuppliers[idx]
      const p = prodById.get(it.productId)
      const cost = it.unitFactor && it.unitFactor > 1
        ? Math.round((p?.cost ?? 0) * it.unitFactor * 100) / 100
        : p?.cost ?? 0
      const item: PurchaseItem = {
        productId: it.productId,
        name: it.name,
        barcode: it.barcode,
        cost,
        qty: it.qty,
        unitName: it.unitName,
        unitFactor: it.unitFactor,
        discount: 0,
        tva: settings.tva,
      }
      parFournisseur.set(sid, [...(parFournisseur.get(sid) ?? []), item])
    })
    const pos = convertPurchaseRequest(
      convertTarget.id,
      [...parFournisseur.entries()].map(([supplierId, items]) => ({ supplierId, items }))
    )
    if (pos && pos.length > 0) {
      toast(`✓ ${convertTarget.ref} → ${pos.map((p) => p.ref).join(', ')}`)
    }
    setConvertTarget(null)
  }

  const bcOf = (r: PurchaseRequest) =>
    (r.purchaseIds ?? []).map((id) => purchases.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p)

  const dateFmt = (d: string) => new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR')

  /*
   * Les statuts dans l'ORDRE du circuit : la barre de filtres se lit comme le
   * parcours d'une demande, pas comme une liste alphabétique. « Refusée » est
   * une SORTIE de circuit, pas une étape — elle est donc mise à part.
   */
  const ETAPES: PurchaseRequestStatus[] = ['brouillon', 'soumise', 'approuvee', 'convertie', 'cloturee']
  const combien = (k: PurchaseRequestStatus) => purchaseRequests.filter((r) => r.status === k).length

  const puce = (actif: boolean) =>
    `flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
      actif
        ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-lg shadow-amber-400/25'
        : 'border border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:bg-amber-50 dark:border-white/10 dark:bg-[#12121a] dark:text-zinc-400'
    }`

  const compteur = (actif: boolean) =>
    `rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
      actif ? 'bg-gray-900/15 text-gray-900' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-zinc-400'
    }`

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <ClipboardList className="h-6 w-6 text-amber-500" />{t('da_title')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">{t('da_subtitle')}</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" />{t('da_new')}
        </button>
      </motion.div>

      {/* Circuit de validation — chaque étape filtre la liste. */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFilter('toutes')} className={puce(filter === 'toutes')}>
          {t('da_filter_all')}
          <span className={compteur(filter === 'toutes')}>{purchaseRequests.length}</span>
        </button>

        <span className="mx-1 h-6 w-px bg-gray-200 dark:bg-white/10" aria-hidden="true" />

        {ETAPES.map((k, idx) => (
          <div key={k} className="flex items-center gap-2">
            {idx > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-zinc-600 rtl:rotate-180" aria-hidden="true" />}
            <button onClick={() => setFilter(k)} className={puce(filter === k)}>
              {t(STATUS_META[k].labelKey)}
              <span className={compteur(filter === k)}>{combien(k)}</span>
            </button>
          </div>
        ))}

        {/* Sortie de circuit : une demande refusée ne reprend pas la file. */}
        <div className="flex items-center gap-2">
          <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-zinc-600 rtl:-scale-x-100" aria-hidden="true" />
          <button onClick={() => setFilter('refusee')} className={puce(filter === 'refusee')}>
            {t(STATUS_META.refusee.labelKey)}
            <span className={compteur(filter === 'refusee')}>{combien('refusee')}</span>
          </button>
        </div>
        <div className="relative ml-auto min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('da_search')} className="input-field pl-10" />
        </div>
      </div>

      {/* Liste */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
        className="space-y-3">
        {visible.length === 0 && (
          <p className="glass-card p-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('da_none')}</p>
        )}
        {visible.map((r) => {
          const meta = STATUS_META[r.status]
          const ouvert = detailId === r.id
          const bcs = bcOf(r)
          return (
            <div key={r.id} className="glass-card overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {r.ref}
                    <span className={`ml-2 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${meta.chip}`}>{t(meta.labelKey)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
                    {dateFmt(r.date)} · {r.requesterName} · {r.items.length} {t('da_items_count')}
                    {r.neededBy && <> · {t('da_needed_by')} {dateFmt(r.neededBy)}</>}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {r.status === 'brouillon' && (
                    <>
                      <button onClick={() => openEdit(r)} className="btn-secondary !h-9 text-xs">{t('da_edit')}</button>
                      <button onClick={() => { submitPurchaseRequest(r.id); toast(`✓ ${r.ref} ${t('da_toast_submitted')}`) }}
                        className="btn-primary !h-9 text-xs">
                        <Send className="h-3.5 w-3.5" />{t('da_submit')}
                      </button>
                      <button onClick={() => deletePurchaseRequest(r.id)}
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500 dark:text-zinc-500"
                        title={t('da_delete')}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {r.status === 'soumise' && peutDecider && (
                    <button onClick={() => setDecideTarget(r)} className="btn-primary !h-9 text-xs">
                      <Check className="h-3.5 w-3.5" />{t('da_decide')}
                    </button>
                  )}
                  {r.status === 'approuvee' && peutDecider && (
                    <button onClick={() => openConvert(r)} className="btn-primary !h-9 text-xs">
                      {t('da_convert')}
                    </button>
                  )}
                  {r.status === 'convertie' && peutDecider && (
                    <button onClick={() => { closePurchaseRequest(r.id); toast(`✓ ${r.ref} ${t('da_toast_closed')}`) }}
                      className="btn-secondary !h-9 text-xs">
                      {t('da_close')}
                    </button>
                  )}
                  <button onClick={() => setDetailId(ouvert ? null : r.id)}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-50 dark:text-zinc-500 dark:hover:bg-white/5">
                    {ouvert ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {ouvert && (
                <div className="border-t border-gray-100 p-4 dark:border-white/10">
                  {r.motif && <p className="mb-3 text-sm text-gray-600 dark:text-zinc-300">{t('da_reason')} : {r.motif}</p>}
                  {r.decisionNote && (
                    <p className={`mb-3 text-sm ${r.status === 'refusee' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {t('da_decision_note')} : {r.decisionNote}
                    </p>
                  )}
                  <table className="w-full min-w-[420px] text-sm">
                    <tbody>
                      {r.items.map((it, idx) => (
                        <tr key={idx} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                          <td className="py-1.5 pr-3 font-medium text-gray-900 dark:text-white">{it.name}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums text-gray-600 dark:text-zinc-400">
                            {it.qty} {it.unitName ? `× ${it.unitName}` : ''}
                          </td>
                          <td className="py-1.5 text-xs text-gray-400 dark:text-zinc-500">
                            {it.supplierId ? suppliers.find((sp) => sp.id === it.supplierId)?.name ?? '' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {bcs.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {bcs.map((p) => (
                        <span key={p.id} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                          {p.ref} · {p.supplierName} · {fmtDH(p.total)} · {p.status}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 space-y-1">
                    {r.history.map((h, idx) => (
                      <p key={idx} className="text-[11px] text-gray-400 dark:text-zinc-500 tabular-nums">
                        {new Date(h.date).toLocaleString(lang === 'ar' ? 'ar-MA' : 'fr-FR')} — {h.action}
                        {h.user !== '—' && h.user !== '-' && <> · {h.user}</>}
                        {h.comment && <> · {h.comment}</>}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </motion.div>

      {/* Création / édition */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('da_edit_title') : t('da_new_title')} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">{t('da_reason')}</label>
              <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder={t('da_reason_ph')} className="input-field" />
            </div>
            <div>
              <label className="field-label">{t('da_needed_by')}</label>
              <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className="input-field" />
            </div>
          </div>

          {/* Ajout de ligne */}
          <div className="rounded-xl border border-gray-200 p-3 dark:border-white/10">
            <div className="grid gap-2 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <Select value={lineProduct} onChange={(v) => { setLineProduct(v); setLineUnit('') }}
                  placeholder={t('da_choose_product')}
                  options={[{ value: '', label: t('da_choose_product') }, ...products.map((p) => ({ value: p.id, label: p.name }))]} />
              </div>
              <div className="sm:col-span-3">
                <Select value={lineUnit} onChange={setLineUnit} options={uniteOptions(lineProduct)} placeholder={t('da_unit')} />
              </div>
              <div className="sm:col-span-2">
                <input type="number" min={1} value={lineQty} onChange={(e) => setLineQty(e.target.value)} className="input-field text-center" />
              </div>
              <div className="sm:col-span-2">
                <button onClick={addLine} className="btn-secondary w-full !h-10">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-2">
              <Select value={lineSupplier} onChange={setLineSupplier}
                placeholder={t('da_supplier_suggested')}
                options={[{ value: '', label: t('da_supplier_suggested') }, ...suppliers.map((sp) => ({ value: sp.id, label: sp.name }))]}
                className="w-auto min-w-[220px]" />
            </div>
          </div>

          {/* Lignes */}
          {lines.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
              <table className="w-full min-w-[420px] text-sm">
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={idx} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{l.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-zinc-400">
                        {l.qty} {l.unitName ? `× ${l.unitName}` : ''}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400 dark:text-zinc-500">
                        {l.supplierId ? suppliers.find((sp) => sp.id === l.supplierId)?.name ?? '' : ''}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                          className="rounded p-1 text-gray-400 transition hover:text-rose-500">
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">{t('da_cancel')}</button>
            <button onClick={saveRequest} className="btn-primary">{editingId ? t('da_save') : t('da_create')}</button>
          </div>
        </div>
      </Modal>

      {/* Décision */}
      <Modal open={!!decideTarget} onClose={() => setDecideTarget(null)} title={`${t('da_decide_title')} — ${decideTarget?.ref ?? ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-zinc-300">{t('da_decide_hint')}</p>
          <div>
            <label className="field-label">{t('da_decision_note')}</label>
            <input value={decideComment} onChange={(e) => setDecideComment(e.target.value)} placeholder={t('da_decision_ph')} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => decide(false)}
              className="flex items-center justify-center gap-2 rounded-xl border border-rose-400/60 px-4 py-2.5 text-sm font-bold text-rose-500 transition hover:bg-rose-500/10">
              <X className="h-4 w-4" />{t('da_refuse')}
            </button>
            <button onClick={() => decide(true)} className="btn-primary">
              <Check className="h-4 w-4" />{t('da_approve')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Conversion en BC */}
      <Modal open={!!convertTarget} onClose={() => setConvertTarget(null)} title={`${t('da_convert_title')} — ${convertTarget?.ref ?? ''}`} maxWidth="max-w-2xl">
        {convertTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-zinc-300">{t('da_convert_hint')}</p>
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
              <table className="w-full min-w-[480px] text-sm">
                <tbody>
                  {convertTarget.items.map((it, idx) => (
                    <tr key={idx} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{it.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-zinc-400">
                        {it.qty} {it.unitName ? `× ${it.unitName}` : ''}
                      </td>
                      <td className="px-3 py-2">
                        <Select value={convertSuppliers[idx] ?? ''}
                          onChange={(v) => setConvertSuppliers((m) => ({ ...m, [idx]: v }))}
                          placeholder={t('da_choose_supplier')}
                          options={[{ value: '', label: t('da_choose_supplier') }, ...suppliers.map((sp) => ({ value: sp.id, label: sp.name }))]}
                          className="min-w-[180px]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Aperçu du regroupement : un BC par fournisseur distinct. */}
            {(() => {
              const distincts = new Set(Object.values(convertSuppliers).filter(Boolean))
              return distincts.size > 0 && (
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  → {distincts.size} {t('da_convert_preview')}
                </p>
              )
            })()}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConvertTarget(null)} className="btn-secondary">{t('da_cancel')}</button>
              <button onClick={runConvert} className="btn-primary">{t('da_convert')}</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

export default function DemandesAchatPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
