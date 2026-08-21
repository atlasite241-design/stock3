'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { clearSession, getSession, makeSession, setSession, verifySecret, type Session } from './auth'
import { useDroguerie, type AppUser } from './store'
import { AUTH_EXPIRED, serverLogin, serverLogout } from './sync-api'

interface AuthValue {
  ready: boolean
  session: Session | null
  currentUser: AppUser | null
  needsSetup: boolean
  loginPassword: (email: string, password: string) => { ok: boolean }
  loginIdentifier: (identifier: string, password: string) => { ok: boolean }
  /** Vérification par le serveur (appareil neuf, compte absent en local). */
  loginRemote: (identifier: string, password: string) => Promise<{ ok: boolean }>
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
  loginIdentifier: () => ({ ok: false }),
  loginRemote: async () => ({ ok: false }),
  loginPin: () => ({ ok: false }),
  establishSession: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { ready: dataReady, users, logActivity } = useDroguerie()
  const [session, setSessionState] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)
  // Fenêtre de grâce après une connexion : la session serveur (cookie signé) se
  // pose de façon asynchrone. Sur un réseau lent (prod), une requête /api/sync
  // peut partir AVANT que le cookie soit posé et renvoyer 401 → sans ce garde,
  // l'utilisateur était déconnecté aussitôt connecté. On ignore les 401
  // transitoires pendant cette fenêtre ; un échec réel finit par déconnecter.
  const loginGraceRef = useRef(0)

  useEffect(() => {
    setSessionState(getSession())
    setChecked(true)
  }, [])

  // Le serveur est l'autorité : s'il refuse la session (cookie absent ou
  // expiré), la session locale ne vaut plus rien — on déconnecte pour ramener
  // l'utilisateur à l'écran de connexion plutôt que de le laisser travailler
  // sur un appareil qui ne se synchronise plus.
  useEffect(() => {
    const onExpired = () => {
      // Pendant la fenêtre de grâce (juste après connexion), on ignore le 401 :
      // c'est le cookie serveur qui n'est pas encore posé, pas une vraie expiration.
      if (Date.now() < loginGraceRef.current) return
      clearSession()
      setSessionState(null)
    }
    window.addEventListener(AUTH_EXPIRED, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED, onExpired)
  }, [])

  const loginWith = (u: AppUser | undefined | null, secret: string, stored?: string, identifier?: string) => {
    if (!u || !u.active || !verifySecret(secret, stored)) return { ok: false }
    const s = makeSession(u)
    setSession(s)
    setSessionState(s)
    loginGraceRef.current = Date.now() + 20000 // fenêtre de grâce : le cookie serveur se pose en asynchrone
    // Journalise la connexion APRÈS setSession : logActivity lit le nom dans la
    // session courante. C'est la seule source du rapport « Connexions ».
    try { logActivity('Connexion', { kind: 'login', target: u.name }) } catch {}
    // Ouvre AUSSI la session serveur : c'est elle qui autorise la synchro
    // (le navigateur n'a plus d'accès direct à la base). En cas d'échec réseau,
    // l'application reste utilisable hors-ligne et la synchro reprendra ensuite.
    void serverLogin(identifier ?? u.email ?? u.name ?? '', secret)
    return { ok: true }
  }

  const loginPassword = (email: string, password: string) => {
    const u = users.find((x) => x.active && x.email && x.email.toLowerCase() === email.trim().toLowerCase())
    return loginWith(u, password, u?.passwordHash, email)
  }

  // Connexion par identifiant : email OU nom d'utilisateur.
  // Comparaison tolérante : casse, points et espaces multiples ignorés
  // (« yassir a » ≡ « Yassir A. »). À défaut de correspondance exacte, on
  // accepte le prénom seul (« yassir » → « Yassir A. ») SI un seul compte
  // actif commence ainsi — sinon on refuse plutôt que de deviner.
  const loginIdentifier = (identifier: string, password: string) => {
    const norm = (s: string) => s.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ')
    const id = norm(identifier)
    if (!id) return { ok: false }
    let u = users.find(
      (x) => x.active && ((x.email && norm(x.email) === id) || (x.name && norm(x.name) === id))
    )
    if (!u) {
      const starts = users.filter((x) => x.active && x.name && norm(x.name).startsWith(id + ' '))
      if (starts.length === 1) u = starts[0]
    }
    return loginWith(u, password, u?.passwordHash, identifier)
  }

  /**
   * Repli SERVEUR : sur un appareil neuf, la liste locale d'utilisateurs est
   * vide (plus de données de démo, et la base n'est plus lisible sans session).
   * Le serveur vérifie alors les identifiants et renvoie le compte, qu'on met en
   * cache pour permettre les connexions hors-ligne suivantes.
   */
  const loginRemote = async (identifier: string, password: string): Promise<{ ok: boolean }> => {
    const r = await serverLogin(identifier, password)
    if (!r.ok || !r.user) return { ok: false }
    const u = r.user as unknown as AppUser
    try {
      const local: AppUser[] = JSON.parse(localStorage.getItem('dp_users') || '[]')
      const next = local.some((x) => x.id === u.id) ? local.map((x) => (x.id === u.id ? u : x)) : [u, ...local]
      localStorage.setItem('dp_users', JSON.stringify(next))
      window.dispatchEvent(new CustomEvent('droguerie-sync-pull'))
    } catch { /* stockage indisponible : la session fonctionne quand même */ }
    const s = makeSession(u)
    setSession(s)
    setSessionState(s)
    loginGraceRef.current = Date.now() + 20000 // fenêtre de grâce : le cookie serveur se pose en asynchrone
    try { logActivity('Connexion', { kind: 'login', target: u.name }) } catch {}
    return { ok: true }
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
    loginGraceRef.current = Date.now() + 20000 // fenêtre de grâce : le cookie serveur se pose en asynchrone
    try { logActivity('Connexion', { kind: 'login', target: u.name }) } catch {}
    // Marque une connexion ACTIVE (par ce clic) → le splash ne s'affiche qu'ici,
    // pas à chaque rechargement où la session est déjà valide.
    try { sessionStorage.setItem('dp_just_logged_in', '1') } catch {}
  }

  const logout = () => {
    // Avant clearSession : sinon l'événement serait attribué à « Système ».
    try { logActivity('Déconnexion', { kind: 'logout', target: session?.name }) } catch {}
    clearSession()
    setSessionState(null)
    void serverLogout()
  }

  const currentUser = session ? users.find((u) => u.id === session.userId) ?? null : null
  // Aucun utilisateur actif n'a d'identifiant → première configuration requise.
  const activeUsers = users.filter((u) => u.active)
  const needsSetup = dataReady && activeUsers.length > 0 && activeUsers.every((u) => !u.passwordHash && !u.pinHash)

  return (
    <AuthContext.Provider value={{ ready: dataReady && checked, session, currentUser, needsSetup, loginPassword, loginIdentifier, loginRemote, loginPin, establishSession, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
