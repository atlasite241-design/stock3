'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { clearSession, getSession, makeSession, setSession, verifySecret, type Session } from './auth'
import { useDroguerie, type AppUser } from './store'

interface AuthValue {
  ready: boolean
  session: Session | null
  currentUser: AppUser | null
  needsSetup: boolean
  loginPassword: (email: string, password: string) => { ok: boolean }
  loginPin: (userId: string, pin: string) => { ok: boolean }
  establishSession: (user: AppUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthValue>({
  ready: false,
  session: null,
  currentUser: null,
  needsSetup: false,
  loginPassword: () => ({ ok: false }),
  loginPin: () => ({ ok: false }),
  establishSession: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { ready: dataReady, users } = useDroguerie()
  const [session, setSessionState] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    setSessionState(getSession())
    setChecked(true)
  }, [])

  const loginWith = (u: AppUser | undefined | null, secret: string, stored?: string) => {
    if (!u || !u.active || !verifySecret(secret, stored)) return { ok: false }
    const s = makeSession(u)
    setSession(s)
    setSessionState(s)
    return { ok: true }
  }

  const loginPassword = (email: string, password: string) => {
    const u = users.find((x) => x.active && x.email && x.email.toLowerCase() === email.trim().toLowerCase())
    return loginWith(u, password, u?.passwordHash)
  }

  const loginPin = (userId: string, pin: string) => {
    const u = users.find((x) => x.id === userId)
    return loginWith(u, pin, u?.pinHash)
  }

  // Ouvre une session pour un utilisateur donné (ex. juste après la configuration initiale).
  const establishSession = (u: AppUser) => {
    const s = makeSession(u)
    setSession(s)
    setSessionState(s)
  }

  const logout = () => {
    clearSession()
    setSessionState(null)
  }

  const currentUser = session ? users.find((u) => u.id === session.userId) ?? null : null
  // Aucun utilisateur actif n'a d'identifiant → première configuration requise.
  const activeUsers = users.filter((u) => u.active)
  const needsSetup = dataReady && activeUsers.length > 0 && activeUsers.every((u) => !u.passwordHash && !u.pinHash)

  return (
    <AuthContext.Provider value={{ ready: dataReady && checked, session, currentUser, needsSetup, loginPassword, loginPin, establishSession, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
