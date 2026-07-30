import { NextRequest, NextResponse } from 'next/server'
import { rowsOf, tursoExec } from '@/lib/turso-http'
import { COOKIE_NAME, issueSession, verifySecret } from '@/lib/server-auth'

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

  const c = issueSession(String(match.id ?? ''), String(match.role ?? ''))
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
