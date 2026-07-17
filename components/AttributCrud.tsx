'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react'
import Modal from '@/components/Modal'
import { useToast } from '@/components/Toast'
import type { Attribute } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'

export default function AttributCrud({
  title,
  subtitle,
  icon: Icon,
  items,
  usageOf,
  actions,
  newPlaceholder,
}: {
  title: string
  subtitle: string
  icon: LucideIcon
  items: Attribute[]
  usageOf: (name: string) => number
  actions: {
    add: (name: string) => void
    rename: (id: string, name: string) => void
    remove: (id: string) => void
  }
  newPlaceholder?: string
}) {
  const { t } = useLanguage()
  const toast = useToast()
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<Attribute | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Attribute | null>(null)
  const [blockedTarget, setBlockedTarget] = useState<Attribute | null>(null)

  const add = () => {
    const n = newName.trim()
    if (!n) return
    if (items.some((i) => i.name.toLowerCase() === n.toLowerCase())) {
      toast(`« ${n} » ${t('attr_toast_exists')}`, 'error')
      return
    }
    actions.add(n)
    setNewName('')
    toast(`✓ ${n} ${t('attr_toast_added')}`)
  }

  const saveRename = () => {
    if (!editing) return
    const n = editName.trim()
    if (!n) return
    actions.rename(editing.id, n)
    toast(`✓ ${t('attr_toast_renamed')} ${n}`)
    setEditing(null)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    actions.remove(deleteTarget.id)
    toast(`${deleteTarget.name} ${t('attr_toast_deleted')}`)
    setDeleteTarget(null)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{subtitle}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4 }}
        className="glass-card max-w-2xl p-6"
      >
        {/* Add row */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={newPlaceholder ?? `Nouveau ${title.toLowerCase().replace(/s$/, '')}…`}
            className="input-field"
          />
          <button onClick={add} disabled={!newName.trim()} className="btn-primary shrink-0">
            <Plus className="h-4 w-4" />
            {t('attr_add')}
          </button>
        </div>

        {/* List */}
        <div className="mt-5 space-y-2">
          {items.map((a) => {
            const usage = usageOf(a.name)
            return (
              <div
                key={a.id}
                className="group flex items-center gap-3 rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/5 px-4 py-2.5 transition hover:border-amber-200 dark:hover:border-amber-500/30"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-500">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">{a.name}</span>
                <span className="rounded-md bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400 tabular-nums">
                  {usage} {t('attr_product_count')}
                </span>
                <button
                  onClick={() => {
                    setEditing(a)
                    setEditName(a.name)
                  }}
                  className="rounded-lg p-1.5 text-gray-400 dark:text-zinc-500 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-400"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => (usage > 0 ? setBlockedTarget(a) : setDeleteTarget(a))}
                  className="rounded-lg p-1.5 text-gray-400 dark:text-zinc-500 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })}
          {items.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400 dark:text-zinc-500">{t('attr_empty')}</p>
          )}
        </div>
      </motion.div>

      {/* Rename modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={t('attr_rename_title')} maxWidth="max-w-sm">
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && saveRename()}
          className="input-field"
          autoFocus
        />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setEditing(null)} className="btn-secondary">
            {t('attr_cancel')}
          </button>
          <button onClick={saveRename} className="btn-primary">
            {t('attr_save')}
          </button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('attr_delete_title')} maxWidth="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <span className="font-semibold text-gray-900 dark:text-white">{deleteTarget?.name}</span> {t('attr_delete_desc')}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
            {t('attr_cancel')}
          </button>
          <button onClick={confirmDelete} className="btn-danger">
            <Trash2 className="h-4 w-4" />
            {t('attr_delete')}
          </button>
        </div>
      </Modal>

      {/* Blocked: category still has products */}
      <Modal open={!!blockedTarget} onClose={() => setBlockedTarget(null)} title={t('attr_blocked_title')} maxWidth="max-w-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            {t('attr_blocked_desc_prefix')} <span className="font-semibold text-gray-900 dark:text-white">{blockedTarget?.name}</span>
            {t('attr_blocked_desc_suffix')}
          </p>
        </div>
        <button onClick={() => setBlockedTarget(null)} className="btn-primary mt-5 w-full">
          {t('attr_understood')}
        </button>
      </Modal>
    </>
  )
}
