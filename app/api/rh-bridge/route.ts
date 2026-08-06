import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { COOKIE_NAME, readSession } from '@/lib/server-auth'
import { rowsOf, tursoExec } from '@/lib/turso-http'

export const dynamic = 'force-dynamic'

/**
 * Passerelle vers le module RH Laravel.
 *
 * L'utilisateur connecté à la caisse clique sur « Ressources humaines » : cette
 * route fabrique un jeton signé d'UNE MINUTE et le redirige vers le module,
 * qui ouvre sa propre session. Sans elle, il faudrait se connecter deux fois —
 * et un module qui redemande un mot de passe est un module qu'on n'ouvre pas.
 *
 * Format du jeton : base64url(charge).base64url(HMAC-SHA256) — le MÊME contrat
 * que vérifie le module Laravel (BridgeToken), testé des deux côtés. Pas de
 * JWT : rien à négocier, l'algorithme est dans le code.
 *
 * Deux variables d'environnement côté Vercel :
 *   HR_BRIDGE_SECRET  — la même valeur que dans le .env Laravel
 *   HR_BRIDGE_URL     — l'adresse du module (ex. https://rh.droguerie.local)
 */

const b64u = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export async function GET(req: NextRequest) {
  const secret = process.env.HR_BRIDGE_SECRET || ''
  const cible = process.env.HR_BRIDGE_URL || ''

  if (!secret || !cible) {
    // Configuration absente : on le DIT, plutôt qu'une redirection qui échoue
    // mystérieusement chez l'utilisateur.
    return NextResponse.json(
      { ok: false, error: 'HR_BRIDGE_SECRET ou HR_BRIDGE_URL manquant sur Vercel' },
      { status: 503 }
    )
  }

  const session = readSession(req.cookies.get(COOKIE_NAME)?.value)
  if (!session) {
    // Pas de session caisse : retour à la connexion, pas d'erreur brute.
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // L'email et le nom ne sont pas dans le cookie : on lit le compte.
  const r = await tursoExec([
    {
      sql: "SELECT data FROM records WHERE collection = 'users' AND id = ? LIMIT 1",
      args: [{ type: 'text', value: session.userId }],
    },
  ])
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: 'compte introuvable' }, { status: 502 })
  }

  let email = ''
  let name = ''
  try {
    const data = JSON.parse(String(rowsOf(r.results?.[0])[0]?.[0]?.value ?? '{}'))
    email = String(data.email || '')
    name = String(data.name || '')
  } catch {
    /* compte illisible : refusé ci-dessous */
  }

  if (!email) {
    return NextResponse.json({ ok: false, error: 'compte sans email : le module RH ne peut pas rattacher la session' }, { status: 409 })
  }

  const now = Math.floor(Date.now() / 1000)
  const charge = JSON.stringify({
    sub: session.userId,
    email,
    name: name || email,
    role: session.role,
    iat: now,
    exp: now + 60, // une minute : le jeton FRANCHIT la porte, il n'est pas une session
  })

  const signature = crypto.createHmac('sha256', secret).update(charge).digest()
  const jeton = `${b64u(Buffer.from(charge))}.${b64u(signature)}`

  return NextResponse.redirect(`${cible.replace(/\/$/, '')}/rh/entree?t=${jeton}`)
}
