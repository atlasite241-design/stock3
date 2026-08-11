'use client'

import { apiAll, apiCounts, apiPull, apiUpsert, syncStatus, UPSERT_LIMIT, type UpsertRow } from './sync-api'
import { kvGet, kvSet, storageGet, storageSet } from './pstore'
import { compacterImagesStockees } from './storage-repair'

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
  { collection: 'lots', key: 'dp_lots' },
  { collection: 'purchases', key: 'dp_purchases' },
  { collection: 'purchaseRequests', key: 'dp_purchase_requests' },
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
  { collection: 'inventories', key: 'dp_inventories' },
  { collection: 'exercices', key: 'dp_exercices' },
  { collection: 'budgets', key: 'dp_budgets' },
  { collection: 'investments', key: 'dp_investments' },
  { collection: 'rfqs', key: 'dp_rfqs' },
  { collection: 'stores', key: 'dp_stores' },
  { collection: 'depots', key: 'dp_depots' },
  { collection: 'zones', key: 'dp_zones' },
  { collection: 'allees', key: 'dp_allees' },
  { collection: 'rayons', key: 'dp_rayons' },
  { collection: 'etageres', key: 'dp_etageres' },
  { collection: 'niveaux', key: 'dp_niveaux' },
  { collection: 'positions', key: 'dp_positions' },
  { collection: 'emplacements', key: 'dp_emplacements' },
  { collection: 'transfers', key: 'dp_transfers' },
  // Ressources humaines
  { collection: 'hrEmployees', key: 'dp_hr_employees' },
  { collection: 'hrDocuments', key: 'dp_hr_documents' },
  { collection: 'hrAttendance', key: 'dp_hr_attendance' },
  { collection: 'hrLeaves', key: 'dp_hr_leaves' },
  { collection: 'hrShifts', key: 'dp_hr_shifts' },
  { collection: 'hrTeams', key: 'dp_hr_teams' },
  { collection: 'hrHolidays', key: 'dp_hr_holidays' },
  { collection: 'hrAdjustments', key: 'dp_hr_adjustments' },
  { collection: 'hrPayslips', key: 'dp_hr_payslips' },
  { collection: 'hrEvaluations', key: 'dp_hr_evaluations' },
  { collection: 'hrObjectives', key: 'dp_hr_objectives' },
  { collection: 'hrActions', key: 'dp_hr_actions' },
  { collection: 'hrTrainings', key: 'dp_hr_trainings' },
  { collection: 'hrSkills', key: 'dp_hr_skills' },
  { collection: 'hrCertifications', key: 'dp_hr_certifications' },
  { collection: 'hrJobs', key: 'dp_hr_jobs' },
  { collection: 'hrApplications', key: 'dp_hr_applications' },
  { collection: 'hrBadges', key: 'dp_hr_badges' },
  { collection: 'settings', key: 'dp_settings', singleton: true },
]

const KEY_TO_COL = new Map(COLLECTIONS.map((c) => [c.key, c]))
const COL_BY_NAME = new Map(COLLECTIONS.map((c) => [c.collection, c]))

type Row = Record<string, unknown> & { id?: string; storeId?: string }

function upsertStmt(collection: string, id: string, storeId: string | null, data: unknown, now: number): UpsertRow {
  return { collection, id, storeId, data: JSON.stringify(data), updated_at: now }
}

function upsertStmtRaw(collection: string, id: string, storeId: string | null, data: string, now: number): UpsertRow {
  return { collection, id, storeId, data, updated_at: now }
}

// Empreinte du dernier état poussé (collection → id → signature courte). Sans elle,
// `pushOne` re-téléversait TOUS les enregistrements à chaque sauvegarde : une vente
// qui décrémente un stock renvoyait les 55 000 produits (550 requêtes) et réécrivait
// tous les `updated_at`, obligeant ensuite chaque appareil à re-télécharger le
// catalogue entier à chaque pull. On n'envoie plus que ce qui a réellement changé.
// La signature est un hash court (longueur|hash32), et NON le JSON complet : garder
// 60 000+ chaînes JSON en mémoire faisait planter l'onglet lors d'un gros import.
const pushedSnapshot = new Map<string, Map<string, string>>()

