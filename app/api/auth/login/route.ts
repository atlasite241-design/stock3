import { NextRequest, NextResponse } from 'next/server'
import { rowsOf, tursoExec } from '@/lib/turso-http'
import { COOKIE_NAME, issueSession, verifySecret } from '@/lib/server-auth'
import { effectivePermissions, type RoleName } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

/**
 * Ouvre une session SERVEUR après vérification des identifiants contre la base.
 * C'est ce cookie (HttpOnly, signé) qui autorise ensuite /api/sync/*.
 *
 * Les utilisateurs vivent dans la table `records` (collection « users »), le
 * mot de passe y est stocké haché (sel:empreinte) — jamais en clair.
 */

const norm = (s: string) => s.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ')

interface StoredUser {
  id?: string
  name?: string
  email?: string
  role?: string
  active?: boolean
  passwordHash?: string
  pinHash?: string
  /** Dérogation individuelle aux droits du rôle. */
  permissions?: string[]
  storeId?: string
  storeIds?: string[]
}

export async function POST(req: NextRequest) {
  let identifier = '', password = ''
  try {
    const body = await req.json()
    identifier = String(body?.identifier ?? '')
    password = String(body?.password ?? '')
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }
  if (!identifier || !password) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })

  const res = await tursoExec([{ sql: "SELECT id, data FROM records WHERE collection = 'users' AND deleted = 0" }])
  if (!res.ok) return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 502 })

  const id = norm(identifier)
  let match: StoredUser | null = null
  for (const row of rowsOf(res.results?.[0])) {
    let u: StoredUser
    try { u = JSON.parse(String(row[1]?.value ?? '{}')) } catch { continue }
    if (!u.active) continue
    const byEmail = u.email && norm(u.email) === id
    const byName = u.name && norm(u.name) === id
    // Tolérance au prénom seul, comme côté client (« yassir » ≡ « Yassir A. »).
    const byPrefix = u.name && norm(u.name).startsWith(id + ' ')
    if (byEmail || byName || byPrefix) { match = u; if (byEmail || byName) break }
  }

  if (!match || !verifySecret(password, match.passwordHash)) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 401 })
  }

  // Droits personnalisés par rôle : ils vivent dans la collection « settings ».
  // Une seule lecture supplémentaire, à la connexion uniquement — la session
  // signée transporte ensuite le résultat.
  let rolePermissions: Record<string, string[]> | undefined
  try {
    const st = await tursoExec([{ sql: "SELECT data FROM records WHERE collection = 'settings' AND deleted = 0 LIMIT 1" }])
    if (st.ok) {
      const raw = rowsOf(st.results?.[0])[0]?.[0]?.value
      if (raw) rolePermissions = (JSON.parse(String(raw)) as { rolePermissions?: Record<string, string[]> }).rolePermissions
    }
  } catch { /* réglages illisibles : on retombe sur les droits par défaut du rôle */ }

  const perms = [...effectivePermissions(match.permissions, String(match.role ?? '') as RoleName, rolePermissions)]
  const storeIds = match.storeIds?.length ? match.storeIds : match.storeId ? [match.storeId] : []

  const c = issueSession(String(match.id ?? ''), String(match.role ?? ''), perms, storeIds)
  // Le compte complet n'est renvoyé qu'APRÈS preuve du mot de passe : le client
  // peut alors le mettre en cache et se reconnecter hors-ligne. C'est sans
  // risque — l'appelant vient précisément de prouver qu'il connaît ce secret.
  const out = NextResponse.json({ ok: true, userId: match.id, role: match.role, user: match })
  out.cookies.set(c.name, c.value, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: c.maxAge,
  })
  return out
}

export async function DELETE() {
  const out = NextResponse.json({ ok: true })
  out.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 })
  return out
}
