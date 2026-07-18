'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import AuthGate from './AuthGate'
import BottomNav from './MobileNav'

// Enveloppe des sous-écrans du menu « Plus » : en-tête avec bouton retour,
// titre, sous-titre et une zone d'action optionnelle (ex. bouton scanner).
export default function MobileSubShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const router = useRouter()

  return (
    <AuthGate>
      <div className="relative mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#0b1326] pb-32 text-slate-200">
        <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
          <div className="absolute left-1/3 -top-24 h-72 w-72 rounded-full bg-sky-500/10 blur-[120px]" />
        </div>

        {/* Top bar */}
        <header className="fixed left-1/2 top-0 z-50 flex w-full max-w-md -translate-x-1/2 items-center gap-3 border-b border-sky-500/20 bg-slate-950/60 px-4 py-3 backdrop-blur-2xl">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-500/20 bg-white/5 text-sky-300 transition active:scale-90"
            aria-label="Retour"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-white">{title}</h1>
            {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>

        <main className="relative z-10 mt-[68px] space-y-5 px-5 pt-3">{children}</main>

        <BottomNav />
      </div>
    </AuthGate>
  )
}
