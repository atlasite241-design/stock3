'use client'

import {
  BarChart3,
  Boxes,
  ClipboardList,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PERMISSION_CATALOG, type Lang } from '@/lib/permissions'
import { useLanguage } from '@/lib/i18n'

const CATEGORY_ICON: Record<string, LucideIcon> = {
  Package, ShoppingCart, Wallet, Users, Truck, ClipboardList, Boxes, BarChart3, Settings,
}

/**
 * Grille contrôlée des permissions (9 catégories). `value` = clés actives.
 * `onChange(next)` reçoit le nouvel ensemble. `lockedKeys` = permissions non modifiables.
 */
export default function PermissionGrid({
  value,
  onChange,
  disabled = false,
  lockedKeys = [],
}: {
  value: Set<string>
  onChange: (next: Set<string>) => void
  disabled?: boolean
  lockedKeys?: string[]
}) {
  const { t, lang } = useLanguage()
  const locked = (k: string) => lockedKeys.includes(k)

  const emit = (next: Set<string>) => {
    lockedKeys.forEach((k) => { if (value.has(k)) next.add(k) })
    onChange(next)
  }

  const toggle = (k: string) => {
    if (disabled || locked(k)) return
    const next = new Set(value)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    emit(next)
  }

  const toggleCategory = (catKey: string) => {
    if (disabled) return
    const keys = PERMISSION_CATALOG.find((c) => c.key === catKey)?.perms.map((p) => p.key) ?? []
    const allOn = keys.every((k) => value.has(k))
    const next = new Set(value)
    keys.forEach((k) => { if (allOn) { if (!locked(k)) next.delete(k) } else next.add(k) })
    emit(next)
  }

  return (
    <div className={`grid grid-cols-1 gap-5 md:grid-cols-2 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      {PERMISSION_CATALOG.map((catg) => {
        const CatIcon = CATEGORY_ICON[catg.icon] ?? Package
        const allOn = catg.perms.every((p) => value.has(p.key))
        return (
          <div key={catg.key} className="space-y-3.5 rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50/40 dark:bg-white/5 p-5">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <CatIcon className="h-4 w-4 text-amber-500" />
                <h5 className="text-sm font-bold text-gray-900 dark:text-white">{catg[lang as Lang]}</h5>
              </div>
              <button onClick={() => toggleCategory(catg.key)} className="text-[11px] font-semibold text-amber-600 hover:underline dark:text-amber-400">
                {allOn ? t('perm_deselect_all') : t('perm_select_all')}
              </button>
            </div>
            <div className="space-y-3">
              {catg.perms.map((perm) => {
                const on = value.has(perm.key)
                const lk = locked(perm.key)
                return (
                  <div key={perm.key} className={`flex items-center justify-between gap-3 ${lk ? 'opacity-70' : ''}`}>
                    <span className="text-sm text-gray-700 dark:text-zinc-300">{perm[lang as Lang]}</span>
                    <button
                      onClick={() => toggle(perm.key)}
                      disabled={lk}
                      aria-pressed={on}
                      className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${on ? 'bg-amber-500' : 'bg-gray-300 dark:bg-white/15'} ${lk ? 'cursor-not-allowed' : ''}`}
                    >
                      <span className={`absolute top-1 h-3 w-3 rounded-full bg-white shadow-sm transition-all ${on ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
