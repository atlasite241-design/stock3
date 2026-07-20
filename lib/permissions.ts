// Catalogue complet des permissions (droguerie multi-magasins).
// Labels bilingues intégrés pour éviter 160 clés i18n distinctes.

export type Lang = 'fr' | 'ar'
export interface Perm {
  key: string
  fr: string
  ar: string
}
export interface PermCategory {
  key: string
  fr: string
  ar: string
  icon: string // nom d'icône lucide (résolu dans la page)
  perms: Perm[]
}

export const PERMISSION_CATALOG: PermCategory[] = [
  {
    key: 'prod', fr: 'Produits', ar: 'المنتجات', icon: 'Package',
    perms: [
      { key: 'prod.view', fr: 'Voir les produits', ar: 'عرض المنتجات' },
      { key: 'prod.add', fr: 'Ajouter un produit', ar: 'إضافة منتج' },
      { key: 'prod.edit', fr: 'Modifier un produit', ar: 'تعديل منتج' },
      { key: 'prod.delete', fr: 'Supprimer un produit', ar: 'حذف منتج' },
      { key: 'prod.view_buy', fr: "Voir les prix d'achat", ar: 'عرض أسعار الشراء' },
      { key: 'prod.view_sell', fr: 'Voir les prix de vente', ar: 'عرض أسعار البيع' },
      { key: 'prod.edit_price', fr: 'Modifier les prix', ar: 'تعديل الأسعار' },
      { key: 'prod.scan', fr: 'Scanner un code-barres', ar: 'مسح الرمز الشريطي' },
      { key: 'prod.print_label', fr: 'Imprimer une étiquette', ar: 'طباعة ملصق' },
    ],
  },
  {
    key: 'sale', fr: 'Ventes', ar: 'المبيعات', icon: 'ShoppingCart',
    perms: [
      { key: 'sale.create', fr: 'Créer une vente', ar: 'إنشاء عملية بيع' },
      { key: 'sale.edit', fr: 'Modifier une vente', ar: 'تعديل عملية بيع' },
      { key: 'sale.cancel', fr: 'Annuler une vente', ar: 'إلغاء عملية بيع' },
      { key: 'sale.delete', fr: 'Supprimer une vente', ar: 'حذف عملية بيع' },
      { key: 'sale.print_invoice', fr: 'Imprimer une facture', ar: 'طباعة فاتورة' },
      { key: 'sale.print_ticket', fr: 'Imprimer un ticket', ar: 'طباعة تذكرة' },
      { key: 'sale.quote_create', fr: 'Créer un devis', ar: 'إنشاء عرض سعر' },
      { key: 'sale.quote_convert', fr: 'Convertir un devis en facture', ar: 'تحويل عرض سعر إلى فاتورة' },
      { key: 'sale.return', fr: 'Effectuer un retour', ar: 'إجراء إرجاع' },
      { key: 'sale.credit_note', fr: 'Créer un avoir', ar: 'إنشاء إشعار دائن' },
      { key: 'sale.history', fr: "Consulter l'historique des ventes", ar: 'الاطلاع على سجل المبيعات' },
    ],
  },
  {
    key: 'cash', fr: 'Caisse', ar: 'الصندوق', icon: 'Wallet',
    perms: [
      { key: 'cash.open', fr: 'Ouvrir la caisse', ar: 'فتح الصندوق' },
      { key: 'cash.close', fr: 'Fermer la caisse', ar: 'إغلاق الصندوق' },
      { key: 'cash.in', fr: 'Encaisser', ar: 'التحصيل' },
      { key: 'cash.refund', fr: 'Effectuer un remboursement', ar: 'إجراء استرداد' },
      { key: 'cash.journal', fr: 'Consulter le journal de caisse', ar: 'الاطلاع على يومية الصندوق' },
      { key: 'cash.cancel_payment', fr: 'Annuler un paiement', ar: 'إلغاء دفعة' },
      { key: 'cash.balance', fr: 'Voir le solde de caisse', ar: 'عرض رصيد الصندوق' },
    ],
  },
  {
    key: 'client', fr: 'Clients', ar: 'العملاء', icon: 'Users',
    perms: [
      { key: 'client.view', fr: 'Voir les clients', ar: 'عرض العملاء' },
      { key: 'client.add', fr: 'Ajouter un client', ar: 'إضافة عميل' },
      { key: 'client.edit', fr: 'Modifier un client', ar: 'تعديل عميل' },
      { key: 'client.delete', fr: 'Supprimer un client', ar: 'حذف عميل' },
      { key: 'client.credit_view', fr: 'Voir les crédits', ar: 'عرض الديون' },
      { key: 'client.credit_add', fr: 'Ajouter un crédit', ar: 'إضافة دين' },
      { key: 'client.credit_collect', fr: 'Encaisser un crédit', ar: 'تحصيل دين' },
      { key: 'client.loyalty_view', fr: 'Voir la fidélité', ar: 'عرض الوفاء' },
      { key: 'client.loyalty_edit', fr: 'Modifier les points fidélité', ar: 'تعديل نقاط الوفاء' },
    ],
  },
  {
    key: 'supp', fr: 'Fournisseurs', ar: 'الموردون', icon: 'Truck',
    perms: [
      { key: 'supp.view', fr: 'Voir les fournisseurs', ar: 'عرض الموردين' },
      { key: 'supp.add', fr: 'Ajouter un fournisseur', ar: 'إضافة مورد' },
      { key: 'supp.edit', fr: 'Modifier un fournisseur', ar: 'تعديل مورد' },
      { key: 'supp.delete', fr: 'Supprimer un fournisseur', ar: 'حذف مورد' },
      { key: 'supp.balances', fr: 'Consulter les soldes', ar: 'الاطلاع على الأرصدة' },
      { key: 'supp.payments', fr: 'Consulter les paiements', ar: 'الاطلاع على المدفوعات' },
    ],
  },
  {
    key: 'purch', fr: 'Achats', ar: 'المشتريات', icon: 'ClipboardList',
    perms: [
      { key: 'purch.request', fr: "Demande d'achat", ar: 'طلب شراء' },
      { key: 'purch.order', fr: 'Bon de commande', ar: 'سند طلبية' },
      { key: 'purch.reception', fr: 'Bon de réception', ar: 'سند استلام' },
      { key: 'purch.delivery', fr: 'Bon de livraison fournisseur', ar: 'سند تسليم المورد' },
      { key: 'purch.invoice', fr: 'Facture fournisseur', ar: 'فاتورة المورد' },
      { key: 'purch.return', fr: 'Retour fournisseur', ar: 'إرجاع للمورد' },
      { key: 'purch.payment', fr: 'Paiement fournisseur', ar: 'دفع للمورد' },
    ],
  },
  {
    key: 'stock', fr: 'Stock', ar: 'المخزون', icon: 'Boxes',
    perms: [
      { key: 'stock.view', fr: 'Voir le stock', ar: 'عرض المخزون' },
      { key: 'stock.critical', fr: 'Consulter le stock critique', ar: 'الاطلاع على المخزون الحرج' },
      { key: 'stock.inventory', fr: 'Effectuer un inventaire', ar: 'إجراء جرد' },
      { key: 'stock.adjust', fr: 'Ajuster le stock', ar: 'تعديل المخزون' },
      { key: 'stock.entry', fr: 'Entrée de stock', ar: 'إدخال مخزون' },
      { key: 'stock.exit', fr: 'Sortie de stock', ar: 'إخراج مخزون' },
      { key: 'stock.restock', fr: 'Réapprovisionnement', ar: 'إعادة التموين' },
      { key: 'stock.reception', fr: 'Réception fournisseur', ar: 'استلام المورد' },
      { key: 'stock.transfer', fr: 'Transfert entre magasins', ar: 'التحويل بين المتاجر' },
      { key: 'stock.transfer_validate', fr: 'Valider un transfert', ar: 'التحقق من تحويل' },
      { key: 'stock.transfer_cancel', fr: 'Annuler un transfert', ar: 'إلغاء تحويل' },
      { key: 'stock.movements', fr: 'Voir les mouvements de stock', ar: 'عرض حركات المخزون' },
      { key: 'stock.manual_edit', fr: 'Modifier le stock manuellement', ar: 'تعديل المخزون يدويًا' },
    ],
  },
  {
    key: 'report', fr: 'Rapports', ar: 'التقارير', icon: 'BarChart3',
    perms: [
      { key: 'report.sales', fr: 'Rapport des ventes', ar: 'تقرير المبيعات' },
      { key: 'report.purchases', fr: 'Rapport des achats', ar: 'تقرير المشتريات' },
      { key: 'report.stock', fr: 'Rapport du stock', ar: 'تقرير المخزون' },
      { key: 'report.margins', fr: 'Rapport des marges', ar: 'تقرير الهوامش' },
      { key: 'report.profits', fr: 'Rapport des bénéfices', ar: 'تقرير الأرباح' },
      { key: 'report.expenses', fr: 'Rapport des dépenses', ar: 'تقرير المصاريف' },
      { key: 'report.clients', fr: 'Rapport des clients', ar: 'تقرير العملاء' },
      { key: 'report.suppliers', fr: 'Rapport des fournisseurs', ar: 'تقرير الموردين' },
      { key: 'report.export_excel', fr: 'Export Excel', ar: 'تصدير Excel' },
      { key: 'report.export_pdf', fr: 'Export PDF', ar: 'تصدير PDF' },
    ],
  },
  {
    key: 'set', fr: 'Paramètres', ar: 'الإعدادات', icon: 'Settings',
    perms: [
      { key: 'set.company', fr: 'Paramètres société', ar: 'إعدادات الشركة' },
      { key: 'set.store', fr: 'Paramètres magasin', ar: 'إعدادات المتجر' },
      { key: 'set.tva', fr: 'Paramètres TVA', ar: 'إعدادات الضريبة' },
      { key: 'set.print', fr: 'Paramètres impression', ar: 'إعدادات الطباعة' },
      { key: 'set.backup', fr: 'Sauvegarde', ar: 'النسخ الاحتياطي' },
      { key: 'set.restore', fr: 'Restauration', ar: 'الاستعادة' },
      { key: 'set.sync', fr: 'Synchronisation', ar: 'المزامنة' },
      { key: 'set.import', fr: 'Import Excel', ar: 'استيراد Excel' },
      { key: 'set.export', fr: 'Export Excel', ar: 'تصدير Excel' },
      { key: 'set.currency', fr: 'Gestion des devises', ar: 'إدارة العملات' },
      { key: 'set.users', fr: 'Gestion des utilisateurs', ar: 'إدارة المستخدمين' },
      { key: 'set.roles', fr: 'Gestion des rôles', ar: 'إدارة الأدوار' },
      { key: 'set.permissions', fr: 'Gestion des permissions', ar: 'إدارة الصلاحيات' },
      { key: 'set.reset_stats', fr: 'Réinitialisation des statistiques', ar: 'إعادة تعيين الإحصائيات' },
    ],
  },
]

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_CATALOG.flatMap((c) => c.perms.map((p) => p.key))

