'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Banknote,
  Delete,
  CreditCard,
  Layers,
  User,
  X,
} from 'lucide-react'
import type { Sale } from '@/lib/store'

const PAYMENT_TABS: { key: Sale['payment']; label: string; icon: typeof Banknote }[] = [
  { key: 'especes', label: 'Espèces', icon: Banknote },
  { key: 'carte', label: 'Carte / TPE', icon: CreditCard },
  { key: 'credit', label: 'Crédit client', icon: User },
  { key: 'mixte', label: 'Mixte', icon: Layers },
]

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back']

const fmt = (n: number) => `${n.toFixed(2).replace('.', ',')} MAD`

function roundSuggestions(total: number): number[] {
  const exact = Math.round(total * 100) / 100
  const steps = [10, 50, 100]
  const out = [exact]
  steps.forEach((s) => {
    const rounded = Math.ceil(exact / s) * s
    if (rounded > exact) out.push(rounded)
  })
  return Array.from(new Set(out)).slice(0, 4)
}

export default function PaymentModal({
  open,
  onClose,
  total,
  payment,
  onPaymentChange,
  clientSelected,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  total: number
  payment: Sale['payment']
  onPaymentChange: (p: Sale['payment']) => void
  clientSelected: boolean
  onConfirm: (receivedAmount: number, print: boolean) => void
}) {
  const [digits, setDigits] = useState('')

  useEffect(() => {
    if (open) setDigits(String(Math.round(total * 100)))
  }, [open, total])

  const received = useMemo(() => {
    const cents = parseInt(digits || '0', 10)
    return cents / 100
  }, [digits])

  const cashPortion = payment === 'mixte' ? Math.min(received, total) : received
  const cardPortion = payment === 'mixte' ? Math.max(0, total - cashPortion) : 0
  const change = (payment === 'especes' || payment === 'mixte') ? cashPortion - total : 0

  const suggestions = useMemo(() => roundSuggestions(total), [total])

  const press = (k: string) => {
    if (k === 'back') {
      setDigits((d) => d.slice(0, -1))
    } else {
      setDigits((d) => (d === '0' ? k : d + k).slice(0, 9))
    }
  }

  const showKeypad = payment === 'especes' || payment === 'mixte'
  const readyToConfirm =
    payment === 'credit'
      ? clientSelected
      : payment === 'especes'
        ? received >= total
        : true

  const confirm = (print: boolean) => {
    if (!readyToConfirm) return
    onConfirm(payment === 'especes' || payment === 'mixte' ? received : total, print)
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.2 }}
            className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b0f17] text-white shadow-2xl sm:max-h-[90vh] sm:rounded-3xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  Encaissement
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{fmt(total)}</p>
              </div>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Payment tabs */}
            <div className="mt-5 grid grid-cols-2 gap-2 px-6 sm:grid-cols-4">
              {PAYMENT_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => onPaymentChange(t.key)}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                    payment === t.key
                      ? 'border-emerald-400/40 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]'
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-5 flex-1 overflow-y-auto px-6">
              {showKeypad ? (
                <>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Montant reçu
                    </p>
                    <p className="mt-1 text-4xl font-bold tabular-nums">{fmt(received)}</p>

                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Suggestions :
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => setDigits(String(Math.round(s * 100)))}
                          className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.12]"
                        >
                          {fmt(s)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-[1fr_auto] gap-4">
                    <div className="grid grid-cols-3 gap-2">
                      {KEYS.map((k) => (
                        <button
                          key={k}
                          onClick={() => press(k)}
                          className="flex h-14 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-semibold text-white transition hover:bg-white/[0.09] active:scale-95"
                        >
                          {k === 'back' ? <Delete className="h-5 w-5" /> : k}
                        </button>
                      ))}
                    </div>
                  </div>

                  {payment === 'especes' && (
                    <div
                      className={`mt-4 rounded-2xl border p-4 ${
                        change >= 0
                          ? 'border-emerald-400/30 bg-emerald-500/10'
                          : 'border-rose-400/30 bg-rose-500/10'
                      }`}
                    >
                      <p
                        className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                          change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {change >= 0 ? 'À rendre' : 'Manque'}
                      </p>
                      <p
                        className={`mt-1 text-2xl font-bold tabular-nums ${
                          change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {fmt(Math.abs(change))}
                      </p>
                    </div>
                  )}

                  {payment === 'mixte' && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
                          Espèces
                        </p>
                        <p className="mt-1 text-xl font-bold tabular-nums text-emerald-400">
                          {fmt(cashPortion)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-400">
                          Carte
                        </p>
                        <p className="mt-1 text-xl font-bold tabular-nums text-sky-400">
                          {fmt(cardPortion)}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] py-10 text-center">
                  {payment === 'carte' ? (
                    <>
                      <CreditCard className="h-8 w-8 text-sky-400" />
                      <p className="text-sm text-zinc-300">
                        Présentez la carte sur le TPE pour <span className="font-bold text-white">{fmt(total)}</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <User className="h-8 w-8 text-amber-400" />
                      {clientSelected ? (
                        <p className="text-sm text-zinc-300">
                          Ce montant sera ajouté au crédit du client —{' '}
                          <span className="font-bold text-white">{fmt(total)}</span>
                        </p>
                      ) : (
                        <p className="text-sm text-rose-400">
                          Sélectionnez un client dans le panier avant de continuer
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-5 flex flex-col gap-2.5 border-t border-white/10 px-4 py-3 sm:px-6 sm:py-4">
              <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Tiroir-caisse · imprimante prête
              </p>
              <div className="flex items-center justify-end gap-2 overflow-x-auto">
                <button
                  onClick={onClose}
                  className="shrink-0 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.08]"
                >
                  Annuler
                </button>
                <button
                  onClick={() => confirm(false)}
                  disabled={!readyToConfirm}
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Valider la vente
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
