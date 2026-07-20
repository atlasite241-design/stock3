'use client'

import { turso, tursoConfigured } from './turso'

/**
 * Synchronisation localStorage ⇄ Turso (table `records`).
 * Chaque entité métier est une "collection" ; chaque enregistrement est une
 * ligne JSON dans `records`. Un seul code générique pour tout.
 *
 * Cette étape gère l'ÉCRITURE (push) : à chaque changement local, la collection
 * concernée est renvoyée vers Turso (débattue ~1,2 s), avec reprise hors-ligne.
 */

export interface Collection {
  collection: string
  key: string // clé localStorage
  singleton?: boolean // objet unique (réglages) au lieu d'un tableau
}

export const COLLECTIONS: Collection[] = [
  { collection: 'products', key: 'dp_products' },
  { collection: 'sales', key: 'dp_sales' },
  { collection: 'clients', key: 'dp_clients' },
  { collection: 'suppliers', key: 'dp_suppliers' },
  { collection: 'movements', key: 'dp_movements' },
  { collection: 'purchases', key: 'dp_purchases' },
  { collection: 'quotes', key: 'dp_quotes' },
  { collection: 'returns', key: 'dp_returns' },
  { collection: 'cash', key: 'dp_cash' },
  { collection: 'sessions', key: 'dp_sessions' },
  { collection: 'users', key: 'dp_users' },
  { collection: 'activity', key: 'dp_activity' },
  { collection: 'categories', key: 'dp_attr_categories' },
  { collection: 'subcategories', key: 'dp_attr_souscategories' },
  { collection: 'brands', key: 'dp_attr_marques' },
  { collection: 'units', key: 'dp_attr_unites' },
  { collection: 'clientPayments', key: 'dp_client_payments' },
  { collection: 'credits', key: 'dp_credits' },
  { collection: 'loyalty', key: 'dp_loyalty_movements' },
  { collection: 'supplierPayments', key: 'dp_supplier_payments' },
  { collection: 'expenses', key: 'dp_expenses' },
  { collection: 'stores', key: 'dp_stores' },
  { collection: 'depots', key: 'dp_depots' },
  { collection: 'transfers', key: 'dp_transfers' },
  { collection: 'settings', key: 'dp_settings', singleton: true },
]

const KEY_TO_COL = new Map(COLLECTIONS.map((c) => [c.key, c]))
const COL_BY_NAME = new Map(COLLECTIONS.map((c) => [c.collection, c]))

const UPSERT = `INSERT INTO records (collection, id, store_id, data, updated_at, deleted)
VALUES (?, ?, ?, ?, ?, 0)
ON CONFLICT(collection, id) DO UPDATE SET
  store_id = excluded.store_id, data = excluded.data,
  updated_at = excluded.updated_at, deleted = 0`

type Stmt = { sql: string; args: (string | number | null)[] }
type Row = Record<string, unknown> & { id?: string; storeId?: string }

function upsertStmt(collection: string, id: string, storeId: string | null, data: unknown, now: number): Stmt {
  return { sql: UPSERT, args: [collection, id, storeId, JSON.stringify(data), now] }
}

/** Pousse une collection (tous ses enregistrements) vers Turso. */
async function pushOne(c: Collection, now: number): Promise<number> {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(c.key) : null
  if (!raw) return 0
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return 0
  }
  const stmts: Stmt[] = []
  if (c.singleton) {
    stmts.push(upsertStmt(c.collection, 'global', null, parsed, now))
  } else if (Array.isArray(parsed)) {
    for (const rec of parsed as Row[]) {
      if (!rec || !rec.id) continue
      stmts.push(upsertStmt(c.collection, rec.id, rec.storeId ?? null, rec, now))
    }
  }
  const db = turso()
  for (let i = 0; i < stmts.length; i += 100) {
    await db.batch(stmts.slice(i, i + 100))
  }
  return stmts.length
}