export type RoleName = 'Administrateur' | 'Gérant' | 'Magasinier' | 'Caissier' | 'Vendeur'
export const ROLE_NAMES: RoleName[] = ['Administrateur', 'Gérant', 'Magasinier', 'Caissier', 'Vendeur']

// helper : toutes les clés d'une catégorie
const cat = (k: string) => PERMISSION_CATALOG.find((c) => c.key === k)?.perms.map((p) => p.key) ?? []

// Permissions par défaut par rôle.
export const ROLE_DEFAULT_PERMISSIONS: Record<RoleName, string[]> = {
  // Administrateur : tout.
  Administrateur: [...ALL_PERMISSION_KEYS],

  // Gérant : tout sauf les paramètres système critiques.
  Gérant: ALL_PERMISSION_KEYS.filter(
    (k) => !['set.users', 'set.roles', 'set.permissions', 'set.restore', 'set.reset_stats', 'set.sync'].includes(k)
  ),

  // Magasinier : produits (sans prix), achats, stock/inventaire/ajust/mouvements/transferts, fournisseurs (lecture).
  Magasinier: [
    'prod.view', 'prod.add', 'prod.edit', 'prod.delete', 'prod.scan', 'prod.print_label', 'prod.view_buy', 'prod.view_sell',
    ...cat('purch'),
    ...cat('stock'),
    'supp.view', 'supp.balances', 'supp.payments',
    'report.stock', 'report.purchases',
  ],

  // Caissier : vente, encaissement, caisse, tickets, produits (lecture), stock (lecture), ajout clients.
  Caissier: [
    'prod.view', 'prod.view_sell', 'prod.scan',
    'sale.create', 'sale.print_ticket', 'sale.print_invoice', 'sale.history', 'sale.return',
    'cash.open', 'cash.close', 'cash.in', 'cash.refund', 'cash.journal', 'cash.balance',
    'stock.view', 'stock.critical',
    'client.view', 'client.add', 'client.credit_view', 'client.loyalty_view',
  ],

  // Vendeur : produits (lecture), devis, préparation de ventes, clients (lecture), stock (lecture).
  Vendeur: [
    'prod.view', 'prod.view_sell', 'prod.scan',
    'sale.create', 'sale.quote_create', 'sale.history',
    'client.view',
    'stock.view',
  ],
}

// L'Administrateur conserve toujours ces permissions (anti-verrouillage).
export const LOCKED_ADMIN_PERMISSIONS: string[] = ['set.users', 'set.roles', 'set.permissions']

/** Permissions effectives d'un utilisateur : override individuel s'il existe (tableau, même vide), sinon défauts du rôle (éventuellement personnalisés en base). */
export function effectivePermissions(
  userPermissions: string[] | undefined,
  role: RoleName,
  rolePermissions?: Record<string, string[]>
): Set<string> {
  if (Array.isArray(userPermissions)) return new Set(userPermissions)
  const fromRole = rolePermissions?.[role] ?? ROLE_DEFAULT_PERMISSIONS[role] ?? []
  return new Set(fromRole)
}

export function labelOf(key: string, lang: Lang): string {
  for (const c of PERMISSION_CATALOG) {
    const p = c.perms.find((x) => x.key === key)
    if (p) return p[lang]
  }
  return key
}
