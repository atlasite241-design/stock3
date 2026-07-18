'use client'

import { useMemo, useState } from 'react'
import { Check, Phone, Search, Users, Wallet, X } from 'lucide-react'
import MobileSubShell from '@/components/MobileSubShell'
import { fmtDH, useDroguerie, type Client } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export default function MobileClientsPage() {
  const { clients, settleCredit } = useDroguerie()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [payFor, setPayFor] = useState<Client | null>(null)
  const [amount, setAmount] = useState('')
  const [flash, setFlash] = useState('')

  const q = query.trim().toLowerCase()
  const list = useMemo(
    () => clients.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q)),
    [clients, q]
  )

  const openPay = (c: Client) => {
    setPayFor(c)
    setAmount(String(Math.max(0, c.credit || 0)))
  }
  const confirmPay = () => {
    if (!payFor) return
    const val = parseFloat(amount.replace(',', '.')) || 0
    if (val <= 0) return
    settleCredit(payFor.id, val)
    setFlash(t('mob_cli_paid'))
    setPayFor(null)
    setTimeout(() => setFlash(''), 1800)
  }

  return (
    <MobileSubShell title={t('mob_cli_title')} subtitle={t('mob_cli_subtitle')}>
      {flash && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-center text-sm font-semibold text-emerald-300">{flash}</p>}

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('mob_search')}
          className="h-11 w-full rounded-2xl border border-slate-200 dark:border-sky-500/20 bg-slate-100 dark:bg-white/5 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-400/60"
        />
      </div>

      <div className="space-y-3">
        {list.map((c) => (
          <div key={c.id} className="rounded-2xl m-card p-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300"><Users className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{c.name}</p>
                {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Phone className="h-3 w-3" />{c.phone}</a>}
              </div>
              {c.credit > 0 && (
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-amber-400/80">{t('mob_cli_credit')}</p>
                  <p className="text-sm font-bold text-amber-400 tabular-nums">{fmtDH(c.credit)}</p>
                </div>
              )}
            </div>
            {c.credit > 0 && (
              <button
                onClick={() => openPay(c)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 py-2.5 text-sm font-bold text-slate-900 transition active:scale-[0.98]"
              >
                <Wallet className="h-4 w-4" />{t('mob_cli_pay')}
              </button>
            )}
          </div>
        ))}
        {list.length === 0 && <p className="rounded-2xl m-card p-6 text-center text-sm text-slate-500 dark:text-slate-400">{t('mob_empty')}</p>}
      </div>

      {/* Payment sheet */}
      {payFor && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-white/80 dark:bg-slate-950/70 backdrop-blur-sm" onClick={() => setPayFor(null)}>
          <div className="w-full max-w-md rounded-t-3xl border border-slate-200 dark:border-sky-500/20 bg-white dark:bg-slate-900 p-6 pb-10" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('mob_cli_pay_title')}</h3>
              <button onClick={() => setPayFor(null)} className="text-slate-500 dark:text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{payFor.name}</p>
            <p className="mb-4 text-xs text-amber-400">{t('mob_cli_credit')}: {fmtDH(payFor.credit)}</p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-sky-400/80">{t('mob_cli_amount')}</span>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 dark:border-sky-500/20 bg-slate-100 dark:bg-white/5 px-4 text-lg font-bold text-slate-900 dark:text-white outline-none focus:border-sky-400/60"
              />
            </label>
            <button
              onClick={confirmPay}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 font-bold text-slate-900 transition active:scale-[0.98]"
            >
              <Check className="h-5 w-5" />{t('mob_confirm')}
            </button>
          </div>
        </div>
      )}
    </MobileSubShell>
  )
}
