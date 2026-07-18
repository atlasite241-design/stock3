'use client'

import { turso, tursoConfigured } from './turso'

// Clé locale (NON synchronisée avec Turso) → l'activation reste liée à cet
// appareil/navigateur uniquement.
const STORAGE_KEY = 'atlasstock_license'

export interface LicenseState {
  key: string
  months: number
  activatedAt: string
  expiresAt: string
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
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
  const s = getLicense()
  if (!s) return false
  // Licence expirée → il faut une nouvelle clé.
  if (s.expiresAt && new Date(s.expiresAt).getTime() < Date.now()) return false
  return true
}

export function clearLicense(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export type ActivateResult =
  | { ok: true; months: number; expiresAt: string }
  | { ok: false; error: 'invalid' | 'network' | 'unconfigured' }

/**
 * Valide une clé contre `license_keys` (Turso). Si valide : lit la durée
 * (mois), consomme la clé (suppression = usage unique), calcule la date
 * d'expiration et enregistre l'activation localement.
 */
export async function activateLicense(rawKey: string): Promise<ActivateResult> {
  const key = rawKey.trim().toUpperCase()
  if (!key) return { ok: false, error: 'invalid' }
  if (!tursoConfigured()) return { ok: false, error: 'unconfigured' }

  try {
    const client = turso()
    const found = await client.execute({ sql: 'SELECT key, months FROM license_keys WHERE key = ? LIMIT 1', args: [key] })
    if (found.rows.length === 0) return { ok: false, error: 'invalid' }

    const months = Number(found.rows[0].months) || 1
    await client.execute({ sql: 'DELETE FROM license_keys WHERE key = ?', args: [key] })

    const now = new Date()
    const expiresAt = addMonths(now, months).toISOString()
    const state: LicenseState = { key, months, activatedAt: now.toISOString(), expiresAt }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return { ok: true, months, expiresAt }
  } catch {
    return { ok: false, error: 'network' }
  }
}
