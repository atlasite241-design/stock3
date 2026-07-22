'use client'

// Stockage des PRODUITS dans IndexedDB (capacité ~centaines de Mo) au lieu de
// localStorage (~2–5 Mo), pour supporter de très gros catalogues (50 000+).
// On garde un cache SYNCHRONE en mémoire (la chaîne JSON) pour rester compatible
// avec le reste du code qui lit/écrit de façon synchrone ; l'écriture réelle vers
// IndexedDB est asynchrone.

export const PRODUCTS_KEY = 'dp_products'
const DB_NAME = 'droguerie-pro'
const STORE = 'kv'

let cache: string | null = null
let cacheReady = false
let dbPromise: Promise<IDBDatabase | null> | null = null

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE) }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function idbGet(db: IDBDatabase): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(PRODUCTS_KEY)
      req.onsuccess = () => resolve((req.result as string) ?? null)
      req.onerror = () => resolve(null)
    } catch { resolve(null) }
  })
}

function idbPut(db: IDBDatabase, value: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, PRODUCTS_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch { resolve() }
  })
}

/** À appeler au démarrage AVANT de lire les produits. Charge le cache depuis IndexedDB
 *  et migre l'éventuel ancien contenu de localStorage. */
export async function initProductCache(): Promise<void> {
  const db = await openDB()
  if (db) cache = await idbGet(db)
  // Migration : ancien stockage localStorage → IndexedDB (une seule fois).
  if (cache == null && typeof localStorage !== 'undefined') {
    const legacy = localStorage.getItem(PRODUCTS_KEY)
    if (legacy) {
      cache = legacy
      if (db) void idbPut(db, legacy)
      try { localStorage.removeItem(PRODUCTS_KEY) } catch {}
    }
  }
  cacheReady = true
}

export function productCacheReady(): boolean { return cacheReady }

/** Lecture synchrone (depuis le cache mémoire). */
export function productsGet(): string | null {
  if (cache != null) return cache
  // Repli avant init (ne devrait pas arriver après initProductCache).
  if (typeof localStorage !== 'undefined') return localStorage.getItem(PRODUCTS_KEY)
  return null
}

/** Écriture synchrone du cache + persistance IndexedDB asynchrone. */
export function productsSet(value: string): void {
  cache = value
  void openDB().then((db) => { if (db) void idbPut(db, value) })
}

export function productsRemove(): void {
  cache = null
  void openDB().then((db) => {
    if (!db) return
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(PRODUCTS_KEY)
    } catch {}
  })
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(PRODUCTS_KEY) } catch {}
}

/** Routage localStorage-compatible : la clé produits passe par IndexedDB, le reste par localStorage. */
export function storageGet(key: string): string | null {
  if (key === PRODUCTS_KEY) return productsGet()
  return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
}
export function storageSet(key: string, value: string): void {
  if (key === PRODUCTS_KEY) { productsSet(value); return }
  localStorage.setItem(key, value)
}
