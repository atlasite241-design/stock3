'use client'

import { useMemo, useRef, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { FileText, Printer, Search } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import InvoiceDocument from '@/components/InvoiceDocument'
import { printInvoicePdf } from '@/lib/invoicePdf'
import { fmtDH, PAYMENT_META, saleInvoiceNumber, useDroguerie, type Sale } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, sales, settings, clients, products } = useDroguerie()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [invoice, setInvoice] = useState<Sale | null>(null)
  // Index produit : la facture affiche la référence de chaque article, et le
  // catalogue peut compter des dizaines de milliers de fiches.
  const produitsParId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const clientFacture = invoice?.clientId ? clients.find((c) => c.id === invoice.clientId) : undefined
  const printRef = useRef<HTMLDivElement>(null)

  if (!ready) {
    return <Loader />
  }

  const visible = [...sales]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((s) => {
      const q = query.trim().toLowerCase()
      return (
        !q ||
        s.id.toLowerCase().includes(q) ||
        (s.clientName ?? '').toLowerCase().includes(q)
      )
    })

  /*
   * Le numéro suit les réglages (Société › Documents & Facturation) au lieu
   * d'être découpé dans l'identifiant technique : « FCT-MW34VZ » n'était ni
   * séquentiel, ni conforme à une numérotation de facturation, ni reconnaissable
   * par le client qui la présente au comptoir.
   */
  const invoiceNumber = (s: Sale) => saleInvoiceNumber(s, sales, settings)

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('fac_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('fac_subtitle_prefix')} ({settings.tva}%).
          </p>
        </div>
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('fac_search_placeholder')}
            className="input-field pl-10"
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('fac_col_number')}</th>
                <th className="px-5 py-3.5">{t('fac_col_date')}</th>
                <th className="px-5 py-3.5">{t('fac_col_client')}</th>
                <th className="px-5 py-3.5">{t('fac_col_payment')}</th>
                <th className="px-5 py-3.5">{t('fac_col_total_ttc')}</th>
                <th className="px-5 py-3.5 text-right">{t('fac_col_action')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, 50).map((s) => (
                <tr key={s.id} className="border-b border-gray-50 transition-colors hover:bg-amber-50/40">
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{invoiceNumber(s)}</td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm text-gray-700 dark:text-zinc-300">
                      {new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">
                      {new Date(s.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">{s.clientName ?? t('bl_walk_in_client')}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${PAYMENT_META[s.payment].chip}`}>
                      {PAYMENT_META[s.payment].label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(s.total)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end">
                      <button onClick={() => setInvoice(s)} className="btn-secondary !h-8 !px-3 text-xs">
                        <FileText className="h-3.5 w-3.5" />
                        {t('fac_view')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('fac_none_found')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Invoice modal */}
      {/* Assez large pour un document A4 (794 px) : plus étroite, la fenêtre
          le rognait et l'aperçu ne montrait pas ce qui serait imprimé. */}
      <Modal open={!!invoice} onClose={() => setInvoice(null)} title={t('fac_title')} maxWidth="max-w-4xl">
        {invoice && (
          <>
            {/* Défilement des DEUX côtés : le document a une largeur fixe d'A4
                et ne doit pas être comprimé par la fenêtre — sinon l'aperçu ne
                montre pas ce qui sera imprimé. */}
            <div ref={printRef} className="max-h-[60vh] overflow-auto rounded-xl border border-gray-100 dark:border-white/10">
              <InvoiceDocument
                title={t('fdoc_invoice')}
                docNumber={invoiceNumber(invoice)}
                date={invoice.date}
                partyLabel={t('fdoc_client')}
                partyName={invoice.clientName ?? t('bl_walk_in_client')}
                partyAddress={clientFacture?.address || undefined}
                // La fiche client ne porte pas d'ICE : le CIN est la seule
                // mention d'identification disponible aujourd'hui.
                partyLegal={clientFacture?.cin ? `CIN : ${clientFacture.cin}` : undefined}
                contact={
                  clientFacture?.phone || clientFacture?.email
                    ? { name: clientFacture.name, phone: clientFacture.phone || undefined, email: clientFacture.email || undefined }
                    : undefined
                }
                infos={[
                  { label: t('fdoc_date_label'), value: new Date(invoice.date).toLocaleDateString('fr-FR') },
                  { label: t('fdoc_payment_label'), value: PAYMENT_META[invoice.payment].label },
                  { label: t('fdoc_client_ref'), value: clientFacture?.code || null },
                  { label: t('fdoc_seller'), value: invoice.userName || null },
                ]}
                lines={invoice.items.map((i) => ({
                  // Le conditionnement fait partie du libelle : une facture qui
                  // indique « 3 » sans « boite de 100 » est invérifiable.
                  label: i.unitFactor && i.unitFactor > 1 ? `${i.name} — ${i.unitName} ×${i.unitFactor}` : i.name,
                  ref: produitsParId.get(i.productId)?.barcode || undefined,
                  qty: i.qty,
                  puHT: i.price / (1 + settings.tva / 100),
                  tvaPct: settings.tva,
                }))}
              />
            </div>
            <button
              onClick={() => printInvoicePdf(printRef.current?.querySelector('.print-area') as HTMLElement)}
              className="btn-primary mt-4 w-full"
            >
              <Printer className="h-4 w-4" />
              {t('fac_print')}
            </button>
          </>
        )}
      </Modal>
    </>
  )
}

export default function FacturesPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
