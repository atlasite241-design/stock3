'use client'

// Connexions : qui s'est connecté, quand, depuis quel magasin.
//
// Alimenté par le journal d'activité, filtré sur kind = login/logout (marqueur
// stable, indépendant de la langue du libellé). Les connexions antérieures à
// cette version n'ont pas été enregistrées : la liste démarre donc à zéro.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Info, LogIn, LogOut } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import { useDroguerie } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const PERIODS: { days: number; key: TKey }[] = [
  { days: 7, key: 'rp_vd_p7' },
  { days: 30, key: 'sk_var_p30' },
  { days: 90, key: 'sk_var_p90' },
  { days: 0, key: 'sk_var_pall' },
]

function Content() {
  const { ready, activity } = useDroguerie()
  const { t, lang } = useLanguage()
  const [days, setDays] = useState(30)

  const { rows, perUser } = useMemo(() => {
    const since = days > 0 ? Date.now() - days * 86400000 : 0
    const rows = activity
      .filter((a) => (a.kind === 'login' || a.kind === 'logout') && new Date(a.date).getTime() >= since)
      .sort((a, b) => b.date.localeCompare(a.date))
    const m = new Map<string, { name: string; logins: number; last: string }>()
    for (const a of rows) {
      if (a.kind !== 'login') continue
      const name = a.target || a.user
      const e = m.get(name) ?? { name, logins: 0, last: a.date }
      e.logins++
      if (a.date > e.last) e.last = a.date
      m.set(name, e)
    }
    return { rows, perUser: [...m.values()].sort((a, b) => b.logins - a.logins) }
  }, [activity, days])

  if (!ready) return <Loader />

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { dateStyle: 'short', timeStyle: 'short' })

  const exportCsv = () => {
    const csv = [[t('cx_col_when'), t('cx_col_user'), t('cx_col_event'), t('mag_name')],
      ...rows.map((a) => [fmt(a.date), a.target || a.user, a.kind === 'login' ? t('cx_login') : t('cx_logout'), a.storeName ?? ''])]
      .map((x) => x.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'connexions.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <LogIn className="h-6 w-6 text-amber-500" />{t('cx_title')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">{t('cx_sub')}</p>
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

      {perUser.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {perUser.map((u) => (
            <div key={u.name} className="glass-card p-4">
              <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{u.name}</p>
              <p className="mt-1 text-xl font-extrabold tabular-nums text-amber-600 dark:text-amber-400">{u.logins}</p>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500">{t('cx_last')} {fmt(u.last)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="glass-card overflow-x-auto">
        {rows.length === 0 ? (
          <p className="flex items-start justify-center gap-2 p-12 text-center text-sm text-gray-500 dark:text-zinc-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />{t('cx_empty')}
          </p>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                <th className="px-4 py-3">{t('cx_col_when')}</th>
                <th className="px-4 py-3">{t('cx_col_user')}</th>
                <th className="px-4 py-3">{t('cx_col_event')}</th>
                <th className="px-4 py-3">{t('mag_name')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map((a) => (
                <tr key={a.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2.5 tabular-nums text-gray-500 dark:text-zinc-400">{fmt(a.date)}</td>
                  <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{a.target || a.user}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${a.kind === 'login' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-zinc-400'}`}>
                      {a.kind === 'login' ? <LogIn className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
                      {a.kind === 'login' ? t('cx_login') : t('cx_logout')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-zinc-400">{a.storeName ?? '—'}</td>
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
