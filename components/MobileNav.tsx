'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Boxes, ClipboardList, LayoutDashboard, Menu, ShoppingCart } from 'lucide-react'
import { useLanguage, type TKey } from '@/lib/i18n'

// Barre de navigation mobile — 5 onglets. Partagée par MobileShell (accueil,
// ventes, stock…) et MobileSubShell (écrans du menu « Plus »).
export const MOBILE_NAV: { href: string; icon: React.ReactNode; labelKey: TKey }[] = [
  { href: '/mobile', icon: <LayoutDashboard className="h-[22px] w-[22px]" />, labelKey: 'mob_nav_home' },
  { href: '/mobile/caisse', icon: <ShoppingCart className="h-[22px] w-[22px]" />, labelKey: 'mob_nav_sales' },
  { href: '/mobile/stock', icon: <Boxes className="h-[22px] w-[22px]" />, labelKey: 'mob_nav_stock' },
  { href: '/mobile/inventaire', icon: <ClipboardList className="h-[22px] w-[22px]" />, labelKey: 'mob_nav_inventory' },
  { href: '/mobile/plus', icon: <Menu className="h-[22px] w-[22px]" />, labelKey: 'mob_nav_more' },
]

export default function BottomNav() {
  const { t } = useLanguage()
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/mobile') return pathname === '/mobile'
    // « Plus » reste actif sur tous ses sous-écrans (/mobile/plus/...).
    if (href === '/mobile/plus') return pathname.startsWith('/mobile/plus')
    return pathname.startsWith(href)
  }

  return (
    <nav className="fixed bottom-5 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4">
      <div className="mx-auto flex h-16 items-center justify-around rounded-full border border-slate-200 dark:border-amber-500/20 bg-white/85 dark:bg-slate-950/85 px-1.5 shadow-[0_-8px_30px_rgb(var(--c-amber-500)/0.12)] backdrop-blur-3xl">
        {MOBILE_NAV.map((n) => {
          const active = isActive(n.href)
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-1 flex-col items-center justify-center rounded-full py-1.5 transition-all active:scale-90 ${
                active ? 'text-amber-400' : 'text-slate-500 hover:text-amber-300'
              }`}
            >
              <span className={active ? 'drop-shadow-[0_0_8px_rgb(var(--c-amber-500)/0.5)]' : ''}>{n.icon}</span>
              <span className="mt-0.5 text-[9px] font-semibold tracking-wide">{t(n.labelKey)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
