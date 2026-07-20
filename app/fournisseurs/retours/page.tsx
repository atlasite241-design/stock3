'use client'

import { motion } from 'framer-motion'
import Loader from '@/components/Loader'
import { HandCoins, RotateCcw, Undo2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, purchases } = useDroguerie()
  const { t } = useLanguage()

  if (!ready) {
    return <Loader />
  }

  const returned = [...purchases].filter((p) => p.status === 'retournee').sort((a, b) => b.date.localeCompare(a.date))

  const totalCredit = returned.reduce((a, p) => a + p.paid, 0)
  const totalCancelled = returned.reduce((a, p) => a + Math.max(0, p.total - p.paid), 0)

  const cards = [
    { label: t('fret_kpi_count'), value: String(returned.length), icon: RotateCcw, cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' },
    { label: t('fret_kpi_credit'), value: fmtDH(totalCredit), icon: HandCoins, cls: 'bg-violet-50 dark:bg-violet-500/10 text-violet-500 dark:text-violet-400' },
    { label: t('fret_kpi_cancelled'), value: fmtDH(totalCancelled), icon: Undo2, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('fret_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('fret_subtitle')}</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.4 }} className="glass-card glass-card-hover p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.cls}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{c.label}</p>
            <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">{c.value}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('fret_col_ref')}</th>
                <th className="px-5 py-3.5">{t('fret_col_supplier')}</th>
                <th className="px-5 py-3.5">{t('fret_col_date')}</th>
                <th className="px-5 py-3.5">{t('fret_col_total')}</th>
                <th className="px-5 py-3.5">{t('fret_col_paid')}</th>
                <th className="px-5 py-3.5">{t('fret_col_effect')}</th>
              </tr>
            </thead>
            <tbody>
              {returned.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{p.ref}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-zinc-300">{p.supplierName}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">
                    {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(p.total)}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">{fmtDH(p.paid)}</td>
                  <td className="px-5 py-3.5">
                    {p.paid > 0 ? (
                      <span className="rounded-lg border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10 px-2 py-1 text-xs font-bold text-violet-700 dark:text-violet-400 tabular-nums">
                        {t('fret_effect_credit')}: {fmtDH(p.paid)}
                      </span>
                    ) : (
                      <span className="rounded-lg border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {t('fret_effect_cancelled')}: {fmtDH(p.total)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {returned.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('fret_none')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </>
  )
}

export default function FournisseursRetoursPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
