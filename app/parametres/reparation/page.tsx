'use client'

/*
 * RÉPARATION DES DONNÉES.
 *
 * Des garde-fous ont été ajoutés après coup : rien n'empêchait de retourner
 * deux fois la même vente, ni de convertir un devis autant de fois qu'on
 * cliquait. Le code ne peut pas défaire ce qui a déjà été écrit — cet écran le
 * peut, sous le contrôle de l'utilisateur.
 *
 * Deux niveaux de certitude, volontairement séparés :
 *   — les retours en trop sont une CERTITUDE arithmétique (on ne rend pas plus
 *     qu'on n'a acheté) : ils sont désignés d'office ;
 *   — les ventes en double ne sont qu'un SOUPÇON (deux clients peuvent acheter
 *     la même chose à la même minute) : rien n'est coché d'avance.
 */

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, ShieldCheck, Undo2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { usePermissions } from '@/lib/access'
import { fmtDH, retoursExcedentaires, ventesDupliquees, useDroguerie } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, sales, returns, activeStore, annulerRetour, annulerVente } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()

  const [choisies, setChoisies] = useState<Record<string, boolean>>({})
  const [confirmRetours, setConfirmRetours] = useState(false)
  const [confirmVentes, setConfirmVentes] = useState(false)

  const trop = useMemo(() => retoursExcedentaires(sales, returns), [sales, returns])
  const groupes = useMemo(() => ventesDupliquees(sales), [sales])
  const nbChoisies = Object.values(choisies).filter(Boolean).length

  if (!ready) return <Loader />

  const autorise = can('stock.manual_edit') || can('set.reset_stats')

  const reparerRetours = () => {
    let n = 0
    // Un par un : chaque annulation relit l'état à jour du stock et de la caisse.
    for (const r of trop) if (annulerRetour(r.id)) n++
    setConfirmRetours(false)
    toast(`✓ ${n} ${t('rpr_toast_returns')}`)
  }

  const reparerVentes = () => {
    let n = 0
    let bloquees = 0
    for (const id of Object.keys(choisies)) {
      if (!choisies[id]) continue
      const r = annulerVente(id)
      if (r.ok) n++
      else if (r.raison === 'retours') bloquees++
    }
    setChoisies({})
    setConfirmVentes(false)
    toast(
      bloquees > 0 ? `✓ ${n} ${t('rpr_toast_sales')} · ${bloquees} ${t('rpr_blocked_returns')}` : `✓ ${n} ${t('rpr_toast_sales')}`,
      bloquees > 0 ? 'warning' : 'success'
    )
  }

  const montantTrop = trop.reduce((a, r) => a + r.total, 0)

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          <ShieldCheck className="h-6 w-6 text-amber-500" />
          {t('rpr_title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          {t('rpr_sub')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
        </p>
      </motion.div>

      {!autorise && (
        <div className="glass-card border-l-4 border-rose-500 px-5 py-4">
          <p className="text-sm text-rose-600 dark:text-rose-400">{t('rpr_forbidden')}</p>
        </div>
      )}

      {/* 1 — Retours en trop (certitude) */}
      <div className="glass-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              {t('rpr_returns_title')}
            </p>
            <p className="mt-0.5 max-w-2xl text-xs text-gray-500 dark:text-zinc-400">{t('rpr_returns_desc')}</p>
          </div>
          {trop.length > 0 && autorise && (
            <button onClick={() => setConfirmRetours(true)} className="btn-primary">
              <Undo2 className="h-4 w-4" />
              {t('rpr_fix')} ({trop.length})
            </button>
          )}
        </div>

        {trop.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {t('rpr_returns_none')}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                  <th className="px-3 py-2">{t('rpr_col_doc')}</th>
                  <th className="px-3 py-2">{t('rpr_col_date')}</th>
                  <th className="px-3 py-2">{t('rpr_col_sale')}</th>
                  <th className="px-3 py-2 text-center">{t('rpr_col_articles')}</th>
                  <th className="px-3 py-2 text-right">{t('rpr_col_amount')}</th>
                </tr>
              </thead>
              <tbody>
                {trop.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                    <td className="px-3 py-2 font-semibold text-rose-600 dark:text-rose-400">{r.creditNo ?? r.id.slice(-5)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{new Date(r.date).toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">#{r.saleId.slice(-5)}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-gray-600 dark:text-zinc-300">
                      {r.items.reduce((a, i) => a + i.qty, 0)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-rose-500">−{fmtDH(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2 — Ventes en double (soupçon) */}
      <div className="glass-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {t('rpr_sales_title')}
            </p>
            <p className="mt-0.5 max-w-2xl text-xs text-gray-500 dark:text-zinc-400">{t('rpr_sales_desc')}</p>
          </div>
          {nbChoisies > 0 && autorise && (
            <button onClick={() => setConfirmVentes(true)} className="btn-danger">
              <Undo2 className="h-4 w-4" />
              {t('rpr_cancel_selected')} ({nbChoisies})
            </button>
          )}
        </div>

        {groupes.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {t('rpr_sales_none')}
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {groupes.map((groupe) => (
              <div key={groupe[0].id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-500/20 dark:bg-amber-500/[0.06]">
                <p className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {groupe.length} {t('rpr_group_same')} — {groupe[0].clientName || t('rpr_no_client')} · {fmtDH(groupe[0].total)}
                </p>
                <div className="space-y-1.5">
                  {groupe.map((s, i) => (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                        choisies[s.id] ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-white/60 dark:bg-white/[0.03]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!!choisies[s.id]}
                        disabled={!autorise}
                        onChange={(e) => setChoisies({ ...choisies, [s.id]: e.target.checked })}
                        className="h-4 w-4 rounded accent-rose-500"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-semibold text-gray-900 dark:text-white">{s.invoiceNo ?? s.id.slice(-6)}</span>
                        <span className="ml-2 text-xs text-gray-500">{new Date(s.date).toLocaleString('fr-FR')}</span>
                        {/* La plus ancienne est presque toujours la vraie : on le dit. */}
                        {i === 0 && <span className="ml-2 text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">{t('rpr_keep_hint')}</span>}
                      </span>
                      <span className="shrink-0 tabular-nums text-gray-600 dark:text-zinc-300">{fmtDH(s.total)}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmations */}
      <Modal open={confirmRetours} onClose={() => setConfirmRetours(false)} title={t('rpr_confirm_returns_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-300">
          {t('rpr_confirm_returns_1')} <b>{trop.length}</b> {t('rpr_confirm_returns_2')} <b>{fmtDH(montantTrop)}</b>. {t('rpr_confirm_returns_3')}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setConfirmRetours(false)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={reparerRetours} className="btn-primary"><Undo2 className="h-4 w-4" />{t('rpr_fix')}</button>
        </div>
      </Modal>

      <Modal open={confirmVentes} onClose={() => setConfirmVentes(false)} title={t('rpr_confirm_sales_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-300">
          <b>{nbChoisies}</b> {t('rpr_confirm_sales_1')}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setConfirmVentes(false)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={reparerVentes} className="btn-danger"><Undo2 className="h-4 w-4" />{t('rpr_cancel_selected')}</button>
        </div>
      </Modal>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
