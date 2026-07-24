'use client'

import { turso, tursoConfigured } from './turso'
import { storageGet, storageSet } from './pstore'

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
  { collection: 'revenues', key: 'dp_revenues' },
  { collection: 'moneyTransfers', key: 'dp_money_transfers' },
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

function upsertStmtRaw(collection: string, id: string, storeId: string | null, data: string, now: number): Stmt {
  return { sql: UPSERT, args: [collection, id, storeId, data, now] }
}

// Empreinte du dernier état poussé (collection → id → signature courte). Sans elle,
// `pushOne` re-téléversait TOUS les enregistrements à chaque sauvegarde : une vente
// qui décrémente un stock renvoyait les 55 000 produits (550 requêtes) et réécrivait
// tous les `updated_at`, obligeant ensuite chaque appareil à re-télécharger le
// catalogue entier à chaque pull. On n'envoie plus que ce qui a réellement changé.
// La signature est un hash court (longueur|hash32), et NON le JSON complet : garder
// 60 000+ chaînes JSON en mémoire faisait planter l'onglet lors d'un gros import.
const pushedSnapshot = new Map<string, Map<string, string>>()

// Signature compacte d'une chaîne : « longueur|hash32 ». La longueur ajoutée au
// hash rend les collisions négligeables tout en tenant en ~12 octets (vs ~300).
function sig(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return s.length + '|' + (h >>> 0).toString(36)
}

/** Pousse une collection (tous ses enregistrements) vers Turso. */
async function pushOne(c: Collection, now: number): Promise<number> {
  const raw = typeof window !== 'undefined' ? storageGet(c.key) : null
  if (!raw) return 0
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return 0
  }
  const db = turso()
  let nextSnapshot: Map<string, string> | null = null
  let total = 0

  if (c.singleton) {
    await db.batch([upsertStmt(c.collection, 'global', null, parsed, now)])
    total = 1
  } else if (Array.isArray(parsed)) {
    const prev = pushedSnapshot.get(c.collection)
    nextSnapshot = new Map<string, string>()
    // Envoi par lots au fil de l'eau : on ne garde jamais plus de 100 requêtes
    // (donc 100 chaînes JSON) en mémoire. Auparavant on matérialisait toutes les
    // requêtes d'un coup → pic mémoire fatal sur un gros import.
    let batch: Stmt[] = []
    const flush = async () => {
      if (batch.length === 0) return
      await db.batch(batch)
      total += batch.length
      batch = []
    }
    for (const rec of parsed as Row[]) {
      if (!rec || !rec.id) continue
      const data = JSON.stringify(rec) // transitoire : on ne le conserve pas
      const s = sig(data)
      nextSnapshot.set(rec.id, s)
      if (prev && prev.get(rec.id) === s) continue // inchangé depuis le dernier envoi
      batch.push(upsertStmtRaw(c.collection, rec.id, rec.storeId ?? null, data, now))
      if (batch.length >= 100) await flush()
    }
    await flush()
  }

  // Enregistré seulement après succès : un échec fera repartir l'envoi complet.
  if (nextSnapshot) pushedSnapshot.set(c.collection, nextSnapshot)
  return total
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
    const raw = typeof window !== 'undefined' ? storageGet(c.key) : null
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

// Verrou de ré-entrance : le pull est déclenché toutes les 4 s. Sans ce garde,
// un rattrapage long (gros catalogue) voyait plusieurs pulls se chevaucher et
// réécrire le blob produits en parallèle → onglet figé.
let pulling = false

/** Récupère les enregistrements modifiés depuis le dernier curseur et les fusionne en local. */
export async function pull(): Promise<void> {
  if (!syncState.started || pulling) return
  pulling = true
  try {
    await pullInner()
  } finally {
    pulling = false
  }
}

