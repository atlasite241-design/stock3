'use client'

import React, { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useDroguerie } from '@/lib/store'
import Loader from './Loader'
import LicenseGate from './LicenseGate'
import PasswordChangeGate from './PasswordChangeGate'

/**
 * Empêche l'accès aux pages protégées tant que l'utilisateur n'est pas connecté.
 * La page /login n'est pas enveloppée par ce gardien.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, session } = useAuth()
  const { bootPhase } = useDroguerie()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (ready && !session && pathname !== '/login') {
      router.replace('/login')
    }
  }, [ready, session, pathname, router])

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white dark:bg-[#0a0a0f]">
        <Loader className="!min-h-0" />
        {bootPhase && (
          <p className="text-xs font-medium tracking-wide text-gray-400 dark:text-zinc-500">{bootPhase}</p>
        )}
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
