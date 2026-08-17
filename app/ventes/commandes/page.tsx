'use client'

/*
 * COMMANDES CLIENTS — l'engagement pris avant la livraison.
 *
 * La commande ne touche JAMAIS au stock : c'est la livraison qui vend, via le
 * moteur existant (recordSale) — la vente créée est à la fois le BL et la
 * facture, visibles dans leurs pages habituelles. La commande suit les
 * quantités (commandé / livré / restant) et son statut se déduit d'elles.
 *
 * Traçabilité : le devis d'origine remonte, les ventes générées descendent —
 * tout se lit depuis le détail de la commande.
 */

import { useMemo, useRef, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { BadgeCheck, ClipboardList, Copy, Eye, PackageCheck, Plus, Printer, Search, Truck, XCircle } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import InvoiceDocument from '@/components/InvoiceDocument'
import { useToast } from '@/components/Toast'
import { usePermissions } from '@/lib/access'
import { printInvoicePdf } from '@/lib/invoicePdf'
import {
  availableStock,
  CUSTOMER_ORDER_META,
  fmtDH,
  orderDeliveredQty,
  orderRemainingQty,
  roundMoney,
  roundQty,
  useDroguerie,
  type CustomerOrder,
  type CustomerOrderStatus,
  type Sale,
} from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const STATUS_KEY: Record<CustomerOrderStatus, TKey> = {
  brouillon: 'co_status_brouillon',
  confirmee: 'co_status_confirmee',
  preparation: 'co_status_preparation',
  partielle: 'co_status_partielle',
  livree: 'co_status_livree',
  annulee: 'co_status_annulee',
}

function Content() {
  const {
    ready, customerOrders, clients, products, settings,
    addCustomerOrder, confirmCustomerOrder, deliverCustomerOrder, cancelCustomerOrder, duplicateCustomerOrder,
  } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()
  const printRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [filtre, setFiltre] = useState<CustomerOrderStatus | 'tous'>('tous')
  const [detail, setDetail] = useState<CustomerOrder | null>(null)
  const [printTarget, setPrintTarget] = useState<CustomerOrder | null>(null)
  const [cancelTarget, setCancelTarget] = useState<CustomerOrder | null>(null)
  // Duplication quand les prix du catalogue ont bougé : on demande lesquels garder.
  const [dupTarget, setDupTarget] = useState<CustomerOrder | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // Création directe
  const [createOpen, setCreateOpen] = useState(false)
  const [newClientId, setNewClientId] = useState('')
  const [newNote, setNewNote] = useState('')
  const [newLines, setNewLines] = useState<{ productId: string; name: string; price: number; qty: number }[]>([])
  const [prodQuery, setProdQuery] = useState('')

  // Livraison
  const [deliverTarget, setDeliverTarget] = useState<CustomerOrder | null>(null)
  const [deliverQtys, setDeliverQtys] = useState<Record<string, string>>({})
  const [deliverPayment, setDeliverPayment] = useState<Sale['payment']>('especes')

  const prodById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const visibles = useMemo(
    () =>
      customerOrders
        .filter((o) => filtre === 'tous' || o.status === filtre)
        .filter((o) => {
          const q = query.trim().toLowerCase()
          return !q || o.ref.toLowerCase().includes(q) || o.clientName.toLowerCase().includes(q) || (o.quoteRef ?? '').toLowerCase().includes(q)
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [customerOrders, filtre, query]
  )

  const prodResults = useMemo(() => {
    const q = prodQuery.trim().toLowerCase()
    if (q.length < 2) return []
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? '').includes(q))
      .filter((p) => !newLines.some((l) => l.productId === p.id))
      .slice(0, 6)
  }, [products, prodQuery, newLines])

  if (!ready) return <Loader />

  const creer = () => {
    if (!newLines.length) return toast(t('co_toast_no_line'), 'error')
    const client = clients.find((c) => c.id === newClientId)
    const r = addCustomerOrder({
      clientId: client?.id,
      clientName: client?.name ?? t('bl_walk_in_client'),
      note: newNote.trim() || undefined,
      paymentTerm: client?.paymentTermDays ? `${client.paymentTermDays} j` : undefined,
      items: newLines.map((l) => ({ productId: l.productId, name: l.name, price: l.price, qty: l.qty })),
    })
    if ('error' in r) return toast(t('co_toast_no_line'), 'error')
    toast(`✓ ${r.ref} ${t('co_toast_created')}`)
    setCreateOpen(false)
    setNewLines([])
    setNewClientId('')
    setNewNote('')
  }

  const ouvrirLivraison = (o: CustomerOrder) => {
    setDeliverTarget(o)
    // Pré-rempli avec le RESTANT : livrer tout est le cas le plus fréquent.
    const init: Record<string, string> = {}
    o.items.forEach((i) => { const r = roundQty(i.qty - i.deliveredQty); if (r > 0) init[i.productId] = String(r) })
    setDeliverQtys(init)
  }

  const livrer = () => {
    if (!deliverTarget) return
    const qtys = Object.entries(deliverQtys)
      .map(([productId, v]) => ({ productId, qty: parseFloat(v.replace(',', '.')) || 0 }))
      .filter((q) => q.qty > 0)
    const r = deliverCustomerOrder(deliverTarget.id, qtys, deliverPayment)
    if (!r.ok) return toast(r.raison === 'rien' ? t('co_toast_nothing') : t('co_toast_bad_status'), 'error')
    toast(`✓ ${t('co_toast_delivered')} — ${r.sale.invoiceNo ?? ''}`)
    setDeliverTarget(null)
  }

  const annuler = () => {
    if (!cancelTarget) return
    if (!cancelReason.trim()) return toast(t('cn_cancel_reason_ph'), 'error')
    const r = cancelCustomerOrder(cancelTarget.id, cancelReason.trim())
    if (!r.ok && r.raison === 'livree') toast(t('co_cancel_delivered'), 'error')
    else toast(`${cancelTarget.ref} ${t('cn_toast_cancelled')}`)
    setCancelTarget(null)
    setCancelReason('')
  }

  const FILTRES: { key: CustomerOrderStatus | 'tous'; label: string }[] = [
    { key: 'tous', label: t('cn_filter_all') },
    { key: 'brouillon', label: t('co_status_brouillon') },
    { key: 'confirmee', label: t('co_status_confirmee') },
    { key: 'preparation', label: t('co_status_preparation') },
    { key: 'partielle', label: t('co_status_partielle') },
    { key: 'livree', label: t('co_status_livree') },
    { key: 'annulee', label: t('co_status_annulee') },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <ClipboardList className="h-6 w-6 text-amber-500" />
            {t('co_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('co_sub')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('fac_search_placeholder')} className="input-field pl-10" />
          </div>
          {can('sale.order') && (
            <button onClick={() => setCreateOpen(true)} className="btn-primary">
              <Plus className="h-4 w-4" />
              {t('co_new')}
            </button>
          )}
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-1.5">
        {FILTRES.map((f) => (
          <button key={f.key} onClick={() => setFiltre(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filtre === f.key ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-zinc-300'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-x-auto">
        {visibles.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <ClipboardList className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('co_none')}</p>
          </div>
        ) : (
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                <th className="px-4 py-3">{t('co_col_ref')}</th>
                <th className="px-4 py-3">{t('cn_col_date')}</th>
                <th className="px-4 py-3">{t('fdoc_client')}</th>
                <th className="px-4 py-3">{t('co_col_quote')}</th>
                <th className="px-4 py-3 text-right">{t('cn_col_ttc')}</th>
                <th className="px-4 py-3 text-center">{t('co_col_delivered')}</th>
                <th className="px-4 py-3 text-center">{t('co_col_remaining')}</th>
                <th className="px-4 py-3">{t('cn_col_status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((o) => {
                const reste = orderRemainingQty(o)
                const actif = o.status !== 'annulee' && o.status !== 'livree'
                return (
                  <tr key={o.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-2.5 font-semibold text-amber-600 dark:text-amber-400">{o.ref}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(o.date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-zinc-300">{o.clientName}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{o.quoteRef ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900 dark:text-white">{fmtDH(o.total)}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{orderDeliveredQty(o)}</td>
                    <td className={`px-4 py-2.5 text-center font-bold tabular-nums ${reste > 0 && o.status !== 'annulee' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>{reste}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${CUSTOMER_ORDER_META[o.status].chip}`}>
                        {t(STATUS_KEY[o.status])}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {/* Emplacements FIXES — même leçon que les avoirs : rien ne
                          surgit sous le curseur après un clic. */}
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setDetail(o)} className="rounded-lg p-2 text-gray-400 transition hover:bg-sky-50 hover:text-sky-600 dark:text-zinc-500" title={t('fac_view')}>
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => setPrintTarget(o)} className="rounded-lg p-2 text-gray-400 transition hover:bg-sky-50 hover:text-sky-600 dark:text-zinc-500" title={t('fac_print')}>
                          <Printer className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => confirmCustomerOrder(o.id)}
                          disabled={!(o.status === 'brouillon' && can('sale.order_confirm'))}
                          className="rounded-lg p-2 text-emerald-500 transition hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-20 dark:hover:bg-emerald-500/10"
                          title={t('co_confirm')}
                        >
                          <BadgeCheck className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => ouvrirLivraison(o)}
                          disabled={!(actif && o.status !== 'brouillon' && reste > 0 && can('sale.order_deliver'))}
                          className="rounded-lg p-2 text-amber-500 transition hover:bg-amber-50 disabled:pointer-events-none disabled:opacity-20 dark:hover:bg-amber-500/10"
                          title={t('co_deliver')}
                        >
                          <Truck className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            /* Prix inchangés → un seul clic. Prix différents →
                               la fenêtre demande lesquels appliquer, totaux
                               à l'appui — pas de choix silencieux. */
                            const change = o.items.some((i) => {
                              const p = prodById.get(i.productId)
                              return p !== undefined && Math.abs(p.price - i.price) > 0.001
                            })
                            if (!change) { const d = duplicateCustomerOrder(o.id); if (d) toast(`✓ ${d.ref} ${t('co_toast_created')}`) }
                            else setDupTarget(o)
                          }}
                          disabled={!can('sale.order')}
                          className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-20 dark:text-zinc-500 dark:hover:bg-white/10"
                          title={t('co_duplicate')}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setCancelTarget(o)}
                          disabled={!(actif && orderDeliveredQty(o) === 0 && can('sale.order_cancel'))}
                          className="rounded-lg p-2 text-rose-400 transition hover:bg-rose-50 disabled:pointer-events-none disabled:opacity-20 dark:hover:bg-rose-500/10"
                          title={t('co_cancel')}
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------- Détail : quantités + traçabilité ---------- */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.ref ?? ''} maxWidth="max-w-2xl">
        {detail && (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-xl border border-gray-100 px-3 py-2 dark:border-white/10">
                <p className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-500">{t('fdoc_client')}</p>
                <p className="truncate font-semibold text-gray-900 dark:text-white">{detail.clientName}</p>
              </div>
              <div className="rounded-xl border border-gray-100 px-3 py-2 dark:border-white/10">
                <p className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-500">{t('co_col_quote')}</p>
                <p className="font-mono text-xs font-semibold text-gray-900 dark:text-white">{detail.quoteRef ?? '—'}</p>
              </div>
              <div className="rounded-xl border border-gray-100 px-3 py-2 dark:border-white/10">
                <p className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-500">{t('cn_col_ttc')}</p>
                <p className="font-semibold tabular-nums text-gray-900 dark:text-white">{fmtDH(detail.total)}</p>
              </div>
              <div className="rounded-xl border border-gray-100 px-3 py-2 dark:border-white/10">
                <p className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-500">{t('co_payment_term')}</p>
                <p className="font-semibold text-gray-900 dark:text-white">{detail.paymentTerm ?? '—'}</p>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-zinc-500">
                    <th className="px-3 py-2">{t('inv_col_name')}</th>
                    <th className="px-3 py-2 text-center">{t('co_qty_ordered')}</th>
                    <th className="px-3 py-2 text-center">{t('co_col_delivered')}</th>
                    <th className="px-3 py-2 text-center">{t('co_col_remaining')}</th>
                    <th className="px-3 py-2 text-center">{t('co_stock_now')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((i) => {
                    const p = prodById.get(i.productId)
                    const reste = roundQty(i.qty - i.deliveredQty)
                    return (
                      <tr key={i.productId} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{i.name}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{i.qty}</td>
                        <td className="px-3 py-2 text-center tabular-nums text-gray-600 dark:text-zinc-300">{i.deliveredQty}</td>
                        <td className={`px-3 py-2 text-center font-bold tabular-nums ${reste > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>{reste}</td>
                        {/* Disponibilité AU MOMENT de préparer — l'info du magasinier. */}
                        <td className={`px-3 py-2 text-center tabular-nums ${p && availableStock(p) < reste ? 'font-bold text-rose-500' : 'text-gray-600 dark:text-zinc-300'}`}>
                          {p ? availableStock(p) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Traçabilité descendante : les BL / factures générés. */}
            {detail.deliveries.length > 0 && (
              <div className="mt-3 rounded-xl border border-gray-100 p-3 text-sm dark:border-white/10">
                <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  <PackageCheck className="h-4 w-4 text-emerald-500" />
                  {t('co_deliveries')}
                </p>
                {detail.deliveries.map((d) => (
                  <div key={d.id} className="flex items-center justify-between border-b border-gray-50 py-1.5 last:border-0 dark:border-white/5">
                    <span className="text-xs text-gray-500">{new Date(d.date).toLocaleString('fr-FR')} · {d.user ?? '—'}</span>
                    <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">{d.saleRef ?? d.saleId.slice(-6)}</span>
                    <span className="tabular-nums text-gray-600 dark:text-zinc-300">{d.qtys.reduce((s, q) => s + q.qty, 0)} {t('cret_article_abbr')}</span>
                  </div>
                ))}
                <p className="mt-2 text-[11px] text-gray-400 dark:text-zinc-500">{t('co_deliveries_hint')}</p>
              </div>
            )}
            {detail.note && <p className="mt-3 text-xs text-gray-500 dark:text-zinc-400">{detail.note}</p>}
          </>
        )}
      </Modal>

      {/* ---------- Document imprimable ---------- */}
      <Modal open={!!printTarget} onClose={() => setPrintTarget(null)} title={printTarget?.ref ?? ''} maxWidth="max-w-4xl">
        {printTarget && (
          <>
            <div ref={printRef} className="max-h-[60vh] overflow-auto rounded-xl border border-gray-100 dark:border-white/10">
              <InvoiceDocument
                title={t('co_doc_title')}
                number={printTarget.ref}
                date={printTarget.date}
                partyLabel={t('fdoc_client')}
                partyName={printTarget.clientName}
                // Une commande n'est ni une facture ni un règlement.
                showAmountInWords={false}
                infos={[
                  { label: t('co_col_quote'), value: printTarget.quoteRef || null },
                  { label: t('co_payment_term'), value: printTarget.paymentTerm || null },
                  { label: t('cn_col_status'), value: t(STATUS_KEY[printTarget.status]) },
                ]}
                observations={printTarget.note}
                lines={printTarget.items.map((i) => ({
                  label: i.unitFactor && i.unitFactor > 1 ? `${i.name} — ${i.unitName} ×${i.unitFactor}` : i.name,
                  ref: prodById.get(i.productId)?.barcode || undefined,
                  qty: i.qty,
                  puHT: i.price / (1 + settings.tva / 100),
                  tvaPct: settings.tva,
                }))}
              />
            </div>
            <button onClick={() => printInvoicePdf(printRef.current?.querySelector('.print-area') as HTMLElement)} className="btn-primary mt-4 w-full">
              <Printer className="h-4 w-4" />
              {t('fac_print')}
            </button>
          </>
        )}
      </Modal>

      {/* ---------- Livraison ---------- */}
      <Modal open={!!deliverTarget} onClose={() => setDeliverTarget(null)} title={`${t('co_deliver')} — ${deliverTarget?.ref ?? ''}`} maxWidth="max-w-lg">
        {deliverTarget && (
          <>
            <p className="text-sm text-gray-600 dark:text-zinc-300">{t('co_deliver_desc')}</p>
            <div className="mt-3 max-h-[38vh] space-y-2 overflow-auto">
              {deliverTarget.items.map((i) => {
                const reste = roundQty(i.qty - i.deliveredQty)
                if (reste <= 0) return null
                const p = prodById.get(i.productId)
                const dispo = p ? availableStock(p) : 0
                return (
                  <div key={i.productId} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-white/10 dark:bg-white/5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{i.name}</p>
                      <p className="text-xs tabular-nums text-gray-500 dark:text-zinc-400">
                        {t('co_col_remaining')} {reste} · {t('co_stock_now')}{' '}
                        <span className={dispo < reste ? 'font-bold text-rose-500' : ''}>{dispo}</span>
                      </p>
                    </div>
                    <input
                      value={deliverQtys[i.productId] ?? ''}
                      onChange={(e) => setDeliverQtys((q) => ({ ...q, [i.productId]: e.target.value }))}
                      inputMode="decimal"
                      className="input-field h-9 w-24 text-center tabular-nums"
                    />
                  </div>
                )
              })}
            </div>
            <div className="mt-3">
              <label className="field-label">{t('pos_payment_method')}</label>
              <Select value={deliverPayment} onChange={(v) => setDeliverPayment(v as Sale['payment'])}
                options={[
                  { value: 'especes', label: t('pos_pay_especes') },
                  { value: 'carte', label: t('pos_pay_carte') },
                  { value: 'credit', label: t('pos_pay_credit') },
                  { value: 'mixte', label: t('pos_pay_mixte') },
                ]} />
              {deliverPayment === 'credit' && !deliverTarget.clientId && (
                <p className="mt-1 text-xs font-semibold text-rose-500">{t('pos_toast_select_client_credit')}</p>
              )}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setDeliverTarget(null)} className="btn-secondary">{t('cli_cancel')}</button>
              <button
                onClick={livrer}
                disabled={deliverPayment === 'credit' && !deliverTarget.clientId}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Truck className="h-4 w-4" />
                {t('co_deliver_do')}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ---------- Création directe ---------- */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('co_new')} maxWidth="max-w-lg">
        <div>
          <label className="field-label">{t('pos_client_label')}</label>
          <Select value={newClientId} onChange={setNewClientId} placeholder={t('pos_no_client')}
            options={[{ value: '', label: t('pos_no_client') }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
        </div>
        <div className="mt-3">
          <label className="field-label">{t('co_add_product')}</label>
          <input value={prodQuery} onChange={(e) => setProdQuery(e.target.value)} className="input-field" placeholder={t('inv_cy_pick_ph')} />
          {prodResults.length > 0 && (
            <div className="mt-1 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
              {prodResults.map((p) => (
                <button key={p.id} onClick={() => { setNewLines((l) => [...l, { productId: p.id, name: p.name, price: p.price, qty: 1 }]); setProdQuery('') }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-amber-50 dark:hover:bg-white/5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{p.name}</span>
                    <span className="block font-mono text-[11px] text-gray-400">{p.barcode || '—'}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-gray-600 dark:text-zinc-300">{fmtDH(p.price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {newLines.length > 0 && (
          <div className="mt-3 space-y-2">
            {newLines.map((l, idx) => (
              <div key={l.productId} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-white/10 dark:bg-white/5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{l.name}</p>
                  <p className="text-xs tabular-nums text-gray-500 dark:text-zinc-400">{fmtDH(l.price)}</p>
                </div>
                <input
                  value={String(l.qty)}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value.replace(',', '.')) || 0
                    setNewLines((ls) => ls.map((x, i2) => (i2 === idx ? { ...x, qty: v } : x)))
                  }}
                  inputMode="decimal"
                  className="input-field h-9 w-20 text-center tabular-nums"
                />
                <button onClick={() => setNewLines((ls) => ls.filter((_, i2) => i2 !== idx))} className="rounded-lg p-2 text-rose-400 transition hover:bg-rose-50 dark:hover:bg-rose-500/10">
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            ))}
            <p className="text-right text-sm font-bold tabular-nums text-gray-900 dark:text-white">
              {t('cn_col_ttc')} : {fmtDH(newLines.reduce((s, l) => s + l.price * l.qty, 0))}
            </p>
          </div>
        )}
        <div className="mt-3">
          <label className="field-label">{t('cn_note')}</label>
          <input value={newNote} onChange={(e) => setNewNote(e.target.value)} className="input-field" placeholder={t('cn_note_ph')} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setCreateOpen(false)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={creer} disabled={newLines.length === 0} className="btn-primary disabled:cursor-not-allowed disabled:opacity-40">
            <Plus className="h-4 w-4" />
            {t('co_create')}
          </button>
        </div>
      </Modal>

      {/* ---------- Duplication : quels prix ? ---------- */}
      <Modal open={!!dupTarget} onClose={() => setDupTarget(null)} title={t('co_dup_title')} maxWidth="max-w-sm">
        {dupTarget && (() => {
          const totalOrigine = dupTarget.total
          const totalCatalogue = roundMoney(dupTarget.items.reduce((s2, i) => s2 + (prodById.get(i.productId)?.price ?? i.price) * i.qty, 0))
          const dupliquer = (refresh: boolean) => {
            const d = duplicateCustomerOrder(dupTarget.id, { refreshPrices: refresh })
            if (d) toast(`✓ ${d.ref} ${t('co_toast_created')} — ${fmtDH(d.total)}`)
            setDupTarget(null)
          }
          return (
            <>
              <p className="text-sm text-gray-600 dark:text-zinc-300">{t('co_dup_desc')}</p>
              <div className="mt-4 grid gap-2">
                <button onClick={() => dupliquer(false)} className="btn-secondary justify-between">
                  <span>{t('co_dup_keep')}</span>
                  <span className="font-bold tabular-nums">{fmtDH(totalOrigine)}</span>
                </button>
                <button onClick={() => dupliquer(true)} className="btn-primary justify-between">
                  <span>{t('co_dup_refresh')}</span>
                  <span className="font-bold tabular-nums">{fmtDH(totalCatalogue)}</span>
                </button>
                <button onClick={() => setDupTarget(null)} className="text-xs font-semibold text-gray-400 transition hover:text-amber-500">
                  {t('cli_cancel')}
                </button>
              </div>
            </>
          )
        })()}
      </Modal>

      {/* ---------- Annulation motivée ---------- */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title={t('co_cancel_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-300">{t('co_cancel_desc')}</p>
        <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="input-field mt-3" placeholder={t('cn_cancel_reason_ph')} autoFocus />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setCancelTarget(null)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={annuler} className="btn-danger"><XCircle className="h-4 w-4" />{t('co_cancel')}</button>
        </div>
      </Modal>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