// L'empreinte est PERSISTÉE : sans ça, elle repartait vide à chaque chargement
// de page → le 1er push de session renvoyait TOUT le catalogue (des dizaines de
// milliers d'écritures), puis chaque appareil re-lisait ces lignes au pull.
//
// Persistée dans INDEXEDDB, pas dans localStorage. L'empreinte d'un catalogue de 100 000 fiches pèse
// ~4 Mo ; le plafond de localStorage est de ~5 Mo pour toute l'origine. Elle
// saturait donc le quota et faisait échouer TOUTES les autres écritures —
// « Setting the value of 'dp_settings' exceeded the quota » — c'est-à-dire les
// réglages, la file hors-ligne et le catalogue lui-même. Elle vit désormais dans
// IndexedDB, où la capacité se compte en centaines de mégaoctets.
const SIG_PREFIX = 'dp_pushsig_'

// Attente que les empreintes soient lues (IndexedDB, donc asynchrone).
let empreintesPretes: Promise<void> | null = null

async function loadSnapshots() {
  for (const c of COLLECTIONS) {
    try {
      const raw = await kvGet(SIG_PREFIX + c.collection)
      if (raw) pushedSnapshot.set(c.collection, new Map(JSON.parse(raw) as [string, string][]))
    } catch {
      /* empreinte illisible : on repart de zéro pour cette collection */
    }
  }
  // Purge des empreintes de l'ancien emplacement : elles ne servent plus à rien
  // et ce sont elles qui occupent le quota. À faire même quand IndexedDB a déjà
  // repris la main, sinon la place n'est jamais rendue.
  if (typeof localStorage !== 'undefined') {
    const anciennes: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(SIG_PREFIX)) anciennes.push(k)
    }
    for (const k of anciennes) {
      // Reprise avant suppression : ne pas perdre l'empreinte d'un appareil qui
      // n'a encore rien migré, sinon son prochain envoi repousserait tout.
      if (!pushedSnapshot.has(k.slice(SIG_PREFIX.length))) {
        try {
          const raw = localStorage.getItem(k)
          if (raw) {
            const col = k.slice(SIG_PREFIX.length)
            pushedSnapshot.set(col, new Map(JSON.parse(raw) as [string, string][]))
            void kvSet(k, raw)
          }
        } catch { /* illisible : on la jette */ }
      }
      try { localStorage.removeItem(k) } catch { /* ignore */ }
    }
  }
}

function saveSnapshot(collection: string) {
  const snap = pushedSnapshot.get(collection)
  if (!snap) return
  // Écriture asynchrone : l'empreinte mémoire fait déjà foi pour cette session.
  void kvSet(SIG_PREFIX + collection, JSON.stringify([...snap]))
}

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
  let nextSnapshot: Map<string, string> | null = null
  let total = 0

  if (c.singleton) {
    await apiUpsert([upsertStmt(c.collection, 'global', null, parsed, now)])
    total = 1
  } else if (Array.isArray(parsed)) {
    const prev = pushedSnapshot.get(c.collection)
    nextSnapshot = new Map<string, string>()
    // Envoi par lots au fil de l'eau : on ne garde jamais plus de 100 requêtes
    // (donc 100 chaînes JSON) en mémoire. Auparavant on matérialisait toutes les
    // requêtes d'un coup → pic mémoire fatal sur un gros import.
    let batch: UpsertRow[] = []
    const flush = async () => {
      if (batch.length === 0) return
      await apiUpsert(batch)
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
      if (batch.length >= UPSERT_LIMIT) await flush()
    }

    /**
     * SUPPRESSIONS.
     *
     * Jusqu'ici seuls les enregistrements PRÉSENTS étaient envoyés : effacer une
     * fiche localement ne la retirait jamais du serveur. La base distante gardait
     * tout, et le moindre retéléchargement complet ressuscitait les fiches
     * supprimées — c'est ainsi qu'un catalogue nettoyé à 14 600 est remonté à
     * 49 555.
     *
     * On ne marque que les identifiants que CET appareil a lui-même poussés puis
     * n'a plus : sans empreinte précédente, on ne supprime rien. Un appareil dont
     * le périmètre ne couvre qu'un magasin ne peut donc pas effacer les fiches
     * des autres.
     */
    if (prev) {
      for (const [id] of prev) {
        if (nextSnapshot.has(id)) continue
        batch.push({ collection: c.collection, id, storeId: null, data: '', updated_at: now, deleted: 1 })
        if (batch.length >= UPSERT_LIMIT) await flush()
      }
    }
    await flush()
  }

  // Enregistré seulement après succès : un échec fera repartir l'envoi complet.
  if (nextSnapshot) {
    pushedSnapshot.set(c.collection, nextSnapshot)
    saveSnapshot(c.collection) // persiste pour ne pas tout re-pousser à la prochaine session
  }
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
  const r = await apiCounts()
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
  // Aucun envoi tant que les empreintes ne sont pas chargées : sans elles, tout
  // paraît nouveau et la collection entière repart vers Turso.
  if (empreintesPretes) await empreintesPretes
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