/** Migration initiale : pousse TOUT le localStorage vers Turso. */
export async function pushAll(onProgress?: (collection: string, n: number) => void): Promise<number> {
  const now = Date.now()
  let total = 0
  for (const c of COLLECTIONS) {
    const n = await pushOne(c, now)
    total += n
    onProgress?.(c.collection, n)
  }
  return total
}

export async function countRemote(): Promise<{ collection: string; n: number }[]> {
  const db = turso()
  const r = await db.execute('SELECT collection, COUNT(*) AS n FROM records WHERE deleted = 0 GROUP BY collection ORDER BY collection')
  return r.rows.map((row) => ({ collection: String(row.collection), n: Number(row.n) }))
}

// ---------------------------------------------------------------------------
// Écriture automatique (write-through) + reprise hors-ligne
// ---------------------------------------------------------------------------

export const syncState = { started: false, lastError: '', lastPushAt: 0, lastPushCollection: '', log: [] as string[] }
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const PENDING_KEY = 'dp_sync_pending'

function pushLog(msg: string) {
  const t = new Date().toLocaleTimeString('fr-FR')
  syncState.log = [`${t} — ${msg}`, ...syncState.log].slice(0, 25)
}

/** Compte les enregistrements présents en local (localStorage), par collection. */
export function localCounts(): { collection: string; n: number }[] {
  return COLLECTIONS.map((c) => {
    let n = 0
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(c.key) : null
    if (raw) {
      try {
        const p = JSON.parse(raw)
        n = c.singleton ? 1 : Array.isArray(p) ? p.length : 0
      } catch {}
    }
    return { collection: c.collection, n }
  })
}

function loadPending(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]')
  } catch {
    return []
  }
}
function markPending(collection: string, on: boolean) {
  const set = new Set(loadPending())
  if (on) set.add(collection)
  else set.delete(collection)
  localStorage.setItem(PENDING_KEY, JSON.stringify([...set]))
}

async function flushOne(c: Collection) {
  try {
    const n = await pushOne(c, Date.now())
    markPending(c.collection, false)
    syncState.lastPushAt = Date.now()
    syncState.lastPushCollection = c.collection
    syncState.lastError = ''
    pushLog(`✓ envoyé: ${c.collection} (${n})`)
  } catch (e) {
    markPending(c.collection, true) // hors-ligne → on réessaiera
    const msg = e instanceof Error ? e.message : String(e)
    syncState.lastError = msg
    pushLog(`✗ échec ${c.collection}: ${msg}`)
  }
}

/** Réessaie toutes les collections en attente (au démarrage / à la reconnexion). */
export async function flushDirty() {
  if (!tursoConfigured()) return
  for (const col of loadPending()) {
    const c = COLLECTIONS.find((x) => x.collection === col)
    if (c) await flushOne(c)
  }
}

/** Appelée par le store à chaque `save(key, ...)`. Débattue par collection. */
export function syncOnSave(key: string) {
  const c = KEY_TO_COL.get(key)
  if (!c) return
  if (!syncState.started) {
    pushLog(`ignoré (synchro inactive): ${c.collection}`)
    return
  }
  pushLog(`programmé: ${c.collection}`)
  const prev = timers.get(c.key)
  if (prev) clearTimeout(prev)
  timers.set(
    c.key,
    setTimeout(() => {
      void flushOne(c)
    }, 1200)
  )
}

// ---------------------------------------------------------------------------
// Lecture automatique (pull) : rapatrie les changements des autres appareils
// ---------------------------------------------------------------------------

const CURSOR_KEY = 'dp_sync_cursor'
function getCursor(): number {
  return Number(localStorage.getItem(CURSOR_KEY) || '0')
}
function setCursor(v: number) {
  localStorage.setItem(CURSOR_KEY, String(v))
}

interface RemoteRow {
  collection: string
  id: string
  data: string
  updated_at: number
  deleted: number
}

