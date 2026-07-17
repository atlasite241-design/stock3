'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Bell, Boxes, Building2, Check, ChevronDown, LayoutDashboard, Plus, Wallet } from 'lucide-react'
import AuthGate from './AuthGate'
import { useDroguerie } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { useLanguage, type TKey } from '@/lib/i18n'

const NAV: { href: string; icon: React.ReactNode; labelKey: TKey }[] = [
  { href: '/mobile', icon: <LayoutDashboard className="h-5 w-5" />, labelKey: 'mob_nav_home' },
  { href: '/mobile/ventes', icon: <Wallet className="h-5 w-5" />, labelKey: 'mob_nav_sales' },
  { href: '/mobile/stock', icon: <Boxes className="h-5 w-5" />, labelKey: 'mob_nav_stock' },
  { href: '/mobile/analytics', icon: <BarChart3 className="h-5 w-5" />, labelKey: 'mob_nav_analytics' },
]

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const { products, stores, activeStore, activeStoreId, switchStore } = useDroguerie()
  const { currentUser, session } = useAuth()
  const { t } = useLanguage()
  const pathname = usePathname()
  const [storeOpen, setStoreOpen] = useState(false)

  const who = currentUser?.name ?? session?.name ?? activeStore?.manager ?? 'Gérant'
  const initials = who.split(' ')[0].slice(0, 2).toUpperCase()
  const lowCount = products.filter((p) => p.stock <= p.minStock).length
  // Magasins autorisés selon le rôle.
  const allowedStores = !session || session.role === 'Administrateur' ? stores : stores.filter((s) => session.storeIds.includes(s.id))
  const canSwitch = allowedStores.length > 1
  const onCaisse = pathname.startsWith('/mobile/caisse')

  // Force le magasin actif dans les magasins autorisés.
  useEffect(() => {
    if (!session || stores.length === 0 || allowedStores.length === 0) return
    if (!allowedStores.some((s) => s.id === activeStoreId)) switchStore(allowedStores[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, stores, activeStoreId])

  const isActive = (href: string) => (href === '/mobile' ? pathname === '/mobile' : pathname.startsWith(href))

  return (
    <AuthGate>
    <div className="relative mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#0b1326] pb-32 text-slate-200">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="absolute left-1/3 -top-24 h-72 w-72 rounded-full bg-sky-500/10 blur-[120px]" />
      </div>

      {/* Top app bar */}
      <header className="fixed left-1/2 top-0 z-50 flex w-full max-w-md -translate-x-1/2 items-center justify-between gap-2 border-b border-sky-500/20 bg-slate-950/60 px-5 py-3 backdrop-blur-2xl">
        <Link href="/mobile" className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-500/40 bg-gradient-to-br from-sky-400 to-cyan-500 text-xs font-black text-slate-900">
            {initials}
          </div>
          <span className="truncate text-lg font-black italic tracking-tight text-sky-400">DrogueriePro</span>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          {/* Store selector */}
          {activeStore && (
            <div className="relative">
              <button
                onClick={() => canSwitch && setStoreOpen((o) => !o)}
                className={`flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-bold text-sky-300 ${canSwitch ? '' : 'cursor-default'}`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span className="max-w-[64px] truncate">{activeStore.code || activeStore.name}</span>
                {canSwitch && <ChevronDown className={`h-3.5 w-3.5 transition-transform ${storeOpen ? 'rotate-180' : ''}`} />}
              </button>
              {storeOpen && canSwitch && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setStoreOpen(false)} />
                  <div className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-2xl border border-sky-500/20 bg-slate-900 p-1.5 shadow-2xl">
                    {allowedStores.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => (s.id === activeStoreId ? setStoreOpen(false) : switchStore(s.id))}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${s.id === activeStoreId ? 'bg-sky-500/10' : 'hover:bg-white/5'}`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.active ? 'bg-sky-500/15 text-sky-300' : 'bg-white/10 text-slate-400'}`}>
                          <Building2 className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">{s.name}</span>
                          <span className="block text-xs text-slate-400">{s.code}{s.city ? ` · ${s.city}` : ''}</span>
                        </span>
                        {s.id === activeStoreId && <Check className="h-4 w-4 shrink-0 text-sky-400" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <Link href="/mobile/stock" className="relative flex h-9 w-9 items-center justify-center rounded-full text-sky-400 transition-colors hover:bg-sky-500/10">
            <Bell className="h-5 w-5" />
            {lowCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{lowCount}</span>
            )}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mt-20 space-y-8 px-6">{children}</main>

      {/* Floating "Encaisser" action */}
      {!onCaisse && (
        <div className="pointer-events-none fixed bottom-28 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-6">
          <div className="flex justify-end">
            <Link
              href="/mobile/caisse"
              className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 text-slate-900 shadow-[0_8px_30px_rgba(14,165,233,0.5)] transition active:scale-90"
              title={t('mob_pos_checkout')}
              aria-label={t('mob_pos_checkout')}
            >
              <Plus className="h-7 w-7" strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      )}

      {/* Bottom navigation */}
      <nav className="fixed bottom-6 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4">
        <div className="mx-auto flex h-16 items-center justify-around rounded-full border border-sky-500/20 bg-slate-950/80 px-2 shadow-[0_-8px_30px_rgba(14,165,233,0.1)] backdrop-blur-3xl">
          {NAV.map((n) => {
            const active = isActive(n.href)
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex flex-col items-center justify-center rounded-full px-4 py-1 transition-all active:scale-90 ${
                  active ? 'bg-sky-500/10 text-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.2)]' : 'text-slate-500 hover:text-sky-300'
                }`}
              >
                {n.icon}
                <span className="mt-1 text-[10px] font-medium uppercase tracking-widest">{t(n.labelKey)}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
    </AuthGate>
  )
}