async function pullInner(): Promise<void> {
  const db = turso()
  const since0 = getCursor()
  let since = since0
  let maxTs = since0
  const byCol = new Map<string, RemoteRow[]>()

  // Rattrapage en mémoire AVANT toute écriture locale. Auparavant, un seul lot de
  // 1000 était appliqué par appel : rattraper 50 000 produits réécrivait le blob
  // produits (~15 Mo : JSON.parse + JSON.stringify) une fois par lot, ce qui
  // figeait l'onglet plusieurs secondes (« Page ne répondant pas »).
  for (let batch = 0; batch < 200; batch++) {
    const res = await db.execute({
      sql: 'SELECT collection, id, data, updated_at, deleted FROM records WHERE updated_at > ? ORDER BY updated_at ASC LIMIT 1000',
      args: [since],
    })
    if (res.rows.length === 0) break
    for (const r of res.rows as unknown as RemoteRow[]) {
      maxTs = Math.max(maxTs, Number(r.updated_at))
      const list = byCol.get(r.collection) ?? []
      list.push(r)
      byCol.set(r.collection, list)
    }
    if (res.rows.length < 1000) break
    since = maxTs
  }
  if (byCol.size === 0) return

  const changedCols: string[] = []
  for (const [colName, rows] of byCol) {
    const c = COL_BY_NAME.get(colName)
    if (!c) continue

    if (c.singleton) {
      const last = rows[rows.length - 1]
      if (Number(last.deleted) === 0 && storageGet(c.key) !== last.data) {
        storageSet(c.key, last.data)
        changedCols.push(colName)
      }
      continue
    }

    let arr: Row[] = []
    try {
      arr = JSON.parse(storageGet(c.key) || '[]')
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
      storageSet(c.key, JSON.stringify([...map.values()]))
      changedCols.push(colName)
    }
  }

  setCursor(maxTs)
  if (changedCols.length) {
    pushLog(`⇣ reçu: ${changedCols.join(', ')}`)
    // On transmet les collections réellement modifiées : le store ne recharge
    // ainsi que ce qui a changé (recharger les produits = parser ~15 Mo).
    window.dispatchEvent(new CustomEvent('droguerie-sync-pull', { detail: { collections: changedCols } }))
  }
}

/**
 * Force un re-téléchargement COMPLET depuis Turso en UN SEUL SELECT (sans curseur,
 * sans LIMIT). Reconstruit chaque collection locale à partir du serveur (Turso =
 * source de vérité). Évite le bug de pagination du pull incrémental (curseur sur
 * horodatage non-unique) qui « sautait » des enregistrements. Utile après un import
 * côté serveur ou l'ajout d'une nouvelle collection.
 */
export async function resyncFromStart(): Promise<number> {
  const db = turso()
  const res = await db.execute('SELECT collection, id, data, updated_at FROM records WHERE deleted = 0')

  let maxTs = 0
  const byCol = new Map<string, { data: string }[]>()
  for (const r of res.rows as unknown as (RemoteRow & { updated_at: number })[]) {
    maxTs = Math.max(maxTs, Number(r.updated_at))
    const list = byCol.get(String(r.collection)) ?? []
    list.push({ data: String(r.data) })
    byCol.set(String(r.collection), list)
  }

  let total = 0
  for (const [colName, rows] of byCol) {
    const c = COL_BY_NAME.get(colName)
    if (!c) continue
    if (c.singleton) {
      storageSet(c.key, rows[rows.length - 1].data)
      total += 1
      continue
    }
    const arr: unknown[] = []
    for (const r of rows) {
      try {
        arr.push(JSON.parse(r.data))
      } catch {}
    }
    storageSet(c.key, JSON.stringify(arr))
    total += arr.length
  }

  setCursor(maxTs)
  pushLog(`↺ re-synchronisation complète : ${total} enregistrements`)
  window.dispatchEvent(new CustomEvent('droguerie-sync-pull'))
  return total
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
  for (const [key, arr] of byKey) storageSet(key, JSON.stringify(arr))
  for (const [key, data] of singles) storageSet(key, data)
  setCursor(maxTs)
  pushLog(`⇣ amorçage depuis Turso : ${res.rows.length} enregistrements`)
  return true
}

/** Active la synchro (après le chargement initial) : write-through + pull périodique. */
/** Vrai si la liste de produits locale est vide (appareil non hydraté). */
function localProductsEmpty(): boolean {
  try {
    const raw = storageGet('dp_products')
    if (!raw) return true
    const arr = JSON.parse(raw)
    return !Array.isArray(arr) || arr.length === 0
  } catch {
    return true
  }
}

export function startSync() {
  if (syncState.started || typeof window === 'undefined' || !tursoConfigured()) return
  syncState.started = true
  window.addEventListener('online', () => void flushDirty())
  void flushDirty()
  // Auto-réparation : si le local n'a aucun produit, on télécharge tout depuis
  // Turso (SELECT complet, fiable) au lieu du pull incrémental — sinon on
  // enchaîne les pulls incrémentaux normaux.
  const first = localProductsEmpty()
    ? resyncFromStart().then(() => undefined)
    : pull()
  void first.catch((e) => pushLog(`✗ pull initial: ${e instanceof Error ? e.message : String(e)}`))
  // Le pull tournait toutes les 4 s, même onglet en arrière-plan : c'est ce qui a
  // consommé des centaines de millions de « rows read » chez Turso. On espace, et
  // on ne lit rien quand l'onglet n'est pas visible (rattrapage au retour).
  const safePull = () => void pull().catch((e) => pushLog(`✗ pull: ${e instanceof Error ? e.message : String(e)}`))
  setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return
    safePull()
  }, 60000)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) safePull()
    })
  }
}