/** Récupère les enregistrements modifiés depuis le dernier curseur et les fusionne en local. */
export async function pull(): Promise<void> {
  if (!syncState.started) return
  const db = turso()
  const since = getCursor()
  const res = await db.execute({
    sql: 'SELECT collection, id, data, updated_at, deleted FROM records WHERE updated_at > ? ORDER BY updated_at ASC LIMIT 1000',
    args: [since],
  })
  if (res.rows.length === 0) return

  let maxTs = since
  const byCol = new Map<string, RemoteRow[]>()
  for (const r of res.rows as unknown as RemoteRow[]) {
    maxTs = Math.max(maxTs, Number(r.updated_at))
    const list = byCol.get(r.collection) ?? []
    list.push(r)
    byCol.set(r.collection, list)
  }

  const changedCols: string[] = []
  for (const [colName, rows] of byCol) {
    const c = COL_BY_NAME.get(colName)
    if (!c) continue

    if (c.singleton) {
      const last = rows[rows.length - 1]
      if (Number(last.deleted) === 0 && localStorage.getItem(c.key) !== last.data) {
        localStorage.setItem(c.key, last.data)
        changedCols.push(colName)
      }
      continue
    }

    let arr: Row[] = []
    try {
      arr = JSON.parse(localStorage.getItem(c.key) || '[]')
    } catch {
      arr = []
    }
    const map = new Map<string, Row>(arr.filter((x) => x && x.id).map((x) => [x.id as string, x]))
    let colChanged = false
    for (const r of rows) {
      const id = String(r.id)
      if (Number(r.deleted) === 1) {
        if (map.delete(id)) colChanged = true
      } else {
        const existing = map.get(id)
        if (!existing || JSON.stringify(existing) !== r.data) {
          map.set(id, JSON.parse(r.data))
          colChanged = true
        }
      }
    }
    if (colChanged) {
      localStorage.setItem(c.key, JSON.stringify([...map.values()]))
      changedCols.push(colName)
    }
  }

  setCursor(maxTs)
  if (changedCols.length) {
    pushLog(`⇣ reçu: ${changedCols.join(', ')}`)
    window.dispatchEvent(new CustomEvent('droguerie-sync-pull'))
  }
}

/**
 * Amorçage d'un appareil NEUF : rapatrie toutes les données depuis Turso dans
 * localStorage (au lieu de générer des données de démo). Retourne false si Turso
 * est vide (première installation → on laissera le seed s'exécuter).
 */
export async function bootstrapFromRemote(): Promise<boolean> {
  const db = turso()
  const res = await db.execute('SELECT collection, id, data, updated_at FROM records WHERE deleted = 0')
  if (res.rows.length === 0) return false

  const byKey = new Map<string, unknown[]>()
  const singles = new Map<string, string>()
  let maxTs = 0
  for (const r of res.rows as unknown as (RemoteRow & { updated_at: number })[]) {
    maxTs = Math.max(maxTs, Number(r.updated_at))
    const c = COL_BY_NAME.get(String(r.collection))
    if (!c) continue
    if (c.singleton) {
      singles.set(c.key, String(r.data))
    } else {
      const list = byKey.get(c.key) ?? []
      try {
        list.push(JSON.parse(String(r.data)))
      } catch {}
      byKey.set(c.key, list)
    }
  }
  for (const [key, arr] of byKey) localStorage.setItem(key, JSON.stringify(arr))
  for (const [key, data] of singles) localStorage.setItem(key, data)
  setCursor(maxTs)
  pushLog(`⇣ amorçage depuis Turso : ${res.rows.length} enregistrements`)
  return true
}

/** Active la synchro (après le chargement initial) : write-through + pull périodique. */
export function startSync() {
  if (syncState.started || typeof window === 'undefined' || !tursoConfigured()) return
  syncState.started = true
  window.addEventListener('online', () => void flushDirty())
  void flushDirty()
  // Premier pull immédiat, puis toutes les 4 s.
  void pull().catch((e) => pushLog(`✗ pull: ${e instanceof Error ? e.message : String(e)}`))
  setInterval(() => {
    void pull().catch((e) => pushLog(`✗ pull: ${e instanceof Error ? e.message : String(e)}`))
  }, 4000)
}
