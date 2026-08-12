'use client'

// Demandes de prix : l'étape qui manquait entre la demande d'achat et le bon
// de commande. On consulte plusieurs fournisseurs sur une même liste, on saisit
// leurs offres, on compare ligne à ligne, on attribue — le bon de commande est
// créé aux prix retenus, et le lien entre les deux documents est conservé.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Award, FileQuestion, Plus, Printer, Search, Trash2, X } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { usePermissions } from '@/lib/access'
import {
  fmtDH,
  RFQ_STATUS_META,
  rfqOfferComplete,
  rfqOfferTotal,
  useDroguerie,
  type Product,
  type Rfq,
  type RfqItem,
} from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const STATUS_KEY: Record<Rfq['status'], TKey> = {
  brouillon: 'rfq_st_brouillon',
  envoyee: 'rfq_st_envoyee',
  depouillee: 'rfq_st_depouillee',
  attribuee: 'rfq_st_attribuee',
  annulee: 'rfq_st_annulee',
}

function Content() {
  const {
    ready, rfqs, products, suppliers, purchaseRequests, activeStore, settings,
    addRfq, updateRfq, setRfqOffer, removeRfqOffer, awardRfq, cancelRfq, deleteRfq,
  } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()

  const [createOpen, setCreateOpen] = useState(false)
  const [picked, setPicked] = useState<{ p: Product; qty: string }[]>([])
  const [query, setQuery] = useState('')
  const [fromRequest, setFromRequest] = useState('')
  const [neededBy, setNeededBy] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [offerSupplier, setOfferSupplier] = useState('')
  const [offerPrices, setOfferPrices] = useState<Record<string, string>>({})
  const [offerLead, setOfferLead] = useState('')
  const [awardTarget, setAwardTarget] = useState<{ rfq: Rfq; supplierId: string; name: string } | null>(null)

  const current = openId ? rfqs.find((r) => r.id === openId) : undefined

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? '').includes(q))
      .filter((p) => !picked.some((x) => x.p.id === p.id))
      .slice(0, 6)
  }, [products, query, picked])

  // Demandes d'achat approuvées : point de départ naturel d'une consultation.
  const approuvees = useMemo(
    () => purchaseRequests.filter((r) => r.status === 'approuvee'),
    [purchaseRequests]
  )

  if (!ready) return <Loader />

  const loadFromRequest = (id: string) => {
    setFromRequest(id)
    const req = approuvees.find((r) => r.id === id)
    if (!req) return
    const lignes = req.items
      .map((it) => {
        const p = products.find((x) => x.id === it.productId)
        return p ? { p, qty: String(it.qty) } : null
      })
      .filter((x): x is { p: Product; qty: string } => !!x)
    setPicked(lignes)
    if (req.neededBy) setNeededBy(req.neededBy.slice(0, 10))
  }

  const create = () => {
    const items: RfqItem[] = picked
      .map((x) => ({ productId: x.p.id, name: x.p.name, barcode: x.p.barcode || undefined, qty: parseFloat(x.qty.replace(',', '.')) || 0 }))
      .filter((i) => i.qty > 0)
    if (items.length === 0) { toast(t('rfq_toast_no_items'), 'error'); return }
    const req = approuvees.find((r) => r.id === fromRequest)
    const r = addRfq(items, { requestId: req?.id, requestRef: req?.ref, neededBy: neededBy || undefined })
    if (!r) return
    setCreateOpen(false)
    setPicked([]); setQuery(''); setFromRequest(''); setNeededBy('')
    toast(`✓ ${r.ref} ${t('rfq_toast_created')}`)
    setOpenId(r.id)
  }

  const saveOffer = () => {
    if (!current || !offerSupplier) { toast(t('rfq_toast_pick_supplier'), 'error'); return }
    const sup = suppliers.find((s) => s.id === offerSupplier)
    if (!sup) return
    const prices: Record<string, number> = {}
    for (const it of current.items) {
      const v = parseFloat((offerPrices[it.productId] ?? '').replace(',', '.'))
      if (Number.isFinite(v) && v > 0) prices[it.productId] = v
    }
    if (Object.keys(prices).length === 0) { toast(t('rfq_toast_no_price'), 'error'); return }
    setRfqOffer(current.id, {
      supplierId: sup.id, supplierName: sup.name, prices,
      leadDays: offerLead ? parseInt(offerLead) : undefined,
    })
    setOfferSupplier(''); setOfferPrices({}); setOfferLead('')
    toast(`✓ ${t('rfq_toast_offer_saved')} ${sup.name}`)
  }

  /*
   * LE PRIX VIENT DU FOURNISSEUR, PAS DE NOUS. Cet écran sautait l'étape :
   * on saisissait des prix sans jamais avoir produit le document à envoyer.
   * On imprime donc une feuille de consultation — articles et quantités, avec
   * une colonne de prix VIDE que le fournisseur remplit — et la consultation
   * passe à « envoyée ». Les prix saisis ensuite ne sont que le report de sa
   * réponse.
   */
  const envoyer = () => {
    if (!current) return
    if (current.status === 'brouillon') updateRfq(current.id, { status: 'envoyee' })
    setTimeout(() => window.print(), 60)
  }

  const doAward = () => {
    if (!awardTarget) return
    const po = awardRfq(awardTarget.rfq.id, awardTarget.supplierId)
    setAwardTarget(null)
    if (po) toast(`✓ ${t('rfq_toast_awarded')} ${awardTarget.name} → ${po.ref}`)
  }

  // Meilleur prix par ligne : sert à mettre en évidence l'offre la plus basse.
  const bestPerLine = (rfq: Rfq) => {
    const best: Record<string, number> = {}
    for (const it of rfq.items) {
      const prix = rfq.offers.map((o) => o.prices[it.productId]).filter((v): v is number => typeof v === 'number' && v > 0)
      if (prix.length) best[it.productId] = Math.min(...prix)
    }
    return best
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <FileQuestion className="h-6 w-6 text-amber-500" />
            {t('rfq_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('rfq_sub')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {current && <button onClick={() => setOpenId(null)} className="btn-secondary"><X className="h-4 w-4" />{t('rfq_back')}</button>}
          {current && can('purch.order') && (
            <button onClick={envoyer} className="btn-primary"><Printer className="h-4 w-4" />{t('rfq_print')}</button>
          )}
          {can('purch.order') && !current && (
            <button onClick={() => setCreateOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />{t('rfq_new')}</button>
          )}
        </div>
      </motion.div>

      {/* Feuille envoyée au fournisseur : il y inscrit SES prix. Masquée à
          l'écran, elle est la seule chose imprimée. */}
      {current && (
        <div className="hidden print:block print-area bg-white p-6 text-gray-900">
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t('rfq_sheet_title')} — {current.ref}</h2>
          <p style={{ margin: '4px 0 2px', fontSize: 13 }}>
            {settings.storeName}{settings.address ? ` · ${settings.address}` : ''}{settings.phone ? ` · ${settings.phone}` : ''}
          </p>
          <p style={{ margin: '0 0 14px', fontSize: 12 }}>
            {new Date(current.date).toLocaleDateString('fr-FR')}
            {current.neededBy && <> · {t('rfq_needed_by')} {new Date(current.neededBy).toLocaleDateString('fr-FR')}</>}
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 13 }}>{t('rfq_sheet_intro')}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #000', padding: '6px 4px' }}>{t('rfq_col_article')}</th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid #000', padding: '6px 4px', width: 90 }}>{t('rfq_col_qty')}</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #000', padding: '6px 4px', width: 150 }}>{t('rfq_sheet_price_col')}</th>
              </tr>
            </thead>
            <tbody>
              {current.items.map((it) => (
                <tr key={it.productId}>
                  <td style={{ padding: '8px 4px', borderBottom: '1px dotted #999' }}>
                    {it.name}{it.barcode ? ` (${it.barcode})` : ''}
                  </td>
                  <td style={{ padding: '8px 4px', borderBottom: '1px dotted #999', textAlign: 'center' }}>{it.qty}</td>
                  {/* Colonne volontairement VIDE : c'est le fournisseur qui la remplit. */}
                  <td style={{ padding: '8px 4px', borderBottom: '1px solid #000' }} />
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 22, fontSize: 13 }}>{t('rfq_sheet_lead')} : ______________</p>
          <p style={{ marginTop: 28, fontSize: 13 }}>{t('rfq_sheet_stamp')}</p>
        </div>
      )}

      {current ? (
        <>
          {/* Tableau comparatif */}
          <div className="glass-card px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{current.ref}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  {current.items.length} {t('rfq_articles')} · {current.offers.length} {t('rfq_offers')}
                  {current.requestRef && <> · {t('rfq_from_request')} {current.requestRef}</>}
                </p>
              </div>
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${RFQ_STATUS_META[current.status].chip}`}>
                {t(STATUS_KEY[current.status])}
              </span>
            </div>
          </div>

          <div className="glass-card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                  <th className="px-4 py-3">{t('rfq_col_article')}</th>
                  <th className="px-4 py-3 text-center">{t('rfq_col_qty')}</th>
                  {/* Les fournisseurs sont l'axe de comparaison : ils ne doivent
                      pas hériter du gris minuscule des autres en-têtes. */}
                  {current.offers.map((o) => (
                    <th key={o.supplierId} className="px-4 py-3 text-right text-xs normal-case tracking-normal text-gray-900 dark:text-white">
                      {o.supplierName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {current.items.map((it) => {
                  const best = bestPerLine(current)[it.productId]
                  return (
                    <tr key={it.productId} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                      <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{it.name}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{it.qty}</td>
                      {current.offers.map((o) => {
                        const v = o.prices[it.productId]
                        const meilleur = typeof v === 'number' && v === best && current.offers.length > 1
                        return (
                          <td key={o.supplierId} className={`px-4 py-2.5 text-right tabular-nums ${meilleur ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-zinc-300'}`}>
                            {typeof v === 'number' ? fmtDH(v) : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                {current.offers.length > 0 && (
                  <tr className="border-t-2 border-gray-200 bg-gray-50/50 dark:border-white/10 dark:bg-white/[0.03]">
                    <td className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400" colSpan={2}>{t('rfq_total')}</td>
                    {current.offers.map((o) => {
                      const total = rfqOfferTotal(current, o)
                      const complet = rfqOfferComplete(current, o)
                      const min = Math.min(...current.offers.filter((x) => rfqOfferComplete(current, x)).map((x) => rfqOfferTotal(current, x)))
                      return (
                        <td key={o.supplierId} className="px-4 py-3 text-right">
                          <span className={`block font-extrabold tabular-nums ${complet && total === min ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                            {fmtDH(total)}
                          </span>
                          {!complet && <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">{t('rfq_incomplete')}</span>}
                          {o.leadDays !== undefined && <span className="block text-[10px] text-gray-400">{o.leadDays} {t('rfq_days')}</span>}
                        </td>
                      )
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Offres : saisie et attribution */}
          {current.status !== 'attribuee' && current.status !== 'annulee' && can('purch.order') && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="glass-card p-5">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{t('rfq_add_offer')}</p>
                {/* Lever l'ambiguïté : on ne fixe pas un prix, on reporte celui
                    que le fournisseur a annoncé. */}
                <p className="mb-3 mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{t('rfq_offer_hint')}</p>
                <Select
                  value={offerSupplier}
                  onChange={setOfferSupplier}
                  options={[{ value: '', label: t('rfq_pick_supplier') }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
                />
                {offerSupplier && (
                  <>
                    <div className="mt-3 space-y-2">
                      {current.items.map((it) => (
                        <div key={it.productId} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm text-gray-600 dark:text-zinc-300">{it.name}</span>
                          <input
                            value={offerPrices[it.productId] ?? ''}
                            onChange={(e) => setOfferPrices({ ...offerPrices, [it.productId]: e.target.value })}
                            inputMode="decimal"
                            placeholder={t('rfq_unit_price')}
                            className="input-field h-9 w-28 text-right tabular-nums"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <input value={offerLead} onChange={(e) => setOfferLead(e.target.value.replace(/\D/g, ''))} inputMode="numeric"
                        placeholder={t('rfq_lead_days')} className="input-field h-9 w-32" />
                      <button onClick={saveOffer} className="btn-primary !h-9">{t('rfq_save_offer')}</button>
                    </div>
                  </>
                )}
              </div>

              <div className="glass-card p-5">
                <p className="mb-3 text-sm font-bold text-gray-900 dark:text-white">{t('rfq_award')}</p>
                {current.offers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400 dark:text-zinc-500">{t('rfq_no_offer')}</p>
                ) : (
                  <div className="space-y-2">
                    {current.offers.map((o) => (
                      <div key={o.supplierId} className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 px-3 py-2 dark:border-white/10">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{o.supplierName}</p>
                          <p className="text-xs tabular-nums text-gray-500">{fmtDH(rfqOfferTotal(current, o))}</p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <button onClick={() => setAwardTarget({ rfq: current, supplierId: o.supplierId, name: o.supplierName })}
                            className="btn-primary !h-8 !px-2.5 text-xs"><Award className="h-3.5 w-3.5" />{t('rfq_choose')}</button>
                          <button onClick={() => removeRfqOffer(current.id, o.supplierId)} className="btn-secondary !h-8 !px-2 !text-rose-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => { cancelRfq(current.id); toast(t('rfq_toast_cancelled')) }} className="btn-secondary mt-4 w-full !text-rose-500">
                  {t('rfq_cancel_consult')}
                </button>
              </div>
            </div>
          )}

          {current.status === 'attribuee' && (
            <div className="glass-card border-l-4 border-emerald-500 px-5 py-4">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {t('rfq_awarded_to')} <b>{current.awardedSupplierName}</b> — {t('rfq_po_created')}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="glass-card overflow-x-auto">
          {rfqs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <FileQuestion className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
              <p className="text-sm text-gray-500 dark:text-zinc-400">{t('rfq_empty')}</p>
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                  <th className="px-4 py-3">{t('rfq_col_ref')}</th>
                  <th className="px-4 py-3">{t('rfq_col_date')}</th>
                  <th className="px-4 py-3 text-center">{t('rfq_articles')}</th>
                  <th className="px-4 py-3 text-center">{t('rfq_offers')}</th>
                  <th className="px-4 py-3">{t('rfq_col_awarded')}</th>
                  <th className="px-4 py-3">{t('rfq_col_status')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {[...rfqs].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-2.5 font-semibold text-amber-600 dark:text-amber-400">{r.ref}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(r.date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{r.items.length}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{r.offers.length}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{r.awardedSupplierName ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${RFQ_STATUS_META[r.status].chip}`}>
                        {t(STATUS_KEY[r.status])}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setOpenId(r.id)} className="btn-secondary !px-3 !py-1 text-xs">{t('rfq_open')}</button>
                        {r.status !== 'attribuee' && can('purch.order') && (
                          <button onClick={() => deleteRfq(r.id)} className="btn-secondary !px-2 !py-1 !text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Création */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('rfq_new')} maxWidth="max-w-lg">
        {approuvees.length > 0 && (
          <div className="mb-4">
            <label className="field-label">{t('rfq_from_request_label')}</label>
            <Select value={fromRequest} onChange={loadFromRequest}
              options={[{ value: '', label: t('rfq_from_scratch') }, ...approuvees.map((r) => ({ value: r.id, label: `${r.ref} — ${r.items.length} ${t('rfq_articles')}` }))]} />
          </div>
        )}
        <label className="field-label">{t('rfq_add_articles')}</label>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="input-field pl-10" placeholder={t('rfq_search_ph')} />
        </div>
        {results.length > 0 && (
          <div className="mt-1 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
            {results.map((p) => (
              // Nom sur sa ligne, en couleur explicite : sans classe de couleur
              // il héritait d'un gris sombre, illisible sur fond sombre — seul
              // le code-barres restait visible.
              <button key={p.id} onClick={() => { setPicked([...picked, { p, qty: '1' }]); setQuery('') }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-amber-50 dark:hover:bg-white/5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{p.name}</span>
                  <span className="block font-mono text-[11px] text-gray-400">{p.barcode || '—'}</span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-gray-600 dark:text-zinc-300">{fmtDH(p.cost)}</span>
              </button>
            ))}
          </div>
        )}
        {picked.length > 0 && (
          <div className="mt-3 space-y-2">
            {picked.map((x, i) => (
              <div key={x.p.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-zinc-300">{x.p.name}</span>
                <input value={x.qty} onChange={(e) => setPicked(picked.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y)))}
                  inputMode="decimal" className="input-field h-9 w-20 text-center tabular-nums" />
                <button onClick={() => setPicked(picked.filter((_, j) => j !== i))} className="text-gray-400 hover:text-rose-500"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <label className="field-label">{t('rfq_needed_by')}</label>
          <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className="input-field" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setCreateOpen(false)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={create} className="btn-primary"><Plus className="h-4 w-4" />{t('rfq_create')}</button>
        </div>
      </Modal>

      {/* Attribution */}
      <Modal open={!!awardTarget} onClose={() => setAwardTarget(null)} title={t('rfq_award_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-300">
          {t('rfq_award_desc_1')} <b>{awardTarget?.name}</b> {t('rfq_award_desc_2')}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setAwardTarget(null)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={doAward} className="btn-primary"><Award className="h-4 w-4" />{t('rfq_award')}</button>
        </div>
      </Modal>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
