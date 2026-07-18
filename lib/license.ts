'use client'

import { turso, tursoConfigured } from './turso'

// Clé locale (NON synchronisée avec Turso) → l'activation reste liée à cet
// appareil/navigateur uniquement.
const STORAGE_KEY = 'atlasstock_license'

export interface LicenseState {
  key: string
  activatedAt: string
}

export function getLicense(): LicenseState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LicenseState) : null
  } catch {
    return null
  }
}

export function isLicensed(): boolean {
  return !!getLicense()
}

export function clearLicense(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export type ActivateResult = { ok: true } | { ok: false; error: 'invalid' | 'network' | 'unconfigured' }

/**
 * Valide une clé de licence contre la table `license_keys` de Turso.
 * Si la clé existe : elle est CONSOMMÉE (supprimée de la base, usage unique)
 * puis l'activation est enregistrée localement.
 */
export async function activateLicense(rawKey: string): Promise<ActivateResult> {
  const key = rawKey.trim().toUpperCase()
  if (!key) return { ok: false, error: 'invalid' }
  if (!tursoConfigured()) return { ok: false, error: 'unconfigured' }

  try {
    const client = turso()
    const found = await client.execute({ sql: 'SELECT key FROM license_keys WHERE key = ? LIMIT 1', args: [key] })
    if (found.rows.length === 0) return { ok: false, error: 'invalid' }

    // Usage unique : on supprime la clé pour qu'elle ne serve qu'une fois.
    await client.execute({ sql: 'DELETE FROM license_keys WHERE key = ?', args: [key] })

    const state: LicenseState = { key, activatedAt: new Date().toISOString() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return { ok: true }
  } catch {
    return { ok: false, error: 'network' }
  }
}
