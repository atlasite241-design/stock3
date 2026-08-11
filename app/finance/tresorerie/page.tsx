'use client'

// Trésorerie : les flux d'argent DÉRIVÉS des données existantes — journal de
// caisse (entrées/sorties), ventes espèces et transferts — jamais ressaisis.
// Le solde initial est celui posé par l'utilisateur en début de période.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownCircle, ArrowUpCircle, Banknote, PiggyBank } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const PERIODS: { key: string; days: number; label: TKey }[] = [
  { key: '30', days: 30, label: 'sk_var_p30' },
  { key: '90', days: 90, label: 'sk_var_p90' },
  { key: '365', days: 365, label: 'sk_var_p365' },
]

function Content() {
  const { ready, cash, sales, moneyTransfers, sessions, activeStore, activeStoreId } = useDroguerie()
  const { t } = useLanguage()
  const [period, setPeriod] = useState('90')

  const flux = useMemo(() => {
    const since = Date.now() - Number(period) * 86400000
    const inPeriod = (iso: string) => new Date(iso).getTime() >= since

    // Ventes ESPÈCES : l'argent réellement entré en caisse (les ventes à
    // crédit ne sont pas de la trésorerie tant qu'elles ne sont pas réglées —
    // leurs règlements passent par le journal de caisse).
    const ventesEspeces = sales.filter((s) => inPeriod(s.date) && (s.payment === 'especes' || s.payment === 'mixte')).reduce((a, s) => a + s.total, 0)
    const entreesCaisse = cash.filter((c) => inPeriod(c.date) && c.type === 'recette').reduce((a, c) => a + c.amount, 0)
    const sortiesCaisse = cash.filter((c) => inPeriod(c.date) && c.type === 'depense').reduce((a, c) => a + c.amount, 0)
    // Transferts non scopés : on filtre sur le magasin actif à la main.
    const versBanque = moneyTransfers
      .filter((m) => (!m.storeId || m.storeId === activeStoreId) && inPeriod(m.date) && m.route.toLowerCase().startsWith('caisse'))
      .reduce((a, m) => a + m.amount, 0)

    // Solde initial : le fond de caisse de la première session de la période.
    const first = [...sessions].filter((s) => inPeriod(s.openedAt)).sort((a, b) => a.openedAt.localeCompare(b.openedAt))[0]
    const initial = first?.openingAmount ?? 0

    const entrees = ventesEspeces + entreesCaisse
    const sorties = sortiesCaisse
    return { initial, ventesEspeces, entreesCaisse, sortiesCaisse, versBanque, entrees, sorties, solde: initial + entrees - sorties }
  }, [cash, sales, moneyTransfers, sessions, activeStoreId, period])

  // Flux mensuels (entrées vs sorties) pour lecture rapide.
  const monthly = useMemo(() => {
    const map = new Map<string, { label: string; in: number; out: number }>()
    const push = (iso: string, kind: 'in' | 'out', amount: number) => {
      const d = new Date(iso)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const cur = map.get(key) ?? { label: key, in: 0, out: 0 }
      cur[kind] += amount
      map.set(key, cur)
    }
    const since = Date.now() - Number(period) * 86400000
    for (const s of sales) if (new Date(s.date).getTime() >= since && (s.payment === 'especes' || s.payment === 'mixte')) push(s.date, 'in', s.total)
    for (const c of cash) if (new Date(c.date).getTime() >= since) push(c.date, c.type === 'recette' ? 'in' : 'out', c.amount)
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v)
  }, [sales, cash, period])

  if (!ready) return <Loader />

  const cards = [
    { l: t('fin_tr_initial'), v: fmtDH(flux.initial), icon: PiggyBank, cls: 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-zinc-300' },
    { l: t('fin_tr_in'), v: fmtDH(flux.entrees), icon: ArrowDownCircle, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500' },
    { l: t('fin_tr_out'), v: fmtDH(flux.sorties), icon: ArrowUpCircle, cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' },
    { l: t('fin_tr_balance'), v: fmtDH(flux.solde), icon: Banknote, cls: flux.solde >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Banknote className="h-6 w-6 text-amber-500" />
            {t('fin_tr_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('fin_tr_sub')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${period === p.key ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-zinc-300'}`}>
              {t(p.label)}
            </button>
          ))}
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div key={c.l} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.4 }}
            className="glass-card glass-card-hover p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.cls}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{c.l}</p>
            <p className="mt-1 truncate text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">{c.v}</p>
          </motion.div>
        ))}
      </div>

      {/* Détail des flux */}
      <div className="glass-card p-5">
        <p className="mb-3 text-sm font-bold text-gray-900 dark:text-white">{t('fin_tr_detail')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { l: t('fin_tr_cash_sales'), v: flux.ventesEspeces, pos: true },
            { l: t('fin_tr_other_in'), v: flux.entreesCaisse, pos: true },
            { l: t('fin_tr_cash_out'), v: flux.sortiesCaisse, pos: false },
            { l: t('fin_tr_to_bank'), v: flux.versBanque, pos: false },
          ].map((r) => (
            <div key={r.l} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-white/10">
              <span className="text-gray-500 dark:text-zinc-400">{r.l}</span>
              <span className={`font-bold tabular-nums ${r.pos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                {r.pos ? '+' : '−'}{fmtDH(r.v)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-gray-400 dark:text-zinc-500">{t('fin_tr_note')}</p>
      </div>

      {/* Flux mensuels */}
      <div className="glass-card overflow-x-auto">
        <p className="px-4 pt-4 text-sm font-bold text-gray-900 dark:text-white">{t('fin_tr_monthly')}</p>
        {monthly.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('fin_dash_none')}</p>
        ) : (
          <table className="mt-2 w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                <th className="px-4 py-3">{t('fin_tr_month')}</th>
                <th className="px-4 py-3 text-right">{t('fin_tr_in')}</th>
                <th className="px-4 py-3 text-right">{t('fin_tr_out')}</th>
                <th className="px-4 py-3 text-right">{t('fin_tr_net')}</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m) => (
                <tr key={m.label} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{m.label}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">+{fmtDH(m.in)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-rose-500">−{fmtDH(m.out)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${m.in - m.out >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                    {fmtDH(m.in - m.out)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
