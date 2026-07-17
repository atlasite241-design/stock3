'use client'

import React, { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import AuthGate from './AuthGate'
import { ToastProvider } from './Toast'
import { useTheme } from '@/lib/theme'
import { playSound } from '@/lib/sound'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()

  // Global barcode scanner listener: a USB scanner types very fast and ends
  // with Enter. If the user scans anywhere outside an input, we jump to the
  // Caisse with the scanned code ready to be added to the cart.
  useEffect(() => {
    let buffer = ''
    let lastTime = 0
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      const now = Date.now()
      if (now - lastTime > 120) buffer = ''
      lastTime = now
      if (e.key === 'Enter') {
        if (buffer.length >= 6) {
          sessionStorage.setItem('pendingScan', buffer)
          if (pathname === '/caisse') {
            window.dispatchEvent(new CustomEvent('droguerie-scan'))
          } else {
            router.push('/caisse')
          }
        }
        buffer = ''
      } else if (/^[0-9a-zA-Z]$/.test(e.key)) {
        buffer += e.key
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router, pathname])

  // Light tactile click sound on any button press (respects the global on/off toggle).
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null
      const btn = el?.closest('button')
      if (btn && !btn.disabled) playSound('click')
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  return (
    <ToastProvider>
      <AuthGate>
      <div className="min-h-screen dark:bg-[#0a0a0f]">
        {/* Ambient glow */}
        <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
          <div className="absolute -top-32 left-1/3 h-[420px] w-[420px] rounded-full bg-amber-200/30 blur-[140px] dark:bg-amber-500/10" />
          <div className="absolute right-0 top-1/4 h-[360px] w-[360px] rounded-full bg-yellow-200/30 blur-[140px] dark:bg-yellow-500/[0.06]" />
        </div>

        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="relative z-10 flex min-h-screen flex-col lg:pl-64 rtl:lg:pl-0 rtl:lg:pr-64">
          <Topbar onMenuClick={() => setSidebarOpen(true)} theme={theme} onToggleTheme={toggleTheme} />
          <main className="mx-auto w-full max-w-[1560px] flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
      </AuthGate>
    </ToastProvider>
  )
}
