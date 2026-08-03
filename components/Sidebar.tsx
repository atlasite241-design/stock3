'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Bell,
  Calculator,
  Boxes,
  Building2,
  ChevronDown,
  Coins,
  LayoutDashboard,
  Monitor,
  Package,
  RefreshCw,
  Rocket,
  Settings,
  Sparkles,
  ShoppingCart,
  Store,
  Truck,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react'
import type { RegisterSession } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'
import { ROUTE_PERM, usePermissions } from '@/lib/access'

interface NavChild {
  href: string
  labelKey: TKey
}

/** Regroupement intermédiaire (3e niveau) : « Stock › Inventaires › … ». */
interface NavSection {
  sectionKey: TKey
  items: NavChild[]
}

type NavEntry = NavChild | NavSection
const isSection = (e: NavEntry): e is NavSection => 'sectionKey' in e

interface NavItem {
  labelKey: TKey
  icon: LucideIcon
  href?: string
  children?: NavEntry[]
}

/** Toutes les entrées finales d'un groupe, sections aplaties. */
const leavesOf = (item: NavItem): NavChild[] =>
  (item.children ?? []).flatMap((e) => (isSection(e) ? e.items : [e]))

/** Famille de premier niveau : un intertitre au-dessus d'un groupe d'entrées. */
interface NavFamily {
  familyKey: TKey
  items: NavItem[]
}

