'use client'

// Licence — la validation et la gestion des clés passent désormais par des
// routes serveur (/api/license/*) qui utilisent le token Turso SERVEUR
// (jamais exposé au navigateur). Le client ne connaît plus la base des clés.

const STORAGE_KEY = 'atlasstock_license'

export interface LicenseState {
  key: string
  months: number
  activatedAt: string
  expiresAt: string
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

export async function activateLicense(rawKey: string): Promise<ActivateResult> {
  const key = rawKey.trim().toUpperCase()
  if (!key) return { ok: false, error: 'invalid' }
  try {
    const res = await fetch('/api/license/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })
    const data = (await res.json()) as { ok: boolean; months?: number; expiresAt?: string; error?: string }
    if (!data.ok) {
      const err = data.error === 'network' ? 'network' : 'invalid'
      return { ok: false, error: err }
    }
    const state: LicenseState = {
      key,
      months: data.months ?? 1,
      activatedAt: new Date().toISOString(),
      expiresAt: data.expiresAt ?? new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return { ok: true, months: state.months, expiresAt: state.expiresAt }
  } catch {
    return { ok: false, error: 'network' }
  }
}

// --- Administration (l'écran admin appelle aussi les routes serveur) ---

export interface LicenseStat {
  months: number
  count: number
}

export async function getLicenseStats(): Promise<LicenseStat[]> {
  const res = await fetch('/api/license/stats', { cache: 'no-store' })
  const data = (await res.json()) as { ok: boolean; stats?: LicenseStat[] }
  if (!data.ok || !data.stats) throw new Error('stats_failed')
  return data.stats
}

export async function generateKeys(months: number, count: number): Promise<string[]> {
  const res = await fetch('/api/license/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ months, count }),
  })
  const data = (await res.json()) as { ok: boolean; keys?: string[] }
  if (!data.ok || !data.keys) throw new Error('generate_failed')
  return data.keys
}
