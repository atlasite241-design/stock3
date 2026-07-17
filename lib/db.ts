import 'server-only'
import { createClient, type Client } from '@libsql/client'

/**
 * Server-only Turso (libSQL) client.
 *
 * IMPORTANT: the auth token grants full read/write on the database, so it must
 * NEVER reach the browser. This module is imported only from server code
 * (API routes / server actions); the front-end talks to those routes, never to
 * Turso directly. `import 'server-only'` makes a client-side import fail loudly.
 */
let _db: Client | null = null

export function getDb(): Client {
  if (_db) return _db
  const url = process.env.TURSO_DATABASE_URL
  if (!url) {
    throw new Error('TURSO_DATABASE_URL manquant — copie .env.local.example en .env.local et remplis-le.')
  }
  _db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
  return _db
}