// La configuration de la synchro n'est plus lisible depuis le navigateur (le
// token vit côté serveur) : on interroge /api/sync une fois et on mémorise.
let configured = true
export function tursoConfigured(): boolean { return configured }
export async function refreshSyncConfig(): Promise<boolean> {
  const st = await syncStatus()
  configured = st.configured
  return configured
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

/**
 * Curseur de lecture : couple (horodatage, identifiant).
 *
 * L'identifiant departage les lignes ecrites dans la MEME milliseconde — le cas
 * de tout import en masse. Sans lui, la pagination sautait a l'horodatage et
 * perdait definitivement tout ce qui depassait la premiere page.
 *
 * Format « ts|id ». Les appareils qui n'ont qu'un nombre reprennent au debut de
 * leur horodatage : quelques lignes relues, et le retard se comble seul.
 */
function getCursor(): { ts: number; id: string } {
  const raw = localStorage.getItem(CURSOR_KEY) || '0'
  const sep = raw.indexOf('|')
  if (sep < 0) return { ts: Number(raw) || 0, id: '' }
  return { ts: Number(raw.slice(0, sep)) || 0, id: raw.slice(sep + 1) }
}
function setCursor(ts: number, id = '') {
  localStorage.setItem(CURSOR_KEY, `${ts}|${id}`)
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
  const c0 = getCursor()
  let since = c0.ts
  let sinceId = c0.id
  let maxTs = c0.ts
  let maxId = c0.id
  const byCol = new Map<string, RemoteRow[]>()

  // Rattrapage en mémoire AVANT toute écriture locale. Auparavant, un seul lot de
  // 1000 était appliqué par appel : rattraper 50 000 produits réécrivait le blob
  // produits (~15 Mo : JSON.parse + JSON.stringify) une fois par lot, ce qui
  // figeait l'onglet plusieurs secondes (« Page ne répondant pas »).
  for (let batch = 0; batch < 200; batch++) {
    const res = await apiPull(since, sinceId)
    if (res.scanned === 0) break
    for (const r of res.rows as unknown as RemoteRow[]) {
      const list = byCol.get(r.collection) ?? []
      list.push(r)
      byCol.set(r.collection, list)
    }
    // Le curseur suit la page examinee par le serveur, pas les lignes recues :
    // certaines ont pu etre masquees par le perimetre de l'utilisateur.
    maxTs = Number(res.maxTs ?? maxTs)
    maxId = String(res.maxId ?? '')
    if (res.scanned < res.page) break
    since = maxTs
    sinceId = maxId
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
    // Empreinte de la collection : on la met à jour avec les enregistrements reçus
    // pour NE PAS les re-pousser ensuite (ils sont déjà en remote).
    let snap = pushedSnapshot.get(colName)
    if (!snap) { snap = new Map<string, string>(); pushedSnapshot.set(colName, snap) }
    let colChanged = false
    for (const r of rows) {
      const id = String(r.id)
      if (Number(r.deleted) === 1) {
        if (map.delete(id)) colChanged = true
        snap.delete(id)
      } else {
        const existing = map.get(id)
        if (!existing || JSON.stringify(existing) !== r.data) {
          map.set(id, JSON.parse(r.data))
          colChanged = true
        }
        snap.set(id, sig(r.data)) // reçu de remote → déjà synchronisé
      }
    }
    if (colChanged) {
      storageSet(c.key, JSON.stringify([...map.values()]))
      changedCols.push(colName)
    }
    saveSnapshot(colName)
  }

  setCursor(maxTs, maxId)
  if (changedCols.length) {
    pushLog(`⇣ reçu: ${changedCols.join(', ')}`)
    // On transmet les collections réellement modifiées : le store ne recharge
    // ainsi que ce qui a changé (recharger les produits = parser ~15 Mo).
    window.dispatchEvent(new CustomEvent('droguerie-sync-pull', { detail: { collections: changedCols } }))
    await reparerImagesRecues()
  }
}

/**
 * Réduit les images arrivées du serveur, puis renvoie la version allégée.
 *
 * Réparer le stockage local au démarrage ne suffisait pas : le serveur détient
 * lui aussi le logo en pleine résolution, et le pull suivant le réécrivait
 * aussitôt en local — le quota repassait à 126 % dans la minute. On compacte
 * donc APRÈS chaque réception, et on repousse le résultat pour que la copie
 * distante soit corrigée à son tour. Une seule tournée suffit à converger.
 */
export async function reparerImagesRecues(): Promise<void> {
  try {
    const bilan = await compacterImagesStockees()
    if (bilan.images === 0) return
    pushLog(`🖼 ${bilan.images} image(s) réduite(s), ${Math.round(bilan.octets / 1024)} Ko rendus`)
    for (const cle of bilan.cles) {
      const c = KEY_TO_COL.get(cle)
      if (c) await flushOne(c) // la version allégée remplace celle du serveur
    }
  } catch {
    /* la réparation ne doit jamais faire échouer une synchro */
  }
}

/**
 * Force un re-téléchargement COMPLET depuis Turso en UN SEUL SELECT (sans curseur,
 * sans LIMIT). Reconstruit chaque collection locale à partir du serveur (Turso =
 * source de vérité). Évite le bug de pagination du pull incrémental (curseur sur
 * horodatage non-unique) qui « sautait » des enregistrements. Utile après un import
 * côté serveur ou l'ajout d'une nouvelle collection.
 */
/**
 * Télécharge TOUTE la base par pages (curseur rowid). La pagination est
 * imposée par la passerelle serveur : une réponse de fonction serverless est
 * plafonnée, un SELECT complet de 100 000 lignes ne passerait pas.
 */
async function fetchAllRows(): Promise<{ collection: string; id: string; data: string; updated_at: number }[]> {
  const out: { collection: string; id: string; data: string; updated_at: number }[] = []
  let after = 0
  for (let page = 0; page < 5000; page++) {
    const res = await apiAll(after)
    out.push(...res.rows)
    if (res.scanned < res.page) break
    after = res.cursor
  }
  return out
}

/**
 * Retéléchargement complet.
 *
 * L'opération REMPLAÇAIT le local par le distant. Tout ce qui n'avait pas encore
 * été poussé disparaissait donc sans un mot — une fiche créée à la main quelques
 * secondes plus tôt, une saisie de stock en attente d'envoi. C'est ainsi qu'un
 * produit saisi manuellement s'est volatilisé.
 *
 * Désormais on FUSIONNE. Un enregistrement local absent du serveur est de deux
 * natures, et l'empreinte des envois les distingue :
 *   — déjà poussé par cet appareil, donc supprimé ailleurs → on le laisse partir ;
 *   — jamais poussé → il est neuf, on le garde, il partira au prochain envoi.
 */
export async function resyncFromStart(): Promise<number> {
  const rows = await fetchAllRows()

  let maxTs = 0
  const byCol = new Map<string, { data: string }[]>()
  for (const r of rows) {
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
    const snap = new Map<string, string>()
    const vusDistant = new Set<string>()
    for (const r of rows) {
      try {
        const rec = JSON.parse(r.data) as Row
        arr.push(rec)
        if (rec && rec.id) {
          snap.set(String(rec.id), sig(r.data))
          vusDistant.add(String(rec.id))
        }
      } catch {}
    }

    // Rattrapage des enregistrements locaux jamais envoyés.
    const dejaPousse = pushedSnapshot.get(colName)
    try {
      const brut = storageGet(c.key)
      const locaux = brut ? (JSON.parse(brut) as Row[]) : []
      if (Array.isArray(locaux)) {
        for (const rec of locaux) {
          if (!rec || !rec.id) continue
          const id = String(rec.id)
          if (vusDistant.has(id)) continue          // le serveur fait autorité
          if (dejaPousse && dejaPousse.has(id)) continue // supprimé ailleurs : on l'accepte
          arr.push(rec)                              // jamais poussé : on le garde
        }
      }
    } catch { /* local illisible : le distant seul fait foi */ }

    storageSet(c.key, JSON.stringify(arr))
    // Local reconstruit à l'identique du remote → empreinte reconstruite pour NE
    // PAS re-pousser tout après une re-synchronisation.
    pushedSnapshot.set(colName, snap)
    saveSnapshot(colName)
    total += arr.length
  }

  setCursor(maxTs)
  pushLog(`↺ re-synchronisation complète : ${total} enregistrements`)
  window.dispatchEvent(new CustomEvent('droguerie-sync-pull'))
  await reparerImagesRecues()
  return total
}

/**
 * Amorçage d'un appareil NEUF : rapatrie toutes les données depuis Turso dans
 * localStorage (au lieu de générer des données de démo). Retourne false si Turso
 * est vide (première installation → on laissera le seed s'exécuter).
 */
export async function bootstrapFromRemote(): Promise<boolean> {
  const rows = await fetchAllRows()
  if (rows.length === 0) return false

  const byKey = new Map<string, unknown[]>()
  const singles = new Map<string, string>()
  const snaps = new Map<string, Map<string, string>>() // collection -> empreinte
  let maxTs = 0
  for (const r of rows) {
    maxTs = Math.max(maxTs, Number(r.updated_at))
    const c = COL_BY_NAME.get(String(r.collection))
    if (!c) continue
    if (c.singleton) {
      singles.set(c.key, String(r.data))
    } else {
      const list = byKey.get(c.key) ?? []
      try {
        const rec = JSON.parse(String(r.data)) as Row
        list.push(rec)
        let s = snaps.get(c.collection)
        if (!s) { s = new Map(); snaps.set(c.collection, s) }
        if (rec && rec.id) s.set(String(rec.id), sig(String(r.data)))
      } catch {}
      byKey.set(c.key, list)
    }
  }
  for (const [key, arr] of byKey) storageSet(key, JSON.stringify(arr))
  for (const [key, data] of singles) storageSet(key, data)
  // Empreinte reconstruite = pas de re-push complet après l'amorçage.
  for (const [collection, snap] of snaps) { pushedSnapshot.set(collection, snap); saveSnapshot(collection) }
  setCursor(maxTs)
  pushLog(`⇣ amorçage depuis le serveur : ${rows.length} enregistrements`)
  await reparerImagesRecues()
  return true
}

/** Active la synchro (après le chargement initial) : write-through + pull périodique. */
/** Vrai si la liste de produits locale est vide (appareil non hydraté). */
/**
 * Contrôle d'intégrité du catalogue, UNE fois par session.
 *
 * L'auto-réparation ne se déclenchait que sur un local entièrement vide. Un
 * catalogue PARTIEL — le symptôme laissé par l'ancienne pagination, qui perdait
 * tout ce qui dépassait la première page d'un même horodatage — passait donc
 * inaperçu : l'appareil affichait 520 produits sur 14 601 sans jamais le
 * signaler. On compare désormais au serveur, et on retélécharge si l'écart est
 * réel. Une seule fois par session : un COUNT distant n'est pas gratuit.
 */
const INTEGRITE_KEY = 'dp_integrity_checked'

async function verifierIntegrite(): Promise<void> {
  try {
    if (sessionStorage.getItem(INTEGRITE_KEY)) return
    sessionStorage.setItem(INTEGRITE_KEY, '1')
    const distant = await countRemote()
    const nD = distant.find((c) => c.collection === 'products')?.n ?? 0
    const nL = localCounts().find((c) => c.collection === 'products')?.n ?? 0
    if (nD === 0) return
    // Tolérance : un écart de quelques fiches est normal entre deux pulls.
    const ecart = nD - nL
    if (ecart <= 20 || ecart / nD < 0.01) return

    /**
     * Un écart ne suffit PAS à conclure que le local est en retard.
     *
     * Tant que les suppressions n'étaient pas transmises, le distant conservait
     * les fiches effacées ici : le local était donc légitimement plus petit, et
     * retélécharger ressuscitait tout ce qu'on venait de nettoyer. C'est ce qui
     * a fait remonter un catalogue de 14 600 à 49 555.
     *
     * On ne retélécharge donc que si le local est VIDE ou dérisoire. Dans les
     * autres cas on signale l'écart et on laisse le pull incrémental faire son
     * travail — il rapatrie les ajouts sans écraser les suppressions.
     */
    if (nL > 100 && nL / nD > 0.05) {
      pushLog(`⚠ écart catalogue : ${nL} local / ${nD} distant (suppressions non encore propagées ?)`)
      return
    }
    pushLog(`⚠ catalogue quasi vide : ${nL} local / ${nD} distant — retéléchargement`)
    await resyncFromStart()
    pushLog('✓ catalogue rétabli')
  } catch {
    /* hors-ligne ou permission absente : on réessaiera à la prochaine session */
  }
}

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
  if (syncState.started || typeof window === 'undefined') return
  syncState.started = true
  // Confirme auprès du serveur que la synchro est configurée (sans bloquer).
  void refreshSyncConfig()

  window.addEventListener('online', () => void flushDirty())

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

  void amorcer()
}

