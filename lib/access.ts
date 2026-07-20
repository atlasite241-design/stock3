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
  '/recettes': 'cash.in',
  '/transfert-argent': 'cash.journal',
  // Produits
  '/produits': 'prod.view',
  '/produits/categories': 'prod.view',
  '/produits/sous-categories': 'prod.view',
  '/produits/marques': 'prod.view',
  '/produits/unites': 'prod.view',
  '/produits/codes-barres': 'prod.scan',
  // Stock
  '/stock': 'stock.view',
  '/stock/par-magasin': 'stock.view',
  '/stock/inventaire': 'stock.inventory',
  '/stock/mouvements': 'stock.movements',
  '/stock/transferts': 'stock.transfer',
  '/stock/transferts/nouveau': 'stock.transfer',
  '/stock/transferts/details': 'stock.transfer',
  // Achats
  '/achats': 'purch.order',
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
  '/ventes/bon-livraison': 'sale.create',
  '/ventes/factures': 'sale.print_invoice',
  '/ventes/avoirs': 'sale.credit_note',
  '/ventes/retours': 'sale.return',
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
  // Alertes
  '/alertes': 'stock.critical',
  // Magasins
  '/magasins': 'set.store',
  '/magasins/nouveau': 'set.store',
  '/magasins/depots': 'set.store',
  '/magasins/utilisateurs': 'set.users',
  '/magasins/parametres': 'set.store',
  // Utilisateurs
  '/utilisateurs/employes': 'set.users',
  '/utilisateurs/roles': 'set.roles',
  '/utilisateurs/permissions': 'set.permissions',
  '/utilisateurs/journal': 'set.users',
  // Paramètres
  '/parametres/societe': 'set.company',
  '/parametres/impression': 'set.print',
  '/parametres/sauvegarde': 'set.backup',
  '/parametres/reinitialisation': 'set.reset_stats',
  '/parametres/licences': 'set.company',
  '/parametres/administration': 'set.users',
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
