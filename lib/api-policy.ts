import 'server-only'

/**
 * Politique d'accès aux données, appliquée CÔTÉ SERVEUR.
 *
 * Jusqu'ici les permissions ne masquaient que des écrans : une session valide
 * pouvait lire l'intégralité de la base via l'API. Ce module décide, pour
 * chaque collection, qui peut lire et qui peut écrire — et restreint les
 * enregistrements au périmètre magasin de l'utilisateur.
 */

/** Permission requise pour LIRE une collection. `null` = lisible par toute session. */
const READ_PERM: Record<string, string | null> = {
  products: 'prod.view',
  categories: null, subcategories: null, brands: null, units: null,
  sales: 'sale.history',
  quotes: 'sale.quote_create',
  returns: 'sale.return',
  clients: 'client.view',
  credits: 'client.credit_view',
  loyalty: 'client.loyalty_view',
  suppliers: 'supp.view',
  purchases: 'purch.order',
  movements: 'stock.movements',
  transfers: 'stock.transfer',
  cash: 'cash.journal',
  sessions: 'cash.journal',
  expenses: 'cash.journal',
  revenues: 'cash.in',
  activity: 'set.users',
  users: null,          // nécessaire à l'écran de connexion ; jamais de secret exposé côté client
  stores: null, depots: null,
  zones: 'loc.view', allees: 'loc.view', rayons: 'loc.view', etageres: 'loc.view',
  niveaux: 'loc.view', positions: 'loc.view', emplacements: 'loc.view',
  settings: null,       // réglages d'affichage, indispensables au démarrage
}

/** Permission requise pour ÉCRIRE. Une collection absente n'est PAS écrivable. */
const WRITE_PERM: Record<string, string> = {
  products: 'prod.edit',
  categories: 'prod.edit', subcategories: 'prod.edit', brands: 'prod.edit', units: 'prod.edit',
  sales: 'sale.create',
  quotes: 'sale.quote_create',
  returns: 'sale.return',
  clients: 'client.add',
  credits: 'client.credit_collect',
  loyalty: 'client.loyalty_view',
  suppliers: 'supp.add',
  purchases: 'purch.order',
  movements: 'stock.movements',
  transfers: 'stock.transfer',
  cash: 'cash.journal',
  sessions: 'cash.journal',
  expenses: 'cash.journal',
  revenues: 'cash.in',
  activity: 'set.users',
  users: 'set.users',
  stores: 'set.store', depots: 'set.store',
  zones: 'loc.create', allees: 'loc.create', rayons: 'loc.create', etageres: 'loc.create',
  niveaux: 'loc.create', positions: 'loc.create', emplacements: 'loc.create',
  settings: 'set.company',
}

/**
 * Collections PARTAGÉES entre magasins : leurs enregistrements n'ont pas de
 * périmètre. Filtrer `stores` par magasin empêcherait par exemple de changer
 * de magasin actif.
 */
const SHARED = new Set(['settings', 'users', 'stores', 'categories', 'subcategories', 'brands', 'units', 'activity'])

export interface Scope {
  /** Permissions effectives, embarquées dans la session signée. */
  perms: Set<string>
  /** Magasins autorisés. Vide = accès à tous (administrateur / gérant global). */
  storeIds: string[]
}

export const canRead = (collection: string, s: Scope): boolean => {
  if (!(collection in READ_PERM)) return false // collection inconnue : refus par défaut
  const need = READ_PERM[collection]
  return need === null || s.perms.has(need)
}

export const canWrite = (collection: string, s: Scope): boolean => {
  const need = WRITE_PERM[collection]
  return !!need && s.perms.has(need)
}

/**
 * Un enregistrement est-il dans le périmètre ? Les données partagées et celles
 * sans magasin le sont toujours ; sinon le magasin doit figurer dans la session.
 */
export const inScope = (collection: string, storeId: string | null | undefined, s: Scope): boolean => {
  if (s.storeIds.length === 0) return true      // périmètre illimité
  if (SHARED.has(collection)) return true
  if (!storeId) return true                     // donnée non rattachée à un magasin
  return s.storeIds.includes(storeId)
}

/** Collections lisibles par cette session — sert à filtrer les lectures en masse. */
export const readableCollections = (s: Scope): string[] =>
  Object.keys(READ_PERM).filter((c) => canRead(c, s))
