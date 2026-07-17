'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  DoorClosed,
  DoorOpen,
  Landmark,
  Lock,
  Repeat,
  Wallet,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, cash, sales, clientPayments, sessions, currentSession, expectedCash, openSession, closeSession, addCashEntry } =
    useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [openModal, setOpenModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [entryModal, setEntryModal] = useState<'depense' | 'recette' | null>(null)
  const [transferModal, setTransferModal] = useState(false)
  const [transferDirection, setTransferDirection] = useState<'sortie' | 'entree'>('sortie')
  const [openingAmount, setOpeningAmount] = useState('500')
  const [closingAmount, setClosingAmount] = useState('')
  const [entryLabel, setEntryLabel] = useState('')
  const [entryAmount, setEntryAmount] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const urlConsumed = useRef(false)

  // Deep-link support from the sidebar "Caisse" submenu
  useEffect(() => {
    if (!ready || urlConsumed.current) return
    urlConsumed.current = true
    const action = new URLSearchParams(window.location.search).get('action')
    if (action === 'open' && !currentSession) setOpenModal(true)
    if (action === 'close' && currentSession) {
      setClosingAmount(String(Math.round(expectedCash(currentSession))))
      setCloseModal(true)
    }
    if (action === 'depense' && currentSession) setEntryModal('depense')
    if (action === 'recette' && currentSession) setEntryModal('recette')
    if (action === 'transfert' && currentSession) setTransferModal(true)
  }, [ready, currentSession, expectedCash])

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const since = currentSession?.openedAt ?? new Date(0).toISOString()
  const sessionSales = sales.filter((s) => s.date >= since)
  const sumSales = (mode: 'especes' | 'carte' | 'credit' | 'mixte') =>
    sessionSales.filter((s) => s.payment === mode).reduce((a, s) => a + s.total, 0)
  const salesEspeces = sumSales('especes') + sumSales('mixte')
  const salesCarte = sumSales('carte')
  const salesCredit = sumSales('credit')
  const salesVirement = clientPayments.filter((p) => p.date >= since && p.method === 'virement').reduce((a, p) => a + p.amount, 0)
  const cashSales = salesEspeces
  const sessionCash = cash.filter((c) => c.date >= since)
  const isTransfer = (label: string) => label.startsWith('Transfert') || label.startsWith('تحويل')
  const retraits = sessionCash.filter((c) => c.type === 'depense' && isTransfer(c.label)).reduce((a, c) => a + c.amount, 0)
  const realDepenses = sessionCash.filter((c) => c.type === 'depense' && !isTransfer(c.label)).reduce((a, c) => a + c.amount, 0)
  const otherCashIn = sessionCash.filter((c) => c.type === 'recette').reduce((a, c) => a + c.amount, 0)
  const depenses = realDepenses + retraits
  const expected = currentSession ? expectedCash(currentSession) : 0
  const countedNum = parseFloat(closingAmount.replace(',', '.')) || 0

  const closureRows: { label: string; value: number; kind: 'base' | 'in' | 'out' | 'info' }[] = [
    { label: t('clot_float'), value: currentSession?.openingAmount ?? 0, kind: 'base' },
    { label: t('clot_cash_sales'), value: salesEspeces, kind: 'in' },
    { label: t('clot_card'), value: salesCarte, kind: 'info' },
    { label: t('clot_transfer'), value: salesVirement, kind: 'info' },
    { label: t('clot_credit'), value: salesCredit, kind: 'info' },
    ...(otherCashIn > 0 ? [{ label: t('clot_other_in'), value: otherCashIn, kind: 'in' as const }] : []),
    { label: t('clot_expenses'), value: realDepenses, kind: 'out' as const },
    { label: t('clot_withdrawals'), value: retraits, kind: 'out' as const },
  ]

  const cards = [
    { label: t('cj_card_float'), value: fmtDH(currentSession?.openingAmount ?? 0), icon: Wallet, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('cj_card_cash_sales'), value: fmtDH(cashSales), icon: ArrowUpCircle, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
    { label: t('cj_card_expenses'), value: fmtDH(depenses), icon: ArrowDownCircle, cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' },
    { label: t('cj_card_expected'), value: fmtDH(expected), icon: Banknote, cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400' },
  ]

  const doOpen = () => {
    openSession(parseFloat(openingAmount.replace(',', '.')) || 0)
    toast(t('cj_toast_opened'))
    setOpenModal(false)
  }

  const doClose = () => {
    const counted = parseFloat(closingAmount.replace(',', '.')) || 0
    closeSession(counted)
    const diff = counted - expected
    toast(
      diff === 0
        ? t('cj_toast_closed_ok')
        : `${t('cj_toast_closed_gap')} ${fmtDH(diff)}`,
      diff === 0 ? 'success' : 'error'
    )
    setCloseModal(false)
    setClosingAmount('')
  }

  const doEntry = () => {
    if (!entryModal) return
    const amount = parseFloat(entryAmount.replace(',', '.')) || 0
    if (!entryLabel.trim() || amount <= 0) {
      toast(t('cj_toast_label_amount_required'), 'error')
      return
    }
    addCashEntry(entryModal, entryLabel.trim(), amount)
    toast(`✓ ${entryModal === 'depense' ? t('cj_expense') : t('cj_income')} enregistrée`)
    setEntryModal(null)
    setEntryLabel('')
    setEntryAmount('')
  }

  const doTransfer = () => {
    const amount = parseFloat(transferAmount.replace(',', '.')) || 0
    if (amount <= 0) {
      toast(t('cj_toast_invalid_amount'), 'error')
      return
    }
    const label = transferDirection === 'sortie' ? t('cj_to_bank_label') : t('cj_from_bank_label')
    addCashEntry(transferDirection === 'sortie' ? 'depense' : 'recette', label, amount)
    toast(`✓ ${label} — ${fmtDH(amount)}`)
    setTransferModal(false)
    setTransferAmount('')
    setTransferDirection('sortie')
  }

  const closedSessions = sessions.filter((s) => s.closedAt)

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('cj_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {currentSession
              ? `${t('cj_open_since')} ${new Date(currentSession.openedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
              : t('cj_closed')}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {currentSession ? (
            <>
              <button onClick={() => setEntryModal('recette')} className="btn-secondary">
                <ArrowUpCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                {t('cj_income')}
              </button>
              <button onClick={() => setEntryModal('depense')} className="btn-secondary">
                <ArrowDownCircle className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                {t('cj_expense')}
              </button>
              <button onClick={() => setTransferModal(true)} className="btn-secondary">
                <Repeat className="h-4 w-4 text-sky-500 dark:text-sky-400" />
                {t('cj_transfer')}
              </button>
              <button onClick={() => { setClosingAmount(String(Math.round(expected))); setCloseModal(true) }} className="btn-primary">
                <DoorClosed className="h-4 w-4" />
                {t('cj_close_register')}
              </button>
            </>
          ) : (
            <button onClick={() => setOpenModal(true)} className="btn-primary">
              <DoorOpen className="h-4 w-4" />
              {t('cj_open_register')}
            </button>
          )}
        </div>
      </motion.div>

      {currentSession && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.4 }}
              className="glass-card glass-card-hover p-5"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.cls}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{c.label}</p>
              <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
                {c.value}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {!currentSession && (
        <div className="glass-card flex flex-col items-center gap-3 p-10 text-center">
          <Lock className="h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500 dark:text-zinc-400">{t('cj_empty_state')}</p>
        </div>
      )}

      {/* Journal */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="border-b border-gray-100 dark:border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('cj_journal_title')}</h2>
          <p className="text-xs text-gray-500 dark:text-zinc-400">{t('cj_journal_subtitle')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3">{t('cj_col_date')}</th>
                <th className="px-5 py-3">{t('cj_col_label')}</th>
                <th className="px-5 py-3">{t('cj_col_type')}</th>
                <th className="px-5 py-3 text-right">{t('cj_col_amount')}</th>
              </tr>
            </thead>
            <tbody>
              {cash.slice(0, 30).map((c) => (
                <tr key={c.id} className="border-b border-gray-50">
                  <td className="px-5 py-3 text-sm text-gray-600 dark:text-zinc-400">
                    {new Date(c.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}{' '}
                    {new Date(c.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-white">{c.label}</td>
                  <td className="px-5 py-3">
                    {c.label.startsWith('Transfert') ? (
                      <span className="rounded-lg border border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/10 px-2 py-1 text-xs font-bold text-sky-700 dark:text-sky-400">
                        {t('cj_transfer')}
                      </span>
                    ) : (
                      <span
                        className={`rounded-lg border px-2 py-1 text-xs font-bold ${
                          c.type === 'recette'
                            ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700'
                            : 'border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 text-rose-700'
                        }`}
                      >
                        {c.type === 'recette' ? t('cj_income') : t('cj_expense')}
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-5 py-3 text-right text-sm font-bold tabular-nums ${
                      c.type === 'recette' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                    }`}
                  >
                    {c.type === 'recette' ? '+' : '−'}
                    {fmtDH(c.amount)}
                  </td>
                </tr>
              ))}
              {cash.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('cj_no_movement')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Closed sessions history */}
      {closedSessions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="glass-card overflow-hidden"
        >
          <div className="border-b border-gray-100 dark:border-white/10 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('cj_closures_history')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  <th className="px-5 py-3">{t('cj_col_opening')}</th>
                  <th className="px-5 py-3">{t('cj_col_closing')}</th>
                  <th className="px-5 py-3">{t('cj_col_expected')}</th>
                  <th className="px-5 py-3">{t('cj_col_counted')}</th>
                  <th className="px-5 py-3 text-right">{t('cj_col_diff')}</th>
                </tr>
              </thead>
              <tbody>
                {closedSessions.map((s) => {
                  const diff = (s.closingAmount ?? 0) - (s.expectedAmount ?? 0)
                  return (
                    <tr key={s.id} className="border-b border-gray-50">
                      <td className="px-5 py-3 text-sm text-gray-600 dark:text-zinc-400">
                        {new Date(s.openedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600 dark:text-zinc-400">
                        {s.closedAt && new Date(s.closedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">{fmtDH(s.expectedAmount ?? 0)}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{fmtDH(s.closingAmount ?? 0)}</td>
                      <td
                        className={`px-5 py-3 text-right text-sm font-bold tabular-nums ${
                          diff === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                        }`}
                      >
                        {diff > 0 ? '+' : ''}
                        {fmtDH(diff)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Open modal */}
      <Modal open={openModal} onClose={() => setOpenModal(false)} title={t('cj_open_register')} maxWidth="max-w-sm">
        <label className="field-label">{t('cj_cash_float_dh')}</label>
        <input
          type="number"
          min="0"
          value={openingAmount}
          onChange={(e) => setOpeningAmount(e.target.value)}
          className="input-field"
          autoFocus
        />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setOpenModal(false)} className="btn-secondary">{t('cj_cancel')}</button>
          <button onClick={doOpen} className="btn-primary">{t('cj_open')}</button>
        </div>
      </Modal>

      {/* Close modal — detailed closure summary */}
      <Modal open={closeModal} onClose={() => setCloseModal(false)} title={t('cj_close_register')} maxWidth="max-w-lg">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('clot_summary_title')}</p>
        <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-white/10">
          <table className="w-full text-sm">
            <tbody>
              {closureRows.map((r) => (
                <tr key={r.label} className="border-b border-gray-50 dark:border-white/5">
                  <td className="px-4 py-2.5">
                    <span className="text-gray-700 dark:text-zinc-300">{r.label}</span>
                    {r.kind === 'info' && (
                      <span className="ml-2 rounded bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-gray-400 dark:text-zinc-500">
                        {t('clot_out_of_drawer')}
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                      r.kind === 'in'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : r.kind === 'out'
                          ? 'text-rose-500 dark:text-rose-400'
                          : r.kind === 'info'
                            ? 'text-gray-400 dark:text-zinc-500'
                            : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {r.kind === 'in' ? '+' : r.kind === 'out' ? '−' : ''}
                    {fmtDH(r.value)}
                  </td>
                </tr>
              ))}
              <tr className="bg-amber-50 dark:bg-amber-500/10">
                <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">{t('clot_theoretical')}</td>
                <td className="px-4 py-3 text-right text-base font-black text-gray-900 dark:text-white tabular-nums">{fmtDH(expected)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[11px] italic text-gray-400 dark:text-zinc-500">{t('clot_note')}</p>

        <div className="mt-4">
          <label className="field-label">{t('clot_counted')}</label>
          <input
            type="number"
            min="0"
            value={closingAmount}
            onChange={(e) => setClosingAmount(e.target.value)}
            className="input-field"
            autoFocus
          />
        </div>
        {closingAmount !== '' && (
          <div
            className={`mt-3 flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold ${
              countedNum - expected === 0
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}
          >
            <span>{t('clot_gap')}</span>
            <span className="tabular-nums">
              {countedNum - expected > 0 ? '+' : ''}
              {fmtDH(countedNum - expected)}
            </span>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setCloseModal(false)} className="btn-secondary">{t('cj_cancel')}</button>
          <button onClick={doClose} className="btn-primary">
            <DoorClosed className="h-4 w-4" />
            {t('cj_close')}
          </button>
        </div>
      </Modal>

      {/* Entry modal */}
      <Modal
        open={!!entryModal}
        onClose={() => setEntryModal(null)}
        title={entryModal === 'depense' ? t('cj_new_expense') : t('cj_new_income')}
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">{t('cj_label')}</label>
            <input
              type="text"
              value={entryLabel}
              onChange={(e) => setEntryLabel(e.target.value)}
              placeholder={entryModal === 'depense' ? t('cj_expense_placeholder') : t('cj_income_placeholder')}
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label">{t('cj_amount_dh')}</label>
            <input
              type="number"
              min="0"
              value={entryAmount}
              onChange={(e) => setEntryAmount(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setEntryModal(null)} className="btn-secondary">{t('cj_cancel')}</button>
            <button onClick={doEntry} className="btn-primary">{t('cj_save')}</button>
          </div>
        </div>
      </Modal>

      {/* Transfer modal */}
      <Modal open={transferModal} onClose={() => setTransferModal(false)} title={t('cj_transfer_title')} maxWidth="max-w-sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400">
              <Landmark className="h-5 w-5" />
            </span>
            <p className="text-sm text-gray-600 dark:text-zinc-400">
              {t('cj_transfer_desc')}
            </p>
          </div>
          <div>
            <label className="field-label">{t('cj_direction')}</label>
            <Select
              value={transferDirection}
              onChange={(v) => setTransferDirection(v as 'sortie' | 'entree')}
              options={[
                { value: 'sortie', label: t('cj_to_bank') },
                { value: 'entree', label: t('cj_from_bank') },
              ]}
            />
          </div>
          <div>
            <label className="field-label">{t('cj_amount_dh')}</label>
            <input
              type="number"
              min="0"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              className="input-field"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setTransferModal(false)} className="btn-secondary">{t('cj_cancel')}</button>
            <button onClick={doTransfer} className="btn-primary">
              <Repeat className="h-4 w-4" />
              {t('cj_transfer_action')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default function CaisseJournalPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