const NAV_ALL: NavItem[] = [
  { labelKey: 'nav_dashboard', icon: LayoutDashboard, href: '/' },
  { labelKey: 'nav_setup', icon: Sparkles, href: '/setup' },
  { labelKey: 'nav_guide', icon: Rocket, href: '/guide-demarrage' },
  { labelKey: 'nav_guide_exercise', icon: RefreshCw, href: '/guide-exercice' },
  {
    labelKey: 'nav_pos',
    icon: Monitor,
    children: [
      { href: '/caisse', labelKey: 'nav_pos_new_sale' },
      { href: '/caisse/vente-rapide', labelKey: 'nav_pos_quick_sale' },
      { href: '/caisse?suspend=1', labelKey: 'nav_pos_suspend' },
      { href: '/caisse?resume=1', labelKey: 'nav_pos_resume' },
    ],
  },
  {
    labelKey: 'nav_caisse',
    icon: Wallet,
    children: [
      { href: '/caisse-journal?action=open', labelKey: 'nav_caisse_open' },
      { href: '/caisse-journal?action=close', labelKey: 'nav_caisse_close' },
      { href: '/depenses', labelKey: 'nav_caisse_expenses' },
      { href: '/recettes', labelKey: 'nav_caisse_income' },
      { href: '/transfert-argent', labelKey: 'nav_caisse_transfer' },
      { href: '/caisse-journal/fin-journee', labelKey: 'nav_caisse_endday' },
      { href: '/caisse-journal', labelKey: 'nav_caisse_journal' },
      { href: '/caisse-journal/archives', labelKey: 'nav_caisse_archives' },
    ],
  },
  {
    labelKey: 'nav_products',
    icon: Package,
    children: [
      { href: '/produits', labelKey: 'nav_products_list' },
      { href: '/produits/categories', labelKey: 'nav_products_categories' },
      { href: '/produits/sous-categories', labelKey: 'nav_products_subcategories' },
      { href: '/produits/marques', labelKey: 'nav_products_brands' },
      { href: '/produits/unites', labelKey: 'nav_products_units' },
      { href: '/produits/codes-barres', labelKey: 'nav_products_barcodes' },
      { href: '/produits/analyse', labelKey: 'nav_products_analysis' },
      { href: '/produits/declinaisons', labelKey: 'nav_products_variants' },
    ],
  },
  {
    labelKey: 'nav_stock',
    icon: Boxes,
    children: [
      {
        sectionKey: 'nav_stock_sec_overview',
        items: [
          { href: '/stock', labelKey: 'nav_stock_current' },
          { href: '/stock/par-magasin', labelKey: 'nav_stock_by_store' },
          { href: '/stock/par-depot', labelKey: 'nav_stock_by_depot' },
          { href: '/stock/consultation', labelKey: 'nav_stock_consult' },
        ],
      },
      {
        sectionKey: 'nav_stock_sec_init',
        items: [
          { href: '/stock/stock-initial', labelKey: 'nav_stock_initial' },
          { href: '/stock/stock-initial?mode=import', labelKey: 'nav_stock_import' },
          { href: '/stock/ajustement', labelKey: 'nav_stock_adjust' },
        ],
      },
      {
        sectionKey: 'nav_stock_sec_inventory',
        items: [
          { href: '/stock/inventaire', labelKey: 'nav_stock_inventory' },
          { href: '/stock/inventaire?scope=zone', labelKey: 'nav_stock_inv_zone' },
          { href: '/stock/inventaire?scope=emplacement', labelKey: 'nav_stock_inv_loc' },
          { href: '/stock/comptage', labelKey: 'nav_stock_quickcount' },
          { href: '/stock/ecarts', labelKey: 'nav_stock_variances' },
        ],
      },
      {
        sectionKey: 'nav_stock_sec_moves',
        items: [
          { href: '/achats/entrees-stock', labelKey: 'nav_stock_in' },
          { href: '/stock/mouvements?flux=sorties', labelKey: 'nav_stock_out' },
          { href: '/stock/mouvements', labelKey: 'nav_stock_history' },
          { href: '/stock/mouvements?vue=historique', labelKey: 'nav_stock_moves_history' },
          { href: '/stock/annulation', labelKey: 'nav_stock_cancel_move' },
        ],
      },
      {
        sectionKey: 'nav_stock_sec_transfers',
        items: [
          { href: '/stock/transferts/nouveau', labelKey: 'nav_stock_transfer_new' },
          { href: '/stock/transferts', labelKey: 'nav_stock_transfers' },
          { href: '/stock/transferts/details', labelKey: 'nav_stock_transfers_detail' },
          { href: '/stock/transferts?tab=reception', labelKey: 'nav_stock_transfer_recv' },
          { href: '/stock/transferts?tab=historique', labelKey: 'nav_stock_transfer_hist' },
        ],
      },
      {
        sectionKey: 'nav_stock_sec_reappro',
        items: [
          { href: '/stock/reapprovisionnement', labelKey: 'nav_stock_reappro' },
          { href: '/stock/critique', labelKey: 'nav_stock_critical' },
          { href: '/stock/suggestions', labelKey: 'nav_stock_suggestions' },
          { href: '/stock/previsions', labelKey: 'nav_stock_forecast' },
        ],
      },
      {
        sectionKey: 'nav_stock_sec_reports',
        items: [
          { href: '/stock/rapports/valorisation', labelKey: 'nav_stock_rep_value' },
          { href: '/stock/rapports/rotation', labelKey: 'nav_stock_rep_rotation' },
          { href: '/stock/rapports/historique', labelKey: 'nav_stock_rep_history' },
          { href: '/rapports/stock', labelKey: 'nav_stock_rep_state' },
          { href: '/stock/rapports/export', labelKey: 'nav_stock_rep_export' },
        ],
      },
      {
        sectionKey: 'nav_stock_sec_control',
        items: [
          { href: '/stock/controle/expires', labelKey: 'nav_stock_expired' },
          { href: '/stock/controle/negatif', labelKey: 'nav_stock_negative' },
          { href: '/stock/controle/sans-emplacement', labelKey: 'nav_stock_nolocation' },
          { href: '/stock/controle/dormants', labelKey: 'nav_stock_dormant' },
          { href: '/stock/controle/anomalies', labelKey: 'nav_stock_anomalies' },
        ],
      },
    ],
  },
  {
    labelKey: 'nav_purchases',
    icon: Truck,
    children: [
      { href: '/achats', labelKey: 'nav_purchases_orders' },
      { href: '/achats/bon-livraison', labelKey: 'nav_purchases_delivery' },
      { href: '/achats/reception', labelKey: 'nav_purchases_reception' },
      { href: '/achats/entrees-stock', labelKey: 'nav_purchases_stock_entries' },
      { href: '/achats/factures', labelKey: 'nav_purchases_invoices' },
      { href: '/achats/paiements', labelKey: 'nav_purchases_payments' },
      { href: '/achats/historique', labelKey: 'nav_purchases_history' },
      { href: '/achats/retours', labelKey: 'nav_purchases_returns' },
    ],
  },
  {
    labelKey: 'nav_sales',
    icon: ShoppingCart,
    children: [
      { href: '/ventes/devis', labelKey: 'nav_sales_quotes' },
      { href: '/ventes/bon-livraison', labelKey: 'nav_sales_delivery' },
      { href: '/ventes/factures', labelKey: 'nav_sales_invoices' },
      { href: '/ventes/avoirs', labelKey: 'nav_sales_credits' },
      { href: '/ventes/retours', labelKey: 'nav_sales_returns' },
      { href: '/clients/paiements', labelKey: 'nav_sales_payments' },
      { href: '/ventes', labelKey: 'nav_sales_history' },
    ],
  },
  {
    labelKey: 'nav_clients',
    icon: Users,
    children: [
      { href: '/clients', labelKey: 'nav_clients_list' },
      { href: '/clients/nouveau', labelKey: 'nav_clients_new' },
      { href: '/clients/historique', labelKey: 'nav_clients_history' },
      { href: '/clients/credits', labelKey: 'nav_clients_credits' },
      { href: '/clients/paiements', labelKey: 'nav_clients_payments' },
      { href: '/clients/fidelite', labelKey: 'nav_clients_loyalty' },
    ],
  },
  {
    labelKey: 'nav_suppliers',
    icon: Truck,
    children: [
      { href: '/fournisseurs', labelKey: 'nav_suppliers_list' },
      { href: '/fournisseurs/nouveau', labelKey: 'nav_suppliers_new' },
      { href: '/fournisseurs/historique', labelKey: 'nav_suppliers_history' },
      { href: '/fournisseurs/retours', labelKey: 'nav_suppliers_returns' },
      { href: '/achats/paiements', labelKey: 'nav_suppliers_payments' },
      { href: '/fournisseurs/soldes', labelKey: 'nav_suppliers_balances' },
    ],
  },
  {
    labelKey: 'nav_reports',
    icon: BarChart3,
    children: [
      {
        sectionKey: 'nav_rp_sec_stock',
        items: [
          { href: '/stock/rapports/valorisation', labelKey: 'nav_rp_valuation' },
          { href: '/stock/rapports/rotation', labelKey: 'nav_rp_rotation' },
          { href: '/stock/controle/ruptures', labelKey: 'nav_rp_out' },
          { href: '/stock/critique', labelKey: 'nav_rp_critical' },
        ],
      },
      {
        sectionKey: 'nav_rp_sec_purchases',
        items: [
          { href: '/rapports/achats', labelKey: 'nav_rp_purch_period' },
          { href: '/rapports/fournisseurs', labelKey: 'nav_rp_purch_supplier' },
          { href: '/rapports/produits-achetes', labelKey: 'nav_rp_purch_products' },
        ],
      },
      {
        sectionKey: 'nav_rp_sec_sales',
        items: [
          { href: '/rapports', labelKey: 'nav_rp_revenue' },
          { href: '/rapports/ventes', labelKey: 'nav_rp_sales_period' },
          { href: '/rapports/vendeurs', labelKey: 'nav_rp_sales_seller' },
          { href: '/rapports/produits-plus-vendus', labelKey: 'nav_rp_best_sellers' },
          { href: '/rapports/produits-moins-vendus', labelKey: 'nav_reports_worst_products' },
          { href: '/rapports/marge', labelKey: 'nav_reports_margin' },
        ],
      },
      {
        sectionKey: 'nav_rp_sec_clients',
        items: [
          { href: '/rapports/clients', labelKey: 'nav_rp_cli_balances' },
          { href: '/clients/credits', labelKey: 'nav_rp_cli_credits' },
          { href: '/clients/fidelite', labelKey: 'nav_rp_cli_loyalty' },
        ],
      },
      {
        sectionKey: 'nav_rp_sec_suppliers',
        items: [
          { href: '/fournisseurs/soldes', labelKey: 'nav_rp_sup_balances' },
          { href: '/fournisseurs/historique', labelKey: 'nav_rp_sup_history' },
        ],
      },
      {
        sectionKey: 'nav_rp_sec_cash',
        items: [
          { href: '/rapports/caisse', labelKey: 'nav_rp_cash_journal' },
          { href: '/recettes', labelKey: 'nav_rp_cash_in' },
          { href: '/depenses', labelKey: 'nav_rp_cash_out' },
        ],
      },
      {
        sectionKey: 'nav_rp_sec_inventory',
        items: [
          { href: '/stock/ecarts', labelKey: 'nav_rp_inv_gaps' },
          { href: '/stock/ajustement', labelKey: 'nav_rp_inv_adjust' },
        ],
      },
      {
        sectionKey: 'nav_rp_sec_stores',
        items: [
          { href: '/stock/par-magasin', labelKey: 'nav_rp_store_stock' },
          { href: '/rapports/magasins', labelKey: 'nav_rp_store_perf' },
        ],
      },
      {
        sectionKey: 'nav_rp_sec_users',
        items: [
          { href: '/utilisateurs/connexions', labelKey: 'nav_rp_usr_logins' },
          { href: '/utilisateurs/journal', labelKey: 'nav_rp_usr_activity' },
        ],
      },
    ],
  },
  {
    labelKey: 'nav_accounting',
    icon: Calculator,
    children: [
      { href: '/comptabilite/journaux', labelKey: 'nav_acc_journals' },
      { href: '/comptabilite/plan-comptable', labelKey: 'nav_acc_chart' },
      { href: '/comptabilite/tva', labelKey: 'nav_acc_vat' },
      { href: '/comptabilite/ecritures', labelKey: 'nav_acc_entries' },
      { href: '/comptabilite/reglements', labelKey: 'nav_acc_payments' },
      { href: '/comptabilite/banque', labelKey: 'nav_acc_bank' },
    ],
  },
  {
    labelKey: 'nav_alerts',
    icon: Bell,
    children: [
      { href: '/alertes?type=stock', labelKey: 'nav_alerts_stock' },
      { href: '/alertes?type=commandes', labelKey: 'nav_alerts_orders' },
      { href: '/alertes?type=paiements', labelKey: 'nav_alerts_payments' },
      { href: '/alertes?type=inventaires', labelKey: 'nav_alerts_inventory' },
      { href: '/alertes?type=sauvegardes', labelKey: 'nav_alerts_backups' },
    ],
  },
  {
    labelKey: 'nav_stores',
    icon: Building2,
    children: [
      {
        sectionKey: 'nav_st_sec_manage',
        items: [
          { href: '/magasins', labelKey: 'nav_stores_list' },
          { href: '/magasins/nouveau', labelKey: 'nav_stores_new' },
          { href: '/magasins/depots', labelKey: 'nav_stores_depots' },
          { href: '/magasins/utilisateurs', labelKey: 'nav_stores_users' },
          { href: '/magasins/parametres', labelKey: 'nav_stores_settings' },
        ],
      },
      {
        sectionKey: 'nav_st_sec_arch',
        items: [
          { href: '/magasins/plan', labelKey: 'nav_stores_plan' },
          { href: '/magasins/zones', labelKey: 'nav_stores_zones' },
          { href: '/magasins/allees', labelKey: 'nav_stores_allees' },
          { href: '/magasins/rayons', labelKey: 'nav_stores_rayons' },
          { href: '/magasins/etageres', labelKey: 'nav_stores_etageres' },
          { href: '/magasins/niveaux', labelKey: 'nav_stores_niveaux' },
          { href: '/magasins/emplacements', labelKey: 'nav_stores_emplacements' },
        ],
      },
      {
        sectionKey: 'nav_st_sec_ai',
        items: [
          { href: '/magasins/generateur', labelKey: 'nav_stores_generator' },
          { href: '/magasins/assistant-photos', labelKey: 'nav_stores_photo_wizard' },
          { href: '/magasins/affectation', labelKey: 'nav_stores_assign' },
          { href: '/magasins/explorateur', labelKey: 'nav_stores_explorer' },
        ],
      },
      {
        sectionKey: 'nav_st_sec_ops',
        items: [
          { href: '/magasins/guide-emplacements', labelKey: 'nav_stores_loc_guide' },
          { href: '/magasins/rangement', labelKey: 'nav_stores_rangement' },
          { href: '/magasins/deplacement', labelKey: 'nav_st_move' },
          { href: '/stock/inventaire?scope=emplacement', labelKey: 'nav_stock_inv_loc' },
        ],
      },
      {
        sectionKey: 'nav_st_sec_print',
        items: [
          { href: '/magasins/impression', labelKey: 'nav_st_labels' },
          { href: '/magasins/qr-codes', labelKey: 'nav_st_qr' },
          { href: '/magasins/plan?print=1', labelKey: 'nav_st_plan_print' },
          { href: '/produits/codes-barres', labelKey: 'nav_products_barcodes' },
        ],
      },
      {
        sectionKey: 'nav_st_sec_reports',
        items: [
          { href: '/magasins/rapports?report=occupancy', labelKey: 'nav_st_r_occupancy' },
          { href: '/magasins/rapports?report=by_position', labelKey: 'nav_st_r_by_position' },
          { href: '/magasins/rapports?report=empty_locations', labelKey: 'nav_st_r_empty' },
          { href: '/magasins/rapports?report=fill_rate', labelKey: 'nav_st_r_fill' },
        ],
      },
    ],
  },
  {
    labelKey: 'nav_users',
    icon: UserCog,
    children: [
      { href: '/utilisateurs/employes', labelKey: 'nav_users_employees' },
      { href: '/utilisateurs/roles', labelKey: 'nav_users_roles' },
      { href: '/utilisateurs/permissions', labelKey: 'nav_users_permissions' },
      { href: '/utilisateurs/journal', labelKey: 'nav_users_journal' },
    ],
  },
  {
    labelKey: 'nav_hr',
    icon: UsersRound,
    children: [
      {
        sectionKey: 'nav_hr_sec_employees',
        items: [
          { href: '/rh/employes', labelKey: 'nav_hr_list' },
          { href: '/rh/employes/nouveau', labelKey: 'nav_hr_new' },
          { href: '/rh/employes/dossier', labelKey: 'nav_hr_file' },
          { href: '/rh/employes/documents', labelKey: 'nav_hr_documents' },
          { href: '/rh/employes/historique', labelKey: 'nav_hr_history' },
        ],
      },
      {
        sectionKey: 'nav_hr_sec_attendance',
        items: [
          { href: '/rh/presence/pointage', labelKey: 'nav_hr_clock' },
          { href: '/rh/presence/presences', labelKey: 'nav_hr_present' },
          { href: '/rh/presence/absences', labelKey: 'nav_hr_absent' },
          { href: '/rh/presence/retards', labelKey: 'nav_hr_late' },
          { href: '/rh/presence/conges', labelKey: 'nav_hr_leaves' },
        ],
      },
      {
        sectionKey: 'nav_hr_sec_planning',
        items: [
          { href: '/rh/planning/horaires', labelKey: 'nav_hr_shifts' },
          { href: '/rh/planning/equipes', labelKey: 'nav_hr_teams' },
          { href: '/rh/planning/calendrier', labelKey: 'nav_hr_calendar' },
          { href: '/rh/planning/feries', labelKey: 'nav_hr_holidays' },
        ],
      },
      {
        sectionKey: 'nav_hr_sec_payroll',
        items: [
          { href: '/rh/paie/salaires', labelKey: 'nav_hr_salaries' },
          { href: '/rh/paie/primes', labelKey: 'nav_hr_bonuses' },
          { href: '/rh/paie/avances', labelKey: 'nav_hr_advances' },
          { href: '/rh/paie/deductions', labelKey: 'nav_hr_deductions' },
          { href: '/rh/paie/bulletins', labelKey: 'nav_hr_payslips' },
        ],
      },
      {
        sectionKey: 'nav_hr_sec_performance',
        items: [
          { href: '/rh/performance/evaluations', labelKey: 'nav_hr_evaluations' },
          { href: '/rh/performance/objectifs', labelKey: 'nav_hr_objectives' },
          { href: '/rh/performance/recompenses', labelKey: 'nav_hr_rewards' },
          { href: '/rh/performance/sanctions', labelKey: 'nav_hr_sanctions' },
        ],
      },
      {
        sectionKey: 'nav_hr_sec_training',
        items: [
          { href: '/rh/formation/formations', labelKey: 'nav_hr_trainings' },
          { href: '/rh/formation/competences', labelKey: 'nav_hr_skills' },
          { href: '/rh/formation/certifications', labelKey: 'nav_hr_certifications' },
        ],
      },
      {
        sectionKey: 'nav_hr_sec_recruitment',
        items: [
          { href: '/rh/recrutement/offres', labelKey: 'nav_hr_jobs' },
          { href: '/rh/recrutement/candidatures', labelKey: 'nav_hr_applications' },
          { href: '/rh/recrutement/entretiens', labelKey: 'nav_hr_interviews' },
          { href: '/rh/recrutement/embauches', labelKey: 'nav_hr_hires' },
        ],
      },
      {
        sectionKey: 'nav_hr_sec_security',
        items: [
          // Rôles, permissions et connexions existent déjà sous Utilisateurs :
          // ce sont les mêmes écrans, pas des copies.
          { href: '/utilisateurs/roles', labelKey: 'nav_hr_roles' },
          { href: '/utilisateurs/permissions', labelKey: 'nav_hr_permissions' },
          { href: '/rh/securite/badges', labelKey: 'nav_hr_badges' },
          { href: '/utilisateurs/connexions', labelKey: 'nav_hr_logins' },
        ],
      },
      {
        sectionKey: 'nav_hr_sec_reports',
        items: [
          { href: '/rh/rapports/effectif', labelKey: 'nav_hr_headcount' },
          { href: '/rh/rapports/presence', labelKey: 'nav_hr_rep_presence' },
          { href: '/rh/rapports/heures', labelKey: 'nav_hr_rep_hours' },
          { href: '/rh/rapports/masse-salariale', labelKey: 'nav_hr_payroll_mass' },
          { href: '/rh/rapports/export', labelKey: 'nav_hr_export' },
        ],
      },
    ],
  },
  {
    labelKey: 'nav_settings',
    icon: Settings,
    children: [
      { href: '/parametres/societe', labelKey: 'nav_settings_company' },
      { href: '/parametres/impression', labelKey: 'nav_settings_print' },
      { href: '/parametres/sauvegarde', labelKey: 'nav_settings_backup' },
      { href: '/parametres/theme', labelKey: 'nav_settings_theme' },
      { href: '/parametres/reinitialisation', labelKey: 'nav_settings_reset' },
      { href: '/parametres/remise-a-zero', labelKey: 'nav_settings_wipe' },
      { href: '/parametres/licences', labelKey: 'nav_settings_licenses' },
      { href: '/sync', labelKey: 'nav_settings_sync' },
      { href: '/parametres/administration', labelKey: 'nav_settings_admin' },
    ],
  },
]

