import type { Settings } from '@/lib/store'

// Assistant de configuration (Setup Wizard) — définition des étapes et
// détection de l'achèvement à partir des données réelles de l'application.

export type StepKey =
  | 'societe' | 'fiscal' | 'materiel' | 'magasins' | 'utilisateurs' | 'paiement'
  | 'fournisseurs' | 'clients' | 'produits' | 'codesbarres' | 'wms'
  | 'stockinitial' | 'verification' | 'sauvegarde'

export interface StepMeta {
  key: StepKey
  icon: string          // nom d'icône lucide
  fr: string
  ar: string
  /** Étape obligatoire : bloque la progression tant qu'elle n'est pas terminée. */
  required: boolean
}

export const SETUP_STEPS: StepMeta[] = [
  { key: 'societe',      icon: 'Building2',    fr: 'Société',            ar: 'الشركة',          required: true },
  { key: 'fiscal',       icon: 'Percent',      fr: 'Paramètres fiscaux', ar: 'الإعدادات الجبائية', required: true },
  { key: 'materiel',     icon: 'Printer',      fr: 'Matériel',           ar: 'العتاد',          required: false },
  { key: 'magasins',     icon: 'Store',        fr: 'Magasins & Dépôts',  ar: 'المتاجر والمستودعات', required: true },
  { key: 'utilisateurs', icon: 'Users',        fr: 'Utilisateurs',       ar: 'المستخدمون',      required: true },
  { key: 'paiement',     icon: 'CreditCard',   fr: 'Modes de paiement',  ar: 'طرق الدفع',       required: true },
  { key: 'fournisseurs', icon: 'Truck',        fr: 'Fournisseurs',       ar: 'الموردون',        required: false },
  { key: 'clients',      icon: 'UserPlus',     fr: 'Clients',            ar: 'العملاء',         required: false },
  { key: 'produits',     icon: 'Package',      fr: 'Produits',           ar: 'المنتجات',        required: true },
  { key: 'codesbarres',  icon: 'Barcode',      fr: 'Codes-barres',       ar: 'الرموز الشريطية', required: false },
  { key: 'wms',          icon: 'MapPin',       fr: 'Emplacements (WMS)',  ar: 'المواقع (WMS)',   required: false },
  { key: 'stockinitial', icon: 'Boxes',        fr: 'Stock initial',      ar: 'المخزون الأولي',  required: false },
  { key: 'verification', icon: 'ListChecks',   fr: 'Vérification finale', ar: 'التحقق النهائي',  required: true },
  { key: 'sauvegarde',   icon: 'Save',         fr: 'Sauvegarde',         ar: 'النسخ الاحتياطي', required: true },
]

export interface SetupCtx {
  settings: Settings
  storesCount: number
  usersCount: number
  suppliersCount: number
  clientsCount: number
  productsCount: number
  barcodedCount: number
  zonesCount: number
  stockInitDone: boolean
}

const flag = (s: Settings, k: string) => !!s.setup?.done?.includes(k)

/** Une étape est-elle terminée ? (données réelles + drapeaux de validation). */
export function isStepDone(key: StepKey, c: SetupCtx): boolean {
  const s = c.settings
  switch (key) {
    case 'societe':      return !!s.storeName?.trim() && !!s.phone?.trim() && !!(s.city || s.address)?.trim()
    case 'fiscal':       return flag(s, 'fiscal') && typeof s.tva === 'number' && !!s.invoicePrefix
    case 'materiel':     return flag(s, 'materiel')
    case 'magasins':     return c.storesCount >= 1
    case 'utilisateurs': return c.usersCount >= 1
    case 'paiement':     return (s.paymentModes?.length ?? 0) >= 1
    case 'fournisseurs': return c.suppliersCount >= 1 || flag(s, 'fournisseurs')
    case 'clients':      return c.clientsCount >= 1 || flag(s, 'clients')
    case 'produits':     return c.productsCount >= 1
    case 'codesbarres':  return c.barcodedCount >= 1 || flag(s, 'codesbarres')
    case 'wms':          return c.zonesCount >= 1 || flag(s, 'wms')
    case 'stockinitial': return c.stockInitDone || flag(s, 'stockinitial')
    case 'sauvegarde':   return flag(s, 'sauvegarde')
    case 'verification':
      // Terminée quand toutes les étapes obligatoires (hors elle-même) le sont.
      return SETUP_STEPS
        .filter((st) => st.required && st.key !== 'verification')
        .every((st) => isStepDone(st.key, c))
  }
}

/** Nombre d'étapes terminées (pour la barre de progression). */
export function doneCount(c: SetupCtx): number {
  return SETUP_STEPS.filter((st) => isStepDone(st.key, c)).length
}
