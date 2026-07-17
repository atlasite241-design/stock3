'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2, Check, ChevronDown } from 'lucide-react'
import { getActiveStoreId, loadStores, setActiveStoreId, type Store } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { useLanguage } from '@/lib/i18n'

export default function StoreSwitcher() {
  const { t } = useLanguage()
  const { session } = useAuth()
  const [stores, setStores] = useState<Store[]>([])
  const [activeId, setActiveId] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setStores(loadStores())
    setActiveId(getActiveStoreId())
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Magasins autorisés selon le rôle : admin = tous, sinon storeIds de l'utilisateur.
  const allowedStores =
    !session || session.role === 'Administrateur'
      ? stores
      : stores.filter((s) => session.storeIds.includes(s.id))

  // Si le magasin actif n'est pas autorisé, on bascule sur le premier autorisé.
  useEffect(() => {
    if (!session || stores.length === 0 || allowedStores.length === 0) return
    if (!allowedStores.some((s) => s.id === activeId)) {
      setActiveStoreId(allowedStores[0].id)
      window.location.reload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, stores, activeId])

  const active = allowedStores.find((s) => s.id === activeId) ?? allowedStores[0] ?? null
  const canSwitch = allowedStores.length > 1

  const pick = (id: string) => {
    if (id === activeId) {
      setOpen(false)
      return
    }
    setActiveStoreId(id)
    window.location.reload()
  }

  if (!active) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => canSwitch && setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-left transition dark:border-amber-500/20 dark:bg-amber-500/10 ${
          canSwitch ? 'hover:bg-amber-100 dark:hover:bg-amber-500/20' : 'cursor-default'
        }`}
        title={t('mag_current')}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 text-gray-900">
          <Building2 className="h-3.5 w-3.5" />
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-[130px] truncate text-[13px] font-bold leading-tight text-amber-900 dark:text-amber-300">{active.name}</span>
          <span className="block text-[10px] font-semibold uppercase leading-tight text-amber-600/70 dark:text-amber-400/60">{t('mag_current')}</span>
        </span>
        {canSwitch && <ChevronDown className={`h-4 w-4 text-amber-500 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {open && canSwitch && (
        <div className="absolute left-0 top-12 z-50 w-64 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#12121a] rtl:left-auto rtl:right-0">
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">{t('mag_switch')}</p>
          <div className="max-h-72 overflow-y-auto">
            {allowedStores.map((s) => (
              <button
                key={s.id}
                onClick={() => pick(s.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  s.id === activeId
                    ? 'bg-amber-50 dark:bg-amber-500/10'
                    : 'hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.active ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' : 'bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-zinc-500'}`}>
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{s.name}</span>
                  <span className="block text-xs text-gray-500 dark:text-zinc-400">{s.code}{s.city ? ` · ${s.city}` : ''}</span>
                </span>
                {s.id === activeId && <Check className="h-4 w-4 shrink-0 text-amber-500" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
