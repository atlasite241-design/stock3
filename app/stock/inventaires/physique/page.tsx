'use client'

// Inventaire physique complet : toutes les références actives du magasin sont
// chargées ; le comptage (saisie ou scan) alimente une session PERSISTÉE
// (brouillon → contrôle → validation) — contrairement à l'ancienne feuille
// volatile, fermer l'onglet ne perd plus rien.

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ClipboardList, Eye, Plus } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { useToast } from '@/components/Toast'
import InventoryCountSheet from '@/components/InventoryCountSheet'
import { usePermissions } from '@/lib/access'
import { INVENTORY_META, useDroguerie } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

const STATUS_KEY: Record<string, TKey> = {
  brouillon: 'inv_status_brouillon',
  controle: 'inv_status_controle',
  valide: 'inv_status_valide',
  annule: 'inv_status_annule',
}

function Content() {
  const { ready, products, inventories, depots, activeStoreId, activeStore, addInventory } = useDroguerie()
  const { can } = usePermissions()
  const { t } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const urlId = useSearchParams().get('id')

  const [createOpen, setCreateOpen] = useState(false)
  const [depotId, setDepotId] = useState('')
  const [note, setNote] = useState('')

  const storeDepots = depots.filter((d) => d.storeId === activeStoreId)
  const open = inventories
    .filter((i) => i.kind === 'physique' && (i.status === 'brouillon' || i.status === 'controle'))
    .sort((a, b) => b.date.localeCompare(a.date))
  const current = urlId ? inventories.find((i) => i.id === urlId && i.kind === 'physique') : undefined

  /*
   * UN SEUL INVENTAIRE PHYSIQUE À LA FOIS. Il porte sur TOUT le stock : en
   * ouvrir un second pendant qu'un comptage est en cours ferait compter les
   * mêmes articles deux fois, avec deux stocks théoriques figés à des instants
   * différents — la validation du second écraserait celle du premier. Il faut
   * donc valider ou annuler celui en cours avant d'en démarrer un autre.
   * Un inventaire tournant, lui, ne porte que sur une sélection : il reste
   * possible d'en lancer en parallèle.
   */
  const enCours = open[0]

  if (!ready) return <Loader />

  const create = () => {
    if (enCours) { toast(`${t('inv_already_open')} ${enCours.ref}`, 'error'); return }
    const inv = addInventory('physique', { depotId: depotId || undefined, note: note.trim() || undefined })
    setCreateOpen(false)
    setDepotId('')
    setNote('')
    toast(`✓ ${inv.ref} ${t('inv_created')}`)
    router.push(`/stock/inventaires/physique?id=${inv.id}`)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <ClipboardList className="h-6 w-6 text-amber-500" />
            {t('inv_phys_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('inv_phys_sub')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
            {current?.depotId && (
              <> · {t('inv_depot')} : <span className="font-semibold">{storeDepots.find((d) => d.id === current.depotId)?.name ?? '—'}</span></>
            )}
          </p>
        </div>
        {can('stock.inventory_create') && (
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={() => setCreateOpen(true)}
              disabled={!!enCours}
              title={enCours ? `${t('inv_already_open')} ${enCours.ref}` : undefined}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              {t('inv_new_phys')}
            </button>
            {enCours && (
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                {t('inv_already_open')} {enCours.ref}
              </span>
            )}
          </div>
        )}
      </motion.div>

      {current ? (
        current.status === 'brouillon' ? (
          <InventoryCountSheet inventory={current} pool={products} />
        ) : (
          // Comptage clos : rediriger la lecture vers l'écran de contrôle.
          <div className="glass-card flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {current.ref} — {t(STATUS_KEY[current.status])}
            </p>
            <button onClick={() => router.push(`/stock/inventaires/details?id=${current.id}`)} className="btn-primary">
              <Eye className="h-4 w-4" />
              {t('inv_view_control')}
            </button>
          </div>
        )
      ) : (
        <div className="glass-card overflow-x-auto">
          {open.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <ClipboardList className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
              <p className="text-sm text-gray-500 dark:text-zinc-400">{t('inv_phys_empty')}</p>
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/10 dark:text-zinc-500">
                  <th className="px-4 py-3">{t('inv_c_ref')}</th>
                  <th className="px-4 py-3">{t('inv_col_date')}</th>
                  <th className="px-4 py-3">{t('inv_depot')}</th>
                  <th className="px-4 py-3 text-center">{t('inv_kpi_counted')}</th>
                  <th className="px-4 py-3">{t('inv_c_status')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {open.map((i) => (
                  <tr key={i.id} className="border-b border-gray-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-2.5 font-semibold text-amber-600 dark:text-amber-400">{i.ref}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(i.date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{storeDepots.find((d) => d.id === i.depotId)?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums text-gray-600 dark:text-zinc-300">{i.lines.length}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${INVENTORY_META[i.status].chip}`}>
                        {t(STATUS_KEY[i.status])}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => router.push(i.status === 'brouillon' ? `/stock/inventaires/physique?id=${i.id}` : `/stock/inventaires/details?id=${i.id}`)}
                        className="btn-secondary !px-3 !py-1.5 text-xs"
                      >
                        {i.status === 'brouillon' ? t('inv_continue') : t('inv_view_control')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Création */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('inv_new_phys')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-300">{t('inv_new_phys_desc')}</p>
        {storeDepots.length > 1 && (
          <div className="mt-4">
            <label className="field-label">{t('inv_depot')}</label>
            <Select
              value={depotId}
              onChange={setDepotId}
              options={[{ value: '', label: t('inv_depot_all') }, ...storeDepots.map((d) => ({ value: d.id, label: d.name }))]}
            />
          </div>
        )}
        <div className="mt-4">
          <label className="field-label">{t('inv_note')}</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="input-field" placeholder={t('inv_note_ph')} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setCreateOpen(false)} className="btn-secondary">{t('cli_cancel')}</button>
          <button onClick={create} className="btn-primary">
            <Plus className="h-4 w-4" />
            {t('inv_create')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function Page() {
  return <AppShell><Content /></AppShell>
}
