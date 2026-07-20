'use client'

import { useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { PackageCheck, Printer, Search } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { useDroguerie, type Sale } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, sales, settings } = useDroguerie()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [bl, setBl] = useState<Sale | null>(null)

  if (!ready) {
    return <Loader />
  }

  const visible = [...sales]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((s) => {
      const q = query.trim().toLowerCase()
      return !q || s.id.toLowerCase().includes(q) || (s.clientName ?? '').toLowerCase().includes(q)
    })

  const blNumber = (s: Sale) => `BL-${s.id.slice(-6).toUpperCase()}`

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('bl_title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('bl_subtitle')}
          </p>
        </div>
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('bl_search_placeholder')}
            className="input-field pl-10"
          />
        </div>
      </motion.div>

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
                <th className="px-5 py-3.5">{t('bl_col_number')}</th>
                <th className="px-5 py-3.5">{t('bl_col_date')}</th>
                <th className="px-5 py-3.5">{t('bl_col_client')}</th>
                <th className="px-5 py-3.5">{t('bl_col_items')}</th>
                <th className="px-5 py-3.5 text-right">{t('bl_col_action')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, 50).map((s) => (
                <tr key={s.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{blNumber(s)}</td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm text-gray-700 dark:text-zinc-300">
                      {new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">
                      {new Date(s.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400">{s.clientName ?? t('bl_walk_in_client')}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">
                    {s.items.reduce((a, i) => a + i.qty, 0)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end">
                      <button onClick={() => setBl(s)} className="btn-secondary !h-8 !px-3 text-xs">
                        <PackageCheck className="h-3.5 w-3.5" />
                        {t('bl_view')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('bl_none_found')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Delivery note modal */}
      <Modal open={!!bl} onClose={() => setBl(null)} title={t('bl_title')} maxWidth="max-w-md">
        {bl && (
          <>
            <div className="print-area rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121a] p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{settings.storeName}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{settings.address}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{settings.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-amber-600 dark:text-amber-400">{t('bl_title').toUpperCase()}</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">{blNumber(bl)}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{new Date(bl.date).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-700 dark:text-zinc-300">
                {t('bl_client_prefix')} <span className="font-semibold">{bl.clientName ?? t('bl_walk_in_client')}</span>
              </p>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10 text-left text-[11px] font-bold uppercase text-gray-400 dark:text-zinc-500">
                    <th className="py-2">{t('bl_designation')}</th>
                    <th className="py-2 text-right">{t('bl_delivered_qty')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bl.items.map((i) => (
                    <tr key={i.productId} className="border-b border-gray-100 dark:border-white/10">
                      <td className="py-2 text-gray-800 dark:text-zinc-100">{i.name}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{i.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-6 grid grid-cols-2 gap-6 text-xs text-gray-600 dark:text-zinc-400">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-zinc-200">{t('bl_delivered_by')}</p>
                  <div className="mt-8 border-t border-dashed border-gray-300 dark:border-white/20" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-zinc-200">{t('bl_received_by')}</p>
                  <div className="mt-8 border-t border-dashed border-gray-300 dark:border-white/20" />
                </div>
              </div>
              <p className="mt-4 text-center text-[11px] text-gray-400 dark:text-zinc-500">
                {t('bl_good_condition')} {settings.storeName}
              </p>
            </div>
            <button onClick={() => window.print()} className="btn-primary mt-4 w-full">
              <Printer className="h-4 w-4" />
              {t('bl_print')}
            </button>
          </>
        )}
      </Modal>
    </>
  )
}

export default function BonLivraisonPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
