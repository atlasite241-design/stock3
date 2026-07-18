'use client'

import { useState } from 'react'
import { Lock, LockOpen, Wallet } from 'lucide-react'
import MobileSubShell from '@/components/MobileSubShell'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export default function MobileCaisseRegisterPage() {
  const { currentSession, expectedCash, openSession, closeSession } = useDroguerie()
  const { t } = useLanguage()
  const [openFund, setOpenFund] = useState('0')
  const [counted, setCounted] = useState('')
  const [flash, setFlash] = useState('')

  const expected = currentSession ? expectedCash(currentSession) : 0
  const countedVal = parseFloat(counted.replace(',', '.')) || 0
  const diff = countedVal - expected

  const open = () => openSession(Math.max(0, parseFloat(openFund.replace(',', '.')) || 0))
  const close = () => {
    closeSession(countedVal)
    setCounted('')
    setFlash(t('mob_reg_closed_ok'))
    setTimeout(() => setFlash(''), 2200)
  }

  return (
    <MobileSubShell title={t('mob_reg_title')} subtitle={t('mob_reg_subtitle')}>
      {flash && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-center text-sm font-semibold text-emerald-300">{flash}</p>}

      {!currentSession ? (
        <section className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.08] p-6 backdrop-blur-xl">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300"><Lock className="h-7 w-7" /></span>
            <h2 className="text-lg font-bold text-white">{t('mob_reg_closed')}</h2>
          </div>
          <label className="mt-6 block">
            <span className="mb-1.5 block text-xs font-semibold text-sky-400/80">{t('mob_reg_open_fund')}</span>
            <input
              type="number"
              inputMode="decimal"
              value={openFund}
              onChange={(e) => setOpenFund(e.target.value)}
              className="h-12 w-full rounded-2xl border border-sky-500/20 bg-white/5 px-4 text-lg font-bold text-white outline-none focus:border-sky-400/60"
            />
          </label>
          <button
            onClick={open}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-500 font-bold text-slate-900 transition active:scale-[0.98]"
          >
            <LockOpen className="h-5 w-5" />{t('mob_reg_open_now')}
          </button>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.08] p-5 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300"><Wallet className="h-6 w-6" /></span>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-emerald-400/80">{t('mob_reg_opened_at')}</p>
                <p className="text-sm font-semibold text-white">
                  {new Date(currentSession.openedAt).toLocaleDateString('fr-FR')} {new Date(currentSession.openedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-sm text-slate-400">{t('mob_reg_expected')}</span>
              <span className="text-lg font-bold text-white tabular-nums">{fmtDH(expected)}</span>
            </div>
          </section>

          <section className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.08] p-5 backdrop-blur-xl">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-sky-400/80">{t('mob_reg_counted')}</span>
              <input
                type="number"
                inputMode="decimal"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                placeholder="0"
                className="h-12 w-full rounded-2xl border border-sky-500/20 bg-white/5 px-4 text-lg font-bold text-white outline-none focus:border-sky-400/60"
              />
            </label>
            {counted !== '' && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-slate-400">{t('mob_reg_diff')}</span>
                <span className={`text-lg font-bold tabular-nums ${Math.abs(diff) < 0.01 ? 'text-emerald-400' : diff > 0 ? 'text-sky-400' : 'text-rose-400'}`}>
                  {diff > 0 ? '+' : ''}{fmtDH(diff)}
                </span>
              </div>
            )}
          </section>

          <button
            onClick={close}
            disabled={counted === ''}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            <Lock className="h-5 w-5" />{t('mob_reg_close_now')}
          </button>
        </>
      )}
    </MobileSubShell>
  )
}
