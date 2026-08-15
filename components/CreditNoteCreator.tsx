'use client'

/*
 * CRÉATION D'UN AVOIR depuis un document d'origine (facture client ou achat
 * fournisseur). Composant UNIQUE pour les deux sens : la fenêtre est la même,
 * seules les données changent — deux copies auraient divergé à la première
 * retouche.
 *
 * L'utilisateur choisit les QUANTITÉS à créditer ligne par ligne, jamais un
 * montant libre : le total se calcule, comme l'exige le store. Le plafond
 * (reste à couvrir de la facture) est affiché et, s'il est dépassé, seul un
 * porteur du droit de validation peut forcer — en le voyant écrit.
 */

import { useMemo, useState } from 'react'
import { FileMinus, Minus, Plus } from 'lucide-react'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { usePermissions } from '@/lib/access'
import { fmtDH, roundMoney, useDroguerie, type CreditNote, type CreditNoteKind, type CreditNoteLine, type CreditNoteReason } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

export const REASON_KEY: Record<CreditNoteReason, TKey> = {
  retour_marchandise: 'cn_reason_return',
  produit_defectueux: 'cn_reason_defect',
  erreur_facturation: 'cn_reason_billing',
  geste_commercial: 'cn_reason_gesture',
  autre: 'cn_reason_other',
}

export interface CreditNoteOriginLine {
  productId: string
  name: string
  ref?: string
  /** Quantité facturée — plafond de la quantité créditables. */
  maxQty: number
  puHT: number
  tvaPct: number
}

export default function CreditNoteCreator({
  open,
  onClose,
  kind,
  partyId,
  partyName,
  originId,
  originRef,
  originDate,
  originTotalTTC,
  returnId,
  supplierInvoiceRef,
  supplierBlRef,
  lines,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  kind: CreditNoteKind
  partyId?: string
  partyName: string
  originId: string
  originRef: string
  originDate?: string
  originTotalTTC: number
  returnId?: string
  supplierInvoiceRef?: string
  supplierBlRef?: string
  lines: CreditNoteOriginLine[]
  onCreated?: (avoir: CreditNote) => void
}) {
  const { createCreditNote } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()

  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [reason, setReason] = useState<CreditNoteReason>('retour_marchandise')
  const [note, setNote] = useState('')
  // Plafond dépassé : on mémorise le refus pour proposer le forçage au gérant.
  const [depasse, setDepasse] = useState<number | null>(null)

  const peutForcer = can(kind === 'client' ? 'sale.credit_note_validate' : 'purch.credit_note')

  const setQty = (id: string, max: number, delta: number) => {
    setDepasse(null)
    setQtys((q) => ({ ...q, [id]: Math.max(0, Math.min(max, (q[id] ?? 0) + delta)) }))
  }

  const retenues: CreditNoteLine[] = useMemo(
    () =>
      lines
        .filter((l) => (qtys[l.productId] ?? 0) > 0)
        .map((l) => ({ productId: l.productId, name: l.name, ref: l.ref, qty: qtys[l.productId], puHT: l.puHT, tvaPct: l.tvaPct })),
    [lines, qtys]
  )
  const totalTTC = roundMoney(retenues.reduce((s, l) => s + l.puHT * l.qty * (1 + l.tvaPct / 100), 0))

  const creer = (forcer = false) => {
    const r = createCreditNote({
      kind,
      partyId,
      partyName,
      originId,
      originRef,
      originDate,
      originTotalTTC,
      returnId,
      supplierInvoiceRef,
      supplierBlRef,
      reason,
      note: note.trim() || undefined,
      lines: retenues,
      forcer,
    })
    if (!r.ok) {
      if (r.raison === 'sans_ligne') toast(t('cn_toast_no_line'), 'error')
      else setDepasse(r.plafond ?? 0)
      return
    }
    toast(`✓ ${r.avoir.ref} ${t('cn_toast_created')} — ${fmtDH(r.avoir.totalTTC)}`)
    setQtys({})
    setNote('')
    setDepasse(null)
    onClose()
    onCreated?.(r.avoir)
  }

  return (
    <Modal open={open} onClose={onClose} title={kind === 'client' ? t('cn_create_client_title') : t('cn_create_supplier_title')} maxWidth="max-w-lg">
      {/* Rappel du document d'origine : un avoir n'existe jamais seul. */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-gray-100 px-3 py-2 dark:border-white/10">
          <p className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-500">{kind === 'client' ? t('cn_origin_invoice') : t('cn_origin_purchase')}</p>
          <p className="font-semibold text-gray-900 dark:text-white">{originRef}</p>
        </div>
        <div className="rounded-xl border border-gray-100 px-3 py-2 dark:border-white/10">
          <p className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-500">{kind === 'client' ? t('fdoc_client') : t('fdoc_supplier')}</p>
          <p className="truncate font-semibold text-gray-900 dark:text-white">{partyName}</p>
        </div>
        <div className="rounded-xl border border-gray-100 px-3 py-2 dark:border-white/10">
          <p className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-500">{t('cn_origin_amount')}</p>
          <p className="font-semibold tabular-nums text-gray-900 dark:text-white">{fmtDH(originTotalTTC)}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-500/10">
          <p className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">{t('cn_amount')}</p>
          <p className="font-bold tabular-nums text-amber-700 dark:text-amber-300">{fmtDH(totalTTC)}</p>
        </div>
      </div>

      {/* Lignes à créditer */}
      <div className="mt-4 max-h-[38vh] space-y-2 overflow-auto">
        {lines.map((l) => (
          <div key={l.productId} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{l.name}</p>
              <p className="text-xs tabular-nums text-gray-500 dark:text-zinc-400">
                {t('cn_billed')} {l.maxQty} × {fmtDH(roundMoney(l.puHT * (1 + l.tvaPct / 100)))} TTC
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setQty(l.productId, l.maxQty, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:border-amber-300 hover:bg-amber-50 dark:border-white/10 dark:bg-[#12121a] dark:text-zinc-400">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-bold tabular-nums text-gray-900 dark:text-white">{qtys[l.productId] ?? 0}</span>
              <button onClick={() => setQty(l.productId, l.maxQty, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:border-amber-300 hover:bg-amber-50 dark:border-white/10 dark:bg-[#12121a] dark:text-zinc-400">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label">{t('cn_reason')}</label>
          <Select
            value={reason}
            onChange={(v) => setReason(v as CreditNoteReason)}
            options={(Object.keys(REASON_KEY) as CreditNoteReason[]).map((r) => ({ value: r, label: t(REASON_KEY[r]) }))}
          />
        </div>
        <div>
          <label className="field-label">{t('cn_note')}</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="input-field" placeholder={t('cn_note_ph')} />
        </div>
      </div>

      {/* Plafond dépassé : le refus est expliqué, le forçage est un choix visible. */}
      {depasse !== null && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
          {t('cn_over_cap_1')} <b>{fmtDH(depasse)}</b>. {t('cn_over_cap_2')}
          {peutForcer && (
            <button onClick={() => creer(true)} className="mt-2 block w-full rounded-lg border border-rose-300 py-1.5 text-xs font-bold uppercase tracking-wide transition hover:bg-rose-100 dark:border-rose-500/30 dark:hover:bg-rose-500/20">
              {t('cn_force')}
            </button>
          )}
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button onClick={onClose} className="btn-secondary">{t('cli_cancel')}</button>
        <button onClick={() => creer(false)} disabled={retenues.length === 0} className="btn-primary disabled:cursor-not-allowed disabled:opacity-40">
          <FileMinus className="h-4 w-4" />
          {t('cn_create')}
        </button>
      </div>
    </Modal>
  )
}
