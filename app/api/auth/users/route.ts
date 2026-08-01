import { NextResponse } from 'next/server'
import { rowsOf, tursoExec } from '@/lib/turso-http'

export const dynamic = 'force-dynamic'

/**
 * Liste ASSAINIE des comptes, accessible avant connexion.
 *
 * L'écran de connexion en a besoin (choix de l'utilisateur pour le code PIN,
 * suivi d'une demande d'inscription en attente d'approbation). On n'expose donc
 * que l'état civil du compte : jamais `passwordHash`, `pinHash` ni la réponse
 * à la question de sécurité — sinon cette route deviendrait la nouvelle fuite.
 */
export async function GET() {
  const res = await tursoExec([{ sql: "SELECT data FROM records WHERE collection = 'users' AND deleted = 0" }])
  if (!res.ok) return NextResponse.json({ ok: false, error: 'unavailable', detail: res.error ?? null }, { status: 502 })

  const users: { id: string; name: string; email: string; role: string; active: boolean; pendingApproval: boolean; hasPin: boolean }[] = []
  for (const row of rowsOf(res.results?.[0])) {
    try {
      const u = JSON.parse(String(row[0]?.value ?? '{}')) as Record<string, unknown>
      if (!u.id) continue
      users.push({
        id: String(u.id),
        name: String(u.name ?? ''),
        email: String(u.email ?? ''),
        role: String(u.role ?? ''),
        active: !!u.active,
        pendingApproval: !!u.pendingApproval,
        hasPin: !!u.pinHash,
      })
    } catch { /* enregistrement illisible : ignoré */ }
  }
  return NextResponse.json({ ok: true, users })
}
