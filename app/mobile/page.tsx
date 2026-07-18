'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Clock, TrendingUp, TriangleAlert } from 'lucide-react'
import MobileShell from '@/components/MobileShell'
import ProductImage from '@/components/ProductImage'
import { fmtDH, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

const PEAK_STARTS = [8, 10, 12, 14, 16, 18, 20] // 2-hour buckets 08h → 22h

function Content() {
  const { ready, products, sales, activeStore } = useDroguerie()
  const { t } = useLanguage()

  const dayKey = (d: Date) => d.toDateString()

  const model = useMemo(() => {
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    const salesOf = (key: string) => sales.filter((s) => dayKey(new Date(s.date)) === key)
    const todaySales = salesOf(dayKey(today))
    const ydaySales = salesOf(dayKey(yesterday))

    const caToday = todaySales.reduce((a, s) => a + s.total, 0)
    const caYday = ydaySales.reduce((a, s) => a + s.total, 0)
    const profitToday = todaySales.reduce((a, s) => a + s.profit, 0)
    const profitYday = ydaySales.reduce((a, s) => a + s.profit, 0)

    const since30 = Date.now() - 30 * 86400000
    const past = sales.filter((s) => {
      const d = new Date(s.date).getTime()
      return d >= since30 && dayKey(new Date(s.date)) !== dayKey(today)
    })
    const days = new Set(past.map((s) => dayKey(new Date(s.date)))).size || 1
    const target = past.reduce((a, s) => a + s.total, 0) / days
    const objectivePct = target > 0 ? Math.min(140, Math.round((caToday / target) * 100)) : caToday > 0 ? 100 : 0

    const weekAgo = Date.now() - 7 * 86400000
    const buckets = PEAK_STARTS.map(() => 0)
    sales.forEach((s) => {
      const d = new Date(s.date)
      if (d.getTime() < weekAgo) return
      const h = d.getHours()
      const idx = PEAK_STARTS.findIndex((hs) => h >= hs && h < hs + 2)
      if (idx >= 0) buckets[idx] += 1
    })
    const maxB = Math.max(1, ...buckets)

    const map = new Map<string, { name: string; qty: number; category: string; image?: string }>()
    sales.forEach((s) =>
      s.items.forEach((i) => {
        const p = products.find((x) => x.id === i.productId)
        const e = map.get(i.productId) ?? { name: i.name, qty: 0, category: p?.category ?? '—', image: p?.image }
        e.qty += i.qty
        map.set(i.productId, e)
      })
    )
    const topProducts = Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 4)

    const lowStock = products.filter((p) => p.stock <= p.minStock).sort((a, b) => a.stock - b.stock).slice(0, 4)

    return {
      caToday,
      caTrend: caYday > 0 ? ((caToday - caYday) / caYday) * 100 : null,
      profitToday,
      profitTrend: profitYday > 0 ? ((profitToday - profitYday) / profitYday) * 100 : null,
      salesCount: todaySales.length,
      objectivePct,
      buckets,
      maxB,
      topProducts,
      lowStock,
    }
  }, [sales, products])

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-400">…</div>
  }

  const manager = activeStore?.manager || 'Gérant'
  const firstName = manager.split(' ')[0]

  return (
    <>
      {/* Welcome */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('mob_hello')}, {firstName}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('mob_subtitle')}</p>
        {activeStore && <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-amber-400/70">{activeStore.name}</p>}
      </motion.section>

      {/* KPI cards */}
      <section className="no-scrollbar -mx-6 flex gap-4 overflow-x-auto px-6 py-1">
        <div className="relative flex min-w-[260px] flex-col justify-between overflow-hidden rounded-2xl m-card p-6 backdrop-blur-xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/80">{t('mob_kpi_ca')}</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{fmtDH(model.caToday)}</h2>
            </div>
            <TrendingUp className="h-5 w-5 text-amber-400" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <MobTrend pct={model.caTrend} />
            <span className="text-xs text-slate-500 dark:text-slate-400">{t('mob_vs_yesterday')}</span>
          </div>
          <div className="pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-amber-500/10 blur-3xl" />
        </div>

        <div className="flex min-w-[200px] flex-col justify-between rounded-2xl m-card p-6 backdrop-blur-xl">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/80">{t('mob_kpi_sales')}</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {model.salesCount} <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('mob_sales_unit')}</span>
            </h2>
          </div>
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
              <div className="h-full rounded-full bg-amber-400 shadow-[0_0_8px_rgb(var(--c-amber-400)/0.6)]" style={{ width: `${Math.min(100, model.objectivePct)}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{model.objectivePct}% {t('mob_of_objective')}</p>
          </div>
        </div>

        <div className="flex min-w-[220px] flex-col justify-between rounded-2xl m-card p-6 backdrop-blur-xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/80">{t('mob_kpi_profit')}</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{fmtDH(model.profitToday)}</h2>
            </div>
            {model.profitTrend !== null && model.profitTrend < 0 ? <ArrowDownRight className="h-5 w-5 text-rose-400" /> : <ArrowUpRight className="h-5 w-5 text-emerald-400" />}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <MobTrend pct={model.profitTrend} />
            <span className="text-xs text-slate-500 dark:text-slate-400">{t('mob_vs_yesterday')}</span>
          </div>
        </div>
      </section>

      {/* Peak hours */}
      <section className="rounded-2xl m-card p-6 backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t('mob_peak_hours')}</h3>
          <Clock className="h-5 w-5 text-slate-500 dark:text-slate-400" />
        </div>
        <div className="flex h-24 items-end justify-between gap-2">
          {model.buckets.map((b, i) => {
            const h = Math.max(6, Math.round((b / model.maxB) * 100))
            const isMax = b === model.maxB && b > 0
            return <div key={i} className={`flex-1 rounded-t-sm ${isMax ? 'bg-amber-500 shadow-[0_0_10px_rgb(var(--c-amber-400)/0.4)]' : 'bg-amber-500/30'}`} style={{ height: `${h}%` }} />
          })}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>08h</span>
          <span>12h</span>
          <span>16h</span>
          <span>20h</span>
        </div>
      </section>

      {/* Top products */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t('mob_top_products')}</h3>
          <Link href="/mobile/analytics" className="text-sm font-medium text-amber-400">{t('mob_view_all')}</Link>
        </div>
        <div className="space-y-4">
          {model.topProducts.map((p, i) => (
            <div key={p.name + i} className="flex items-center gap-4 rounded-2xl m-card p-4 backdrop-blur-xl">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-amber-500/30">
                <ProductImage image={p.image} category={p.category} alt={p.name} fit={p.image ? 'contain' : 'cover'} iconSize="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900 dark:text-white">{p.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('mob_cat')}: {p.category}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-slate-900 dark:text-white tabular-nums">{p.qty}</p>
                <p className="text-xs text-amber-400">{t('mob_sales_word')}</p>
              </div>
            </div>
          ))}
          {model.topProducts.length === 0 && (
            <p className="rounded-2xl m-card p-6 text-center text-sm text-slate-500 dark:text-slate-400">{t('mob_no_products')}</p>
          )}
        </div>
      </section>

      {/* Stock alerts */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t('mob_stock_critical')}</h3>
          <TriangleAlert className="h-5 w-5 text-rose-400" />
        </div>
        <div className="space-y-3">
          {model.lowStock.map((p) => {
            const critical = p.stock === 0 || p.stock <= Math.ceil(p.minStock / 2)
            return (
              <div key={p.id} className={`flex items-center justify-between rounded-2xl m-card p-4 backdrop-blur-xl ${critical ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-amber-500'}`}>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{p.name}</p>
                  <p className={`mt-1 text-xs ${critical ? 'text-rose-400' : 'text-amber-400'}`}>Stock: {p.stock} {t('mob_units_left')}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-tighter ${critical ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {critical ? t('mob_badge_critical') : t('mob_badge_warning')}
                </span>
              </div>
            )
          })}
          {model.lowStock.length === 0 && (
            <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-6 text-center text-sm text-emerald-400">{t('mob_all_stock_ok')}</p>
          )}
        </div>
      </section>
    </>
  )
}

function MobTrend({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const up = pct >= 0
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${up ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'}`}>
      {up ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  )
}

export default function MobilePage() {
  return (
    <MobileShell>
      <Content />
    </MobileShell>
  )
}
