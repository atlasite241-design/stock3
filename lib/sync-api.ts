'use client'

// Accès à la synchronisation DEPUIS LE NAVIGATEUR, via les routes serveur.
//
// Le navigateur ne connaît plus ni l'URL ni le token de la base : il appelle des
// opérations nommées (/api/sync) que le serveur exécute avec ses propres
// identifiants. Ce fichier remplace l'ancien client libsql direct.

export interface PullRow { collection: string; id: string; data: string; updated_at: number; deleted: number }
export interface AllRow { collection: string; id: string; data: string; updated_at: number }
export interface UpsertRow { collection: string; id: string; storeId: string | null; data: string; updated_at: number }

/** Nombre maximal d'enregistrements acceptés par appel d'écriture (cf. route). */
export const UPSERT_LIMIT = 200

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    // Le cookie de session est indispensable : il porte l'autorisation.
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string } & T
  if (!res.ok || !json.ok) throw new Error(json.error || `http_${res.status}`)
  return json
}

let statusCache: { configured: boolean; dbId: string } | null = null

/** Synchro configurée côté serveur ? (mémoïsé pour la session) */
export async function syncStatus(): Promise<{ configured: boolean; dbId: string }> {
  if (statusCache) return statusCache
  try {
    const r = await call<{ configured: boolean; dbId: string }>({ op: 'status' })
    statusCache = { configured: !!r.configured, dbId: r.dbId ?? '' }
  } catch {
    statusCache = { configured: false, dbId: '' }
  }
  return statusCache
}

/** Changements postérieurs au curseur (une page). */
export function apiPull(since: number) {
  return call<{ rows: PullRow[]; page: number }>({ op: 'pull', since })
}

/** Téléchargement complet, page par page (curseur `after` = rowid). */
export function apiAll(after: number) {
  return call<{ rows: AllRow[]; page: number; cursor: number }>({ op: 'all', after })
}

/** Volumétrie par collection (page de diagnostic). */
export function apiCounts() {
  return call<{ rows: { collection: string; n: number }[] }>({ op: 'counts' })
}

/** Écriture d'un lot (≤ UPSERT_LIMIT enregistrements). */
export function apiUpsert(rows: UpsertRow[]) {
  return call<{ n: number }>({ op: 'upsert', rows })
}

/**
 * Ouvre la session serveur (autorise ensuite la synchro) et renvoie le compte
 * complet en cas de succès — ce qui permet de se connecter sur un appareil neuf
 * dont la liste locale d'utilisateurs est vide, puis de le mettre en cache pour
 * un usage hors-ligne ultérieur.
 */
export async function serverLogin(identifier: string, password: string): Promise<{ ok: boolean; user?: Record<string, unknown> }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
      credentials: 'same-origin',
    })
    if (!res.ok) return { ok: false }
    const json = (await res.json()) as { ok?: boolean; user?: Record<string, unknown> }
    return { ok: !!json.ok, user: json.user }
  } catch {
    return { ok: false } // hors-ligne : l'app reste utilisable, la synchro reprendra plus tard
  }
}

/** Comptes assainis (sans empreintes) — pour l'écran de connexion. */
export async function fetchPublicUsers(): Promise<{ id: string; name: string; email: string; role: string; active: boolean; pendingApproval: boolean; hasPin: boolean }[]> {
  try {
    const res = await fetch('/api/auth/users', { credentials: 'same-origin', cache: 'no-store' })
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json.users) ? json.users : []
  } catch {
    return []
  }
}

export async function serverLogout(): Promise<void> {
  try { await fetch('/api/auth/login', { method: 'DELETE', credentials: 'same-origin' }) } catch {}
}