/**
 * Ordre RÉEL du menu. Les entrées ci-dessus ne sont que des définitions : c'est
 * cette liste qui fixe l'ordre d'affichage et les familles. Le regroupement
 * suit l'usage — ce qu'on ouvre tous les jours d'abord, l'aide en dernier.
 */
const byKey = (k: TKey): NavItem => {
  const item = NAV_ALL.find((n) => n.labelKey === k)
  if (!item) throw new Error(`Sidebar: entrée de menu introuvable — ${k}`)
  return item
}
const fam = (familyKey: TKey, keys: TKey[]): NavFamily => ({ familyKey, items: keys.map(byKey) })

const NAV_FAMILIES: NavFamily[] = [
  fam('nav_fam_pilot', ['nav_dashboard']),
  fam('nav_fam_ops', ['nav_pos', 'nav_caisse', 'nav_products', 'nav_stock', 'nav_stores']),
  fam('nav_fam_commerce', ['nav_purchases', 'nav_sales', 'nav_clients', 'nav_suppliers']),
  fam('nav_fam_analysis', ['nav_reports', 'nav_accounting', 'nav_alerts']),
  fam('nav_fam_admin', ['nav_hr', 'nav_users', 'nav_settings']),
  fam('nav_fam_help', ['nav_setup', 'nav_guide', 'nav_guide_exercise']),
]

