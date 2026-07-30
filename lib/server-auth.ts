import 'server-only'
import crypto from 'node:crypto'

/**
 * Session serveur signée (cookie HttpOnly).
 *
 * Jusqu'ici l'authentification était purement côté navigateur : elle protégeait
 * l'interface, pas les données. Les routes /api/sync/* exigent désormais ce
 * cookie, signé avec un secret qui ne quitte jamais le serveur.
 */

const COOKIE = 'dp_auth'
const TTL_MS = 7 * 24 * 3600 * 1000

/** Secret de signature. À défaut d'AUTH_SECRET, dérivé du token Turso serveur. */
function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.TURSO_AUTH_TOKEN || ''
  if (!s) throw new Error('AUTH_SECRET manquant')
  return s
}

const b64u = (b: Buffer) => b.toString('base64url')

function sign(payload: string): string {
  return b64u(crypto.createHmac('sha256', secret()).update(payload).digest())
}

export interface ServerSession { userId: string; role: string; exp: number }

/** Fabrique la valeur du cookie : payload base64url + signature HMAC. */
export function issueSession(userId: string, role: string): { name: string; value: string; maxAge: number } {
  const data: ServerSession = { userId, role, exp: Date.now() + TTL_MS }
  const payload = b64u(Buffer.from(JSON.stringify(data)))
  return { name: COOKIE, value: `${payload}.${sign(payload)}`, maxAge: Math.floor(TTL_MS / 1000) }
}

/** Vérifie signature + expiration. Renvoie null si invalide. */
export function readSession(raw: string | undefined): ServerSession | null {
  if (!raw) return null
  const [payload, mac] = raw.split('.')
  if (!payload || !mac) return null
  let expected: string
  try { expected = sign(payload) } catch { return null }
  // Comparaison à temps constant : évite de révéler la signature par timing.
  const a = Buffer.from(mac), b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString()) as ServerSession
    return s.exp > Date.now() ? s : null
  } catch {
    return null
  }
}

export const COOKIE_NAME = COOKIE

/** Réplique du hachage client (lib/auth.ts) pour vérifier un mot de passe. */
export function verifySecret(plain: string, stored?: string): boolean {
  if (!stored) return false
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  let h = `${salt}|${plain}`
  for (let i = 0; i < 6000; i++) h = crypto.createHash('sha256').update(h).digest('hex')
  const a = Buffer.from(h), b = Buffer.from(hash)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
