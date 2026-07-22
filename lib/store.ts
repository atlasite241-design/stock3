'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { bootstrapFromRemote, startSync, syncOnSave } from './sync'
import { tursoConfigured } from './turso'
import { getSession } from './auth'
import { initProductCache, productsRemove, storageGet, storageSet } from './pstore'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface Store {
  id: string
  name: string
  code: string
  address: string
  city: string
  phone: string
  email: string
  manager: string
  logoDataUrl: string
  ice: string
  idFiscal: string
  docPrefix: string
  active: boolean
  createdAt: string
}

export interface Depot {
  id: string
  storeId: string
  name: string
  address: string
  responsable: string
}

export interface Product {
  id: string
  name: string
  barcode: string
  category: string
  subcategory?: string
  brand: string
  unit: string
  price: number
  cost: number
  stock: number
  minStock: number
  image?: string
  storeId?: string
  /** Quantity locked by validated (not-yet-shipped) transfers. available = stock - reserved. */
  reserved?: number
  lot?: string
  serial?: string
}

/** Physical stock minus quantities reserved by pending transfers. */
export const availableStock = (p: Product) => Math.max(0, p.stock - (p.reserved ?? 0))

export interface SaleItem {
  productId: string
  name: string
  price: number
  qty: number
}

export interface Sale {
  id: string
  date: string
  items: SaleItem[]
  total: number
  profit: number
  payment: 'especes' | 'carte' | 'credit' | 'mixte'
  clientId?: string
  clientName?: string
  storeId?: string
}

export interface Client {
  id: string
  name: string
  phone: string
  email: string
  address: string
  city: string
  cin: string
  clientType: 'Particulier' | 'Professionnel' | 'VIP'
  creditLimit: number
  notes: string
  creditDueDate?: string
  discountBalance: number
  credit: number
  totalSpent: number
  points: number
  creditAllowed?: boolean
  paymentTermDays?: number
  image?: string
}

export interface ClientPayment {
  id: string
  date: string
  clientId: string
  clientName: string
  amount: number
  method: 'especes' | 'carte' | 'virement' | 'cheque'
  note: string
  storeId?: string
}

export interface CreditInstalment {
  id: string
  date: string
  amount: number
  method: 'especes' | 'carte' | 'virement' | 'cheque'
  note: string
}

export interface Credit {
  id: string
  ref: string
  date: string
  clientId: string
  clientName: string
  saleId: string
  invoiceRef: string
  items: SaleItem[]
  amount: number
  paid: number
  dueDate: string
  payments: CreditInstalment[]
  storeId?: string
}

export type CreditStatus = 'paye' | 'partiel' | 'retard' | 'non_paye'

export function creditStatus(c: Credit, now: Date = new Date()): CreditStatus {
  const remaining = c.amount - c.paid
  if (remaining <= 0.001) return 'paye'
  if (c.dueDate && new Date(c.dueDate) < now) return 'retard'
  if (c.paid > 0) return 'partiel'
  return 'non_paye'
}

export function daysLate(c: Credit, now: Date = new Date()): number {
  if (c.amount - c.paid <= 0.001 || !c.dueDate) return 0
  const due = new Date(c.dueDate)
  if (due >= now) return 0
  return Math.floor((now.getTime() - due.getTime()) / 86400000)
}

export interface LoyaltyMovement {
  id: string
  date: string
  clientId: string
  clientName: string
  type: 'gain' | 'utilisation'
  points: number
  note: string
  storeId?: string
}

export interface SupplierPayment {
  id: string
  date: string
  supplierId: string
  supplierName: string
  amount: number
  method: 'especes' | 'carte' | 'virement' | 'cheque'
  note: string
  storeId?: string
}

export interface Supplier {
  id: string
  name: string
  phone: string
  address: string
  balance: number
  totalPurchased: number
}

export interface StockMovement {
  id: string
  date: string
  productId: string
  productName: string
  type: 'entree' | 'sortie' | 'ajustement' | 'vente' | 'reception' | 'retour' | 'inventaire' | 'transfert_out' | 'transfert_in' | 'stock_initial'
  qty: number
  note: string
  storeId?: string
}

export interface PurchaseItem {
  productId: string
  name: string
  barcode?: string
  sku?: string
  cost: number
  qty: number
  discount?: number
  tva?: number
  deliveredQty?: number
  receivedQty?: number
  receptionState?: 'conforme' | 'manquant' | 'endommage'
  receptionNote?: string
}

export interface Purchase {
  id: string
  ref: string
  date: string
  supplierId: string
  supplierName: string
  supplierRef?: string
  expectedDate?: string
  note?: string
  globalDiscount?: number
  items: PurchaseItem[]
  total: number
  paid: number
  status: 'en_attente' | 'partiellement_recue' | 'recue' | 'retournee'
  blRef?: string
  blDate?: string
  blCarrier?: string
  blNote?: string
  brRef?: string
  brDate?: string
  brEmployee?: string
  brDepot?: string
  storeId?: string
}

export interface Quote {
  id: string
  ref: string
  date: string
  clientName: string
  items: SaleItem[]
  total: number
  status: 'en_attente' | 'accepte' | 'refuse' | 'converti'
  storeId?: string
}

export interface SaleReturn {
  id: string
  date: string
  saleId: string
  clientName: string
  items: SaleItem[]
  total: number
  method: 'especes' | 'avoir'
  storeId?: string
}

export interface CashEntry {
  id: string
  date: string
  type: 'depense' | 'recette'
  label: string
  amount: number
  storeId?: string
}

export interface SessionSummary {
  salesEspeces: number
  salesCarte: number
  salesVirement: number
  salesCredit: number
  otherCashIn: number
  depenses: number
  retraits: number
}

export interface RegisterSession {
  id: string
  openedAt: string
  openingAmount: number
  closedAt?: string
  closingAmount?: number
  expectedAmount?: number
  summary?: SessionSummary
  storeId?: string
}

const isBankTransfer = (label: string) => label.startsWith('Transfert') || label.startsWith('تحويل')

/** End-of-day breakdown for a register session (window = openedAt → closedAt|now). */
export function computeSessionSummary(
  session: RegisterSession,
  sales: Sale[],
  cash: CashEntry[],
  clientPayments: ClientPayment[]
): SessionSummary {
  const since = session.openedAt
  const until = session.closedAt ?? new Date().toISOString()
  const inW = (d: string) => d >= since && d <= until
  const modeTotal = (m: Sale['payment']) => sales.filter((s) => inW(s.date) && s.payment === m).reduce((a, s) => a + s.total, 0)
  const sCash = cash.filter((c) => inW(c.date))
  return {
    salesEspeces: modeTotal('especes') + modeTotal('mixte'),
    salesCarte: modeTotal('carte'),
    salesVirement: clientPayments.filter((p) => inW(p.date) && p.method === 'virement').reduce((a, p) => a + p.amount, 0),
    salesCredit: modeTotal('credit'),
    otherCashIn: sCash.filter((c) => c.type === 'recette').reduce((a, c) => a + c.amount, 0),
    depenses: sCash.filter((c) => c.type === 'depense' && !isBankTransfer(c.label)).reduce((a, c) => a + c.amount, 0),
    retraits: sCash.filter((c) => c.type === 'depense' && isBankTransfer(c.label)).reduce((a, c) => a + c.amount, 0),
  }
}

export function sessionExpected(session: RegisterSession, s: SessionSummary): number {
  return session.openingAmount + s.salesEspeces + s.otherCashIn - s.depenses - s.retraits
}

export interface AppUser {
  id: string
  name: string
  phone: string
  role: 'Administrateur' | 'Gérant' | 'Magasinier' | 'Caissier' | 'Vendeur'
  active: boolean
  /** Override individuel des permissions (clés du catalogue). Si défini, remplace les permissions du rôle. */
  permissions?: string[]
  storeId?: string
  storeIds?: string[]
  email?: string
  passwordHash?: string
  pinHash?: string
  /** Demande de compte en attente d'approbation par un administrateur. */
  pendingApproval?: boolean
  /** Mot de passe temporaire : changement obligatoire à la prochaine connexion. */
  mustChangePassword?: boolean
  /** Clé de la question de sécurité choisie à l'inscription (q1…q5). */
  securityQuestion?: string
  /** Hash de la réponse de sécurité (récupération de mot de passe). */
  securityAnswerHash?: string
}

export const USER_ROLES: AppUser['role'][] = ['Administrateur', 'Gérant', 'Magasinier', 'Caissier', 'Vendeur']

/** Store ids a user may access. Administrators see all stores. */
export function userStoreAccess(user: AppUser | null | undefined, stores: Store[]): string[] {
  if (!user || user.role === 'Administrateur') return stores.map((s) => s.id)
  const ids = user.storeIds && user.storeIds.length ? user.storeIds : user.storeId ? [user.storeId] : []
  return ids.filter((id) => stores.some((s) => s.id === id))
}

export function canSwitchStore(user: AppUser | null | undefined, stores: Store[]): boolean {
  return userStoreAccess(user, stores).length > 1
}

export interface ActivityLog {
  id: string
  date: string
  user: string
  action: string
  /** Magasin où l'action a eu lieu. */
  storeId?: string
  storeName?: string
  /** Élément concerné (ex. nom du produit, du rôle, de l'utilisateur). */
  target?: string
  /** Ancienne / nouvelle valeur (audit détaillé). */
  oldValue?: string
  newValue?: string
}
export interface AuditMeta {
  target?: string
  oldValue?: string
  newValue?: string
  base?: ActivityLog[]
}

export interface Attribute {
  id: string
  name: string
}

export interface Settings {
  storeName: string
  phone: string
  address: string
  tva: number
  currency: string
  ticketMessage: string
  pointsPerAmount: number
  pointValueDH: number
  opexBudget: number
  printFormat: 'ticket58' | 'ticket80' | 'a4'
  cnss: string
  idFiscal: string
  rcNo: string
  ice: string
  taxePro: string
  slogan: string
  email: string
  logoDataUrl: string
  legalForm: 'SARL' | 'SA' | 'Auto-Entrepreneur' | 'SNC'
  city: string
  website: string
  logoLightDataUrl: string
  invoicePrefix: string
  invoiceStartNumber: number
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD'
  invoiceTerms: string
  signatureDataUrl: string
  /** Début d'exercice : le tableau de bord ne compte que l'activité postérieure à cette date ISO. */
  statsResetAt?: string
  /** Permissions éditables par rôle : { role: [clés de permission] }. */
  rolePermissions?: Record<string, string[]>
  /** Dimensions de l'étiquette (mm) pour l'impression Zebra. */
  labelWidthMm?: number
  labelHeightMm?: number
}

export interface Expense {
  id: string
  date: string
  category: string
  label: string
  amount: number
  status: 'payee' | 'a_payer' | 'retard'
  dueDate?: string
  note: string
  storeId?: string
}

export const EXPENSE_CATEGORIES = ['Loyer', 'Électricité', 'Internet', 'Fournitures', 'Assurance', 'Bureau', 'Transport', 'Autre']

export interface Revenue {
  id: string
  date: string
  category: string
  label: string
  amount: number
  note: string
  storeId?: string
}

export const REVENUE_CATEGORIES = ['Ventes comptoir', 'Vente en gros', 'Prestations', 'Encaissement client', 'Remboursement', 'Subvention', 'Autre']

export interface MoneyTransfer {
  id: string
  date: string
  route: string
  label: string
  amount: number
  note: string
  storeId?: string
}

export const TRANSFER_ROUTES = ['Caisse → Banque', 'Banque → Caisse', 'Caisse → Coffre', 'Coffre → Caisse', 'Caisse → Magasin', 'Magasin → Caisse', 'Autre']

export interface HeldSale {
  id: string
  date: string
  items: SaleItem[]
  clientId: string
  label: string
}

// ------------------------------------------------------------------
// Stock transfers (between stores / depots)
// ------------------------------------------------------------------

export type TransferStatus = 'brouillon' | 'valide' | 'expedie' | 'recu' | 'termine'

export interface TransferItem {
  productId: string
  barcode: string
  sku?: string
  name: string
  cost: number
  lot?: string
  serial?: string
  requestedQty: number
  transferredQty: number
  receivedQty?: number
}

export interface TransferEvent {
  id: string
  date: string
  action: TransferStatus | 'creation' | 'modification'
  user: string
  comment: string
}

export interface Transfer {
  id: string
  ref: string
  date: string
  sourceStoreId: string
  sourceDepotId?: string
  destStoreId: string
  destDepotId?: string
  user: string
  note: string
  items: TransferItem[]
  status: TransferStatus
  history: TransferEvent[]
  hasDiscrepancy?: boolean
}