/**
 * Amorçage : empreintes, puis PREMIÈRE LECTURE, puis premier envoi.
 *
 * Les empreintes viennent d'IndexedDB, donc de façon asynchrone. Rien ne doit
 * partir avant qu'elles soient là : sans empreinte, `pushOne` considère tout
 * comme nouveau et re-téléverse le catalogue entier — des dizaines de milliers
 * d'écritures Turso à chaque ouverture d'onglet.
 */
async function amorcer() {
  // Empreinte anti-re-push : on charge celle de la session précédente. Pour les
  // collections sans empreinte (1re fois après cette mise à jour), on l'initialise
  // depuis le local — SAUF les collections « sales » (modifs non encore poussées).
  // Sans ça, le 1er push de session renvoyait TOUT le catalogue à chaque ouverture.
  empreintesPretes = loadSnapshots()
  await empreintesPretes
  const dirty = new Set(loadPending())
  for (const c of COLLECTIONS) {
    if (c.singleton || pushedSnapshot.has(c.collection) || dirty.has(c.collection)) continue
    const raw = storageGet(c.key)
    if (!raw) continue
    try {
      const arr = JSON.parse(raw)
      if (!Array.isArray(arr)) continue
      const m = new Map<string, string>()
      for (const rec of arr) if (rec && rec.id) m.set(String(rec.id), sig(JSON.stringify(rec)))
      pushedSnapshot.set(c.collection, m)
      saveSnapshot(c.collection)
    } catch {
      /* collection illisible : on la laissera se pousser normalement */
    }
  }

  // Auto-réparation : si le local n'a aucun produit, on télécharge tout depuis
  // Turso (SELECT complet, fiable) au lieu du pull incrémental — sinon on
  // enchaîne les pulls incrémentaux normaux.
  const first = localProductsEmpty()
    ? resyncFromStart().then(() => undefined)
    : pull().then(() => verifierIntegrite())

  /**
   * LIRE AVANT D'ÉCRIRE.
   *
   * L'envoi partait avant la première lecture. Un appareil resté en arrière
   * pendant quelques jours poussait donc sa vue périmée AVANT de découvrir
   * l'état réel : chaque envoi réécrivant `updated_at`, sa version ancienne
   * écrasait la récente, et les fiches supprimées ailleurs qu'il détenait encore
   * repartaient vers le serveur avec `deleted = 0` — ressuscitées.
   *
   * Avec trois postes, chacun imposait sa vue à tour de rôle et rien ne
   * convergeait. On lit d'abord, on envoie ensuite ce qui reste réellement neuf.
   */
  await first.catch((e) => pushLog(`✗ pull initial: ${e instanceof Error ? e.message : String(e)}`))
  await flushDirty()
}
