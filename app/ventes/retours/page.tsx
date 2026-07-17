'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Minus, Plus, Search, Undo2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import { fmtDH, useDroguerie, type Sale, type SaleReturn } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, sales, returns, recordReturn } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Sale | null>(null)
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [method, setMethod] = useState<SaleReturn['method']>('especes')

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const recent = [...sales]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((s) => {
      const q = query.trim().toLowerCase()
      return !q || s.id.toLowerCase().includes(q) || (s.clientName ?? '').toLowerCase().includes(q)
    })
    .slice(0, 8)

  const pick = (s: Sale) => {
    setSelected(s)
    const init: Record<string, number> = {}
    s.items.forEach((i) => (init[i.productId] = 0))
    setQtys(init)
  }

  const setQty = (id: string, max: number, delta: number) => {
    setQtys((q) => ({ ...q, [id]: Math.max(0, Math.min(max, (q[id] ?? 0) + delta)) }))
  }

  const returnItems = selected
    ? selected.items
        .filter((i) => (qtys[i.productId] ?? 0) > 0)
        .map((i) => ({ ...i, qty: qtys[i.productId] }))
    : []
  const refund = returnItems.reduce((a, i) => a + i.price * i.qty, 0)

  const submit = () => {
    if (!selected || returnItems.length === 0) {
      toast(t('cret_toast_select_item'), 'error')
      return
    }
    recordReturn(selected, returnItems, method)
    toast(`✓ ${t('cret_toast_recorded')} ${fmtDH(refund)} ${method === 'especes' ? t('cret_toast_refunded') : t('cret_toast_deducted')}`)
    setSelected(null)
    setQtys({})
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('cret_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          {t('cret_subtitle')}
        </p>
      </motion.div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {/* Pick a sale */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
          className="glass-card p-5"
        >
          <p className="field-label">{t('cret_step1')}</p>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('cret_search_placeholder')}
              className="input-field pl-10"
            />
          </div>
          <div className="mt-3 space-y-2">
            {recent.map((s) => (
              <button
                key={s.id}
                onClick={() => pick(s)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  selected?.id === s.id
                    ? 'border-amber-400 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10'
                    : 'border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/5 hover:border-amber-300 hover:bg-amber-50'
                }`}
              >
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(s.total)}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}{' '}
                    {new Date(s.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}
                    {s.items.reduce((a, i) => a + i.qty, 0)} {t('cret_article_abbr')}
                    {s.clientName ? ` · ${s.clientName}` : ''}
                  </p>
                </div>
                <span className="font-mono text-xs text-gray-400 dark:text-zinc-500">#{s.id.slice(-5)}</span>
              </button>
            ))}
            {recent.length === 0 && <p className="py-6 text-center text-sm text-gray-400 dark:text-zinc-500">{t('cret_no_sale')}</p>}
          </div>
        </motion.div>

        {/* Select items */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="glass-card p-5"
        >
          <p className="field-label">{t('cret_step2')}</p>
          {!selected ? (
            <p className="py-10 text-center text-sm text-gray-400 dark:text-zinc-500">{t('cret_select_sale_first')}</p>
          ) : (
            <>
              <div className="space-y-2">
                {selected.items.map((i) => (
                  <div key={i.productId} className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/5 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{i.name}</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 tabular-nums">
                        {t('cret_sold_prefix')} {i.qty} × {fmtDH(i.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setQty(i.productId, i.qty, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 transition hover:border-amber-300 hover:bg-amber-50"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                        {qtys[i.productId] ?? 0}
                      </span>
                      <button
                        onClick={() => setQty(i.productId, i.qty, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] text-gray-600 dark:text-zinc-400 transition hover:border-amber-300 hover:bg-amber-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <label className="field-label">{t('cret_refund_method')}</label>
                <Select
                  value={method}
                  onChange={(v) => setMethod(v as SaleReturn['method'])}
                  options={[
                    { value: 'especes', label: t('cret_refund_cash') },
                    { value: 'avoir', label: t('cret_refund_credit') },
                  ]}
                />
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-gradient-to-r from-amber-50 dark:from-amber-500/10 to-yellow-50 dark:to-yellow-500/5 p-4">
                <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400">{t('cret_to_refund')}</span>
                <span className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(refund)}</span>
              </div>

              <button onClick={submit} disabled={returnItems.length === 0} className="btn-primary mt-4 w-full disabled:opacity-50">
                <Undo2 className="h-4 w-4" />
                {t('cret_validate')}
              </button>
            </>
          )}
        </motion.div>
      </div>

      {/* Past returns */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="border-b border-gray-100 dark:border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('cret_history_title')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3">{t('cret_col_date')}</th>
                <th className="px-5 py-3">{t('cret_col_origin_sale')}</th>
                <th className="px-5 py-3">{t('cret_col_items')}</th>
                <th className="px-5 py-3">{t('cret_col_method')}</th>
                <th className="px-5 py-3 text-right">{t('cret_col_amount')}</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="px-5 py-3 text-sm text-gray-700 dark:text-zinc-300">
                    {new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-zinc-400">#{r.saleId.slice(-5)}</td>
                  <td className="px-5 py-3 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">
                    {r.items.reduce((a, i) => a + i.qty, 0)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-lg border px-2 py-1 text-xs font-bold ${
                        r.method === 'especes'
                          ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700'
                          : 'border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/10 text-sky-700'
                      }`}
                    >
                      {r.method === 'especes' ? t('cret_method_cash') : t('cret_method_credit')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-rose-500 dark:text-rose-400 tabular-nums">
                    −{fmtDH(r.total)}
                  </td>
                </tr>
              ))}
              {returns.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('cret_none')}
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

export default function RetoursPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
