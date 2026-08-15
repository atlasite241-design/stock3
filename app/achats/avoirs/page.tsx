'use client'

/*
 * AVOIRS FOURNISSEURS. Même moteur que les avoirs clients — l'entité et les
 * règles d'argent sont communes — mais le sens change : c'est le fournisseur
 * qui NOUS doit. Un remboursement encaissé ENTRE en caisse, et l'imputation se
 * fait sur un prochain paiement fournisseur.
 *
 * Se crée depuis Achats › Factures (bouton « Générer un avoir ») : jamais sans
 * document d'origine.
 */

import { useMemo, useRef, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { BadgeCheck, Banknote, Eye, FileMinus, Printer, Search, Wallet, XCircle } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import InvoiceDocument from '@/components/InvoiceDocument'
import { useToast } from '@/components/Toast'
import { REASON_KEY } from '@/components/CreditNoteCreator'
import { usePermissions } from '@/lib/access'
import { printInvoicePdf } from '@/lib/invoicePdf'
import {
  CREDIT_NOTE_META,
  creditNoteRemaining,
  creditNoteUsed,
  fmtDH,
  useDroguerie,
  type CreditNote,
  type CreditNoteStatus,
} from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const STATUS_KEY: Record<CreditNoteStatus, TKey> = {
  brouillon: 'cn_status_brouillon',
  controle: 'cn_status_controle',
  valide: 'cn_status_valide',
  partiel: 'cn_status_partiel',
  solde: 'cn_status_solde',
  annule: 'cn_status_annule',
}

type Filtre = 'tous' | 'brouillon' | 'valide' | 'non_utilise' | 'partiel' | 'solde' | 'annule'

function Content() {
  const { ready, creditNotes, validateCreditNote, cancelCreditNote, consumeCreditNote } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()
  const printRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [docTarget, setDocTarget] = useState<CreditNote | null>(null)
  const [cancelTarget, setCancelTarget] = useState<CreditNote | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [refundTarget, setRefundTarget] = useState<CreditNote | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundMethod, setRefundMethod] = useState<'especes' | 'virement' | 'cheque'>('especes')

  const avoirs = useMemo(
    () =>
      creditNotes
        .filter((a) => a.kind === 'fournisseur')
        .filter((a) => {
          if (filtre === 'tous') return true
          if (filtre === 'non_utilise') return a.status === 'valide' && creditNoteUsed(a) === 0
          return a.status === filtre
        })
        .filter((a) => {
          const q = query.trim().toLowerCase()
          return (
            !q ||
            a.ref.toLowerCase().includes(q) ||
            a.partyName.toLowerCase().includes(q) ||
            a.originRef.toLowerCase().includes(q) ||
            (a.supplierInvoiceRef ?? '').toLowerCase().includes(q) ||
            (a.supplierBlRef ?? '').toLowerCase().includes(q)
          )
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [creditNotes, filtre, query]
  )

  const totalDisponible = useMemo(
    () => creditNotes.filter((a) => a.kind === 'fournisseur').reduce((s, a) => s + creditNoteRemaining(a), 0),
    [creditNotes]
  )

  if (!ready) return <Loader />

  const valider = (a: CreditNote) => {
    validateCreditNote(a.id)
    toast(`✓ ${a.ref} ${t('cn_toast_validated')}`)
  }

  const annuler = () => {
    if (!cancelTarget) return
    if (!cancelReason.trim()) return toast(t('cn_cancel_reason_ph'), 'error')
    const r = cancelCreditNote(cancelTarget.id, cancelReason.trim())
    if (!r.ok && r.raison === 'utilise') toast(t('cn_cancel_used'), 'error')
    else toast(`${cancelTarget.ref} ${t('cn_toast_cancelled')}`)
    setCancelTarget(null)
    setCancelReason('')
  }

  const rembourser = () => {
    if (!refundTarget) return
    const montant = parseFloat(refundAmount.replace(',', '.')) || 0
    if (montant <= 0) return toast(t('exp_toast_invalid_amount'), 'error')
    const r = consumeCreditNote(refundTarget.id, montant, { refund: { method: refundMethod } })
    if (r.ok) toast(`✓ ${refundTarget.ref} ${t('cn_toast_refunded')} — ${fmtDH(r.applique)}`)
    setRefundTarget(null)
    setRefundAmount('')
  }

  const FILTRES: { key: Filtre; label: string }[] = [
    { key: 'tous', label: t('cn_filter_all') },
    { key: 'brouillon', label: t('cn_status_brouillon') },
    { key: 'valide', label: t('cn_status_valide') },
    { key: 'non_utilise', label: t('cn_filter_unused') },
    { key: 'partiel', label: t('cn_status_partiel') },
    { key: 'solde', label: t('cn_status_solde') },
    { key: 'annule', label: t('cn_status_annule') },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <FileMinus className="h-6 w-6 text-amber-500" />
            {t('nav_purch_credit_notes')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('cn_supplier_sub')}</p>
        </div>
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('inv_search_placeholder')} className="input-field pl-10" />
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-500/10">
            <FileMinus className="h-5 w-5" />
          </div>
          <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('nav_purch_credit_notes')}</p>
          <p className="mt-1 text-[22px] font-bold text-gray-900 dark:text-white">{creditNotes.filter((a) => a.kind === 'fournisseur').length}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10">
            <Wallet className="h-5 w-5" />
          </div>
          <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('cn_available')}</p>
          <p className="mt-1 text-[22px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtDH(totalDisponible)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTRES.map((f) => (
          <button key={f.key} onClick={() => setFiltre(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filtre === f.key ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-zinc-300'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-x-auto">
        {avoirs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <FileMinus className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('cn_none')}</p>
          </div>
        ) : (
          <table className="w-full min-w-[1020px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                <th className="px-4 py-3">{t('cn_col_ref')}</th>
                <th className="px-4 py-3">{t('cn_col_date')}</th>
                <th className="px-4 py-3">{t('fdoc_supplier')}</th>
                <th className="px-4 py-3">{t('cn_origin_purchase')}</th>
                <th className="px-4 py-3">{t('cn_supplier_bl')}</th>
                <th className="px-4 py-3 text-right">{t('cn_col_ttc')}</th>
                <th className="px-4 py-3 text-right">{t('cn_col_remaining')}</th>
                <th className="px-4 py-3">{t('cn_col_status')}</th>
                <th className="px-4 py-3">{t('cn_col_by')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {avoirs.map((a) => {
                const reste = creditNoteRemaining(a)
                return (
                  <tr key={a.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-2.5 font-semibold text-amber-600 dark:text-amber-400">{a.ref}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(a.date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-zinc-300">{a.partyName}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{a.supplierInvoiceRef || a.originRef}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{a.supplierBlRef || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900 dark:text-white">{fmtDH(a.totalTTC)}</td>
                    <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${reste > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{fmtDH(reste)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${CREDIT_NOTE_META[a.status].chip}`}>
                        {t(STATUS_KEY[a.status])}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{a.createdBy ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setDocTarget(a)} className="rounded-lg p-2 text-gray-400 transition hover:bg-sky-50 hover:text-sky-600 dark:text-zinc-500" title={t('fac_view')}>
                          <Eye className="h-4 w-4" />
                        </button>
                        {(a.status === 'brouillon' || a.status === 'controle') && can('purch.credit_note') && (
                          <button onClick={() => valider(a)} className="rounded-lg p-2 text-emerald-500 transition hover:bg-emerald-50 dark:hover:bg-emerald-500/10" title={t('cn_validate')}>
                            <BadgeCheck className="h-4 w-4" />
                          </button>
                        )}
                        {(a.status === 'valide' || a.status === 'partiel') && reste > 0 && can('purch.credit_note') && (
                          <button onClick={() => { setRefundTarget(a); setRefundAmount(String(reste)) }} className="rounded-lg p-2 text-amber-500 transition hover:bg-amber-50 dark:hover:bg-amber-500/10" title={t('cn_refund')}>
                            <Banknote className="h-4 w-4" />
                          </button>
                        )}
                        {a.status !== 'annule' && a.status !== 'solde' && creditNoteUsed(a) === 0 && can('purch.credit_note') && (
                          <button onClick={() => setCancelTarget(a)} className="rounded-lg p-2 text-rose-400 transition hover:bg-rose-50 dark:hover:bg-rose-500/10" title={t('cn_cancel_action')}>
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------- Document AVOIR FOURNISSEUR ---------- */}
      <Modal open={!!docTarget} onClose={() => setDocTarget(null)} title={docTarget?.ref ?? ''} maxWidth="max-w-4xl">
        {docTarget && (
          <>
            <div ref={printRef} className="max-h-[60vh] overflow-auto rounded-xl border border-gray-100 dark:border-white/10">
              <InvoiceDocument
                title={t('cn_supplier_doc_title')}
                number={docTarget.ref}
                date={docTarget.date}
                partyLabel={t('fdoc_supplier')}
                partyName={docTarget.partyName}
                infos={[
                  { label: t('cn_origin_purchase'), value: docTarget.supplierInvoiceRef || docTarget.originRef },
                  { label: t('cn_supplier_bl'), value: docTarget.supplierBlRef || null },
                  { label: t('cn_origin_return_ref'), value: docTarget.returnId ? docTarget.originRef : null },
                  { label: t('cn_reason'), value: t(REASON_KEY[docTarget.reason]) },
                ]}
                // Pas d'« arrêté à la somme » : c'est un document d'achat.
                showAmountInWords={false}
                observations={`${t('cn_origin_purchase')} : ${docTarget.supplierInvoiceRef || docTarget.originRef}${docTarget.supplierBlRef ? `\n${t('cn_supplier_bl')} : ${docTarget.supplierBlRef}` : ''}\n${t('cn_reason')} : ${t(REASON_KEY[docTarget.reason])}${docTarget.note ? `\n${docTarget.note}` : ''}`}
                lines={docTarget.lines.map((l) => ({ label: l.name, ref: l.ref, qty: l.qty, puHT: l.puHT, tvaPct: l.tvaPct }))}
              />
            </div>
            {docTarget.uses.length > 0 && (
              <div className="mt-3 rounded-xl border border-gray-100 p-3 text-sm dark:border-white/10">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">{t('cn_uses_title')}</p>
                {docTarget.uses.map((u) => (
                  <div key={u.id} className="flex items-center justify-between border-b border-gray-50 py-1.5 last:border-0 dark:border-white/5">
                    <span className="text-xs text-gray-500">{new Date(u.date).toLocaleString('fr-FR')} · {u.user ?? '—'}</span>
                    <span className="text-xs text-gray-600 dark:text-zinc-300">{u.refund ? t('cn_use_refund') : `${t('cn_use_on')} ${u.targetRef ?? '—'}`}</span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{fmtDH(u.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => printInvoicePdf(printRef.current?.querySelector('.print-area') as HTMLElement)} className="btn-primary mt-4 w-full">
              <Printer className="h-4 w-4" />
              {t('fac_print')}
            </button>
          </>
        )}
      </Modal>

      {/* ---------- Annulation motivée ---------- */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title={t('cn_cancel_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-300">{t('cn_cancel_desc')}</p>
        <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="input-field mt-3" placeholder={t('cn_cancel_reason_ph')} autoFocus />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setCancelTarget(null)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={annuler} className="btn-danger"><XCircle className="h-4 w-4" />{t('cn_cancel_action')}</button>
        </div>
      </Modal>

      {/* ---------- Remboursement (le fournisseur NOUS rembourse : entrée en caisse) ---------- */}
      <Modal open={!!refundTarget} onClose={() => setRefundTarget(null)} title={t('cn_refund_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-300">{t('cn_refund_desc')}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{t('cn_refund_amount')}</label>
            <input value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} inputMode="decimal" className="input-field tabular-nums" autoFocus />
          </div>
          <div>
            <label className="field-label">{t('cn_refund_method')}</label>
            <Select value={refundMethod} onChange={(v) => setRefundMethod(v as typeof refundMethod)}
              options={[
                { value: 'especes', label: t('pay_method_especes') },
                { value: 'virement', label: t('pay_method_virement') },
                { value: 'cheque', label: t('pay_method_cheque') },
              ]} />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setRefundTarget(null)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={rembourser} className="btn-primary"><Banknote className="h-4 w-4" />{t('cn_refund')}</button>
        </div>
      </Modal>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
