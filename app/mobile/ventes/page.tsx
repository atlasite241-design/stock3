'use client'

import Loader from '@/components/Loader'
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Receipt } from 'lucide-react'
import MobileShell from '@/components/MobileShell'
import { fmtDH, PAYMENT_META, useDroguerie, type Sale } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const PAY_CHIP: Record<Sale['payment'], string> = {
  especes: 'bg-emerald-500/20 text-emerald-300',
  carte: 'bg-amber-500/20 text-amber-300',
  credit: 'bg-amber-500/20 text-amber-300',
  mixte: 'bg-violet-500/20 text-violet-300',
}

function Content() {
  const { ready, sales } = useDroguerie()
  const { t } = useLanguage()

  const model = useMemo(() => {
    const todayKey = new Date().toDateString()
    const todaySales = sales.filter((s) => new Date(s.date).toDateString() === todayKey)
    const total = todaySales.reduce((a, s) => a + s.total, 0)
    const byMode: Record<Sale['payment'], number> = { especes: 0, carte: 0, credit: 0, mixte: 0 }
    todaySales.forEach((s) => {
      byMode[s.payment] += s.total
    })
    const recent = [...sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25)
    return { total, count: todaySales.length, byMode, recent }
  }, [sales])

  if (!ready) return <Loader className="!min-h-0 h-64" />

  const modes: Sale['payment'][] = ['especes', 'carte', 'credit', 'mixte']

  return (
    <>
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('mob_sales_title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('mob_sales_subtitle')}</p>
      </motion.section>

      {/* Day totals */}
      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl m-card p-5 backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/80">{t('mob_total_day')}</p>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white tabular-nums">{fmtDH(model.total)}</p>
        </div>
        <div className="rounded-2xl m-card p-5 backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/80">{t('mob_count_day')}</p>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white tabular-nums">{model.count}</p>
        </div>
      </section>

      {/* Payment breakdown */}
      <section className="rounded-2xl m-card p-5 backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-3">
          {modes.map((m) => (
            <div key={m} className="flex items-center justify-between rounded-xl bg-slate-100 dark:bg-white/5 px-3 py-2.5">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PAY_CHIP[m]}`}>{PAYMENT_META[m].label}</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">{fmtDH(model.byMode[m])}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Recent transactions */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t('mob_recent')}</h3>
          <Receipt className="h-5 w-5 text-slate-500 dark:text-slate-400" />
        </div>
        <div className="space-y-3">
          {model.recent.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-2xl m-card p-4 backdrop-blur-xl">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
                <Receipt className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 dark:text-white tabular-nums">{fmtDH(s.total)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}{' '}
                  {new Date(s.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  {s.items.reduce((a, i) => a + i.qty, 0)} {t('mob_articles')}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${PAY_CHIP[s.payment]}`}>{PAYMENT_META[s.payment].label}</span>
            </div>
          ))}
          {model.recent.length === 0 && (
            <p className="rounded-2xl m-card p-6 text-center text-sm text-slate-500 dark:text-slate-400">{t('mob_no_sales')}</p>
          )}
        </div>
      </section>
    </>
  )
}

export default function MobileVentesPage() {
  return (
    <MobileShell>
      <Content />
    </MobileShell>
  )
}