export const TRANSFER_FLOW: TransferStatus[] = ['brouillon', 'valide', 'expedie', 'recu', 'termine']

export const transferQty = (items: TransferItem[], key: 'requestedQty' | 'transferredQty' | 'receivedQty') =>
  items.reduce((a, i) => a + (Number(i[key]) || 0), 0)

/** Value of a transfer at purchase cost (shipped qty, falling back to requested). */
export const transferValue = (t: Transfer) =>
  t.items.reduce((a, i) => a + i.cost * (i.transferredQty || i.requestedQty), 0)

export const TRANSFER_META: Record<TransferStatus, { chip: string }> = {
  brouillon: { chip: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300' },
  valide: { chip: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400' },
  expedie: { chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400' },
  recu: { chip: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-400' },
  termine: { chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400' },
}

// ------------------------------------------------------------------
// Storage keys / helpers
// ------------------------------------------------------------------

const K = {
  products: 'dp_products',
  sales: 'dp_sales',
  clients: 'dp_clients',
  settings: 'dp_settings',
  movements: 'dp_movements',
  suppliers: 'dp_suppliers',
  purchases: 'dp_purchases',
  quotes: 'dp_quotes',
  returns: 'dp_returns',
  cash: 'dp_cash',
  sessions: 'dp_sessions',
  users: 'dp_users',
  activity: 'dp_activity',
  catAttr: 'dp_attr_categories',
  subcatAttr: 'dp_attr_souscategories',
  brandAttr: 'dp_attr_marques',
  unitAttr: 'dp_attr_unites',
  held: 'dp_held_sales',
  backups: 'dp_backups',
  clientPayments: 'dp_client_payments',
  loyalty: 'dp_loyalty_movements',
  supplierPayments: 'dp_supplier_payments',
  expenses: 'dp_expenses',
  revenues: 'dp_revenues',
  moneyTransfers: 'dp_money_transfers',
  credits: 'dp_credits',
  stores: 'dp_stores',
  depots: 'dp_depots',
  activeStore: 'dp_active_store',
  transfers: 'dp_transfers',
}

/** Storage keys whose records carry a storeId and must be filtered per active store. */
const SCOPED_KEYS: string[] = [
  K.products,
  K.sales,
  K.movements,
  K.purchases,
  K.quotes,
  K.returns,
  K.cash,
  K.sessions,
  K.clientPayments,
  K.credits,
  K.loyalty,
  K.supplierPayments,
  K.expenses,
  K.revenues,
  K.moneyTransfers,
  K.users,
]

export const DEFAULT_SETTINGS: Settings = {
  storeName: 'Droguerie Pro',
  phone: '06 61 00 00 00',
  address: 'Casablanca, Maroc',
  tva: 20,
  currency: 'MAD (DH)',
  ticketMessage: 'Merci de votre visite !',
  pointsPerAmount: 50,
  pointValueDH: 1,
  opexBudget: 58000,
  printFormat: 'ticket80',
  cnss: '',
  idFiscal: '',
  rcNo: '',
  ice: '',
  taxePro: '',
  slogan: '',
  email: '',
  logoDataUrl: '',
  legalForm: 'SARL',
  city: 'Casablanca',
  website: '',
  logoLightDataUrl: '',
  invoicePrefix: 'FAC-',
  invoiceStartNumber: 1000,
  dateFormat: 'DD/MM/YYYY',
  invoiceTerms: '',
  signatureDataUrl: '',
}

export const CLIENT_PAYMENT_META: Record<ClientPayment['method'], { label: string }> = {
  especes: { label: 'Espèces' },
  carte: { label: 'Carte bancaire' },
  virement: { label: 'Virement' },
  cheque: { label: 'Chèque' },
}

export const SUPPLIER_PAYMENT_META: Record<SupplierPayment['method'], { label: string }> = {
  especes: { label: 'Espèces' },
  carte: { label: 'Carte bancaire' },
  virement: { label: 'Virement' },
  cheque: { label: 'Chèque' },
}

export const PAYMENT_META: Record<Sale['payment'], { label: string; chip: string }> = {
  especes: { label: 'Espèces', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  carte: { label: 'Carte', chip: 'border-sky-200 bg-sky-50 text-sky-700' },
  credit: { label: 'Crédit', chip: 'border-amber-200 bg-amber-50 text-amber-700' },
  mixte: { label: 'Mixte', chip: 'border-violet-200 bg-violet-50 text-violet-700' },
}

export const MOVEMENT_META: Record<StockMovement['type'], { label: string; chip: string }> = {
  entree: { label: 'Entrée', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  sortie: { label: 'Sortie', chip: 'border-rose-200 bg-rose-50 text-rose-700' },
  ajustement: { label: 'Ajustement', chip: 'border-sky-200 bg-sky-50 text-sky-700' },
  vente: { label: 'Vente', chip: 'border-amber-200 bg-amber-50 text-amber-700' },
  reception: { label: 'Réception', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  retour: { label: 'Retour', chip: 'border-violet-200 bg-violet-50 text-violet-700' },
  inventaire: { label: 'Inventaire', chip: 'border-gray-200 bg-gray-50 text-gray-700' },
  transfert_out: { label: 'Transfert sortant', chip: 'border-orange-200 bg-orange-50 text-orange-700' },
  transfert_in: { label: 'Transfert entrant', chip: 'border-teal-200 bg-teal-50 text-teal-700' },
  stock_initial: { label: 'Stock initial', chip: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
}

export const fmtDH = (n: number) => `${n.toFixed(2).replace('.', ',')} DH`

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

function load<T>(key: string, fallback: T): T {
  try {
    const raw = storageGet(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  // La clé produits est routée vers IndexedDB (gros catalogues) ; le reste vers localStorage.
  storageSet(key, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent('droguerie-store-change', { detail: key }))
  // Write-through vers Turso (no-op tant que startSync() n'a pas été appelée,
  // ce qui neutralise l'amorçage/seed initial).
  syncOnSave(key)
}

// ------------------------------------------------------------------
// Seed data
// ------------------------------------------------------------------

const seedProducts: Omit<Product, 'id'>[] = [
  { name: 'Peinture blanche 5L', barcode: '6111234500017', category: 'Peinture', brand: 'Astral', unit: 'Pièce', price: 185, cost: 140, stock: 24, minStock: 5 },
  { name: 'Ciment colle 25kg', barcode: '6111234500024', category: 'Quincaillerie', brand: 'Générique', unit: 'Sac', price: 65, cost: 48, stock: 40, minStock: 10 },
  { name: 'Ampoule LED 12W', barcode: '6111234500031', category: 'Électricité', brand: 'Schneider', unit: 'Pièce', price: 25, cost: 15, stock: 80, minStock: 20 },
  { name: 'Câble électrique 2.5mm (10m)', barcode: '6111234500048', category: 'Électricité', brand: 'Générique', unit: 'Mètre', price: 95, cost: 70, stock: 35, minStock: 8 },
  { name: 'Robinet mélangeur', barcode: '6111234500055', category: 'Plomberie', brand: 'Générique', unit: 'Pièce', price: 220, cost: 160, stock: 12, minStock: 3 },
  { name: 'Tuyau PVC 32mm (2m)', barcode: '6111234500062', category: 'Plomberie', brand: 'Générique', unit: 'Pièce', price: 45, cost: 30, stock: 50, minStock: 10 },
  { name: 'Marteau 500g', barcode: '6111234500079', category: 'Outillage', brand: 'Stanley', unit: 'Pièce', price: 75, cost: 50, stock: 18, minStock: 5 },
  { name: 'Tournevis set 6 pièces', barcode: '6111234500086', category: 'Outillage', brand: 'Facom', unit: 'Boîte', price: 89, cost: 60, stock: 22, minStock: 5 },
  { name: 'Vis assorties 1kg', barcode: '6111234500093', category: 'Quincaillerie', brand: 'Générique', unit: 'Kg', price: 40, cost: 25, stock: 60, minStock: 15 },
  { name: 'Clous 1kg', barcode: '6111234500109', category: 'Quincaillerie', brand: 'Générique', unit: 'Kg', price: 28, cost: 18, stock: 55, minStock: 15 },
  { name: 'Colle forte 50ml', barcode: '6111234500116', category: 'Quincaillerie', brand: 'Générique', unit: 'Pièce', price: 18, cost: 10, stock: 90, minStock: 20 },
  { name: 'Javel 5L', barcode: '6118000040972', category: 'Droguerie', brand: 'Générique', unit: 'Litre', price: 22, cost: 14, stock: 70, minStock: 20 },
  { name: 'Diluant 1L', barcode: '6111234500130', category: 'Peinture', brand: 'Astral', unit: 'Litre', price: 35, cost: 24, stock: 30, minStock: 8 },
  { name: 'Pinceau 50mm', barcode: '6111234500147', category: 'Peinture', brand: 'Générique', unit: 'Pièce', price: 15, cost: 8, stock: 45, minStock: 10 },
  { name: 'Gants de travail', barcode: '6111234500154', category: 'Sécurité', brand: 'Générique', unit: 'Pièce', price: 20, cost: 12, stock: 65, minStock: 15 },
  { name: 'Serrure 3 clés', barcode: '6111234500161', category: 'Quincaillerie', brand: 'Générique', unit: 'Pièce', price: 130, cost: 95, stock: 10, minStock: 3 },
]

const SEED_CATEGORIES = ['Droguerie', 'Quincaillerie', 'Électricité', 'Plomberie', 'Peinture', 'Jardin', 'Outillage', 'Sanitaire', 'Cuisine', 'Entretien', 'Automobile', 'Sécurité']
const SEED_BRANDS = ['Astral', 'Facom', 'Stanley', 'Bosch', 'Schneider', 'Générique']
const SEED_UNITS = ['Pièce', 'Carton', 'Sac', 'Litre', 'Kg', 'Mètre', 'Boîte']

function seedSales(products: Product[]): Sale[] {
  const sales: Sale[] = []
  const now = new Date()
  for (let d = 13; d >= 0; d--) {
    const count = 2 + Math.floor(Math.random() * 4)
    for (let s = 0; s < count; s++) {
      const items: SaleItem[] = []
      const nItems = 1 + Math.floor(Math.random() * 3)
      let total = 0
      let profit = 0
      for (let it = 0; it < nItems; it++) {
        const p = products[Math.floor(Math.random() * products.length)]
        const qty = 1 + Math.floor(Math.random() * 3)
        items.push({ productId: p.id, name: p.name, price: p.price, qty })
        total += p.price * qty
        profit += (p.price - p.cost) * qty
      }
      const date = new Date(now)
      date.setDate(now.getDate() - d)
      date.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0)
      const r = Math.random()
      sales.push({
        id: uid() + s,
        date: date.toISOString(),
        items,
        total,
        profit,
        payment: r < 0.7 ? 'especes' : r < 0.9 ? 'carte' : 'credit',
      })
    }
  }
  return sales.sort((a, b) => a.date.localeCompare(b.date))
}

function iso(daysAgo: number, h = 10, m = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

export function ensureSeeded() {
  if (typeof window === 'undefined') return

  if (!storageGet(K.products)) {
    save(K.products, seedProducts.map((p, i) => ({ ...p, id: `p${i + 1}` })))
  }
  const products = load<Product[]>(K.products, [])

  if (!localStorage.getItem(K.sales)) save(K.sales, seedSales(products))
  if (!localStorage.getItem(K.clients)) {
    save(K.clients, [
      {
        id: 'c1', name: 'Ahmed Bennani', phone: '0661 23 45 67', email: 'ahmed.bennani@gmail.com',
        address: '12 Rue des Orangers', city: 'Casablanca', cin: 'BK123456', clientType: 'Particulier',
        creditLimit: 1000, notes: '', creditDueDate: iso(-5), discountBalance: 0,
        credit: 350, totalSpent: 4820, points: 96,
      },
      {
        id: 'c2', name: 'Fatima Zahra', phone: '0662 88 99 00', email: 'fatima.zahra@gmail.com',
        address: '5 Avenue Hassan II', city: 'Casablanca', cin: '', clientType: 'Particulier',
        creditLimit: 500, notes: '', discountBalance: 0,
        credit: 0, totalSpent: 2140, points: 42,
      },
      {
        id: 'c3', name: 'Mohammed Alami', phone: '0663 44 55 66', email: 'contact@alami-btp.ma',
        address: '48 Zone Industrielle Sidi Bernoussi', city: 'Casablanca', cin: '', clientType: 'Professionnel',
        creditLimit: 5000, notes: 'Client BTP — commandes groupées fréquentes', creditDueDate: iso(-2), discountBalance: 0,
        credit: 120, totalSpent: 6375, points: 127,
      },
      {
        id: 'c4', name: 'Karim El Fassi', phone: '0664 11 22 33', email: 'karim.elfassi@gmail.com',
        address: '3 Rue Ibn Sina', city: 'Rabat', cin: 'RB98765', clientType: 'Particulier',
        creditLimit: 300, notes: '', discountBalance: 0,
        credit: 0, totalSpent: 980, points: 19,
      },
    ] satisfies Client[])
  }
  if (!localStorage.getItem(K.clientPayments)) {
    save(K.clientPayments, [
      { id: 'cp1', date: iso(6, 14, 0), clientId: 'c1', clientName: 'Ahmed Bennani', amount: 200, method: 'especes', note: 'Règlement partiel' },
      { id: 'cp2', date: iso(3, 10, 30), clientId: 'c3', clientName: 'Mohammed Alami', amount: 500, method: 'virement', note: 'Règlement partiel' },
    ] satisfies ClientPayment[])
  }
  if (!localStorage.getItem(K.credits)) {
    save(K.credits, [
      {
        id: 'cr1', ref: 'CR-000001', date: iso(20, 11, 0), clientId: 'c1', clientName: 'Ahmed Bennani',
        saleId: 'seed-c1', invoiceRef: 'FCT-000101',
        items: [{ productId: 'p9', name: 'Vis assorties 1kg', price: 40, qty: 10 }, { productId: 'p3', name: 'Ampoule LED 12W', price: 25, qty: 6 }],
        amount: 550, paid: 200, dueDate: iso(-5),
        payments: [{ id: 'ci1', date: iso(6, 14, 0), amount: 200, method: 'especes', note: 'Règlement partiel' }],
      },
      {
        id: 'cr2', ref: 'CR-000002', date: iso(10, 9, 30), clientId: 'c3', clientName: 'Mohammed Alami',
        saleId: 'seed-c3', invoiceRef: 'FCT-000102',
        items: [{ productId: 'p4', name: 'Câble électrique 2.5mm (10m)', price: 95, qty: 4 }, { productId: 'p10', name: 'Clous 1kg', price: 28, qty: 8 }],
        amount: 620, paid: 500, dueDate: iso(-2),
        payments: [{ id: 'ci2', date: iso(3, 10, 30), amount: 500, method: 'virement', note: 'Règlement partiel' }],
      },
    ] satisfies Credit[])
  }
  if (!localStorage.getItem(K.loyalty)) {
    save(K.loyalty, [
      { id: 'lm1', date: iso(6), clientId: 'c1', clientName: 'Ahmed Bennani', type: 'gain', points: 24, note: 'Achat en magasin' },
      { id: 'lm2', date: iso(3), clientId: 'c3', clientName: 'Mohammed Alami', type: 'gain', points: 40, note: 'Achat en magasin' },
    ] satisfies LoyaltyMovement[])
  }
  if (!localStorage.getItem(K.settings)) save(K.settings, DEFAULT_SETTINGS)
  if (!localStorage.getItem(K.catAttr)) save(K.catAttr, SEED_CATEGORIES.map((name, i) => ({ id: `cat${i}`, name })))
  if (!localStorage.getItem(K.brandAttr)) save(K.brandAttr, SEED_BRANDS.map((name, i) => ({ id: `br${i}`, name })))
  if (!localStorage.getItem(K.unitAttr)) save(K.unitAttr, SEED_UNITS.map((name, i) => ({ id: `un${i}`, name })))

  if (!localStorage.getItem(K.suppliers)) {
    save(K.suppliers, [
      { id: 's1', name: 'Comptoir Marocain de Quincaillerie', phone: '0522 30 40 50', address: 'Derb Omar, Casablanca', balance: 2400, totalPurchased: 18600 },
      { id: 's2', name: 'Droguerie Centrale SARL', phone: '0522 61 72 83', address: 'Aïn Sebaâ, Casablanca', balance: 0, totalPurchased: 9400 },
      { id: 's3', name: 'ElectroPlus Distribution', phone: '0537 20 21 22', address: 'Rabat', balance: 860, totalPurchased: 5200 },
    ])
  }
  if (!localStorage.getItem(K.supplierPayments)) {
    save(K.supplierPayments, [
      { id: 'sp1', date: iso(4, 11, 0), supplierId: 's1', supplierName: 'Comptoir Marocain de Quincaillerie', amount: 1600, method: 'virement', note: 'Règlement partiel BC-0001' },
      { id: 'sp2', date: iso(2, 9, 0), supplierId: 's3', supplierName: 'ElectroPlus Distribution', amount: 800, method: 'especes', note: 'Règlement partiel' },
    ] satisfies SupplierPayment[])
  }
  if (!localStorage.getItem(K.expenses)) {
    save(K.expenses, [
      { id: 'ex1', date: iso(9, 9, 0), category: 'Loyer', label: 'Loyer entrepôt principal', amount: 15000, status: 'payee', note: '' },
      { id: 'ex2', date: iso(11, 10, 0), category: 'Électricité', label: 'Facture Lydec — Février', amount: 2450, status: 'a_payer', dueDate: iso(-2, 12, 0), note: '' },
      { id: 'ex3', date: iso(16, 14, 0), category: 'Assurance', label: 'RC Professionnelle AXA', amount: 8200, status: 'retard', dueDate: iso(3, 12, 0), note: '' },
      { id: 'ex4', date: iso(20, 9, 30), category: 'Bureau', label: 'Consommables informatiques', amount: 1200, status: 'payee', note: '' },
      { id: 'ex5', date: iso(6, 11, 0), category: 'Internet', label: 'Abonnement fibre — Mars', amount: 899, status: 'payee', note: '' },
      { id: 'ex6', date: iso(14, 8, 0), category: 'Fournitures', label: 'Sacs et emballages', amount: 1650, status: 'payee', note: '' },
      { id: 'ex7', date: iso(28, 9, 0), category: 'Transport', label: 'Location camionnette livraison', amount: 950, status: 'payee', note: '' },
      { id: 'ex8', date: iso(35, 10, 0), category: 'Loyer', label: 'Loyer entrepôt — mois précédent', amount: 15000, status: 'payee', note: '' },
      { id: 'ex9', date: iso(40, 9, 0), category: 'Électricité', label: 'Facture Lydec — Janvier', amount: 2100, status: 'payee', note: '' },
    ] satisfies Expense[])
  }

  if (!localStorage.getItem(K.purchases)) {
    save(K.purchases, [
      {
        id: 'po1', ref: 'BC-0001', date: iso(6, 9, 30), supplierId: 's1', supplierName: 'Comptoir Marocain de Quincaillerie',
        items: [
          { productId: 'p9', name: 'Vis assorties 1kg', cost: 25, qty: 40 },
          { productId: 'p10', name: 'Clous 1kg', cost: 18, qty: 30 },
        ],
        total: 40 * 25 + 30 * 18, paid: 0, status: 'recue',
      },
      {
        id: 'po2', ref: 'BC-0002', date: iso(1, 11, 0), supplierId: 's3', supplierName: 'ElectroPlus Distribution',
        items: [
          { productId: 'p3', name: 'Ampoule LED 12W', cost: 15, qty: 100 },
          { productId: 'p4', name: 'Câble électrique 2.5mm (10m)', cost: 70, qty: 20 },
        ],
        total: 100 * 15 + 20 * 70, paid: 0, status: 'en_attente',
      },
    ])
  }

  if (!localStorage.getItem(K.movements)) {
    save(K.movements, [
      { id: 'm1', date: iso(6, 9, 45), productId: 'p9', productName: 'Vis assorties 1kg', type: 'reception', qty: 40, note: 'BC-0001' },
      { id: 'm2', date: iso(6, 9, 45), productId: 'p10', productName: 'Clous 1kg', type: 'reception', qty: 30, note: 'BC-0001' },
      { id: 'm3', date: iso(4, 15, 10), productId: 'p1', productName: 'Peinture blanche 5L', type: 'sortie', qty: -1, note: 'Pot endommagé' },
      { id: 'm4', date: iso(2, 10, 5), productId: 'p12', productName: 'Javel 5L', type: 'entree', qty: 24, note: 'Livraison directe' },
    ] satisfies StockMovement[])
  }

  if (!localStorage.getItem(K.quotes)) {
    save(K.quotes, [
      {
        id: 'q1', ref: 'DEV-0001', date: iso(3, 12, 0), clientName: 'Société Atlas Bâtiment',
        items: [
          { productId: 'p1', name: 'Peinture blanche 5L', price: 185, qty: 10 },
          { productId: 'p14', name: 'Pinceau 50mm', price: 15, qty: 12 },
        ],
        total: 185 * 10 + 15 * 12, status: 'en_attente',
      },
    ] satisfies Quote[])
  }

  if (!localStorage.getItem(K.returns)) save(K.returns, [])
  if (!localStorage.getItem(K.cash)) {
    save(K.cash, [
      { id: 'ce1', date: iso(0, 9, 15), type: 'depense', label: 'Transport livraison', amount: 80 },
    ] satisfies CashEntry[])
  }
  if (!localStorage.getItem(K.sessions)) {
    save(K.sessions, [
      { id: 'rs1', openedAt: iso(0, 8, 30), openingAmount: 500 },
    ] satisfies RegisterSession[])
  }
  if (!localStorage.getItem(K.users)) {
    save(K.users, [
      { id: 'u1', name: 'Yassir A.', phone: '0661 00 00 00', role: 'Administrateur', active: true },
      { id: 'u2', name: 'Hamid Tazi', phone: '0662 11 22 33', role: 'Caissier', active: true },
      { id: 'u3', name: 'Sara Mansouri', phone: '0663 44 55 66', role: 'Vendeur', active: false },
    ] satisfies AppUser[])
  }
  if (!localStorage.getItem(K.activity)) {
    save(K.activity, [
      { id: 'a1', date: iso(0, 8, 30), user: 'Yassir A.', action: 'Ouverture de caisse (500,00 DH)' },
    ] satisfies ActivityLog[])
  }

  if (!localStorage.getItem(K.transfers)) save(K.transfers, [])

  ensureStores()
}

/**
 * Multi-store migration. Creates a "Magasin Principal" the first time and stamps
 * every existing scoped record (and users) with its id, so no legacy data is lost.
 * Idempotent: records that already carry a storeId are left untouched.
 */
export function ensureStores() {
  if (typeof window === 'undefined') return

  let stores = load<Store[]>(K.stores, [])
  if (stores.length === 0) {
    const main: Store = {
      id: 'main',
      name: 'Magasin Principal',
      code: 'PR',
      address: load<Partial<Settings>>(K.settings, {}).address ?? 'Casablanca, Maroc',
      city: load<Partial<Settings>>(K.settings, {}).city ?? 'Casablanca',
      phone: load<Partial<Settings>>(K.settings, {}).phone ?? '',
      email: load<Partial<Settings>>(K.settings, {}).email ?? '',
      manager: '',
      logoDataUrl: load<Partial<Settings>>(K.settings, {}).logoDataUrl ?? '',
      ice: load<Partial<Settings>>(K.settings, {}).ice ?? '',
      idFiscal: load<Partial<Settings>>(K.settings, {}).idFiscal ?? '',
      docPrefix: '',
      active: true,
      createdAt: new Date().toISOString(),
    }
    stores = [main]
    save(K.stores, stores)
  }
  const mainId = stores[0].id

  // Stamp every legacy scoped record with the main store id.
  SCOPED_KEYS.forEach((key) => {
    const arr = load<Array<Record<string, unknown>>>(key, [])
    let changed = false
    const next = arr.map((r) => {
      if (r && r.storeId) return r
      changed = true
      return { ...r, storeId: mainId }
    })
    if (changed) save(key, next)
  })

  // Give every legacy user access to the main store.
  const users = load<AppUser[]>(K.users, [])
  if (users.some((u) => !u.storeIds && !u.storeId)) {
    save(
      K.users,
      users.map((u) => (u.storeIds || u.storeId ? u : { ...u, storeId: mainId, storeIds: [mainId] }))
    )
  }

  if (!localStorage.getItem(K.depots)) {
    save(K.depots, [
      { id: uid(), storeId: mainId, name: 'Dépôt principal', address: '', responsable: '' },
    ] satisfies Depot[])
  }
  if (!localStorage.getItem(K.activeStore)) save(K.activeStore, mainId)
}

export function loadStores(): Store[] {
  ensureSeeded()
  return load<Store[]>(K.stores, [])
}

export function getActiveStoreId(): string {
  if (typeof window === 'undefined') return ''
  ensureSeeded()
  const stored = load<string>(K.activeStore, '')
  const stores = load<Store[]>(K.stores, [])
  if (stored && stores.some((s) => s.id === stored)) return stored
  return stores[0]?.id ?? ''
}

export function setActiveStoreId(id: string) {
  save(K.activeStore, id)
}

/** Build a store-prefixed document number, e.g. FAC-TNG-000012. */
export function docNumber(base: string, store: Store | null | undefined, seq: number, pad = 6): string {
  const code = (store?.docPrefix || store?.code || '').trim().toUpperCase()
  const num = String(seq).padStart(pad, '0')
  return code ? `${base}-${code}-${num}` : `${base}-${num}`
}

// Normalizers for data created by older versions of the app
const normProduct = (p: Product): Product => ({
  ...p,
  brand: p.brand ?? '',
  unit: p.unit ?? 'Pièce',
})
type LegacyClient = Partial<Client> & Pick<Client, 'id' | 'name' | 'phone' | 'credit' | 'totalSpent' | 'points'>
const normClient = (c: LegacyClient): Client => ({
  email: '',
  address: '',
  city: '',
  cin: '',
  clientType: 'Particulier',
  creditLimit: 0,
  notes: '',
  discountBalance: 0,
  ...c,
  points: c.points ?? 0,
})

export function loadProducts(): Product[] {
  ensureSeeded()
  return load<Product[]>(K.products, []).map(normProduct)
}

export function resetDemoData() {
  Object.values(K).forEach((k) => localStorage.removeItem(k))
  productsRemove() // produits stockés dans IndexedDB
  ensureSeeded()
}

// ------------------------------------------------------------------
// Held sales (POS suspend/resume)
// ------------------------------------------------------------------

export function loadHeldSales(): HeldSale[] {
  return load<HeldSale[]>(K.held, [])
}

export function saveHeldSales(held: HeldSale[]) {
  save(K.held, held)
}

// ------------------------------------------------------------------
// CSV / backup helpers
// ------------------------------------------------------------------

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob(['﻿' + content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export function exportSalesCSV(sales: Sale[]) {
  const rows = [['N°', 'Date', 'Articles', 'Paiement', 'Total DH', 'Profit DH']]
  sales.forEach((s) =>
    rows.push([
      s.id,
      new Date(s.date).toLocaleString('fr-FR'),
      String(s.items.reduce((a, i) => a + i.qty, 0)),
      PAYMENT_META[s.payment].label,
      s.total.toFixed(2),
      s.profit.toFixed(2),
    ])
  )
  downloadFile('ventes-droguerie.csv', rows.map((r) => r.join(';')).join('\n'), 'text/csv;charset=utf-8')
}

const PRODUCT_CSV_HEADER = ['Nom', 'Code-barres', 'Catégorie', 'Sous-catégorie', 'Marque', 'Unité', 'Prix achat', 'Prix vente', 'Stock', 'Stock min']
const productCsvRow = (p: Product) => [p.name, p.barcode, p.category, p.subcategory ?? '', p.brand, p.unit, p.cost.toFixed(2), p.price.toFixed(2), String(p.stock), String(p.minStock)]

export function exportProductsCSV(products: Product[]) {
  const rows = [PRODUCT_CSV_HEADER, ...products.map(productCsvRow)]
  downloadFile('produits-droguerie.csv', rows.map((r) => r.join(';')).join('\n'), 'text/csv;charset=utf-8')
}

/** Export CSV asynchrone par lots, avec progression (0→100), sans figer l'UI. */
export async function exportProductsCSVAsync(products: Product[], onProgress?: (pct: number) => void) {
  const CHUNK = 2000
  const lines: string[] = [PRODUCT_CSV_HEADER.join(';')]
  for (let i = 0; i < products.length; i += CHUNK) {
    const part = products.slice(i, i + CHUNK)
    for (const p of part) lines.push(productCsvRow(p).join(';'))
    onProgress?.(Math.min(100, Math.round(((i + part.length) / Math.max(1, products.length)) * 100)))
    await new Promise((r) => setTimeout(r, 0)) // laisse l'UI se rafraîchir
  }
  onProgress?.(100)
  downloadFile('produits-droguerie.csv', lines.join('\n'), 'text/csv;charset=utf-8')
}

/** Parse a products CSV (semicolon or comma separated, FR headers accepted). Returns parsed rows. */
export function parseProductsCSV(text: string): Omit<Product, 'id'>[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const sep = lines[0].includes(';') ? ';' : ','
  const header = lines[0].split(sep).map((h) => h.trim().toLowerCase())
  const idx = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)))
  const iName = idx('nom', 'name', 'produit')
  const iBarcode = idx('code', 'barcode')
  const iCat = idx('cat')
  const iBrand = idx('marque', 'brand')
  const iUnit = idx('unit')
  const iCost = idx('achat', 'cost', 'cout', 'coût')
  const iPrice = idx('vente', 'prix vente', 'price')
  const iStock = header.findIndex((h) => h === 'stock' || h.includes('quantit'))
  const iMin = idx('min')
  if (iName < 0) return []
  const num = (v?: string) => parseFloat((v ?? '').replace(',', '.')) || 0
  const out: Omit<Product, 'id'>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim())
    const name = cols[iName]
    if (!name) continue
    out.push({
      name,
      barcode: iBarcode >= 0 ? cols[iBarcode] ?? '' : '',
      category: (iCat >= 0 && cols[iCat]) || 'Divers',
      brand: iBrand >= 0 ? cols[iBrand] ?? '' : '',
      unit: (iUnit >= 0 && cols[iUnit]) || 'Pièce',
      cost: iCost >= 0 ? num(cols[iCost]) : 0,
      price: iPrice >= 0 ? num(cols[iPrice]) : 0,
      stock: iStock >= 0 ? Math.round(num(cols[iStock])) : 0,
      minStock: iMin >= 0 ? Math.round(num(cols[iMin])) : 5,
    })
  }
  return out
}

export interface Backup {
  id: string
  date: string
  label: string
  data: Record<string, unknown>
}

export function listBackups(): Backup[] {
  return load<Backup[]>(K.backups, [])
}

export function createBackup(label: string): Backup {
  const data: Record<string, unknown> = {}
  Object.entries(K).forEach(([, key]) => {
    if (key === K.backups) return
    const raw = localStorage.getItem(key)
    if (raw) data[key] = JSON.parse(raw)
  })
  const backup: Backup = { id: uid(), date: new Date().toISOString(), label, data }
  const all = [backup, ...listBackups()].slice(0, 5)
  save(K.backups, all)
  return backup
}

export function restoreBackup(backup: Backup) {
  Object.entries(backup.data).forEach(([key, value]) => save(key, value))
}

export function deleteBackup(id: string) {
  save(K.backups, listBackups().filter((b) => b.id !== id))
}

export function exportAllJSON() {
  const data: Record<string, unknown> = {}
  Object.values(K).forEach((key) => {
    const raw = storageGet(key)
    if (raw) data[key] = JSON.parse(raw)
  })
  downloadFile('droguerie-sauvegarde.json', JSON.stringify(data, null, 2), 'application/json')
}

export function importAllJSON(text: string): boolean {
  try {
    const data = JSON.parse(text)
    if (!data || typeof data !== 'object' || !data[K.products]) return false
    Object.entries(data).forEach(([key, value]) => {
      if (Object.values(K).includes(key)) save(key, value)
    })
    return true
  } catch {
    return false
  }
}

// ------------------------------------------------------------------
// Main hook
// ------------------------------------------------------------------

// Hook interne : contient TOUT l'état + les actions. Appelé UNE SEULE FOIS par le
// DroguerieProvider (voir lib/droguerie-provider.tsx). Les pages consomment via le
// contexte partagé `useDroguerie()` → les 55 000 produits ne sont chargés qu'une fois.
export function useDroguerieState() {
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [returns, setReturns] = useState<SaleReturn[]>([])
  const [cash, setCash] = useState<CashEntry[]>([])
  const [sessions, setSessions] = useState<RegisterSession[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [categories, setCategories] = useState<Attribute[]>([])
  const [subcategories, setSubcategories] = useState<Attribute[]>([])
  const [brands, setBrands] = useState<Attribute[]>([])
  const [units, setUnits] = useState<Attribute[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([])
  const [credits, setCredits] = useState<Credit[]>([])
  const [loyaltyMovements, setLoyaltyMovements] = useState<LoyaltyMovement[]>([])
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [revenues, setRevenues] = useState<Revenue[]>([])
  const [moneyTransfers, setMoneyTransfers] = useState<MoneyTransfer[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [depots, setDepots] = useState<Depot[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [activeStoreId, setActiveStoreIdState] = useState<string>('')
  const [ready, setReady] = useState(false)

  // A ref so the memoized persist wrappers always stamp with the current store id.
  const activeStoreRef = useRef('')
  activeStoreRef.current = activeStoreId

  // Ref miroir de `users` : les mutations consécutives (ex. réinitialisation de
  // tous les comptes en boucle) se composent au lieu de repartir d'une liste périmée.
  const usersRef = useRef<AppUser[]>([])
  usersRef.current = users

  useEffect(() => {
    // Lit tout le localStorage dans l'état React. Rejoué quand la synchro
    // rapatrie des changements d'un autre appareil (événement 'droguerie-sync-pull').
    // `only` = collections réellement modifiées par la synchro (undefined au
    // démarrage = tout charger). Recharger les produits coûte un JSON.parse de
    // ~15 Mo + normProduct sur des dizaines de milliers d'objets : on l'évite
    // quand la synchro n'a rapatrié que des ventes, des logs, etc.
    const loadAll = (only?: string[]) => {
      const wants = (name: string) => !only || only.includes(name)
      if (wants('products')) setProducts(load<Product[]>(K.products, []).map(normProduct))
      if (wants('sales')) setSales(load(K.sales, []))
      setClients(load<Client[]>(K.clients, []).map(normClient))
      setSuppliers(load(K.suppliers, []))
      if (wants('movements')) setMovements(load(K.movements, []))
      setPurchases(load(K.purchases, []))
      setQuotes(load(K.quotes, []))
      setReturns(load(K.returns, []))
      setCash(load(K.cash, []))
      setSessions(load(K.sessions, []))
      setUsers(load(K.users, []))
      setActivity(load(K.activity, []))
      setCategories(load(K.catAttr, []))
      setSubcategories(load(K.subcatAttr, []))
      setBrands(load(K.brandAttr, []))
      setUnits(load(K.unitAttr, []))
      setClientPayments(load(K.clientPayments, []))
      setCredits(load(K.credits, []))
      setLoyaltyMovements(load(K.loyalty, []))
      setSupplierPayments(load(K.supplierPayments, []))
      setExpenses(load(K.expenses, []))
      setRevenues(load(K.revenues, []))
      setMoneyTransfers(load(K.moneyTransfers, []))
      setStores(load(K.stores, []))
      setDepots(load(K.depots, []))
      setTransfers(load(K.transfers, []))
      setActiveStoreIdState(getActiveStoreId())
      setSettings({ ...DEFAULT_SETTINGS, ...load<Partial<Settings>>(K.settings, {}) })
      setReady(true)
    }

    const boot = async () => {
      // Charge d'abord le cache produits depuis IndexedDB (migre l'ancien localStorage).
      await initProductCache()
      // Appareil neuf (aucune donnée locale) + Turso configuré → rapatrier les vraies
      // données au lieu de générer des données de démo divergentes.
      const fresh = !storageGet(K.products) && !localStorage.getItem(K.stores)
      if (fresh && tursoConfigured()) {
        try {
          const hadRemote = await bootstrapFromRemote()
          if (!hadRemote) ensureSeeded()
        } catch {
          ensureSeeded() // hors-ligne : on démarre avec le jeu de démo local
        }
      } else {
        ensureSeeded()
      }
      loadAll()
      // Active la synchro APRÈS le chargement/seed : les écritures suivantes
      // (actions utilisateur) partiront vers Turso ; le seed initial est ignoré.
      startSync()
    }
    void boot()

    const onPull = (e: Event) => {
      const cols = (e as CustomEvent<{ collections?: string[] }>).detail?.collections
      loadAll(cols)
    }
    window.addEventListener('droguerie-sync-pull', onPull)
    return () => window.removeEventListener('droguerie-sync-pull', onPull)
  }, [])

  const makePersist = <T,>(key: string, setter: (v: T) => void) =>
    (next: T) => {
      setter(next)
      save(key, next)
    }

  // Scoped persist: any record still missing a storeId is stamped with the active store,
  // so every mutation transparently tags its new records to the current store.
  const makeScopedPersist = <R extends { storeId?: string }>(key: string, setter: (v: R[]) => void) =>
    (next: R[]) => {
      const sid = activeStoreRef.current
      const stamped = sid ? next.map((r) => (r && r.storeId ? r : { ...r, storeId: sid })) : next
      setter(stamped)
      save(key, stamped)
    }

  /* eslint-disable react-hooks/exhaustive-deps */
  const persistProducts = useCallback(makeScopedPersist<Product>(K.products, setProducts), [])
  const persistSales = useCallback(makeScopedPersist<Sale>(K.sales, setSales), [])
  const persistClients = useCallback(makePersist<Client[]>(K.clients, setClients), [])
  const persistSuppliers = useCallback(makePersist<Supplier[]>(K.suppliers, setSuppliers), [])
  const persistMovements = useCallback(makeScopedPersist<StockMovement>(K.movements, setMovements), [])
  const persistPurchases = useCallback(makeScopedPersist<Purchase>(K.purchases, setPurchases), [])
  const persistQuotes = useCallback(makeScopedPersist<Quote>(K.quotes, setQuotes), [])
  const persistReturns = useCallback(makeScopedPersist<SaleReturn>(K.returns, setReturns), [])
  const persistCash = useCallback(makeScopedPersist<CashEntry>(K.cash, setCash), [])
  const persistSessions = useCallback(makeScopedPersist<RegisterSession>(K.sessions, setSessions), [])
  const persistUsers = useCallback(makePersist<AppUser[]>(K.users, setUsers), [])
  const persistActivity = useCallback(makePersist<ActivityLog[]>(K.activity, setActivity), [])
  const persistCategories = useCallback(makePersist<Attribute[]>(K.catAttr, setCategories), [])
  const persistSubcategories = useCallback(makePersist<Attribute[]>(K.subcatAttr, setSubcategories), [])
  const persistBrands = useCallback(makePersist<Attribute[]>(K.brandAttr, setBrands), [])
  const persistUnits = useCallback(makePersist<Attribute[]>(K.unitAttr, setUnits), [])
  const persistClientPayments = useCallback(makeScopedPersist<ClientPayment>(K.clientPayments, setClientPayments), [])
  const persistCredits = useCallback(makeScopedPersist<Credit>(K.credits, setCredits), [])
  const persistLoyalty = useCallback(makeScopedPersist<LoyaltyMovement>(K.loyalty, setLoyaltyMovements), [])
  const persistSupplierPayments = useCallback(makeScopedPersist<SupplierPayment>(K.supplierPayments, setSupplierPayments), [])
  const persistExpenses = useCallback(makeScopedPersist<Expense>(K.expenses, setExpenses), [])
  const persistRevenues = useCallback(makeScopedPersist<Revenue>(K.revenues, setRevenues), [])
  const persistMoneyTransfers = useCallback(makeScopedPersist<MoneyTransfer>(K.moneyTransfers, setMoneyTransfers), [])
  const persistStores = useCallback(makePersist<Store[]>(K.stores, setStores), [])
  const persistDepots = useCallback(makePersist<Depot[]>(K.depots, setDepots), [])
  const persistTransfers = useCallback(makePersist<Transfer[]>(K.transfers, setTransfers), [])
  /* eslint-enable react-hooks/exhaustive-deps */

  const saveSettings = useCallback((next: Settings) => {
    setSettings(next)
    save(K.settings, next)
  }, [])

  const logActivity = (action: string, metaOrBase?: AuditMeta | ActivityLog[]) => {
    const meta: AuditMeta = Array.isArray(metaOrBase) ? { base: metaOrBase } : (metaOrBase ?? {})
    const sid = activeStoreRef.current
    const store = stores.find((s) => s.id === sid)
    let userName = 'Système'
    try { userName = getSession()?.name || userName } catch {}
    const entry: ActivityLog = {
      id: uid(),
      date: new Date().toISOString(),
      user: userName,
      action,
      storeId: sid || undefined,
      storeName: store?.name,
      target: meta.target,
      oldValue: meta.oldValue,
      newValue: meta.newValue,
    }
    persistActivity([entry, ...(meta.base ?? activity)].slice(0, 300))
  }

  // Réinitialisation des statistiques : pose la date de début d'exercice
  // (le tableau de bord repart de 0) et journalise l'opération. Ne supprime
  // AUCUNE donnée.
  const resetStats = (userName: string) => {
    const next: Settings = { ...settings, statsResetAt: new Date().toISOString() }
    setSettings(next)
    save(K.settings, next)
    logActivity(`Réinitialisation des statistiques du tableau de bord${userName ? ' par ' + userName : ''}`)
  }

  // ---- Products ----
  const addProduct = (data: Omit<Product, 'id'>) => {
    persistProducts([{ ...data, id: uid() }, ...products])
    logActivity(`Produit ajouté : ${data.name}`)
  }

  const updateProduct = (id: string, data: Partial<Product>) => {
    const prev = products.find((p) => p.id === id)
    persistProducts(products.map((p) => (p.id === id ? { ...p, ...data } : p)))
    // Audit du changement de prix de vente.
    if (prev && data.price !== undefined && data.price !== prev.price) {
      logActivity('Modification du prix', { target: prev.name, oldValue: fmtDH(prev.price), newValue: fmtDH(data.price) })
    }
  }

  const deleteProduct = (id: string) => {
    const p = products.find((x) => x.id === id)
    persistProducts(products.filter((x) => x.id !== id))
    if (p) logActivity(`Produit supprimé : ${p.name}`)
  }

  const importProducts = (rows: Omit<Product, 'id'>[]) => {
    // O(N) : index par code-barres au lieu d'un .find() dans la boucle (évite le gel sur gros fichiers).
    let added = 0
    let updated = 0
    const arr: Product[] = products.map((p) => ({ ...p }))
    const byBarcode = new Map<string, number>()
    arr.forEach((p, i) => { if (p.barcode) byBarcode.set(p.barcode, i) })
    for (const r of rows) {
      const bc = r.barcode
      const idx = bc ? byBarcode.get(bc) : undefined
      if (idx !== undefined) {
        arr[idx] = { ...arr[idx], ...r }
        updated++
      } else {
        if (bc) byBarcode.set(bc, arr.length)
        arr.push({ ...r, id: uid() })
        added++
      }
    }
    persistProducts(arr)
    logActivity(`Import produits : ${added} ajoutés, ${updated} mis à jour`)
    return { added, updated }
  }

  // ---- Stock movements ----
  const addMovement = (
    productId: string,
    type: StockMovement['type'],
    qty: number,
    note = '',
    baseProducts?: Product[],
    baseMovements?: StockMovement[]
  ) => {
    const list = baseProducts ?? products
    const p = list.find((x) => x.id === productId)
    if (!p) return
    const nextProducts = list.map((x) =>
      x.id === productId ? { ...x, stock: Math.max(0, x.stock + qty) } : x
    )
    persistProducts(nextProducts)
    const mv: StockMovement = {
      id: uid(),
      date: new Date().toISOString(),
      productId,
      productName: p.name,
      type,
      qty,
      note,
    }
    persistMovements([mv, ...(baseMovements ?? movements)])
    return nextProducts
  }

  const adjustStock = (id: string, delta: number, note = 'Ajustement manuel') => {
    addMovement(id, 'ajustement', delta, note)
  }

  const applyInventory = (counts: { productId: string; counted: number }[]) => {
    let curProducts = products
    let curMovements = movements
    counts.forEach(({ productId, counted }) => {
      const p = curProducts.find((x) => x.id === productId)
      if (!p || p.stock === counted) return
      const delta = counted - p.stock
      curProducts = curProducts.map((x) => (x.id === productId ? { ...x, stock: counted } : x))
      curMovements = [
        {
          id: uid(),
          date: new Date().toISOString(),
          productId,
          productName: p.name,
          type: 'inventaire' as const,
          qty: delta,
          note: `Inventaire physique (écart ${delta > 0 ? '+' : ''}${delta})`,
        },
        ...curMovements,
      ]
    })
    persistProducts(curProducts)
    persistMovements(curMovements)
    logActivity('Inventaire physique validé')
  }

  // ---- Stock initial (mise en service d'un magasin) ----
  /** Vrai si le magasin actif a déjà été initialisé (un mouvement stock_initial existe). */
  const activeStoreInitialized = movements.some((m) => m.type === 'stock_initial' && (m.storeId ?? activeStoreRef.current) === activeStoreRef.current)

  const initializeStock = (entries: { productId: string; qty: number }[], force = false) => {
    const sid = activeStoreRef.current
    const already = movements.some((m) => m.type === 'stock_initial' && (m.storeId ?? sid) === sid)
    if (already && !force) return { ok: false as const, error: 'already' as const }
    const qtyMap = new Map(entries.filter((e) => e.qty > 0).map((e) => [e.productId, Math.round(e.qty)]))
    if (qtyMap.size === 0) return { ok: false as const, error: 'empty' as const }
    const nowIso = new Date().toISOString()
    const newMovements: StockMovement[] = []
    const nextProducts = products.map((p) => {
      const q = qtyMap.get(p.id)
      if (q === undefined || p.storeId !== sid) return p
      newMovements.push({ id: uid(), date: nowIso, productId: p.id, productName: p.name, type: 'stock_initial', qty: q, note: 'Initialisation du stock', storeId: sid })
      return { ...p, stock: q }
    })
    persistProducts(nextProducts)
    persistMovements([...newMovements, ...movements])
    logActivity('Initialisation du stock', { target: stores.find((s) => s.id === sid)?.name, newValue: `${qtyMap.size} produit(s)` })
    return { ok: true as const, count: qtyMap.size }
  }

  // ---- Sales ----
  const recordSale = (items: SaleItem[], payment: Sale['payment'], client?: Client | null): Sale => {
    const total = items.reduce((s, i) => s + i.price * i.qty, 0)
    const profit = items.reduce((s, i) => {
      const p = products.find((x) => x.id === i.productId)
      return s + (i.price - (p?.cost ?? 0)) * i.qty
    }, 0)
    const sale: Sale = {
      id: uid(),
      date: new Date().toISOString(),
      items,
      total,
      profit,
      payment,
      clientId: client?.id,
      clientName: client?.name,
    }
    persistSales([...sales, sale])
    persistProducts(
      products.map((p) => {
        const qty = items.filter((i) => i.productId === p.id).reduce((s, i) => s + i.qty, 0)
        return qty ? { ...p, stock: Math.max(0, p.stock - qty) } : p
      })
    )
    persistMovements([
      ...items.map((i) => ({
        id: uid() + i.productId,
        date: sale.date,
        productId: i.productId,
        productName: i.name,
        type: 'vente' as const,
        qty: -i.qty,
        note: `Vente ${sale.id.slice(-5)}`,
      })),
      ...movements,
    ])
    if (client) {
      const gained = Math.floor(total / settings.pointsPerAmount)
      persistClients(
        clients.map((c) =>
          c.id === client.id
            ? {
                ...c,
                totalSpent: c.totalSpent + total,
                credit: payment === 'credit' ? c.credit + total : c.credit,
                points: c.points + gained,
              }
            : c
        )
      )
      if (gained > 0) {
        persistLoyalty([
          {
            id: uid(),
            date: sale.date,
            clientId: client.id,
            clientName: client.name,
            type: 'gain',
            points: gained,
            note: `Vente ${sale.id.slice(-5)}`,
          },
          ...loyaltyMovements,
        ])
      }
      // A credit sale automatically opens a credit line (invoice due, nothing paid yet).
      if (payment === 'credit') {
        const term = client.paymentTermDays ?? 30
        const due = new Date(sale.date)
        due.setDate(due.getDate() + term)
        const credit: Credit = {
          id: uid(),
          ref: docNumber('CR', stores.find((s) => s.id === activeStoreId) ?? null, credits.filter((x) => x.storeId === activeStoreId).length + 1),
          date: sale.date,
          clientId: client.id,
          clientName: client.name,
          saleId: sale.id,
          invoiceRef: `FCT-${sale.id.slice(-6).toUpperCase()}`,
          items,
          amount: total,
          paid: 0,
          dueDate: due.toISOString(),
          payments: [],
        }
        persistCredits([credit, ...credits])
      }
    }
    logActivity(`Vente encaissée : ${fmtDH(total)} (${PAYMENT_META[payment].label})`)
    return sale
  }

  // Pay a single credit line (partial or full). Keeps client.credit and cash in sync.
  const payCredit = (
    creditId: string,
    amount: number,
    method: CreditInstalment['method'] = 'especes',
    note = ''
  ) => {
    const credit = credits.find((c) => c.id === creditId)
    if (!credit || amount <= 0) return
    const applied = Math.min(amount, credit.amount - credit.paid)
    if (applied <= 0) return
    const instal: CreditInstalment = { id: uid(), date: new Date().toISOString(), amount: applied, method, note }
    persistCredits(credits.map((c) => (c.id === creditId ? { ...c, paid: c.paid + applied, payments: [instal, ...c.payments] } : c)))
    persistClients(clients.map((c) => (c.id === credit.clientId ? { ...c, credit: Math.max(0, c.credit - applied) } : c)))
    persistCash([
      { id: uid(), date: instal.date, type: 'recette', label: `Règlement crédit ${credit.ref} — ${credit.clientName}`, amount: applied },
      ...cash,
    ])
    persistClientPayments([
      { id: uid(), date: instal.date, clientId: credit.clientId, clientName: credit.clientName, amount: applied, method, note: note || `Règlement ${credit.ref}` },
      ...clientPayments,
    ])
    logActivity(`Règlement crédit ${credit.ref} (${credit.clientName}) : ${fmtDH(applied)}`)
  }

  // Manually open a credit line (Nouveau crédit).
  const addManualCredit = (clientId: string, amount: number, dueDate: string, note = '') => {
    const client = clients.find((c) => c.id === clientId)
    if (!client || amount <= 0) return
    const credit: Credit = {
      id: uid(),
      ref: docNumber('CR', stores.find((s) => s.id === activeStoreId) ?? null, credits.filter((x) => x.storeId === activeStoreId).length + 1),
      date: new Date().toISOString(),
      clientId,
      clientName: client.name,
      saleId: '',
      invoiceRef: note || '—',
      items: [],
      amount,
      paid: 0,
      dueDate,
      payments: [],
    }
    persistCredits([credit, ...credits])
    persistClients(clients.map((c) => (c.id === clientId ? { ...c, credit: c.credit + amount } : c)))
    logActivity(`Crédit ${credit.ref} ouvert pour ${client.name} : ${fmtDH(amount)}`)
    return credit
  }

  const updateCredit = (id: string, patch: { amount?: number; dueDate?: string; invoiceRef?: string }) => {
    const credit = credits.find((c) => c.id === id)
    if (!credit) return
    const nextAmount = patch.amount ?? credit.amount
    const delta = nextAmount - credit.amount
    persistCredits(credits.map((c) => (c.id === id ? { ...c, ...patch, amount: nextAmount } : c)))
    if (delta !== 0) {
      persistClients(clients.map((c) => (c.id === credit.clientId ? { ...c, credit: Math.max(0, c.credit + delta) } : c)))
    }
  }

  const deleteCredit = (id: string) => {
    const credit = credits.find((c) => c.id === id)
    if (!credit) return
    const remaining = credit.amount - credit.paid
    persistCredits(credits.filter((c) => c.id !== id))
    if (remaining > 0) {
      persistClients(clients.map((c) => (c.id === credit.clientId ? { ...c, credit: Math.max(0, c.credit - remaining) } : c)))
    }
    logActivity(`Crédit ${credit.ref} supprimé`)
  }

  const recordReturn = (sale: Sale, items: SaleItem[], method: SaleReturn['method']) => {
    const total = items.reduce((s, i) => s + i.price * i.qty, 0)
    const ret: SaleReturn = {
      id: uid(),
      date: new Date().toISOString(),
      saleId: sale.id,
      clientName: sale.clientName ?? '',
      items,
      total,
      method,
    }
    persistReturns([ret, ...returns])
    persistProducts(
      products.map((p) => {
        const qty = items.filter((i) => i.productId === p.id).reduce((s, i) => s + i.qty, 0)
        return qty ? { ...p, stock: p.stock + qty } : p
      })
    )
    persistMovements([
      ...items.map((i) => ({
        id: uid() + i.productId,
        date: ret.date,
        productId: i.productId,
        productName: i.name,
        type: 'retour' as const,
        qty: i.qty,
        note: `Retour vente ${sale.id.slice(-5)}`,
      })),
      ...movements,
    ])
    if (method === 'especes') {
      persistCash([
        { id: uid(), date: ret.date, type: 'depense', label: `Remboursement retour ${ret.id.slice(-5)}`, amount: total },
        ...cash,
      ])
    } else if (sale.clientId) {
      persistClients(
        clients.map((c) => (c.id === sale.clientId ? { ...c, credit: Math.max(0, c.credit - total) } : c))
      )
    }
    logActivity(`Retour client : ${fmtDH(total)}`)
    return ret
  }

  // ---- Clients ----
  const addClient = (
    data: Partial<Omit<Client, 'id' | 'credit' | 'totalSpent' | 'points' | 'discountBalance'>> & {
      name: string
      phone: string
    }
  ) => {
    const client: Client = {
      id: uid(),
      name: data.name,
      phone: data.phone,
      email: data.email ?? '',
      address: data.address ?? '',
      city: data.city ?? '',
      cin: data.cin ?? '',
      clientType: data.clientType ?? 'Particulier',
      creditLimit: data.creditLimit ?? 0,
      notes: data.notes ?? '',
      creditDueDate: data.creditDueDate,
      image: data.image,
      discountBalance: 0,
      credit: 0,
      totalSpent: 0,
      points: 0,
      creditAllowed: data.creditAllowed ?? true,
      paymentTermDays: data.paymentTermDays ?? 30,
    }
    persistClients([client, ...clients])
    return client
  }

  const updateClient = (id: string, data: Partial<Client>) => {
    persistClients(clients.map((c) => (c.id === id ? { ...c, ...data } : c)))
  }

  const deleteClient = (id: string) => {
    persistClients(clients.filter((c) => c.id !== id))
  }

  const settleCredit = (id: string, amount: number, method: ClientPayment['method'] = 'especes') => {
    const c = clients.find((x) => x.id === id)
    const nowIso = new Date().toISOString()
    // Allocate the payment across the client's open credits, oldest due first.
    let remaining = amount
    const nextCredits = [...credits]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((cr) => {
        if (cr.clientId !== id || remaining <= 0) return cr
        const due = cr.amount - cr.paid
        if (due <= 0) return cr
        const applied = Math.min(remaining, due)
        remaining -= applied
        return { ...cr, paid: cr.paid + applied, payments: [{ id: uid(), date: nowIso, amount: applied, method, note: 'Règlement solde' }, ...cr.payments] }
      })
    persistCredits(credits.map((cr) => nextCredits.find((n) => n.id === cr.id) ?? cr))
    persistClients(clients.map((x) => (x.id === id ? { ...x, credit: Math.max(0, x.credit - amount) } : x)))
    persistCash([
      { id: uid(), date: nowIso, type: 'recette', label: `Règlement crédit — ${c?.name ?? ''}`, amount },
      ...cash,
    ])
    persistClientPayments([
      { id: uid(), date: nowIso, clientId: id, clientName: c?.name ?? '', amount, method, note: 'Règlement crédit' },
      ...clientPayments,
    ])
    logActivity(`Règlement crédit ${c?.name ?? ''} : ${fmtDH(amount)}`)
  }

  const redeemPoints = (id: string, points: number) => {
    const c = clients.find((x) => x.id === id)
    if (!c || points <= 0 || points > c.points) return
    const discount = points * settings.pointValueDH
    persistClients(
      clients.map((x) =>
        x.id === id ? { ...x, points: x.points - points, discountBalance: x.discountBalance + discount } : x
      )
    )
    persistLoyalty([
      {
        id: uid(),
        date: new Date().toISOString(),
        clientId: id,
        clientName: c.name,
        type: 'utilisation',
        points,
        note: `Converti en ${fmtDH(discount)} de remise`,
      },
      ...loyaltyMovements,
    ])
    logActivity(`${c.name} a converti ${points} points en ${fmtDH(discount)} de remise`)
  }

  // ---- Expenses ----
  const addExpense = (data: Omit<Expense, 'id'>) => {
    const expense: Expense = { ...data, id: uid() }
    persistExpenses([expense, ...expenses])
    if (expense.status === 'payee') {
      persistCash([
        { id: uid(), date: expense.date, type: 'depense', label: `${expense.category} — ${expense.label}`, amount: expense.amount },
        ...cash,
      ])
    }
    logActivity(`Dépense enregistrée : ${expense.label} (${fmtDH(expense.amount)})`)
    return expense
  }

  const markExpensePaid = (id: string) => {
    const e = expenses.find((x) => x.id === id)
    if (!e || e.status === 'payee') return
    persistExpenses(expenses.map((x) => (x.id === id ? { ...x, status: 'payee' } : x)))
    persistCash([
      { id: uid(), date: new Date().toISOString(), type: 'depense', label: `${e.category} — ${e.label}`, amount: e.amount },
      ...cash,
    ])
    logActivity(`Dépense payée : ${e.label} (${fmtDH(e.amount)})`)
  }

  const deleteExpense = (id: string) => {
    persistExpenses(expenses.filter((x) => x.id !== id))
  }

  // ---- Revenues (recettes) ----
  const addRevenue = (data: Omit<Revenue, 'id'>) => {
    const revenue: Revenue = { ...data, id: uid() }
    persistRevenues([revenue, ...revenues])
    persistCash([
      { id: uid(), date: revenue.date, type: 'recette', label: `${revenue.category} — ${revenue.label}`, amount: revenue.amount },
      ...cash,
    ])
    logActivity(`Recette enregistrée : ${revenue.label} (${fmtDH(revenue.amount)})`)
    return revenue
  }

  const deleteRevenue = (id: string) => {
    persistRevenues(revenues.filter((x) => x.id !== id))
  }

  // ---- Money transfers (transferts d'argent) ----
  const addMoneyTransfer = (data: Omit<MoneyTransfer, 'id'>) => {
    const transfer: MoneyTransfer = { ...data, id: uid() }
    persistMoneyTransfers([transfer, ...moneyTransfers])
    // Impact caisse : « Caisse → X » = sortie, « X → Caisse » = entrée, sinon neutre.
    const [from, to] = transfer.route.split('→').map((s) => s.trim().toLowerCase())
    const cashType = from === 'caisse' ? 'depense' : to === 'caisse' ? 'recette' : null
    if (cashType) {
      const desc = `Transfert : ${transfer.route}${transfer.label ? ` — ${transfer.label}` : ''}`
      persistCash([{ id: uid(), date: transfer.date, type: cashType, label: desc, amount: transfer.amount }, ...cash])
    }
    logActivity(`Transfert d'argent : ${transfer.route} — ${fmtDH(transfer.amount)}`)
    return transfer
  }

  const deleteMoneyTransfer = (id: string) => {
    persistMoneyTransfers(moneyTransfers.filter((x) => x.id !== id))
  }

  // ---- Suppliers ----
  const addSupplier = (data: { name: string; phone: string; address: string }) => {
    persistSuppliers([{ ...data, id: uid(), balance: 0, totalPurchased: 0 }, ...suppliers])
  }

  const updateSupplier = (id: string, data: Partial<Supplier>) => {
    persistSuppliers(suppliers.map((s) => (s.id === id ? { ...s, ...data } : s)))
  }

  const deleteSupplier = (id: string) => {
    persistSuppliers(suppliers.filter((s) => s.id !== id))
  }

  const paySupplier = (id: string, amount: number, method: SupplierPayment['method'] = 'especes') => {
    const s = suppliers.find((x) => x.id === id)
    persistSuppliers(
      suppliers.map((x) => (x.id === id ? { ...x, balance: Math.max(0, x.balance - amount) } : x))
    )
    persistCash([
      { id: uid(), date: new Date().toISOString(), type: 'depense', label: `Paiement fournisseur — ${s?.name ?? ''}`, amount },
      ...cash,
    ])
    persistSupplierPayments([
      { id: uid(), date: new Date().toISOString(), supplierId: id, supplierName: s?.name ?? '', amount, method, note: 'Règlement solde' },
      ...supplierPayments,
    ])
    logActivity(`Paiement fournisseur ${s?.name ?? ''} : ${fmtDH(amount)}`)
  }

  // ---- Purchases ----
  const purchaseItemTotal = (i: PurchaseItem) => {
    const base = i.cost * i.qty * (1 - (i.discount ?? 0) / 100)
    return base * (1 + (i.tva ?? 0) / 100)
  }

  const purchaseTotal = (items: PurchaseItem[], globalDiscount?: number) => {
    const sum = items.reduce((a, i) => a + purchaseItemTotal(i), 0)
    return sum * (1 - (globalDiscount ?? 0) / 100)
  }

  const addPurchase = (
    supplierId: string,
    items: PurchaseItem[],
    meta?: { supplierRef?: string; expectedDate?: string; note?: string; globalDiscount?: number }
  ) => {
    const supplier = suppliers.find((s) => s.id === supplierId)
    if (!supplier) return
    const total = purchaseTotal(items, meta?.globalDiscount)
    const storeForDoc = stores.find((s) => s.id === activeStoreId) ?? null
    const po: Purchase = {
      id: uid(),
      ref: docNumber('BC', storeForDoc, purchases.filter((p) => p.storeId === activeStoreId).length + 1),
      date: new Date().toISOString(),
      supplierId,
      supplierName: supplier.name,
      supplierRef: meta?.supplierRef,
      expectedDate: meta?.expectedDate,
      note: meta?.note,
      globalDiscount: meta?.globalDiscount,
      items,
      total,
      paid: 0,
      status: 'en_attente',
    }
    persistPurchases([po, ...purchases])
    logActivity(`Commande fournisseur ${po.ref} créée (${fmtDH(total)})`)
    return po
  }

  const updatePurchase = (id: string, patch: Partial<Purchase>) => {
    persistPurchases(
      purchases.map((p) => {
        if (p.id !== id || p.status !== 'en_attente') return p
        const next = { ...p, ...patch }
        next.total = purchaseTotal(next.items, next.globalDiscount)
        return next
      })
    )
  }

  const deletePurchase = (id: string) => {
    const po = purchases.find((p) => p.id === id)
    if (!po || po.status !== 'en_attente') return
    persistPurchases(purchases.filter((p) => p.id !== id))
    logActivity(`Commande fournisseur ${po.ref} supprimée`)
  }

  const recordDeliveryNote = (
    id: string,
    delivered: { productId: string; deliveredQty: number }[],
    meta?: { carrier?: string; note?: string }
  ) => {
    const po = purchases.find((p) => p.id === id)
    if (!po) return
    const blRef = po.blRef ?? docNumber('BL', stores.find((s) => s.id === po.storeId) ?? null, purchases.filter((p) => p.blRef && p.storeId === po.storeId).length + 1)
    persistPurchases(
      purchases.map((p) =>
        p.id === id
          ? {
              ...p,
              blRef,
              blDate: new Date().toISOString(),
              blCarrier: meta?.carrier ?? p.blCarrier,
              blNote: meta?.note ?? p.blNote,
              items: p.items.map((i) => {
                const d = delivered.find((x) => x.productId === i.productId)
                return d ? { ...i, deliveredQty: d.deliveredQty } : i
              }),
            }
          : p
      )
    )
    logActivity(`Bon de livraison ${blRef} enregistré (${po.ref})`)
  }

  const validateReception = (
    id: string,
    received: { productId: string; receivedQty: number; state: PurchaseItem['receptionState']; note?: string }[],
    meta?: { employee?: string; depot?: string }
  ) => {
    const po = purchases.find((p) => p.id === id)
    if (!po) return
    const brRef = po.brRef ?? docNumber('BR', stores.find((s) => s.id === po.storeId) ?? null, purchases.filter((p) => p.brRef && p.storeId === po.storeId).length + 1)
    let curProducts = products
    let curMovements = movements
    let receivedValue = 0
    received.forEach((r) => {
      if (r.receivedQty <= 0) return
      const i = po.items.find((x) => x.productId === r.productId)
      if (!i) return
      const p = curProducts.find((x) => x.id === r.productId)
      if (!p) return
      receivedValue += r.receivedQty * i.cost
      curProducts = curProducts.map((x) => (x.id === r.productId ? { ...x, stock: x.stock + r.receivedQty, cost: i.cost } : x))
      curMovements = [
        { id: uid() + r.productId, date: new Date().toISOString(), productId: r.productId, productName: i.name, type: 'entree' as const, qty: r.receivedQty, note: `${po.ref} / ${brRef}` },
        ...curMovements,
      ]
    })
    persistProducts(curProducts)
    persistMovements(curMovements)

    const nextItems = po.items.map((i) => {
      const r = received.find((x) => x.productId === i.productId)
      if (!r) return i
      return {
        ...i,
        receivedQty: (i.receivedQty ?? 0) + r.receivedQty,
        receptionState: r.state ?? i.receptionState,
        receptionNote: r.note ?? i.receptionNote,
      }
    })
    const totalOrdered = nextItems.reduce((a, i) => a + i.qty, 0)
    const totalReceived = nextItems.reduce((a, i) => a + (i.receivedQty ?? 0), 0)
    const nextStatus: Purchase['status'] = totalReceived >= totalOrdered ? 'recue' : totalReceived > 0 ? 'partiellement_recue' : 'en_attente'

    persistPurchases(
      purchases.map((p) =>
        p.id === id
          ? {
              ...p,
              items: nextItems,
              status: nextStatus,
              brRef,
              brDate: new Date().toISOString(),
              brEmployee: meta?.employee ?? p.brEmployee,
              brDepot: meta?.depot ?? p.brDepot,
            }
          : p
      )
    )
    persistSuppliers(
      suppliers.map((s) =>
        s.id === po.supplierId ? { ...s, balance: s.balance + receivedValue, totalPurchased: s.totalPurchased + receivedValue } : s
      )
    )
    logActivity(`Réception ${brRef} — ${po.ref} — stock mis à jour`)
  }

  const payPurchase = (id: string, amount: number, method: SupplierPayment['method'] = 'especes') => {
    const po = purchases.find((p) => p.id === id)
    if (!po) return
    const pay = Math.min(amount, po.total - po.paid)
    persistPurchases(purchases.map((p) => (p.id === id ? { ...p, paid: p.paid + pay } : p)))
    persistSuppliers(
      suppliers.map((s) => (s.id === po.supplierId ? { ...s, balance: Math.max(0, s.balance - pay) } : s))
    )
    persistCash([
      { id: uid(), date: new Date().toISOString(), type: 'depense', label: `Facture ${po.ref} — ${po.supplierName}`, amount: pay },
      ...cash,
    ])
    persistSupplierPayments([
      { id: uid(), date: new Date().toISOString(), supplierId: po.supplierId, supplierName: po.supplierName, amount: pay, method, note: `Facture ${po.ref}` },
      ...supplierPayments,
    ])
    logActivity(`Paiement facture ${po.ref} : ${fmtDH(pay)}`)
  }

  const returnPurchase = (id: string) => {
    const po = purchases.find((p) => p.id === id)
    if (!po || po.status !== 'recue') return
    let curProducts = products
    let curMovements = movements
    po.items.forEach((i) => {
      curProducts = curProducts.map((x) =>
        x.id === i.productId ? { ...x, stock: Math.max(0, x.stock - i.qty) } : x
      )
      curMovements = [
        { id: uid() + i.productId, date: new Date().toISOString(), productId: i.productId, productName: i.name, type: 'retour' as const, qty: -i.qty, note: `Retour ${po.ref}` },
        ...curMovements,
      ]
    })
    persistProducts(curProducts)
    persistMovements(curMovements)
    persistPurchases(purchases.map((p) => (p.id === id ? { ...p, status: 'retournee' } : p)))
    // Cancels the full order value: the unpaid portion is removed from what we owe,
    // and any portion already paid becomes a credit (avoir) — balance may go negative,
    // meaning the supplier now owes us until offset by a future purchase.
    persistSuppliers(
      suppliers.map((s) => (s.id === po.supplierId ? { ...s, balance: s.balance - po.total } : s))
    )
    if (po.paid > 0) {
      logActivity(`Retour fournisseur ${po.ref} — avoir de ${fmtDH(po.paid)} généré`)
    } else {
      logActivity(`Retour fournisseur ${po.ref}`)
    }
  }

  // ---- Quotes ----
  const addQuote = (clientName: string, items: SaleItem[]) => {
    const total = items.reduce((a, i) => a + i.price * i.qty, 0)
    const q: Quote = {
      id: uid(),
      ref: docNumber('DEV', stores.find((s) => s.id === activeStoreId) ?? null, quotes.filter((x) => x.storeId === activeStoreId).length + 1, 4),
      date: new Date().toISOString(),
      clientName,
      items,
      total,
      status: 'en_attente',
    }
    persistQuotes([q, ...quotes])
    logActivity(`Devis ${q.ref} créé (${fmtDH(total)})`)
    return q
  }

  const setQuoteStatus = (id: string, status: Quote['status']) => {
    persistQuotes(quotes.map((q) => (q.id === id ? { ...q, status } : q)))
  }

  const deleteQuote = (id: string) => {
    persistQuotes(quotes.filter((q) => q.id !== id))
  }

  // ---- Cash register ----
  const addCashEntry = (type: CashEntry['type'], label: string, amount: number) => {
    persistCash([{ id: uid(), date: new Date().toISOString(), type, label, amount }, ...cash])
    logActivity(`${type === 'depense' ? 'Dépense' : 'Recette'} : ${label} (${fmtDH(amount)})`)
  }

  const openSession = (openingAmount: number) => {
    const s: RegisterSession = { id: uid(), openedAt: new Date().toISOString(), openingAmount }
    persistSessions([s, ...sessions])
    logActivity(`Ouverture de caisse (${fmtDH(openingAmount)})`)
  }

  // Only this store's open session drives the register state.
  const currentSession = sessions.find((s) => !s.closedAt && s.storeId === activeStoreId) ?? null

  const expectedCash = (session: RegisterSession) => {
    const since = session.openedAt
    const sid = session.storeId ?? activeStoreId
    const cashSales = sales
      .filter((s) => s.storeId === sid && s.date >= since && (s.payment === 'especes' || s.payment === 'mixte'))
      .reduce((a, s) => a + s.total, 0)
    const dep = cash.filter((c) => c.storeId === sid && c.date >= since && c.type === 'depense').reduce((a, c) => a + c.amount, 0)
    const rec = cash.filter((c) => c.storeId === sid && c.date >= since && c.type === 'recette').reduce((a, c) => a + c.amount, 0)
    return session.openingAmount + cashSales + rec - dep
  }

  const closeSession = (closingAmount: number) => {
    if (!currentSession) return
    const expected = expectedCash(currentSession)
    // Snapshot the end-of-day breakdown (this store only) so the archive stays stable over time.
    const sid = currentSession.storeId ?? activeStoreId
    const summary = computeSessionSummary(
      currentSession,
      sales.filter((s) => s.storeId === sid),
      cash.filter((c) => c.storeId === sid),
      clientPayments.filter((p) => p.storeId === sid)
    )
    persistSessions(
      sessions.map((s) =>
        s.id === currentSession.id
          ? { ...s, closedAt: new Date().toISOString(), closingAmount, expectedAmount: expected, summary }
          : s
      )
    )
    logActivity(`Fermeture de caisse — compté ${fmtDH(closingAmount)}, attendu ${fmtDH(expected)}`)
  }

  // ---- Users ----
  // Toutes les mutations utilisateurs passent par la ref (compositions sûres)
  // puis notifient les autres instances useDroguerie (AuthProvider, pages…)
  // pour qu'elles rechargent la liste immédiatement.
  const commitUsers = (next: AppUser[]) => {
    usersRef.current = next
    persistUsers(next)
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('droguerie-sync-pull'))
  }

  const addUser = (data: Omit<AppUser, 'id'>): AppUser => {
    const u: AppUser = { ...data, id: uid() }
    commitUsers([u, ...usersRef.current])
    return u
  }

  // Réinitialise TOUS les identifiants en une seule écriture.
  const resetAllCredentials = () => {
    commitUsers(usersRef.current.map((u) => ({ ...u, passwordHash: '', pinHash: '', mustChangePassword: false })))
    logActivity('Réinitialisation de tous les identifiants')
  }
  const updateUser = (id: string, data: Partial<AppUser>) =>
    commitUsers(usersRef.current.map((u) => (u.id === id ? { ...u, ...data } : u)))
  const deleteUser = (id: string) => commitUsers(usersRef.current.filter((u) => u.id !== id))

  // ---- Attributes ----
  const attrActions = (list: Attribute[], persist: (v: Attribute[]) => void) => ({
    add: (name: string) => persist([{ id: uid(), name: name.trim() }, ...list]),
    rename: (id: string, name: string) => persist(list.map((a) => (a.id === id ? { ...a, name } : a))),
    remove: (id: string) => persist(list.filter((a) => a.id !== id)),
  })

  // ---- Stores (magasins) ----
  const activeStore = stores.find((s) => s.id === activeStoreId) ?? null

  const addStore = (data: Partial<Omit<Store, 'id' | 'createdAt'>> & { name: string; code: string }): Store => {
    const store: Store = {
      id: uid(),
      name: data.name,
      code: data.code,
      address: data.address ?? '',
      city: data.city ?? '',
      phone: data.phone ?? '',
      email: data.email ?? '',
      manager: data.manager ?? '',
      logoDataUrl: data.logoDataUrl ?? '',
      ice: data.ice ?? '',
      idFiscal: data.idFiscal ?? '',
      docPrefix: (data.docPrefix ?? data.code ?? '').toUpperCase(),
      active: data.active ?? true,
      createdAt: new Date().toISOString(),
    }
    persistStores([...stores, store])
    persistDepots([{ id: uid(), storeId: store.id, name: 'Dépôt principal', address: store.address, responsable: store.manager }, ...depots])
    logActivity(`Magasin créé : ${store.name}`)
    return store
  }

  const updateStore = (id: string, data: Partial<Store>) =>
    persistStores(stores.map((s) => (s.id === id ? { ...s, ...data } : s)))

  const switchStore = (id: string) => {
    if (!stores.some((s) => s.id === id)) return
    setActiveStoreId(id)
    setActiveStoreIdState(id)
    if (typeof window !== 'undefined') window.location.reload()
  }

  const deleteStore = (id: string) => {
    if (stores.length <= 1) return
    const next = stores.filter((s) => s.id !== id)
    persistStores(next)
    persistDepots(depots.filter((d) => d.storeId !== id))
    logActivity('Magasin supprimé')
    if (activeStoreId === id) {
      setActiveStoreId(next[0].id)
      if (typeof window !== 'undefined') window.location.reload()
    }
  }

  // ---- Depots ----
  const addDepot = (data: Omit<Depot, 'id'>) => persistDepots([{ ...data, id: uid() }, ...depots])
  const updateDepot = (id: string, data: Partial<Depot>) =>
    persistDepots(depots.map((d) => (d.id === id ? { ...d, ...data } : d)))
  const deleteDepot = (id: string) => persistDepots(depots.filter((d) => d.id !== id))

  // ---- Stock transfers ----
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? ''

  const evt = (action: TransferEvent['action'], user: string, comment = ''): TransferEvent => ({
    id: uid(),
    date: new Date().toISOString(),
    action,
    user,
    comment,
  })

  const addTransfer = (data: {
    sourceStoreId: string
    sourceDepotId?: string
    destStoreId: string
    destDepotId?: string
    user: string
    note?: string
    items: TransferItem[]
  }): Transfer | { error: string } => {
    // Business rule: no transfer to the same store/depot.
    if (data.sourceStoreId === data.destStoreId && (data.sourceDepotId ?? '') === (data.destDepotId ?? '')) {
      return { error: 'same_location' }
    }
    const src = stores.find((s) => s.id === data.sourceStoreId) ?? null
    const transfer: Transfer = {
      id: uid(),
      ref: docNumber('TR', src, transfers.filter((x) => x.sourceStoreId === data.sourceStoreId).length + 1),
      date: new Date().toISOString(),
      sourceStoreId: data.sourceStoreId,
      sourceDepotId: data.sourceDepotId,
      destStoreId: data.destStoreId,
      destDepotId: data.destDepotId,
      user: data.user,
      note: data.note ?? '',
      items: data.items.map((i) => ({ ...i, transferredQty: 0 })),
      status: 'brouillon',
      history: [evt('creation', data.user)],
    }
    persistTransfers([transfer, ...transfers])
    logActivity(`Transfert ${transfer.ref} créé (${storeName(data.sourceStoreId)} → ${storeName(data.destStoreId)})`)
    return transfer
  }

  const updateTransfer = (id: string, patch: { items?: TransferItem[]; note?: string; user?: string }) => {
    persistTransfers(
      transfers.map((tr) => {
        if (tr.id !== id || tr.status !== 'brouillon') return tr
        return {
          ...tr,
          ...(patch.items ? { items: patch.items.map((i) => ({ ...i, transferredQty: 0 })) } : {}),
          ...(patch.note !== undefined ? { note: patch.note } : {}),
          history: [evt('modification', patch.user ?? tr.user), ...tr.history],
        }
      })
    )
  }

  const deleteTransfer = (id: string) => {
    const tr = transfers.find((x) => x.id === id)
    if (!tr) return
    // Release any reservation before removing a validated draft.
    if (tr.status === 'valide') {
      persistProducts(
        products.map((p) => {
          const q = tr.items.filter((i) => i.productId === p.id).reduce((a, i) => a + i.requestedQty, 0)
          return q ? { ...p, reserved: Math.max(0, (p.reserved ?? 0) - q) } : p
        })
      )
    }
    if (tr.status === 'brouillon' || tr.status === 'valide') {
      persistTransfers(transfers.filter((x) => x.id !== id))
      logActivity(`Transfert ${tr.ref} supprimé`)
    }
  }

  // Validation: reserve the requested quantities in the source store.
  const validateTransfer = (id: string, user: string, comment = ''): { ok: boolean; error?: string } => {
    const tr = transfers.find((x) => x.id === id)
    if (!tr || tr.status !== 'brouillon') return { ok: false, error: 'status' }
    // Check availability (physical stock minus already-reserved).
    for (const it of tr.items) {
      const p = products.find((x) => x.id === it.productId)
      if (!p || it.requestedQty > availableStock(p)) return { ok: false, error: 'insufficient' }
    }
    persistProducts(
      products.map((p) => {
        const q = tr.items.filter((i) => i.productId === p.id).reduce((a, i) => a + i.requestedQty, 0)
        return q ? { ...p, reserved: (p.reserved ?? 0) + q } : p
      })
    )
    persistTransfers(transfers.map((x) => (x.id === id ? { ...x, status: 'valide', history: [evt('valide', user, comment), ...x.history] } : x)))
    logActivity(`Transfert ${tr.ref} validé`)
    return { ok: true }
  }

  // Shipping: decrement source stock, release the reservation, log an outbound movement.
  const shipTransfer = (id: string, user: string, comment = ''): { ok: boolean; error?: string } => {
    const tr = transfers.find((x) => x.id === id)
    if (!tr || tr.status !== 'valide') return { ok: false, error: 'status' }
    let curProducts = products
    const newMovements: StockMovement[] = []
    for (const it of tr.items) {
      curProducts = curProducts.map((p) =>
        p.id === it.productId
          ? { ...p, stock: Math.max(0, p.stock - it.requestedQty), reserved: Math.max(0, (p.reserved ?? 0) - it.requestedQty) }
          : p
      )
      newMovements.push({
        id: uid() + it.productId,
        date: new Date().toISOString(),
        productId: it.productId,
        productName: it.name,
        type: 'transfert_out',
        qty: -it.requestedQty,
        note: `Transfert ${tr.ref} → ${storeName(tr.destStoreId)}`,
        storeId: tr.sourceStoreId,
      })
    }
    persistProducts(curProducts)
    persistMovements([...newMovements, ...movements])
    persistTransfers(
      transfers.map((x) =>
        x.id === id
          ? { ...x, status: 'expedie', items: x.items.map((i) => ({ ...i, transferredQty: i.requestedQty })), history: [evt('expedie', user, comment), ...x.history] }
          : x
      )
    )
    logActivity(`Transfert ${tr.ref} expédié`)
    return { ok: true }
  }

  // Reception: add stock to the destination store (creating the product if missing),
  // log an inbound movement, compute discrepancies, and finalize.
  const receiveTransfer = (
    id: string,
    received: { productId: string; receivedQty: number }[],
    user: string,
    comment = ''
  ): { ok: boolean; error?: string } => {
    const tr = transfers.find((x) => x.id === id)
    if (!tr || tr.status !== 'expedie') return { ok: false, error: 'status' }
    let curProducts = products
    const newMovements: StockMovement[] = []
    tr.items.forEach((it) => {
      const rq = received.find((r) => r.productId === it.productId)?.receivedQty ?? 0
      if (rq <= 0) return
      // Match the destination product by barcode within the destination store, else create it.
      const existing = curProducts.find(
        (p) => p.storeId === tr.destStoreId && ((it.barcode && p.barcode === it.barcode) || p.name === it.name)
      )
      if (existing) {
        curProducts = curProducts.map((p) => (p.id === existing.id ? { ...p, stock: p.stock + rq } : p))
      } else {
        curProducts = [
          {
            id: uid(),
            name: it.name,
            barcode: it.barcode,
            category: 'Divers',
            brand: '',
            unit: 'Pièce',
            price: it.cost,
            cost: it.cost,
            stock: rq,
            minStock: 0,
            reserved: 0,
            lot: it.lot,
            serial: it.serial,
            storeId: tr.destStoreId,
          },
          ...curProducts,
        ]
      }
      newMovements.push({
        id: uid() + it.productId,
        date: new Date().toISOString(),
        productId: it.productId,
        productName: it.name,
        type: 'transfert_in',
        qty: rq,
        note: `Transfert ${tr.ref} ← ${storeName(tr.sourceStoreId)}`,
        storeId: tr.destStoreId,
      })
    })
    persistProducts(curProducts)
    persistMovements([...newMovements, ...movements])

    const nextItems = tr.items.map((it) => ({
      ...it,
      receivedQty: received.find((r) => r.productId === it.productId)?.receivedQty ?? 0,
    }))
    const hasDiscrepancy = nextItems.some((i) => (i.receivedQty ?? 0) !== i.transferredQty)
    const history = [evt('termine', user, comment), evt('recu', user, comment), ...tr.history]
    persistTransfers(transfers.map((x) => (x.id === id ? { ...x, status: 'termine', items: nextItems, hasDiscrepancy, history } : x)))
    logActivity(`Transfert ${tr.ref} réceptionné${hasDiscrepancy ? ' (écart constaté)' : ''}`)
    return { ok: true }
  }

  // Store-scoped views returned to every page (mutations keep operating on the full arrays).
  const scoped = <R extends { storeId?: string }>(arr: R[]) => arr.filter((r) => r.storeId === activeStoreId)

  // Les produits peuvent être TRÈS nombreux (50 000+) : on mémorise le filtrage par
  // magasin pour ne pas le recalculer à chaque rendu (sinon l'app fige).
  const scopedProducts = useMemo(
    () => products.filter((p) => p.storeId === activeStoreId),
    [products, activeStoreId]
  )

  return {
    ready,
    // Store-scoped views (filtered to the active store).
    products: scopedProducts,
    sales: scoped(sales),
    movements: scoped(movements),
    purchases: scoped(purchases),
    quotes: scoped(quotes),
    returns: scoped(returns),
    cash: scoped(cash),
    sessions: scoped(sessions),
    clientPayments: scoped(clientPayments),
    credits: scoped(credits),
    loyaltyMovements: scoped(loyaltyMovements),
    supplierPayments: scoped(supplierPayments),
    expenses: scoped(expenses),
    // Shared master data (not scoped per store).
    clients,
    suppliers,
    users,
    activity,
    logActivity,
    categories,
    subcategories,
    brands,
    units,
    settings,
    // Cross-store raw datasets for consolidated dashboards / stock par magasin.
    allProducts: products,
    allSales: sales,
    allMovements: movements,
    allPurchases: purchases,
    allCredits: credits,
    allCash: cash,
    allExpenses: expenses,
    revenues,
    moneyTransfers,
    allSessions: sessions,
    // Magasins.
    stores,
    depots,
    activeStoreId,
    activeStore,
    addStore,
    updateStore,
    deleteStore,
    switchStore,
    addDepot,
    updateDepot,
    deleteDepot,
    // Transferts (cross-store: not filtered — pages match source or dest).
    transfers,
    addTransfer,
    updateTransfer,
    deleteTransfer,
    validateTransfer,
    shipTransfer,
    receiveTransfer,
    currentSession,
    expectedCash,
    addProduct,
    updateProduct,
    deleteProduct,
    importProducts,
    addMovement,
    initializeStock,
    activeStoreInitialized,
    adjustStock,
    applyInventory,
    recordSale,
    recordReturn,
    addClient,
    updateClient,
    deleteClient,
    settleCredit,
    payCredit,
    addManualCredit,
    updateCredit,
    deleteCredit,
    redeemPoints,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    paySupplier,
    addPurchase,
    updatePurchase,
    deletePurchase,
    recordDeliveryNote,
    validateReception,
    payPurchase,
    returnPurchase,
    addQuote,
    setQuoteStatus,
    deleteQuote,
    addCashEntry,
    openSession,
    closeSession,
    addUser,
    updateUser,
    deleteUser,
    resetAllCredentials,
    addExpense,
    markExpensePaid,
    deleteExpense,
    addRevenue,
    deleteRevenue,
    addMoneyTransfer,
    deleteMoneyTransfer,
    categoryActions: attrActions(categories, persistCategories),
    subcategoryActions: attrActions(subcategories, persistSubcategories),
    brandActions: attrActions(brands, persistBrands),
    unitActions: attrActions(units, persistUnits),
    saveSettings,
    resetStats,
  }
}

// Contexte partagé : l'état est calculé UNE fois par le DroguerieProvider et
// distribué à toutes les pages (au lieu d'un rechargement par page).
export type DroguerieValue = ReturnType<typeof useDroguerieState>
export const DroguerieContext = createContext<DroguerieValue | null>(null)

export function useDroguerie(): DroguerieValue {
  const ctx = useContext(DroguerieContext)
  if (!ctx) throw new Error('useDroguerie doit être utilisé dans <DroguerieProvider>')
  return ctx
}
