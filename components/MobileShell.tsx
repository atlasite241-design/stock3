'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, Building2, Check, ChevronDown } from 'lucide-react'
import AuthGate from './AuthGate'
import BottomNav from './MobileNav'
import { useDroguerie } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const { products, stores, activeStore, activeStoreId, switchStore } = useDroguerie()
  const { currentUser, session } = useAuth()
  const [storeOpen, setStoreOpen] = useState(false)

  const who = currentUser?.name ?? session?.name ?? activeStore?.manager ?? 'Gérant'
  const initials = who.split(' ')[0].slice(0, 2).toUpperCase()
  const lowCount = products.filter((p) => p.stock <= p.minStock).length
  // Magasins autorisés selon le rôle.
  const allowedStores = !session || session.role === 'Administrateur' ? stores : stores.filter((s) => session.storeIds.includes(s.id))
  const canSwitch = allowedStores.length > 1

  // Force le magasin actif dans les magasins autorisés.
  useEffect(() => {
    if (!session || stores.length === 0 || allowedStores.length === 0) return
    if (!allowedStores.some((s) => s.id === activeStoreId)) switchStore(allowedStores[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, stores, activeStoreId])

  return (
    <AuthGate>
    <div className="relative mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-slate-100 dark:bg-[#0b1326] pb-32 text-slate-700 dark:text-slate-200">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="absolute left-1/3 -top-24 h-72 w-72 rounded-full bg-sky-500/10 blur-[120px]" />
      </div>

      {/* Top app bar */}
      <header className="fixed left-1/2 top-0 z-50 flex w-full max-w-md -translate-x-1/2 items-center justify-between gap-2 border-b border-slate-200 dark:border-sky-500/20 bg-white/80 dark:bg-slate-950/60 px-5 py-3 backdrop-blur-2xl">
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
                  <div className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-2xl border border-slate-200 dark:border-sky-500/20 bg-white dark:bg-slate-900 p-1.5 shadow-2xl">
                    {allowedStores.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => (s.id === activeStoreId ? setStoreOpen(false) : switchStore(s.id))}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${s.id === activeStoreId ? 'bg-sky-500/10' : 'hover:bg-slate-100 dark:bg-white/5'}`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.active ? 'bg-sky-500/15 text-sky-300' : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400'}`}>
                          <Building2 className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{s.name}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">{s.code}{s.city ? ` · ${s.city}` : ''}</span>
                        </span>
                        {s.id === activeStoreId && <Check className="h-4 w-4 shrink-0 text-sky-400" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <Link href="/mobile/plus/notifications" className="relative flex h-9 w-9 items-center justify-center rounded-full text-sky-400 transition-colors hover:bg-sky-500/10">
            <Bell className="h-5 w-5" />
            {lowCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{lowCount}</span>
            )}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mt-20 space-y-8 px-6">{children}</main>

      <BottomNav />
    </div>
    </AuthGate>
  )
}
