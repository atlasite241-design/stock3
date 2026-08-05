import 'server-only'

/**
 * Politique d'accès aux données, appliquée CÔTÉ SERVEUR.
 *
 * Jusqu'ici les permissions ne masquaient que des écrans : une session valide
 * pouvait lire l'intégralité de la base via l'API. Ce module décide, pour
 * chaque collection, qui peut lire et qui peut écrire — et restreint les
 * enregistrements au périmètre magasin de l'utilisateur.
 */

/**
 * Permission requise pour LIRE une collection. `null` = lisible par toute
 * session. Un tableau = l'une quelconque suffit (le pointage doit être ouvert
 * à qui pointe comme à qui supervise).
 */
const READ_PERM: Record<string, string | string[] | null> = {
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
  // RH — jamais lisible sans permission. La paie et les données personnelles
  // (CIN, CNSS, RIB) ne doivent PAS suivre la règle de `users`, ouverte à
  // toute session parce que l'écran de connexion en dépend.
  hrEmployees: 'hr.view',
  hrDocuments: 'hr.documents',
  hrAttendance: ['hr.clock', 'hr.attendance'],
  hrLeaves: 'hr.leaves',
  hrShifts: 'hr.planning',
  hrTeams: 'hr.planning',
  hrHolidays: 'hr.planning',
  hrAdjustments: 'hr.payroll',
  hrPayslips: 'hr.payroll',
  hrEvaluations: 'hr.performance',
  hrObjectives: 'hr.performance',
  hrActions: 'hr.performance',
  hrTrainings: 'hr.training',
  hrSkills: 'hr.training',
  hrCertifications: 'hr.training',
  hrJobs: 'hr.recruitment',
  hrApplications: 'hr.recruitment',
  hrBadges: 'hr.badges',
}

/** Permission requise pour ÉCRIRE. Une collection absente n'est PAS écrivable. */
const WRITE_PERM: Record<string, string | string[]> = {
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
  hrEmployees: 'hr.edit',
  hrDocuments: 'hr.documents',
  hrAttendance: ['hr.clock', 'hr.attendance'],
  hrLeaves: 'hr.leaves',
  hrShifts: 'hr.planning',
  hrTeams: 'hr.planning',
  hrHolidays: 'hr.planning',
  hrAdjustments: 'hr.payroll',
  hrPayslips: 'hr.payroll',
  hrEvaluations: 'hr.performance',
  hrObjectives: 'hr.performance',
  hrActions: 'hr.performance',
  hrTrainings: 'hr.training',
  hrSkills: 'hr.training',
  hrCertifications: 'hr.training',
  hrJobs: 'hr.recruitment',
  hrApplications: 'hr.recruitment',
  hrBadges: 'hr.badges',
}

/**
 * Collections PARTAGÉES entre magasins : leurs enregistrements n'ont pas de
 * périmètre. Filtrer `stores` par magasin empêcherait par exemple de changer
 * de magasin actif.
 */
const SHARED = new Set([
  'settings', 'users', 'stores', 'categories', 'subcategories', 'brands', 'units', 'activity',
  // Référentiels RH communs à l'enseigne : horaires et jours fériés ne sont pas
  // propres à un magasin.
  'hrShifts', 'hrHolidays',
])

export interface Scope {
  /** Rôle, issu du cookie signé. L'administrateur n'est jamais restreint. */
  role?: string
  /** Permissions effectives, embarquées dans la session signée. */
  perms: Set<string>
  /** Magasins autorisés. Vide = accès à tous (administrateur / gérant global). */
  storeIds: string[]
}

/**
 * L'Administrateur détient TOUJOURS tout — comme côté client.
 *
 * Les permissions sont figées dans le cookie à la connexion. Une session ouverte
 * avant l'ajout d'un module (les RH, par exemple) ne porte donc pas ses
 * permissions, et le serveur refusait l'écriture avec `forbidden_collection` —
 * bloquant toute la synchronisation d'un administrateur, sans qu'aucune
 * reconnexion soit suggérée.
 */
const holds = (need: string | string[], s: Scope): boolean => {
  if (s.role === 'Administrateur') return true
  return Array.isArray(need) ? need.some((p) => s.perms.has(p)) : s.perms.has(need)
}

export const canRead = (collection: string, s: Scope): boolean => {
  if (!(collection in READ_PERM)) return false // collection inconnue : refus par défaut
  const need = READ_PERM[collection]
  return need === null || holds(need, s)
}

export const canWrite = (collection: string, s: Scope): boolean => {
  const need = WRITE_PERM[collection]
  return !!need && holds(need, s)
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
