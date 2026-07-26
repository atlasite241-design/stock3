'use client'

import { useMemo, useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { LayoutGrid, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { storeShortCode, useDroguerie, type Zone } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, zones, allees, stores, activeStore, activeStoreId, addZone, updateZone, deleteZone } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ code: '', name: '' })

  // Code court du magasin actif (MAG01, MAG02…) pour l'aperçu de l'emplacement.
  const storeCode = useMemo(() => {
    const idx = stores.findIndex((s) => s.id === activeStoreId)
    return storeShortCode(idx < 0 ? 0 : idx)
  }, [stores, activeStoreId])

  if (!ready) return <Loader />

  const list = zones.filter((z) => z.storeId === activeStoreId).sort((a, b) => a.code.localeCompare(b.code, 'fr'))
  const alleeCount = (zoneId: string) => allees.filter((a) => a.zoneId === zoneId).length

  const openNew = () => { setEditId(null); setForm({ code: '', name: '' }); setOpen(true) }
  const openEdit = (z: Zone) => { setEditId(z.id); setForm({ code: z.code, name: z.name }); setOpen(true) }

  const save = () => {
    const code = form.code.trim().toUpperCase()
    const name = form.name.trim()
    if (!code) return
    // Unicité du code de zone dans le magasin.
    const clash = list.some((z) => z.code.toUpperCase() === code && z.id !== editId)
    if (clash) { toast(t('wms_code_exists'), 'error'); return }
    if (editId) updateZone(editId, { code, name })
    else addZone({ storeId: activeStoreId, code, name })
    toast(t('mag_saved'))
    setOpen(false)
  }

  const remove = (z: Zone) => {
    const res = deleteZone(z.id)
    if (!res.ok) { toast(t('wms_has_children'), 'error'); return }
    toast(t('mag_delete'))
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <LayoutGrid className="h-6 w-6 text-amber-500" />
            {t('wms_zones_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('wms_zones_subtitle')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
            <span className="ml-1 font-mono text-xs text-gray-400 dark:text-zinc-500">({storeCode})</span>
          </p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus className="h-4 w-4" />
          {t('wms_zone_new')}
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card overflow-hidden">
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <LayoutGrid className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('wms_zone_none')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  <th className="px-5 py-3">{t('wms_code')}</th>
                  <th className="px-5 py-3">{t('wms_zone_name')}</th>
                  <th className="px-5 py-3">{t('wms_emplacement')}</th>
                  <th className="px-5 py-3 text-center">{t('wms_allees')}</th>
                  <th className="px-5 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((z) => (
                  <tr key={z.id} className="border-b border-gray-50 last:border-0 dark:border-white/5 hover:bg-amber-50/40 dark:hover:bg-white/5">
                    <td className="px-5 py-3">
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 font-mono text-sm font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{z.code}</span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">{z.name || '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-zinc-400">{storeCode}-{z.code}</td>
                    <td className="px-5 py-3 text-center tabular-nums text-gray-600 dark:text-zinc-300">{alleeCount(z.id)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(z)} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-amber-400">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => remove(z)} className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? t('wms_zone_edit') : t('wms_zone_new')} maxWidth="max-w-sm">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('wms_code')}</span>
            <input className="input-field font-mono uppercase" value={form.code} maxLength={4} placeholder="A" onChange={(e) => setForm({ ...form, code: e.target.value })} autoFocus />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('wms_zone_name')}</span>
            <input className="input-field" value={form.name} placeholder={t('wms_zone_name_ph')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          {form.code.trim() && (
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              {t('wms_emplacement')} : <span className="font-mono text-amber-600 dark:text-amber-400">{storeCode}-{form.code.trim().toUpperCase()}</span>
            </p>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
          <button onClick={save} disabled={!form.code.trim()} className="btn-primary disabled:opacity-50">
            <Save className="h-4 w-4" />
            {t('mag_save')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function ZonesPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
