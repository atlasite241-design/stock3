'use client'

import { useMemo } from 'react'
import { useAuth } from './auth-context'
import { useDroguerie } from './store'
import { effectivePermissions, type RoleName } from './permissions'

/** Permission requise par route (chemin de base, sans query). Route absente = pas de restriction. */
export const ROUTE_PERM: Record<string, string> = {
  // POS
  '/caisse': 'sale.create',
  '/caisse/vente-rapide': 'sale.create',
  // Caisse
  '/caisse-journal': 'cash.journal',
  '/caisse-journal/fin-journee': 'cash.close',
  '/caisse-journal/archives': 'cash.journal',
  '/depenses': 'cash.journal',
  // Finance (budgets OPEX/CAPEX, trésorerie, analyse)
  '/finance': 'fin.view',
  '/finance/budgets': 'fin.view',
  '/finance/budgets/opex': 'fin.view',
  '/finance/budgets/capex': 'fin.view',
  '/finance/tresorerie': 'fin.view',
  '/finance/previsions': 'fin.view',
  '/finance/analyse': 'fin.view',
  '/recettes': 'cash.in',
  '/transfert-argent': 'cash.journal',
  // Produits
  '/produits': 'prod.view',
  '/produits/categories': 'prod.view',
  '/produits/sous-categories': 'prod.view',
  '/produits/marques': 'prod.view',
  '/produits/unites': 'prod.view',
  '/produits/codes-barres': 'prod.scan',
  '/produits/analyse': 'prod.delete',
  // Lecture seule : l'analyse ne modifie rien, elle propose des regroupements.
  '/produits/declinaisons': 'prod.view',
  '/produits/etat': 'prod.view',
  '/produits/conversion': 'prod.edit',
  // Stock
  '/stock': 'stock.view',
  '/stock/stock-initial': 'stock.init',
  '/stock/par-magasin': 'stock.view',
  '/stock/par-depot': 'stock.view',
  '/stock/inventaire': 'stock.inventory',
  '/stock/inventaires': 'stock.inventory',
  '/stock/inventaires/physique': 'stock.inventory',
  '/stock/inventaires/tournant': 'stock.inventory',
  '/stock/inventaires/details': 'stock.inventory',
  '/stock/inventaires/historique': 'stock.inventory',
  '/stock/reapprovisionnement': 'stock.view',
  '/stock/consultation': 'stock.view',
  '/stock/mouvements': 'stock.movements',
  // Lots et dates de péremption : écran métier qui n'était protégé par rien.
  '/stock/lots': 'stock.view',
  '/stock/ajustement': 'stock.adjust',
  '/stock/comptage': 'stock.inventory',
  '/stock/ecarts': 'stock.inventory',
  '/stock/annulation': 'stock.movements',
  '/stock/critique': 'stock.critical',
  '/stock/suggestions': 'stock.view',
  '/stock/previsions': 'stock.view',
  '/stock/controle/ruptures': 'stock.view',
  '/stock/controle/expires': 'stock.view',
  '/stock/controle/negatif': 'stock.view',
  '/stock/controle/sans-emplacement': 'stock.view',
  '/stock/controle/dormants': 'stock.view',
  '/stock/controle/anomalies': 'stock.view',
  '/stock/rapports/valorisation': 'report.stock',
  '/stock/rapports/rotation': 'report.stock',
  '/stock/rapports/historique': 'report.stock',
  '/stock/rapports/export': 'report.stock',
  '/stock/transferts': 'stock.transfer',
  '/stock/transferts/nouveau': 'stock.transfer',
  '/stock/transferts/details': 'stock.transfer',
  // Achats
  '/achats': 'purch.order',
  // Les demandes d'achat (création ET approbation) n'étaient protégées par rien.
  '/achats/demandes': 'purch.order',
  '/achats/demandes-prix': 'purch.order',
  '/achats/bon-livraison': 'purch.delivery',
  '/achats/reception': 'purch.reception',
  '/achats/entrees-stock': 'stock.entry',
  '/achats/factures': 'purch.invoice',
  '/achats/paiements': 'purch.payment',
  '/achats/historique': 'purch.order',
  '/achats/retours': 'purch.return',
  // Ventes
  '/ventes': 'sale.history',
  '/ventes/devis': 'sale.quote_create',
  '/ventes/commandes': 'sale.order',
  '/ventes/bon-livraison': 'sale.create',
  '/ventes/factures': 'sale.print_invoice',
  '/ventes/avoirs': 'sale.credit_note',
  '/achats/avoirs': 'purch.credit_note',
  '/ventes/retours': 'sale.return',
  // Bons papier (les listes sont visibles avec bons.view ; les actions sont
  // gardées finement dans chaque écran). La saisie utilise ?id= : basePath
  // retire la query, donc '/ventes/bons/saisie' est bien le chemin gardé.
  '/ventes/bons/nouveau': 'bons.create',
  '/ventes/bons/scanner': 'bons.scan',
  '/ventes/bons/saisie': 'bons.enter',
  '/ventes/bons/a-saisir': 'bons.view',
  '/ventes/bons/saisis': 'bons.view',
  '/ventes/bons/annules': 'bons.view',
  '/ventes/bons/recherche': 'bons.view',
  '/ventes/bons/cloture': 'bons.close',
  // Clients
  '/clients': 'client.view',
  '/clients/nouveau': 'client.add',
  '/clients/historique': 'client.view',
  '/clients/credits': 'client.credit_view',
  '/clients/paiements': 'client.credit_collect',
  '/clients/fidelite': 'client.loyalty_view',
  // Fournisseurs
  '/fournisseurs': 'supp.view',
  '/fournisseurs/nouveau': 'supp.add',
  '/fournisseurs/historique': 'supp.view',
  '/fournisseurs/retours': 'purch.return',
  '/fournisseurs/soldes': 'supp.balances',
  // Rapports
  '/rapports': 'report.sales',
  '/rapports/ventes': 'report.sales',
  '/rapports/achats': 'report.purchases',
  '/rapports/stock': 'report.stock',
  '/rapports/produits-plus-vendus': 'report.sales',
  '/rapports/produits-moins-vendus': 'report.sales',
  '/rapports/marge': 'report.margins',
  '/rapports/fournisseurs': 'report.suppliers',
  '/rapports/clients': 'report.clients',
  '/rapports/caisse': 'report.sales',
  '/rapports/produits-achetes': 'report.purchases',
  '/rapports/vendeurs': 'report.sales',
  '/rapports/magasins': 'report.sales',
  // Comptabilité
  '/comptabilite/journaux': 'report.margins',
  '/comptabilite/plan-comptable': 'report.margins',
  '/comptabilite/tva': 'report.margins',
  '/comptabilite/ecritures': 'report.margins',
  '/comptabilite/reglements': 'report.margins',
  '/comptabilite/banque': 'report.margins',
  // Alertes
  '/alertes': 'stock.critical',
  // Magasins
  '/magasins': 'set.store',
  '/magasins/nouveau': 'set.store',
  '/magasins/depots': 'set.store',
  '/magasins/zones': 'loc.view',
  '/magasins/allees': 'loc.view',
  '/magasins/rayons': 'loc.view',
  '/magasins/etageres': 'loc.view',
  '/magasins/niveaux': 'loc.view',
  '/magasins/emplacements': 'loc.view',
  '/magasins/generateur': 'loc.create',
  '/magasins/assistant-photos': 'loc.create',
  '/magasins/affectation': 'loc.move',
  '/magasins/explorateur': 'loc.view',
  '/magasins/plan': 'loc.view',
  '/magasins/rangement': 'loc.move',
  '/magasins/deplacement': 'loc.move',
  '/magasins/qr-codes': 'loc.print',
  '/magasins/impression': 'loc.print',
  '/magasins/rapports': 'loc.view',
  '/magasins/utilisateurs': 'set.users',
  '/magasins/parametres': 'set.store',
  // Utilisateurs
  '/utilisateurs/employes': 'set.users',
  '/utilisateurs/roles': 'set.roles',
  '/utilisateurs/permissions': 'set.permissions',
  '/utilisateurs/journal': 'set.users',
  '/utilisateurs/connexions': 'set.users',

  // Ressources humaines
  '/rh/employes': 'hr.view',
  '/rh/employes/nouveau': 'hr.edit',
  '/rh/employes/dossier': 'hr.view',
  '/rh/employes/documents': 'hr.documents',
  '/rh/employes/historique': 'hr.view',
  '/rh/presence/pointage': 'hr.clock',
  '/rh/presence/presences': 'hr.attendance',
  '/rh/presence/absences': 'hr.attendance',
  '/rh/presence/retards': 'hr.attendance',
  '/rh/presence/conges': 'hr.leaves',
  '/rh/planning/horaires': 'hr.planning',
  '/rh/planning/equipes': 'hr.planning',
  '/rh/planning/calendrier': 'hr.planning',
  '/rh/planning/feries': 'hr.planning',
  '/rh/paie/salaires': 'hr.payroll',
  '/rh/paie/primes': 'hr.payroll',
  '/rh/paie/avances': 'hr.payroll',
  '/rh/paie/deductions': 'hr.payroll',
  '/rh/paie/bulletins': 'hr.payroll',
  '/rh/performance/evaluations': 'hr.performance',
  '/rh/performance/objectifs': 'hr.performance',
  '/rh/performance/recompenses': 'hr.performance',
  '/rh/performance/sanctions': 'hr.performance',
  '/rh/formation/formations': 'hr.training',
  '/rh/formation/competences': 'hr.training',
  '/rh/formation/certifications': 'hr.training',
  '/rh/recrutement/offres': 'hr.recruitment',
  '/rh/recrutement/candidatures': 'hr.recruitment',
  '/rh/recrutement/entretiens': 'hr.recruitment',
  '/rh/recrutement/embauches': 'hr.edit',
  '/rh/securite/badges': 'hr.badges',
  '/rh/rapports/effectif': 'hr.reports',
  '/rh/rapports/presence': 'hr.reports',
  '/rh/rapports/heures': 'hr.reports',
  '/rh/rapports/masse-salariale': 'hr.payroll',
  '/rh/rapports/export': 'hr.reports',
  // Paramètres
  '/parametres/societe': 'set.company',
  // set.tva existait au catalogue sans jamais servir : l'écran n'était pas
  // au menu, donc jamais filtré par permission.
  '/parametres/tva': 'set.tva',
  '/parametres/devise': 'set.company',
  '/parametres/impression': 'set.print',
  '/parametres/sauvegarde': 'set.backup',
  // Réparation : corrige des données déjà écrites — même niveau que la
  // réinitialisation des statistiques.
  '/parametres/reparation': 'set.reset_stats',
  '/parametres/reinitialisation': 'set.reset_stats',
  '/parametres/remise-a-zero': 'set.reset_stats',
  '/parametres/licences': 'set.company',
  '/parametres/administration': 'set.users',
  '/sync': 'set.backup',
  // Assistant de configuration : il ÉCRIT les réglages de l'enseigne. Sur une
  // installation neuve, aucun compte n'existe encore et `can()` laisse passer.
  '/setup': 'set.company',

  /*
   * INTERFACE MOBILE. Elle n'appliquait aucun droit : ni entrée ici, ni garde
   * dans MobileShell. Or on y encaisse, on y inventorie et on y transfère du
   * stock. Chaque écran reprend la permission de son équivalent ordinateur —
   * un même compte a désormais les mêmes pouvoirs sur les deux supports.
   *
   * `/mobile` et `/mobile/plus` (accueil et sommaire) restent ouverts, comme
   * le tableau de bord ; `/mobile/plus/parametres` aussi : ce sont des
   * préférences d'affichage propres à l'appareil, pas des réglages de gestion.
   */
  '/mobile/caisse': 'sale.create',
  '/mobile/ventes': 'sale.history',
  '/mobile/stock': 'stock.view',
  '/mobile/inventaire': 'stock.inventory',
  '/mobile/analytics': 'report.sales',
  '/mobile/plus/caisse': 'cash.open',
  '/mobile/plus/clients': 'client.view',
  '/mobile/plus/factures-whatsapp': 'sale.print_invoice',
  '/mobile/plus/fournisseurs': 'supp.view',
  '/mobile/plus/notifications': 'stock.critical',
  '/mobile/plus/produits': 'prod.view',
  '/mobile/plus/reappro': 'stock.view',
  '/mobile/plus/reception': 'purch.reception',
  '/mobile/plus/stock-critique': 'stock.critical',
  '/mobile/plus/transferts': 'stock.transfer',
}

export const basePath = (href: string) => href.split('?')[0]
export const routePermission = (pathname: string): string | undefined => ROUTE_PERM[basePath(pathname)]

/**
 * Permissions de l'utilisateur connecté. `can(key)` renvoie vrai si l'utilisateur
 * possède la permission. Fail-open quand aucun utilisateur n'est connecté (le gating
 * ne s'applique qu'après connexion ; l'AuthGate gère l'accès non authentifié).
 */
export function usePermissions() {
  const { currentUser } = useAuth()
  const { settings } = useDroguerie()
  const perms = useMemo(() => {
    if (!currentUser) return null
    return effectivePermissions(currentUser.permissions, currentUser.role as RoleName, settings.rolePermissions)
  }, [currentUser, settings.rolePermissions])
  const can = (key?: string) => {
    if (!key) return true
    if (!perms) return true
    return perms.has(key)
  }
  return { can, perms, currentUser }
}
