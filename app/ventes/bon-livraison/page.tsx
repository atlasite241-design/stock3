'use client'

import { useRef, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { PackageCheck, Printer, Search } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import InvoiceDocument from '@/components/InvoiceDocument'
import { printInvoicePdf } from '@/lib/invoicePdf'
import { deliveryNoteNumber, useDroguerie, type Sale } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, sales, settings, products, clients } = useDroguerie()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [bl, setBl] = useState<Sale | null>(null)
  const printRef = useRef<HTMLDivElement>(null)
  const clientBl = bl?.clientId ? clients.find((c) => c.id === bl.clientId) : undefined

  if (!ready) {
    return <Loader />
  }

  // Index par identifiant : un find() par ligne parcourait tout le catalogue.
  const parId = new Map(products.map((p) => [p.id, p]))
  const empOf = (productId: string) => parId.get(productId)?.emplacementComplet

  const visible = [...sales]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((s) => {
      const q = query.trim().toLowerCase()
      return !q || s.id.toLowerCase().includes(q) || (s.clientName ?? '').toLowerCase().includes(q)
    })

  // Le BL reprend le rang de la facture de la même vente : « BL-2026-1000 »
  // répond à « FAC-2026-1000 », ce qu'un numéro indépendant ne permettrait pas.
  const blNumber = (s: Sale) => deliveryNoteNumber(s, sales, settings)

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('bl_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('bl_subtitle')}
          </p>
        </div>
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('bl_search_placeholder')}
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
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('bl_col_number')}</th>
                <th className="px-5 py-3.5">{t('bl_col_date')}</th>
                <th className="px-5 py-3.5">{t('bl_col_client')}</th>
                <th className="px-5 py-3.5">{t('bl_col_items')}</th>
                <th className="px-5 py-3.5 text-right">{t('bl_col_action')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, 50).map((s) => (
                <tr key={s.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{blNumber(s)}</td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm text-gray-700 dark:text-zinc-300">
                      {new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">
                      {new Date(s.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">{s.clientName ?? t('bl_walk_in_client')}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">
                    {s.items.reduce((a, i) => a + i.qty, 0)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end">
                      <button onClick={() => setBl(s)} className="btn-secondary !h-8 !px-3 text-xs">
                        <PackageCheck className="h-3.5 w-3.5" />
                        {t('bl_view')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('bl_none_found')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Delivery note modal */}
      {/*
        Le bon de livraison accompagne la marchandise chez le client : il porte
        donc l'en-tête et les mentions de l'enseigne, comme la facture. La
        colonne emplacement reste — c'est le document du préparateur.
      */}
      <Modal open={!!bl} onClose={() => setBl(null)} title={t('bl_title')} maxWidth="max-w-4xl">
        {bl && (
          <>
            <div ref={printRef} className="max-h-[60vh] overflow-auto rounded-xl border border-gray-100 dark:border-white/10">
              <InvoiceDocument
                title={t('bl_title')}
                number={blNumber(bl)}
                date={bl.date}
                partyLabel={t('fdoc_client')}
                partyName={bl.clientName ?? t('bl_walk_in_client')}
                partyAddress={clientBl?.address || undefined}
                contact={
                  clientBl?.phone || clientBl?.email
                    ? { name: clientBl.name, phone: clientBl.phone || undefined, email: clientBl.email || undefined }
                    : undefined
                }
                // Un bon de livraison constate une remise de marchandise : il
                // n'arrête aucune facture et n'appelle pas de règlement.
                showAmountInWords={false}
                showEmplacement
                observations={`${t('bl_good_condition')} ${settings.storeName}\n\n${t('bl_delivered_by')} : ______________     ${t('bl_received_by')} : ______________`}
                infos={[
                  { label: t('fdoc_date_label'), value: new Date(bl.date).toLocaleDateString('fr-FR') },
                  { label: t('fdoc_seller'), value: bl.userName || null },
                ]}
                lines={bl.items.map((i) => ({
                  label: i.unitFactor && i.unitFactor > 1 ? `${i.name} — ${i.unitName} ×${i.unitFactor}` : i.name,
                  emplacement: empOf(i.productId) || undefined,
                  qty: i.qty,
                  puHT: i.price / (1 + settings.tva / 100),
                  tvaPct: settings.tva,
                }))}
              />
            </div>
            <button onClick={() => printInvoicePdf(printRef.current?.querySelector('.print-area') as HTMLElement)} className="btn-primary mt-4 w-full">
              <Printer className="h-4 w-4" />
              {t('bl_print')}
            </button>
          </>
        )}
      </Modal>
    </>
  )
}

export default function BonLivraisonPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
