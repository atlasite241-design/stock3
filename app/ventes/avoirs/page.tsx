'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileMinus, Printer, Search, Wallet } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { fmtDH, useDroguerie, type SaleReturn } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, returns, settings } = useDroguerie()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [avoir, setAvoir] = useState<SaleReturn | null>(null)

  if (!ready) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">{t('dash_loading')}</div>
  }

  const avoirs = returns
    .filter((r) => r.method === 'avoir')
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((r) => {
      const q = query.trim().toLowerCase()
      return !q || r.clientName.toLowerCase().includes(q) || r.saleId.toLowerCase().includes(q)
    })

  const totalAvoirs = avoirs.reduce((a, r) => a + r.total, 0)
  const avoirNumber = (r: SaleReturn) => `AV-${r.id.slice(-6).toUpperCase()}`

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('av_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          {t('av_subtitle')}
        </p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400">
            <FileMinus className="h-5 w-5" />
          </div>
          <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('av_issued')}</p>
          <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
            {avoirs.length}
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500">
            <Wallet className="h-5 w-5" />
          </div>
          <p className="mt-4 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('av_total')}</p>
          <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
            {fmtDH(totalAvoirs)}
          </p>
        </motion.div>
      </div>

      <div className="relative min-w-[240px] max-w-sm">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('av_search_placeholder')}
          className="input-field pl-10"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3.5">{t('av_col_number')}</th>
                <th className="px-5 py-3.5">{t('av_col_date')}</th>
                <th className="px-5 py-3.5">{t('av_col_client')}</th>
                <th className="px-5 py-3.5">{t('av_col_origin_sale')}</th>
                <th className="px-5 py-3.5">{t('av_col_amount')}</th>
                <th className="px-5 py-3.5 text-right">{t('av_col_action')}</th>
              </tr>
            </thead>
            <tbody>
              {avoirs.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{avoirNumber(r)}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">
                    {new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-zinc-300">{r.clientName || '—'}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-500 dark:text-zinc-400">#{r.saleId.slice(-5)}</td>
                  <td className="px-5 py-3.5 text-sm font-bold text-sky-600 dark:text-sky-400 tabular-nums">{fmtDH(r.total)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => setAvoir(r)} className="btn-secondary !h-8 !px-3 text-xs">
                      <Printer className="h-3.5 w-3.5" />
                      {t('av_view')}
                    </button>
                  </td>
                </tr>
              ))}
              {avoirs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('av_none')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Avoir document */}
      <Modal open={!!avoir} onClose={() => setAvoir(null)} title={t('av_title')} maxWidth="max-w-md">
        {avoir && (
          <>
            <div className="print-area rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{settings.storeName}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{settings.address}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{settings.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-sky-600 dark:text-sky-400">{t('av_title').toUpperCase()}</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">{avoirNumber(avoir)}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{new Date(avoir.date).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-700 dark:text-zinc-300">
                {t('av_client_prefix')} <span className="font-semibold">{avoir.clientName || '—'}</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {t('av_issued_from')} #{avoir.saleId.slice(-5).toUpperCase()}
              </p>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10 text-left text-[11px] font-bold uppercase text-gray-400 dark:text-zinc-500">
                    <th className="py-2">{t('av_designation')}</th>
                    <th className="py-2 text-center">{t('av_qty_abbr')}</th>
                    <th className="py-2 text-right">{t('av_col_total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {avoir.items.map((i) => (
                    <tr key={i.productId} className="border-b border-gray-100 dark:border-white/10">
                      <td className="py-2 text-gray-800 dark:text-zinc-100">{i.name}</td>
                      <td className="py-2 text-center tabular-nums">{i.qty}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{fmtDH(i.price * i.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex justify-end">
                <div className="w-56 rounded-lg bg-sky-50 dark:bg-sky-500/10 px-3 py-2 text-right">
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{t('av_amount_label')}</p>
                  <p className="text-lg font-bold text-sky-600 dark:text-sky-400 tabular-nums">{fmtDH(avoir.total)}</p>
                </div>
              </div>
              <p className="mt-4 text-center text-[11px] text-gray-400 dark:text-zinc-500">
                {t('av_deducted_note')} {settings.storeName}
              </p>
            </div>
            <button onClick={() => window.print()} className="btn-primary mt-4 w-full">
              <Printer className="h-4 w-4" />
              {t('av_print')}
            </button>
          </>
        )}
      </Modal>
    </>
  )
}

export default function AvoirsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
