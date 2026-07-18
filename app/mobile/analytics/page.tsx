'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import MobileShell from '@/components/MobileShell'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const DAY_KEYS: TKey[] = ['day_sun', 'day_mon', 'day_tue', 'day_wed', 'day_thu', 'day_fri', 'day_sat']
const CAT_COLORS = ['#38bdf8', '#22d3ee', '#818cf8', '#34d399', '#fbbf24', '#fb7185']

function Content() {
  const { ready, sales, products } = useDroguerie()
  const { t } = useLanguage()

  const model = useMemo(() => {
    const dayKey = (d: Date) => d.toDateString()
    const days: { label: TKey; ca: number }[] = []
    let ca7 = 0
    let profit7 = 0
    let count7 = 0
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const daySales = sales.filter((s) => dayKey(new Date(s.date)) === dayKey(d))
      const ca = daySales.reduce((a, s) => a + s.total, 0)
      days.push({ label: DAY_KEYS[d.getDay()], ca })
      ca7 += ca
      profit7 += daySales.reduce((a, s) => a + s.profit, 0)
      count7 += daySales.length
    }
    const maxCa = Math.max(1, ...days.map((d) => d.ca))

    const catMap = new Map<string, number>()
    sales.forEach((s) =>
      s.items.forEach((i) => {
        const cat = products.find((p) => p.id === i.productId)?.category ?? '—'
        catMap.set(cat, (catMap.get(cat) ?? 0) + i.price * i.qty)
      })
    )
    const cats = Array.from(catMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6)
    const catTotal = cats.reduce((a, c) => a + c.value, 0) || 1

    return { days, maxCa, ca7, profit7, count7, avgBasket: count7 > 0 ? ca7 / count7 : 0, cats, catTotal }
  }, [sales, products])

  if (!ready) return <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-400">…</div>

  const kpis = [
    { label: t('mob_revenue_7d'), value: fmtDH(model.ca7) },
    { label: t('mob_profit_7d'), value: fmtDH(model.profit7) },
    { label: t('mob_avg_basket'), value: fmtDH(model.avgBasket) },
    { label: t('mob_sales_7d'), value: String(model.count7) },
  ]

  return (
    <>
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('mob_analytics_title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('mob_analytics_subtitle')}</p>
      </motion.section>

      {/* KPI grid */}
      <section className="grid grid-cols-2 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl m-card p-4 backdrop-blur-xl">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400/80">{k.label}</p>
            <p className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-white tabular-nums">{k.value}</p>
          </div>
        ))}
      </section>

      {/* Revenue trend */}
      <section className="rounded-2xl m-card p-6 backdrop-blur-xl">
        <h3 className="mb-6 text-lg font-semibold text-slate-900 dark:text-white">{t('mob_revenue_trend')}</h3>
        <div className="flex h-32 items-end justify-between gap-2">
          {model.days.map((d, i) => {
            const h = Math.max(4, Math.round((d.ca / model.maxCa) * 100))
            const isMax = d.ca === model.maxCa && d.ca > 0
            return <div key={i} className={`flex-1 rounded-t-md ${isMax ? 'bg-sky-500 shadow-[0_0_10px_rgba(56,189,248,0.4)]' : 'bg-sky-500/30'}`} style={{ height: `${h}%` }} />
          })}
        </div>
        <div className="mt-2 flex justify-between gap-2">
          {model.days.map((d, i) => (
            <span key={i} className="flex-1 text-center text-[10px] text-slate-500 dark:text-slate-400">{t(d.label)}</span>
          ))}
        </div>
      </section>

      {/* Sales by category */}
      <section className="rounded-2xl m-card p-6 backdrop-blur-xl">
        <h3 className="mb-5 text-lg font-semibold text-slate-900 dark:text-white">{t('mob_by_category')}</h3>
        <div className="space-y-4">
          {model.cats.map((c, i) => {
            const pct = Math.round((c.value / model.catTotal) * 100)
            return (
              <div key={c.name}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                    {c.name}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{fmtDH(c.value)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CAT_COLORS[i % CAT_COLORS.length] }} />
                </div>
              </div>
            )
          })}
          {model.cats.length === 0 && <p className="text-center text-sm text-slate-500 dark:text-slate-400">{t('mob_no_products')}</p>}
        </div>
      </section>
    </>
  )
}

export default function MobileAnalyticsPage() {
  return (
    <MobileShell>
      <Content />
    </MobileShell>
  )
}
