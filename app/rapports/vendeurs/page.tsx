'use client'

// Ventes par vendeur.
//
// Le vendeur n'était pas enregistré sur les ventes jusqu'à présent : il l'est
// désormais, repris de la session à l'encaissement. Les ventes antérieures
// n'en portent donc pas, et l'écran le dit plutôt que de les répartir au hasard.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Info, TrendingUp, Users } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const PERIODS: { days: number; key: TKey }[] = [
  { days: 7, key: 'rp_vd_p7' },
  { days: 30, key: 'sk_var_p30' },
  { days: 90, key: 'sk_var_p90' },
  { days: 0, key: 'sk_var_pall' },
]

function Content() {
  const { ready, sales, activeStoreId, activeStore } = useDroguerie()
  const { t } = useLanguage()
  const [days, setDays] = useState(30)

  const { rows, unattributed, total } = useMemo(() => {
    const since = days > 0 ? Date.now() - days * 86400000 : 0
    const m = new Map<string, { name: string; count: number; total: number; profit: number }>()
    let unattributed = 0
    let total = 0
    for (const s of sales) {
      if (s.storeId && activeStoreId && s.storeId !== activeStoreId) continue
      if (new Date(s.date).getTime() < since) continue
      total += s.total
      if (!s.userName) { unattributed++; continue }
      const e = m.get(s.userName) ?? { name: s.userName, count: 0, total: 0, profit: 0 }
      e.count++
      e.total += s.total
      e.profit += s.profit
      m.set(s.userName, e)
    }
    return { rows: [...m.values()].sort((a, b) => b.total - a.total), unattributed, total }
  }, [sales, activeStoreId, days])

  if (!ready) return <Loader />

  const best = rows[0]?.total ?? 0
  const exportCsv = () => {
    const csv = [[t('rp_vd_seller'), t('rp_vd_count'), t('cp_col_amount'), t('rp_vd_profit'), t('rp_vd_avg')],
      ...rows.map((r) => [r.name, r.count, r.total.toFixed(2), r.profit.toFixed(2), (r.total / r.count).toFixed(2)])]
      .map((x) => x.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'ventes-par-vendeur.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Users className="h-6 w-6 text-amber-500" />{t('rp_vd_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('rp_vd_sub')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <button onClick={exportCsv} disabled={!rows.length} className="btn-secondary disabled:opacity-40"><Download className="h-4 w-4" />CSV</button>
      </motion.div>

      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button key={p.days} onClick={() => setDays(p.days)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${days === p.days ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-zinc-300'}`}>
            {t(p.key)}
          </button>
        ))}
      </div>

      {unattributed > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-dashed border-gray-200 p-3 text-xs text-gray-500 dark:border-white/15 dark:text-zinc-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          {unattributed.toLocaleString('fr-FR')} {t('rp_vd_unattributed')}
        </p>
      )}

      <div className="glass-card overflow-x-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <TrendingUp className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
            <p className="max-w-md text-sm text-gray-500 dark:text-zinc-400">{t('rp_vd_empty')}</p>
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                <th className="px-4 py-3">{t('rp_vd_seller')}</th>
                <th className="px-4 py-3 text-center">{t('rp_vd_count')}</th>
                <th className="px-4 py-3 text-right">{t('cp_col_amount')}</th>
                <th className="px-4 py-3 text-right">{t('rp_vd_avg')}</th>
                <th className="px-4 py-3 text-right">{t('rp_vd_profit')}</th>
                <th className="px-4 py-3">{t('rp_vd_share')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{r.name}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{r.count}</td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums text-gray-900 dark:text-white">{fmtDH(r.total)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{fmtDH(r.total / r.count)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmtDH(r.profit)}</td>
                  <td className="px-4 py-2.5">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${best ? Math.round((r.total / best) * 100) : 0}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-100 dark:border-white/10">
                <td className="px-4 py-2.5 font-bold text-gray-700 dark:text-zinc-200">{t('gen_total')}</td>
                <td />
                <td className="px-4 py-2.5 text-right font-extrabold tabular-nums text-gray-900 dark:text-white">{fmtDH(total)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