/** Vue à plat, pour les recherches « quel groupe contient la page courante ? ». */
const NAV: NavItem[] = NAV_FAMILIES.flatMap((f) => f.items)

const basePath = (href: string) => href.split('?')[0]

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentFull = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname
  const [expanded, setExpanded] = useState<string[]>([])
  const [cartCount, setCartCount] = useState(0)
  const [caisseOpen, setCaisseOpen] = useState(false)
  const { t } = useLanguage()
  const { can } = usePermissions()

  // Masquage des entrées selon les permissions de l'utilisateur connecté.
  const allowed = (c: NavChild) => can(ROUTE_PERM[basePath(c.href)])
  const visibleItems = (items: NavItem[]) =>
    items.map((item) => {
      if (!item.children) return item
      const children = item.children
        .map((e) => (isSection(e) ? { ...e, items: e.items.filter(allowed) } : e))
        .filter((e) => (isSection(e) ? e.items.length > 0 : allowed(e)))
      return { ...item, children }
    }).filter((item) => (item.children ? item.children.length > 0 : can(ROUTE_PERM[basePath(item.href ?? '/')])))

  // Une famille dont toutes les entrées sont masquées disparaît avec son
  // intertitre — sinon un caissier verrait « Administration » suivi de rien.
  const visibleFamilies = NAV_FAMILIES
    .map((f) => ({ ...f, items: visibleItems(f.items) }))
    .filter((f) => f.items.length > 0)

  useEffect(() => {
    const read = () => {
      try {
        const sessions: RegisterSession[] = JSON.parse(localStorage.getItem('dp_sessions') ?? '[]')
        const activeStore = JSON.parse(localStorage.getItem('dp_active_store') ?? '""')
        // The caisse state follows the active store's own register.
        setCaisseOpen(sessions.some((s) => !s.closedAt && (!activeStore || s.storeId === activeStore)))
      } catch {
        setCaisseOpen(false)
      }
    }
    read()
    window.addEventListener('droguerie-store-change', read)
    return () => window.removeEventListener('droguerie-store-change', read)
  }, [])

  useEffect(() => {
    const read = () => setCartCount(Number(sessionStorage.getItem('dp_cart_count') ?? '0'))
    read()
    window.addEventListener('droguerie-cart-change', read)
    return () => window.removeEventListener('droguerie-cart-change', read)
  }, [])

  // Auto-expand the group containing the current page (accordéon : seul ce groupe).
  useEffect(() => {
    const group = NAV.find((n) => leavesOf(n).some((c) => basePath(c.href) === pathname))
    if (group && !expanded.includes(group.labelKey)) {
      setExpanded([group.labelKey])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Accordéon : ouvrir un groupe ferme les autres. Reclic sur le groupe ouvert = fermé.
  const toggle = (label: string) =>
    setExpanded((e) => (e.includes(label) ? [] : [label]))

  // Quand un groupe s'ouvre, on fait défiler la barre latérale (son conteneur
  // uniquement, pas la page) pour révéler ses sous-menus — utile pour « Paramètres »
  // et « Utilisateurs » qui sont tout en bas.
  const navRef = useRef<HTMLElement>(null)
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})
  useEffect(() => {
    const key = expanded[0]
    const nav = navRef.current
    const el = key ? groupRefs.current[key] : null
    if (!nav || !el) return
    requestAnimationFrame(() => {
      const delta = el.getBoundingClientRect().bottom - nav.getBoundingClientRect().bottom
      if (delta > 0) nav.scrollTo({ top: nav.scrollTop + delta + 12, behavior: 'smooth' })
    })
  }, [expanded])

  const groupActive = (item: NavItem) => leavesOf(item).some((c) => basePath(c.href) === pathname)

  // Section ouverte (3e niveau). Par défaut : celle qui contient la page courante.
  const [openSection, setOpenSection] = useState<string | null>(null)
  useEffect(() => {
    for (const item of NAV) {
      for (const e of item.children ?? []) {
        if (isSection(e) && e.items.some((c) => basePath(c.href) === pathname)) {
          setOpenSection(e.sectionKey)
          return
        }
      }
    }
  }, [pathname])

  // Rendu d'une entrée finale (utilisé au 2e comme au 3e niveau).
  const renderLeaf = (c: NavChild) => {
    const childActive = c.href === currentFull
    const disabled =
      (c.labelKey === 'nav_pos_suspend' && cartCount === 0) ||
      (c.labelKey === 'nav_pos_resume' && cartCount > 0) ||
      (c.labelKey === 'nav_caisse_close' && !caisseOpen) ||
      (c.labelKey === 'nav_caisse_open' && caisseOpen) ||
      (c.labelKey === 'nav_caisse_endday' && caisseOpen)

    if (disabled) {
      const title =
        c.labelKey === 'nav_pos_suspend'
          ? 'Le panier est vide'
          : c.labelKey === 'nav_caisse_close'
            ? 'La caisse est déjà fermée'
            : c.labelKey === 'nav_caisse_open'
              ? 'La caisse est déjà ouverte'
              : c.labelKey === 'nav_caisse_endday'
                ? 'Fermez la caisse pour consulter la fin de journée'
                : 'Videz ou suspendez le panier actuel avant de reprendre une vente'
      return (
        <span
          key={c.href + c.labelKey}
          title={title}
          className="block cursor-not-allowed rounded-lg px-3 py-2 text-[13px] font-medium text-gray-300 dark:text-zinc-600"
        >
          {t(c.labelKey)}
        </span>
      )
    }

    return (
      <Link
        key={c.href + c.labelKey}
        href={c.href}
        onClick={onClose}
        className={`block rounded-lg px-3 py-2 text-[13px] transition-colors ${
          childActive
            ? 'bg-amber-50 font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
            : 'font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white'
        }`}
      >
        {t(c.labelKey)}
      </Link>
    )
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 dark:border-white/10 dark:bg-[#0d0d14] rtl:left-auto rtl:right-0 rtl:border-r-0 rtl:border-l ${
          open ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
        } lg:!translate-x-0`}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 px-5 dark:border-white/10">
          <Link href="/" className="flex items-center gap-3" onClick={onClose}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-400/30">
              <Store className="h-4 w-4 text-gray-900" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-white">
              Droguerie{' '}
              <span className="bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent">
                Pro
              </span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:text-zinc-500 dark:hover:bg-white/5 dark:hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav ref={navRef} className="flex-1 overflow-y-auto px-3 py-4">
          {visibleFamilies.map((family, fi) => (
          <div key={family.familyKey} className={`space-y-1 ${fi > 0 ? 'mt-5' : ''}`}>
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-300 dark:text-zinc-600">
              {t(family.familyKey)}
            </p>
            {family.items.map((item) => {
              if (!item.children) {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.labelKey}
                    href={item.href!}
                    onClick={onClose}
                    className={
                      active
                        ? 'group flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'
                        : 'group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white'
                    }
                  >
                    <item.icon
                      className={`h-[18px] w-[18px] ${
                        active
                          ? 'text-amber-500'
                          : 'text-gray-400 transition-colors group-hover:text-gray-600 dark:text-zinc-500 dark:group-hover:text-zinc-300'
                      }`}
                    />
                    <span className="flex-1">{t(item.labelKey)}</span>
                  </Link>
                )
              }

              const isOpen = expanded.includes(item.labelKey)
              const active = groupActive(item)
              return (
                <div key={item.labelKey} ref={(el) => { groupRefs.current[item.labelKey] = el }}>
                  <button
                    onClick={() => toggle(item.labelKey)}
                    className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? 'border-amber-200 bg-amber-50 font-semibold text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'
                        : 'border-transparent font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white'
                    }`}
                  >
                    <item.icon
                      className={`h-[18px] w-[18px] ${
                        active
                          ? 'text-amber-500'
                          : 'text-gray-400 transition-colors group-hover:text-gray-600 dark:text-zinc-500 dark:group-hover:text-zinc-300'
                      }`}
                    />
                    <span className="flex-1 text-left rtl:text-right">{t(item.labelKey)}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-gray-400 transition-transform dark:text-zinc-500 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="ml-[26px] mt-1 space-y-0.5 border-l border-gray-100 pl-3 dark:border-white/10 rtl:ml-0 rtl:mr-[26px] rtl:border-l-0 rtl:border-r rtl:pl-0 rtl:pr-3">
                      {item.children.map((entry) => {
                        if (!isSection(entry)) return renderLeaf(entry)
                        const secOpen = openSection === entry.sectionKey
                        const secActive = entry.items.some((c) => basePath(c.href) === pathname)
                        return (
                          <div key={entry.sectionKey}>
                            <button
                              onClick={() => setOpenSection(secOpen ? null : entry.sectionKey)}
                              className={`flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                                secActive
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300'
                              }`}
                            >
                              <span className="flex-1 text-left rtl:text-right">{t(entry.sectionKey)}</span>
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${secOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {secOpen && (
                              <div className="ml-2 space-y-0.5 border-l border-gray-100 pl-2 dark:border-white/10 rtl:ml-0 rtl:mr-2 rtl:border-l-0 rtl:border-r rtl:pl-0 rtl:pr-2">
                                {entry.items.map((c) => renderLeaf(c))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          ))}
        </nav>

        {/* Footer card */}
        <div className="shrink-0 p-4">
          <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 dark:border-amber-500/20 dark:from-amber-500/10 dark:to-yellow-500/[0.04]">
            <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-200/50 blur-2xl dark:bg-amber-500/10" />
            <Coins className="h-5 w-5 text-amber-500" />
            <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">{t('sidebar_footer_title')}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-zinc-400">
              {t('sidebar_footer_desc')}
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
