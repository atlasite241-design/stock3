'use client'

import { createClient, type Client } from '@libsql/client/web'

/**
 * Client Turso côté NAVIGATEUR (le serveur Node ne peut pas joindre Turso sur
 * ce réseau — voir /db-test). Le token est exposé via NEXT_PUBLIC_* : l'app doit
 * donc rester sur des appareils/réseau de confiance.
 */
let _client: Client | null = null

export function turso(): Client {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_TURSO_DATABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_TURSO_DATABASE_URL manquant (redémarre `npm run dev`).')
  _client = createClient({ url, authToken: process.env.NEXT_PUBLIC_TURSO_AUTH_TOKEN })
  return _client
}

export function tursoConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_TURSO_DATABASE_URL
}
