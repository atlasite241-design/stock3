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

// --- Administration des clés (réservé aux admins) ---

const KEY_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sans I, O, 0, 1, L

function seg(n: number): string {
  let s = ''
  for (let i = 0; i < n; i++) s += KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)]
  return s
}

export function genKey(): string {
  return `ATLS-${seg(5)}-${seg(5)}-${seg(5)}`
}

export interface LicenseStat {
  months: number
  count: number
}

/** Nombre de clés restantes, groupées par durée. */
export async function getLicenseStats(): Promise<LicenseStat[]> {
  const client = turso()
  const r = await client.execute('SELECT months, count(*) AS n FROM license_keys GROUP BY months ORDER BY months')
  return r.rows.map((row) => ({ months: Number(row.months) || 0, count: Number(row.n) || 0 }))
}

/** Génère `count` nouvelles clés d'une durée donnée et les insère en base. */
export async function generateKeys(months: number, count: number): Promise<string[]> {
  const n = Math.max(1, Math.min(500, Math.floor(count) || 0))
  const client = turso()
  const seen = new Set<string>()
  const keys: string[] = []
  while (keys.length < n) {
    const k = genKey()
    if (!seen.has(k)) {
      seen.add(k)
      keys.push(k)
    }
  }
  const placeholders = keys.map(() => '(?, ?)').join(',')
  const args = keys.flatMap((k) => [k, months])
  await client.execute({ sql: `INSERT OR IGNORE INTO license_keys (key, months) VALUES ${placeholders}`, args })
  return keys
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
