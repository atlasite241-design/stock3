'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import { useToast } from '@/components/Toast'
import { usePermissions } from '@/lib/access'
import { BON_A_SAISIR, fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const d2 = (n: number) => String(n).padStart(2, '0')
const localDay = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d2(d.getMonth() + 1)}-${d2(d.getDate())}` }
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d2(d.getMonth() + 1)}-${d2(d.getDate())}` }
const frDay = (ymd: string) => { const [y, m, j] = ymd.split('-'); return `${j}/${m}/${y}` }

function Content() {
  const { ready, bons, sales, closeBonsDay } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()
  const [day, setDay] = useState(today())

  const saleById = useMemo(() => new Map(sales.map((s) => [s.id, s])), [sales])

  const stats = useMemo(() => {
    const jour = bons.filter((b) => localDay(b.date) === day)
    const saisis = jour.filter((b) => b.status === 'saisi')
    const attente = jour.filter((b) => BON_A_SAISIR.includes(b.status)).length
    const annules = jour.filter((b) => b.status === 'annule').length
    // Totaux calculés depuis les VENTES liées (source de vérité), avec le même
    // partage mixte espèces/carte que la clôture de caisse.
    let ca = 0, cash = 0, card = 0, credit = 0
    for (const b of saisis) {
      const s = b.saleId ? saleById.get(b.saleId) : undefined
      if (!s) { ca += b.total; continue }
      ca += s.total
      if (s.payment === 'especes') cash += s.total
      else if (s.payment === 'carte') card += s.total
      else if (s.payment === 'credit') credit += s.total
      else if (s.payment === 'mixte') { const c = s.cashPart ?? s.total; cash += c; card += s.total - c }
    }
    return { total: jour.length, saisis: saisis.length, attente, annules, ca, cash, card, credit }
  }, [bons, saleById, day])

  const close = (force: boolean) => {
    closeBonsDay(frDay(day), { total: stats.total, saisis: stats.saisis, attente: stats.attente, annules: stats.annules, ca: stats.ca }, force)
    toast(t('bon_close_title'))
  }

  if (!ready) return <Loader />

  const cards = [
    { label: t('bon_close_total'), value: stats.total, tone: 'text-gray-900 dark:text-white' },
    { label: t('bon_close_entered'), value: stats.saisis, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: t('bon_close_pending'), value: stats.attente, tone: stats.attente ? 'text-amber-500' : 'text-gray-400' },
    { label: t('bon_close_cancelled'), value: stats.annules, tone: 'text-rose-500' },
  ]
  const money = [
    { label: t('bon_close_sales_total'), value: stats.ca },
    { label: t('bon_close_cash'), value: stats.cash },
    { label: t('bon_close_card'), value: stats.card },
    { label: t('bon_close_credit'), value: stats.credit },
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Lock className="h-6 w-6 text-amber-500" />{t('bon_close_title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">{t('bon_close_sub')}</p>
        </div>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="input-field h-11 w-auto" />
      </motion.div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c, i) => (
          <div key={i} className="glass-card p-4 text-center">
            <p className={`text-3xl font-extrabold tabular-nums ${c.tone}`}>{c.value}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {money.map((m, i) => (
          <div key={i} className="glass-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{m.label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-white">{fmtDH(m.value)}</p>
          </div>
        ))}
      </div>

      {stats.attente > 0 ? (
        <div className="glass-card space-y-3 border-l-4 border-amber-500 p-5">
          <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />⚠️ {stats.attente} {t('bon_close_pending_warn')}
          </div>
          <p className="text-sm text-gray-500 dark:text-zinc-400">{t('bon_close_blocked')}</p>
          {can('bons.close') && (
            <button onClick={() => close(true)} className="btn-primary bg-rose-500 hover:bg-rose-600">
              <Lock className="h-4 w-4" />{t('bon_close_force')}
            </button>
          )}
        </div>
      ) : (
        <div className="glass-card space-y-3 border-l-4 border-emerald-500 p-5">
          <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />{t('bon_close_ok')}
          </div>
          {can('bons.close') && (
            <button onClick={() => close(false)} className="btn-primary">
              <Lock className="h-4 w-4" />{t('bon_close_title')}
            </button>
          )}
        </div>
      )}
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
