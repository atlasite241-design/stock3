'use client'

import React, { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import LicenseGate from './LicenseGate'
import PasswordChangeGate from './PasswordChangeGate'

/**
 * Empêche l'accès aux pages protégées tant que l'utilisateur n'est pas connecté.
 * La page /login n'est pas enveloppée par ce gardien.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, session } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (ready && !session && pathname !== '/login') {
      router.replace('/login')
    }
  }, [ready, session, pathname, router])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-400 dark:bg-[#0a0a0f] dark:text-zinc-500">
        …
      </div>
    )
  }
  if (!session) return null // redirection en cours

  // Connecté → mot de passe définitif requis, puis licence active sur cet appareil.
  return (
    <PasswordChangeGate>
      <LicenseGate>{children}</LicenseGate>
    </PasswordChangeGate>
  )
}
