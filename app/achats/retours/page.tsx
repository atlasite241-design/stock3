'use client'

import { useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { RotateCcw, Undo2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { fmtDH, useDroguerie, type Purchase } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, purchases, returnPurchase } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [returnTarget, setReturnTarget] = useState<Purchase | null>(null)

  if (!ready) {
    return <Loader />
  }

  const eligible = purchases.filter((p) => p.status === 'recue')
  const returned = purchases.filter((p) => p.status === 'retournee')
  const totalReturned = returned.reduce((a, p) => a + p.total, 0)

  const confirmReturn = () => {
    if (!returnTarget) return
    returnPurchase(returnTarget.id)
    toast(`✓ ${t('pret_toast_returned')} ${returnTarget.ref} ${t('pret_toast_adjusted')}`)
    setReturnTarget(null)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{t('pret_title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{t('pret_subtitle')}</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('pret_eligible_count')}</p>
          <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
            {eligible.length}
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-5">
          <p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">{t('pret_total_returned')}</p>
          <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-gray-900 dark:text-white tabular-nums">
            {fmtDH(totalReturned)}
          </p>
        </motion.div>
      </div>

      {/* Eligible for return */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('pret_eligible_title')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3">{t('pret_col_ref')}</th>
                <th className="px-5 py-3">{t('pret_col_supplier')}</th>
                <th className="px-5 py-3">{t('pret_col_items')}</th>
                <th className="px-5 py-3">{t('pret_col_total')}</th>
                <th className="px-5 py-3 text-right">{t('pret_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {eligible.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-white/5 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5">
                  <td className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white">{p.ref}</td>
                  <td className="px-5 py-3 text-sm text-gray-700 dark:text-zinc-300">{p.supplierName}</td>
                  <td className="px-5 py-3 text-sm text-gray-600 dark:text-zinc-400 tabular-nums">
                    {p.items.reduce((a, i) => a + i.qty, 0)}
                  </td>
                  <td className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white tabular-nums">{fmtDH(p.total)}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => setReturnTarget(p)} className="btn-danger !h-8 !px-2.5 text-xs">
                      <Undo2 className="h-3.5 w-3.5" />
                      {t('pret_return')}
                    </button>
                  </td>
                </tr>
              ))}
              {eligible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('pret_none_eligible')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Return history */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            <RotateCcw className="h-4 w-4 text-violet-500" />
            {t('pret_history_title')}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3">{t('pret_col_ref')}</th>
                <th className="px-5 py-3">{t('pret_col_supplier')}</th>
                <th className="px-5 py-3">{t('pret_col_date')}</th>
                <th className="px-5 py-3 text-right">{t('pret_col_amount')}</th>
              </tr>
            </thead>
            <tbody>
              {returned.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-white/5">
                  <td className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white">{p.ref}</td>
                  <td className="px-5 py-3 text-sm text-gray-700 dark:text-zinc-300">{p.supplierName}</td>
                  <td className="px-5 py-3 text-sm text-gray-600 dark:text-zinc-400">
                    {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                    −{fmtDH(p.total)}
                  </td>
                </tr>
              ))}
              {returned.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                    {t('pret_none_recorded')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Return confirm */}
      <Modal open={!!returnTarget} onClose={() => setReturnTarget(null)} title={t('pret_confirm_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          {t('pret_confirm_prefix')}{' '}
          <span className="font-semibold text-gray-900 dark:text-white">{returnTarget?.ref}</span> {t('pret_confirm_suffix')}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setReturnTarget(null)} className="btn-secondary">
            {t('pret_cancel')}
          </button>
          <button onClick={confirmReturn} className="btn-danger">
            <Undo2 className="h-4 w-4" />
            {t('pret_return')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function RetoursFournisseursPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
