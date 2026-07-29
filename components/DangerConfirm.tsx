'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from '@/components/Modal'
import { useLanguage } from '@/lib/i18n'

/**
 * Confirmation d'une action DESTRUCTRICE : l'utilisateur doit saisir un mot exact
 * (nom de l'élément ou « SUPPRIMER ») pour activer le bouton d'action. Empêche les
 * clics accidentels sur les suppressions irréversibles.
 */
export default function DangerConfirm({
  open,
  onClose,
  onConfirm,
  title,
  description,
  word,
  actionLabel,
  icon,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: ReactNode
  /** Mot exact à saisir pour confirmer (ex. le nom du magasin). Défaut : SUPPRIMER. */
  word?: string
  actionLabel: string
  icon?: ReactNode
}) {
  const { t } = useLanguage()
  const target = (word && word.trim()) || 'SUPPRIMER'
  const [txt, setTxt] = useState('')
  useEffect(() => { if (!open) setTxt('') }, [open])
  const ok = txt.trim().toLowerCase() === target.toLowerCase()

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <p className="text-sm text-gray-600 dark:text-zinc-300">{description}</p>
      </div>
      <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/20 dark:bg-rose-500/10">
        <label className="mb-1.5 block text-xs font-semibold text-rose-700 dark:text-rose-400">
          {t('danger_type_hint')} <span className="font-mono font-bold">{target}</span>
        </label>
        <input
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && ok) { onConfirm(); setTxt('') } }}
          placeholder={target}
          className="input-field font-mono"
          autoFocus
        />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button onClick={onClose} className="btn-secondary">{t('attr_cancel')}</button>
        <button
          onClick={() => { if (ok) { onConfirm(); setTxt('') } }}
          disabled={!ok}
          className="btn-danger disabled:cursor-not-allowed disabled:opacity-40"
        >
          {icon}{actionLabel}
        </button>
      </div>
    </Modal>
  )
}
