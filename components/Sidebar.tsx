'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  ChevronDown,
  Coins,
  LayoutDashboard,
  Monitor,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import type { RegisterSession } from '@/lib/store'
import { useLanguage, type TKey } from '@/lib/i18n'

interface NavChild {
  href: string
  labelKey: TKey
}

interface NavItem {
  labelKey: TKey
  icon: LucideIcon
  href?: string
  children?: NavChild[]
}

const NAV: NavItem[] = [
  { labelKey: 'nav_dashboard', icon: LayoutDashboard, href: '/' },
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
    ],
  },
  {
    labelKey: 'nav_stock',
    icon: Boxes,
    children: [
      { href: '/stock', labelKey: 'nav_stock_current' },
      { href: '/stock/par-magasin', labelKey: 'nav_stock_by_store' },
      { href: '/stock/inventaire', labelKey: 'nav_stock_inventory' },
      { href: '/stock/mouvements', labelKey: 'nav_stock_history' },
      { href: '/stock/transferts', labelKey: 'nav_stock_transfers' },
      { href: '/stock/transferts/details', labelKey: 'nav_stock_transfers_detail' },
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
      { href: '/rapports', labelKey: 'nav_reports_overview' },
      { href: '/rapports/ventes', labelKey: 'nav_reports_sales' },
      { href: '/rapports/achats', labelKey: 'nav_reports_purchases' },
      { href: '/rapports/stock', labelKey: 'nav_reports_stock' },
      { href: '/rapports/produits-plus-vendus', labelKey: 'nav_reports_top_products' },
      { href: '/rapports/produits-moins-vendus', labelKey: 'nav_reports_worst_products' },
      { href: '/rapports/marge', labelKey: 'nav_reports_margin' },
      { href: '/rapports/fournisseurs', labelKey: 'nav_reports_suppliers' },
      { href: '/rapports/clients', labelKey: 'nav_reports_clients' },
      { href: '/rapports/caisse', labelKey: 'nav_reports_cash' },
    ],
  },
  { labelKey: 'nav_alerts', icon: Bell, href: '/alertes' },
  {
    labelKey: 'nav_stores',
    icon: Building2,
    children: [
      { href: '/magasins', labelKey: 'nav_stores_list' },
      { href: '/magasins/nouveau', labelKey: 'nav_stores_new' },
      { href: '/magasins/depots', labelKey: 'nav_stores_depots' },
      { href: '/magasins/utilisateurs', labelKey: 'nav_stores_users' },
      { href: '/magasins/parametres', labelKey: 'nav_stores_settings' },
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
    labelKey: 'nav_settings',
    icon: Settings,
    children: [
      { href: '/parametres/societe', labelKey: 'nav_settings_company' },
      { href: '/parametres/magasin', labelKey: 'nav_settings_store' },
      { href: '/parametres/tva', labelKey: 'nav_settings_tva' },
      { href: '/parametres/devise', labelKey: 'nav_settings_currency' },
      { href: '/parametres/impression', labelKey: 'nav_settings_print' },
      { href: '/parametres/sauvegarde', labelKey: 'nav_settings_backup' },
      { href: '/parametres/import-excel', labelKey: 'nav_settings_import' },
      { href: '/parametres/export-excel', labelKey: 'nav_settings_export' },
      { href: '/parametres/theme', labelKey: 'nav_settings_theme' },
      { href: '/parametres/reinitialisation', labelKey: 'nav_settings_reset' },
      { href: '/parametres/licences', labelKey: 'nav_settings_licenses' },
      { href: '/parametres/administration', labelKey: 'nav_settings_admin' },
    ],
  },
]

const basePath = (href: string) => href.split('?')[0]

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentFull = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname
  const [expanded, setExpanded] = useState<string[]>([])
  const [cartCount, setCartCount] = useState(0)
  const [caisseOpen, setCaisseOpen] = useState(false)
  const { t } = useLanguage()

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

  // Auto-expand the group containing the current page
  useEffect(() => {
    const group = NAV.find((n) => n.children?.some((c) => basePath(c.href) === pathname))
    if (group && !expanded.includes(group.labelKey)) {
      setExpanded((e) => [...e, group.labelKey])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const toggle = (label: string) =>
    setExpanded((e) => (e.includes(label) ? e.filter((x) => x !== label) : [...e, label]))

  const groupActive = (item: NavItem) =>
    item.children?.some((c) => basePath(c.href) === pathname) ?? false

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
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {NAV.map((item) => {
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
                <div key={item.labelKey}>
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
                      {item.children.map((c) => {
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
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
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
