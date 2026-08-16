'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  ClipboardList,
  FileDown,
  Mail,
  MessageCircle,
  Package,
  Plus,
  Rocket,
  Search,
  Send,
  ShoppingBasket,
  Trash2,
  UserSearch,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import InvoiceDocument from '@/components/InvoiceDocument'
import { printInvoicePdf } from '@/lib/invoicePdf'
import { useToast } from '@/components/Toast'
import { availableStock, docNumber, fmtDH, useDroguerie, type Client, type Quote, type SaleItem } from '@/lib/store'
import { gmailLink, waLink } from '@/lib/envoi'
import { useLanguage } from '@/lib/i18n'

type Line = SaleItem & { discount: number }

const r2 = (n: number) => Math.round(n * 100) / 100

function Content() {
  const { ready, products, clients, quotes, settings, activeStore, activeStoreId, addQuote, updateQuote, deleteQuote, convertQuote, convertQuoteToOrder } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const router = useRouter()

  const [clientName, setClientName] = useState('')
  const [validity, setValidity] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [globalDiscount, setGlobalDiscount] = useState('0')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')

  const tvaRate = settings?.tva ?? 20
  const global = Math.min(100, Math.max(0, parseFloat(globalDiscount.replace(',', '.')) || 0))

  const totals = useMemo(() => {
    const subtotal = lines.reduce((a, l) => a + l.price * l.qty * (1 - (l.discount || 0) / 100), 0)
    const afterGlobal = subtotal * (1 - global / 100)
    const tva = afterGlobal * (tvaRate / 100)
    return { subtotal, afterGlobal, tva, ttc: afterGlobal + tva }
  }, [lines, global, tvaRate])

  const addLine = (productId: string) => {
    const p = products.find((x) => x.id === productId)
    if (!p) return
    diverge()
    setLines((ls) => {
      const ex = ls.find((l) => l.productId === productId)
      if (ex) return ls.map((l) => (l.productId === productId ? { ...l, qty: l.qty + 1 } : l))
      return [...ls, { productId: p.id, name: p.name, price: p.price, qty: 1, discount: 0 }]
    })
    setSearch('')
  }
  const patchLine = (id: string, patch: Partial<Line>) => {
    diverge()
    setLines((ls) => ls.map((l) => (l.productId === id ? { ...l, ...patch } : l)))
  }
  const removeLine = (id: string) => {
    diverge()
    setLines((ls) => ls.filter((l) => l.productId !== id))
  }

  // Items persistés : la remise de ligne + la remise globale sont incorporées au prix unitaire.
  const buildItems = (): SaleItem[] =>
    lines.map((l) => ({
      productId: l.productId,
      name: l.name,
      price: r2(l.price * (1 - (l.discount || 0) / 100) * (1 - global / 100)),
      qty: l.qty,
    }))

  const matchedClient: Client | null = clients.find((c) => c.name === clientName.trim()) ?? null

  /*
   * ON NE VEND PAS UN DEVIS QUI N'EXISTE PAS.
   *
   * « Convertir en vente » créait une vente à partir des lignes saisies, sans
   * jamais enregistrer de devis : la vente n'avait aucun document d'origine.
   * Le bouton n'est donc actif qu'une fois le brouillon enregistré, et la
   * conversion porte alors sur CE devis — qui se trouve marqué converti, donc
   * inconvertible une seconde fois.
   *
   * Toute retouche postérieure (ligne, quantité, prix, remise, client) fait
   * diverger le formulaire du devis enregistré : le bouton se referme jusqu'au
   * prochain enregistrement, sinon on vendrait autre chose que ce qui est écrit.
   */
  /*
   * Le formulaire reste LIÉ au devis qu'il a créé. Sans ce lien, chaque clic
   * sur « Enregistrer » fabriquait un devis de plus : trois documents
   * identiques pour une seule demande client. Enregistrer une seconde fois met
   * donc à jour le même devis, et ne fait rien tant que rien n'a changé.
   */
  const [devisLie, setDevisLie] = useState<Quote | null>(null)
  const [modifie, setModifie] = useState(false)
  const diverge = () => setModifie(true)

  const aEnregistrer = lines.length > 0 && (!devisLie || modifie)
  const convertible = !!devisLie && !modifie

  const saveDraft = () => {
    if (lines.length === 0) return toast(t('dvc_need_line'), 'error')
    if (!clientName.trim()) return toast(t('quote_toast_client_required'), 'error')
    if (devisLie && !modifie) return toast(t('dvc_nothing_to_save'), 'warning')
    if (devisLie) {
      const q = updateQuote(devisLie.id, clientName.trim(), buildItems())
      if (!q) return toast(t('dvc_already_converted'), 'error')
      setDevisLie(q)
      setModifie(false)
      return toast(`✓ ${q.ref} ${t('dvc_updated')}`)
    }
    const q = addQuote(clientName.trim(), buildItems())
    // Le formulaire n'est PLUS vidé : c'est ce devis-là qu'on va convertir.
    setDevisLie(q)
    setModifie(false)
    toast(`✓ ${t('quote_prefix')} ${q.ref} ${t('dvc_saved')}`)
  }

  const convert = () => {
    if (!convertible) return toast(t('dvc_save_first'), 'error')
    const sale = convertQuote(devisLie!.id)
    if (!sale) return toast(t('dvc_already_converted'), 'error')
    toast(`✓ ${devisLie!.ref} ${t('dvc_converted')}`)
    nouveau()
  }

  /** Repart d'un formulaire vierge, détaché du devis précédent. */
  const nouveau = () => {
    setDevisLie(null)
    setModifie(false)
    setLines([])
    setNotes('')
    setClientName('')
    setGlobalDiscount('0')
  }

  /*
   * Conversion d'un devis ENREGISTRÉ : elle passe par le store, qui refuse un
   * devis déjà converti. L'écran appelait directement recordSale sans marquer
   * le devis — d'où six ventes identiques nées d'un même devis.
   */
  const convertir = (q: Quote) => {
    const sale = convertQuote(q.id)
    toast(sale ? `✓ ${q.ref} ${t('dvc_converted')}` : t('dvc_already_converted'), sale ? 'success' : 'error')
  }

  /** Corps du message envoyé au client — même contenu pour WhatsApp et courriel. */
  const messageDevis = (q: Quote) => {
    const lignes = q.items.map((i) => `• ${i.name} × ${i.qty} — ${fmtDH(i.price * i.qty)}`).join('\n')
    return (
      `${t('dvc_msg_hello')} ${q.clientName || ''}\n\n` +
      `${t('dvc_msg_intro')} ${q.ref} (${new Date(q.date).toLocaleDateString('fr-FR')}) :\n` +
      `${lignes}\n\n` +
      `${t('dvc_msg_total')} : ${fmtDH(q.total)}\n\n` +
      `${t('dvc_msg_regards')} — ${settings?.storeName ?? ''}`
    )
  }

  const clientDe = (q: Quote) => clients.find((c) => c.name === q.clientName)

  const envoyerWhatsApp = (q: Quote) => {
    window.open(waLink(clientDe(q)?.phone, messageDevis(q)), '_blank')
  }

  const envoyerMail = (q: Quote) => {
    const client = clientDe(q)
    if (!client?.email) toast(t('dvc_no_email'), 'warning')
    window.open(gmailLink(client?.email, `${t('dvc_msg_subject')} ${q.ref}`, messageDevis(q)), '_blank')
  }

  /*
   * Le PDF sort du GABARIT PARTAGÉ, comme la facture et le bon de commande.
   * Cette page fabriquait sa propre page HTML : le devis ne ressemblait à aucun
   * autre document de l'enseigne, et corriger l'en-tête dans Paramètres n'avait
   * aucun effet sur lui. C'est désormais le même composant, donc le même rendu
   * que l'aperçu de Paramètres › Société.
   */
  const printRef = useRef<HTMLDivElement>(null)

  const refDevis = devisLie?.ref ?? docNumber('DEV', activeStore, quotes.filter((x) => x.storeId === activeStoreId).length + 1, 4)

  const genPdf = () => {
    if (lines.length === 0) return toast(t('dvc_need_line'), 'error')
    printInvoicePdf(printRef.current?.querySelector('.print-area') as HTMLElement)
  }
  /*
   * Le courriel s'ouvre dans GMAIL, pas via `mailto:`. Sans logiciel de
   * messagerie associé au poste — le cas d'un ordinateur de magasin — `mailto:`
   * ouvrait un onglet vide et le message était perdu.
   *
   * Et le corps ne se résumait plus au total : un devis qui n'annonce qu'un
   * montant, sans le détail, ne se compare pas et ne s'accepte pas.
   */
  const sendEmail = () => {
    if (lines.length === 0) return toast(t('dvc_need_line'), 'error')
    const detail = lines
      .map((l) => `• ${l.name} × ${l.qty} — ${fmtDH(r2(l.price * (1 - (l.discount || 0) / 100) * (1 - global / 100)) * l.qty)}`)
      .join('\n')
    const corps =
      `${t('dvc_msg_hello')} ${clientName.trim()}\n\n` +
      `${t('dvc_msg_intro')}${devisLie ? ` ${devisLie.ref}` : ''} :\n${detail}\n\n` +
      `${t('fdoc_total_ht')} : ${fmtDH(totals.afterGlobal)}\n` +
      `${t('fdoc_total_tva')} : ${fmtDH(totals.tva)}\n` +
      `${t('dvc_msg_total')} : ${fmtDH(totals.ttc)}\n` +
      (validity ? `${t('dvc_validity')} : ${new Date(validity).toLocaleDateString('fr-FR')}\n` : '') +
      `\n${t('dvc_msg_regards')} — ${settings?.storeName ?? ''}`
    const objet = `${t('dvc_msg_subject')}${devisLie ? ` ${devisLie.ref}` : ''}`
    window.open(gmailLink(matchedClient?.email, objet, corps), '_blank')
  }

  const q = search.trim().toLowerCase()
  const results = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || p.barcode.includes(q)).slice(0, 50)
    : []

  const recent = useMemo(() => [...quotes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6), [quotes])

  if (!ready) return <Loader />

  const card = 'rounded-2xl border border-gray-200 bg-white/80 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]'
  const input = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 dark:border-white/10 dark:bg-white/5 dark:text-white'

  const parId = new Map(products.map((p) => [p.id, p]))

  return (
    <div className="mx-auto max-w-[1400px]">
      {/*
       * Le devis tel qu'il partira au PDF. Rendu hors écran à la largeur d'une
       * A4 : html2canvas capture ce qui est réellement mis en page, pas une
       * approximation — d'où un PDF identique à l'aperçu de Paramètres.
       */}
      <div ref={printRef} aria-hidden className="pointer-events-none fixed left-[-10000px] top-0 w-[794px]">
        <InvoiceDocument
          title={t('quote_prefix')}
          number={refDevis}
          date={new Date().toISOString()}
          partyLabel={t('fdoc_client')}
          partyName={clientName.trim() || t('bl_walk_in_client')}
          partyAddress={[matchedClient?.address, matchedClient?.city].filter(Boolean).join(', ') || undefined}
          partyLegal={matchedClient?.cin ? `CIN : ${matchedClient.cin}` : undefined}
          contact={
            matchedClient?.phone || matchedClient?.email
              ? { name: matchedClient.name, phone: matchedClient.phone || undefined, email: matchedClient.email || undefined }
              : undefined
          }
          // Un devis PROPOSE : il n'arrête aucune facture.
          showAmountInWords={false}
          observations={notes.trim() || undefined}
          infos={[
            { label: t('fdoc_date_label'), value: new Date().toLocaleDateString('fr-FR') },
            { label: t('dvc_validity'), value: validity ? new Date(validity).toLocaleDateString('fr-FR') : null },
            { label: t('fdoc_client_ref'), value: matchedClient?.code || null },
          ]}
          lines={lines.map((l) => {
            // Remise EFFECTIVE : celle de la ligne composée avec la remise
            // globale. Afficher la seule remise de ligne ferait mentir le total.
            const eff = 100 * (1 - (1 - (l.discount || 0) / 100) * (1 - global / 100))
            return {
              label: l.name,
              ref: parId.get(l.productId)?.barcode || undefined,
              qty: l.qty,
              puHT: r2(l.price * (1 - (l.discount || 0) / 100) * (1 - global / 100)),
              tvaPct: tvaRate,
              remisePct: eff > 0 ? r2(eff) : undefined,
            }
          })}
        />
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <nav className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-zinc-400">
            <span>{t('quote_title')}</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-amber-600 dark:text-amber-400">{t('dvc_new')}</span>
          </nav>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{t('dvc_create_title')}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Dit pourquoi « Convertir » est ouvert ou fermé, plutôt que de
              laisser l'utilisateur deviner devant un bouton grisé. */}
          <span className={`text-xs font-semibold ${convertible ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-zinc-500'}`}>
            {devisLie
              ? modifie
                ? `${devisLie.ref} · ${t('dvc_modified')}`
                : `${devisLie.ref} · ${t('dvc_saved_ready')}`
              : t('dvc_save_first')}
          </span>
          {devisLie && (
            <button onClick={nouveau} className="rounded-full border border-gray-300 px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-100 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5">
              {t('dvc_new_quote')}
            </button>
          )}
          <button
            onClick={saveDraft}
            disabled={!aEnregistrer}
            title={aEnregistrer ? undefined : t('dvc_nothing_to_save')}
            className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5"
          >
            {devisLie ? t('dvc_update_draft') : t('dvc_save_draft')}
          </button>
          <button
            onClick={convert}
            disabled={!convertible}
            title={convertible ? devisLie!.ref : t('dvc_save_first')}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-500 disabled:shadow-none dark:disabled:from-white/10 dark:disabled:to-white/10 dark:disabled:text-zinc-500"
          >
            <Rocket className="h-4 w-4" />{t('dvc_convert')}
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* LEFT */}
        <div className="space-y-5 lg:col-span-2">
          {/* Client info */}
          <section className={`${card} p-5`}>
            <div className="mb-4 flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <UserSearch className="h-5 w-5" />
              <h3 className="text-lg font-semibold">{t('dvc_client_info')}</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-zinc-400">{t('dvc_select_client')}</label>
                <input list="dvc-clients" value={clientName} onChange={(e) => { diverge(); setClientName(e.target.value) }} placeholder={t('dvc_new_client')} className={input} />
                <datalist id="dvc-clients">
                  {clients.map((c) => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-zinc-400">{t('dvc_validity')}</label>
                <input type="date" value={validity} onChange={(e) => setValidity(e.target.value)} className={input} />
              </div>
            </div>
          </section>

          {/* Lines */}
          <section className={`${card} relative z-30 p-5`}>
            <div className="mb-4 flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <ShoppingBasket className="h-5 w-5" />
              <h3 className="text-lg font-semibold">{t('dvc_lines')}</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-[11px] uppercase tracking-widest text-gray-400 dark:border-white/10 dark:text-zinc-500">
                    <th className="py-2 font-medium">{t('dvc_col_product')}</th>
                    <th className="px-2 py-2 font-medium">{t('dvc_col_qty')}</th>
                    <th className="px-2 py-2 font-medium">{t('dvc_col_price')}</th>
                    <th className="px-2 py-2 font-medium">{t('dvc_col_discount')}</th>
                    <th className="px-2 py-2 text-right font-medium">{t('dvc_col_total')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm dark:divide-white/5">
                  {lines.map((l) => (
                    <tr key={l.productId}>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-white/5">
                            <Package className="h-5 w-5" />
                          </div>
                          <p className="font-semibold text-gray-900 dark:text-white">{l.name}</p>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <input type="number" min={1} value={l.qty} onChange={(e) => patchLine(l.productId, { qty: Math.max(1, parseInt(e.target.value || '1', 10) || 1) })} className="w-16 rounded-lg border border-gray-200 bg-gray-50 p-1.5 text-center text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-white/5 dark:text-white" />
                      </td>
                      <td className="px-2 py-3">
                        <input type="number" min={0} value={l.price} onChange={(e) => patchLine(l.productId, { price: Math.max(0, parseFloat(e.target.value) || 0) })} className="w-24 rounded-lg border border-gray-200 bg-gray-50 p-1.5 text-right text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-white/5 dark:text-white" />
                      </td>
                      <td className="px-2 py-3">
                        <input type="number" min={0} max={100} value={l.discount} onChange={(e) => patchLine(l.productId, { discount: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })} className="w-16 rounded-lg border border-gray-200 bg-gray-50 p-1.5 text-center text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-white/5 dark:text-white" />
                      </td>
                      <td className="px-2 py-3 text-right font-bold tabular-nums text-gray-900 dark:text-white">{fmtDH(l.price * l.qty * (1 - (l.discount || 0) / 100))}</td>
                      <td className="py-3 text-right">
                        <button onClick={() => removeLine(l.productId)} className="text-rose-400 transition hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400 dark:text-zinc-500">{t('dvc_empty_lines')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Add product */}
            <div className="relative mt-4 border-t border-gray-100 pt-4 dark:border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('dvc_add_via')} className={`${input} border-2 border-dashed pl-9`} />
              </div>
              {results.length > 0 && (
                <div className="absolute z-40 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900">
                  {results.map((p) => (
                    <button key={p.id} onClick={() => addLine(p.id)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-white/5">
                      <span className="truncate text-gray-900 dark:text-white">{p.name}</span>
                      <span className="flex items-center gap-2 text-xs text-gray-400">{fmtDH(p.price)} · {availableStock(p)} <Plus className="h-4 w-4 text-amber-500" /></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Recent quotes */}
          {recent.length > 0 && (
            <section className={`${card} p-5`}>
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{t('dvc_recent')}</h3>
              <div className="space-y-2">
                {recent.map((quote) => (
                  <div key={quote.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:border-white/5 dark:bg-white/[0.02]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{quote.ref} · {quote.clientName}</p>
                      <p className="text-xs text-gray-400">{new Date(quote.date).toLocaleDateString('fr-FR')} · {quote.items.length} art.</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">{fmtDH(quote.total)}</p>
                    {quote.status === 'converti' && (
                      <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                        {t('dvc_badge_converted')}
                      </span>
                    )}
                    <button onClick={() => envoyerWhatsApp(quote)} className="shrink-0 rounded-lg p-2 text-emerald-500 transition hover:bg-emerald-500/10" title={t('dvc_send_wa')}>
                      <MessageCircle className="h-4 w-4" />
                    </button>
                    <button onClick={() => envoyerMail(quote)} className="shrink-0 rounded-lg p-2 text-sky-500 transition hover:bg-sky-500/10" title={t('dvc_send_mail')}>
                      <Mail className="h-4 w-4" />
                    </button>
                    {/* Converti = boutons retirés : c'est le clic répété sur ces
                        icônes qui créait un document de plus à chaque fois. */}
                    {quote.status !== 'converti' && (
                      <>
                        {/* Devis → COMMANDE : l'engagement d'abord, la livraison
                            sortira le stock plus tard, en une ou plusieurs fois. */}
                        <button
                          onClick={() => {
                            const o = convertQuoteToOrder(quote.id)
                            if (o) { toast(`✓ ${quote.ref} ${t('co_toast_converted')} — ${o.ref}`); router.push('/ventes/commandes') }
                          }}
                          className="shrink-0 rounded-lg bg-sky-500/10 p-2 text-sky-600 transition hover:bg-sky-500/20 dark:text-sky-400"
                          title={t('co_convert_from_quote')}
                        >
                          <ClipboardList className="h-4 w-4" />
                        </button>
                        {/* Devis → VENTE immédiate : encaissement direct. */}
                        <button onClick={() => convertir(quote)} className="shrink-0 rounded-lg bg-amber-500/10 p-2 text-amber-600 transition hover:bg-amber-500/20 dark:text-amber-400" title={t('dvc_convert')}>
                          <Rocket className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button onClick={() => deleteQuote(quote.id)} className="shrink-0 rounded-lg p-2 text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT */}
        <div className="space-y-5 lg:col-span-1">
          {/* Summary */}
          <section className={`${card} relative overflow-hidden p-5`}>
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{t('dvc_summary')}</h3>
            <div className="mb-5 space-y-3">
              <div className="flex justify-between text-sm text-gray-500 dark:text-zinc-400">
                <span>{t('dvc_subtotal')}</span>
                <span className="tabular-nums">{fmtDH(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-zinc-400">
                <span>{t('dvc_global_discount')}</span>
                <input type="number" min={0} max={100} value={globalDiscount} onChange={(e) => { diverge(); setGlobalDiscount(e.target.value) }} className="w-16 rounded-lg border border-gray-200 bg-gray-50 p-1 text-center text-sm text-gray-900 outline-none focus:border-amber-400 dark:border-white/10 dark:bg-white/5 dark:text-white" />
              </div>
              <div className="flex justify-between text-sm text-gray-500 dark:text-zinc-400">
                <span>{t('dvc_tva')} ({tvaRate}%)</span>
                <span className="tabular-nums">{fmtDH(totals.tva)}</span>
              </div>
            </div>
            <div className="mb-5 border-t border-gray-200 pt-4 dark:border-white/10">
              <div className="flex items-end justify-between">
                <span className="text-base font-semibold text-gray-900 dark:text-white">{t('dvc_total_ttc')}</span>
                <div className="text-right">
                  <span className="block text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">{fmtDH(totals.ttc)}</span>
                  <span className="text-[11px] uppercase tracking-widest text-gray-400">{t('dvc_currency')}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <button onClick={sendEmail} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98]">
                <Send className="h-4 w-4" />{t('dvc_send_email')}
              </button>
              <button onClick={genPdf} className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-100 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5">
                <FileDown className="h-4 w-4" />{t('dvc_gen_pdf')}
              </button>
            </div>
          </section>

          {/* Notes */}
          <section className={`${card} p-5`}>
            <label className="mb-2 block text-xs font-medium text-gray-500 dark:text-zinc-400">{t('dvc_conditions')}</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('dvc_conditions_ph')} className={input} />
          </section>
        </div>
      </div>
    </div>
  )
}

export default function DevisPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
