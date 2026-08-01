'use client'

// Annulation de mouvement : on ne supprime jamais l'historique — on enregistre
// un mouvement INVERSE qui neutralise l'effet du premier. La trace des deux
// écritures reste consultable, ce qui est la règle en comptabilité de stock.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw, Search, Undo2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import DangerConfirm from '@/components/DangerConfirm'
import Loader from '@/components/Loader'
import { useToast } from '@/components/Toast'
import { useDroguerie, type StockMovement } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const LABEL: Record<string, TKey> = {
  entree: 'sk_cx_t_entree', reappro: 'sk_cx_t_reappro', sortie: 'sk_cx_t_sortie',
  ajustement: 'sk_cx_t_ajustement', vente: 'sk_cx_t_vente', reception: 'sk_cx_t_reception',
  retour: 'sk_cx_t_retour', inventaire: 'sk_cx_t_inventaire',
  transfert_out: 'sk_cx_t_transfert_out', transfert_in: 'sk_cx_t_transfert_in',
  stock_initial: 'sk_cx_t_stock_initial',
}

// Un mouvement déjà annulé porte cette marque : on évite la double annulation.
const CANCEL_TAG = 'Annulation du mouvement'

function Content() {
  const { ready, movements, activeStoreId, activeStore, adjustStock } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<StockMovement | null>(null)

  const cancelled = useMemo(
    () => new Set(movements.filter((m) => m.note?.startsWith(CANCEL_TAG)).map((m) => m.note!.replace(CANCEL_TAG + ' ', ''))),
    [movements]
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return movements
      .filter((m) => !m.storeId || m.storeId === activeStoreId)
      .filter((m) => !q || m.productName.toLowerCase().includes(q) || (m.note ?? '').toLowerCase().includes(q))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 200)
  }, [movements, activeStoreId, query])

  if (!ready) return <Loader />

  const cancel = () => {
    if (!target) return
    // Mouvement inverse : la quantité opposée, tracée vers l'original.
    adjustStock(target.productId, -target.qty, `${CANCEL_TAG} ${target.id}`, target.depotId)
    toast(`✓ ${t('sk_cx_toast')} : ${target.productName} (${target.qty > 0 ? '+' : ''}${target.qty})`)
    setTarget(null)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <Undo2 className="h-6 w-6 text-amber-500" />{t('sk_cx_title')}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">
          {t('sk_cx_sub')} —{' '}
          <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
        </p>
      </motion.div>

      <div className="glass-card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t('sk_cx_search')} className="input-field pl-9" />
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <RotateCcw className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('sk_cx_empty')}</p>
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                <th className="px-4 py-3">{t('sk_var_date')}</th><th className="px-4 py-3">{t('sa_col_product')}</th>
                <th className="px-4 py-3">{t('sk_cx_type')}</th><th className="px-4 py-3 text-center">{t('sk_cx_qty')}</th>
                <th className="px-4 py-3">{t('sk_var_note')}</th><th className="px-4 py-3 text-right" />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const isCancelled = cancelled.has(m.id)
                const isCancellation = m.note?.startsWith(CANCEL_TAG)
                return (
                  <tr key={m.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(m.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{m.productName}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{LABEL[m.type] ? t(LABEL[m.type]) : m.type}</td>
                    <td className={`px-4 py-2.5 text-center font-bold tabular-nums ${m.qty < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {m.qty > 0 ? '+' : ''}{m.qty}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{m.note ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      {isCancelled ? (
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-white/10">{t('sk_cx_done')}</span>
                      ) : isCancellation ? (
                        <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">{t('sk_cx_is_cancel')}</span>
                      ) : (
                        <button onClick={() => setTarget(m)}
                          className="rounded-lg px-2 py-1 text-[11px] font-bold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10">
                          {t('sk_cx_action')}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <DangerConfirm
        open={!!target}
        onClose={() => setTarget(null)}
        onConfirm={cancel}
        title={t('sk_cx_confirm_title')}
        description={
          target ? (
            <>
              {t('sk_cx_confirm_1')}{' '}
              <span className="font-bold text-gray-900 dark:text-white">{-target.qty > 0 ? '+' : ''}{-target.qty}</span>{' '}
              {t('sk_cx_confirm_2')} <span className="font-bold text-gray-900 dark:text-white">{target.productName}</span>.{' '}
              {t('sk_cx_confirm_3')}
            </>
          ) : ''
        }
        word={t('sk_cx_word')}
        actionLabel={t('sk_cx_confirm_title')}
      />
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
