'use client'

import { useState } from 'react'
import Loader from '@/components/Loader'
import { motion } from 'framer-motion'
import { Pencil, Plus, Save, Trash2, Warehouse } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { useDroguerie, type Depot } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

function Content() {
  const { ready, depots, activeStore, activeStoreId, addDepot, updateDepot, deleteDepot } = useDroguerie()
  const { t } = useLanguage()
  const toast = useToast()

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', address: '', responsable: '' })

  if (!ready) {
    return <Loader />
  }

  const list = depots.filter((d) => d.storeId === activeStoreId)

  const openNew = () => {
    setEditId(null)
    setForm({ name: '', address: '', responsable: '' })
    setOpen(true)
  }
  const openEdit = (d: Depot) => {
    setEditId(d.id)
    setForm({ name: d.name, address: d.address, responsable: d.responsable })
    setOpen(true)
  }
  const save = () => {
    if (!form.name.trim()) return
    if (editId) updateDepot(editId, form)
    else addDepot({ storeId: activeStoreId, ...form })
    toast(t('mag_saved'))
    setOpen(false)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            <Warehouse className="h-6 w-6 text-amber-500" />
            {t('dep_title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {t('dep_subtitle')} — <span className="font-semibold text-amber-600 dark:text-amber-400">{activeStore?.name}</span>
          </p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus className="h-4 w-4" />
          {t('dep_new')}
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="glass-card overflow-hidden">
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <Warehouse className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">{t('dep_none')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                <th className="px-5 py-3">{t('dep_name')}</th>
                <th className="px-5 py-3">{t('mag_address')}</th>
                <th className="px-5 py-3">{t('dep_responsable')}</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className="group border-b border-gray-50 last:border-0 dark:border-white/5">
                  <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">{d.name}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-zinc-400">{d.address || '—'}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-zinc-400">{d.responsable || '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(d)} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-amber-400">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => { deleteDepot(d.id); toast(t('mag_delete')) }} className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? t('dep_title') : t('dep_new')}>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('dep_name')}</span>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('mag_address')}</span>
            <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">{t('dep_responsable')}</span>
            <input className="input-field" value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="btn-secondary">{t('mag_cancel')}</button>
          <button onClick={save} disabled={!form.name.trim()} className="btn-primary disabled:opacity-50">
            <Save className="h-4 w-4" />
            {t('mag_save')}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default function DepotsPage() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  )
}
