'use client'

// Moteur comptable — écritures DÉRIVÉES des documents existants.
//
// L'application enregistre déjà ventes, achats, règlements, dépenses et
// recettes. Plutôt que d'imposer une double saisie, ce module traduit ces
// documents en écritures à partie double, selon le plan comptable marocain
// (CGNC). Rien n'est stocké : tout est recalculé, donc toujours cohérent avec
// les documents — et une correction sur une facture se répercute d'elle-même.

import type { ClientPayment, Expense, Purchase, Revenue, Sale, SupplierPayment } from './store'

/* ----------------------------- Plan comptable ---------------------------- */

export interface Account {
  code: string
  label: string
  /** Classe CGNC : 3 actif circulant, 4 passif circulant, 5 trésorerie, 6 charges, 7 produits. */
  cls: 3 | 4 | 5 | 6 | 7
  /** Sens habituel du solde : actif/charge = débit, passif/produit = crédit. */
  nature: 'debit' | 'credit'
}

export const ACCOUNTS: Account[] = [
  { code: '3421', label: 'Clients', cls: 3, nature: 'debit' },
  { code: '3455', label: 'État — TVA récupérable', cls: 3, nature: 'debit' },
  { code: '4411', label: 'Fournisseurs', cls: 4, nature: 'credit' },
  { code: '4455', label: 'État — TVA facturée', cls: 4, nature: 'credit' },
  { code: '5141', label: 'Banque', cls: 5, nature: 'debit' },
  { code: '5161', label: 'Caisse', cls: 5, nature: 'debit' },
  { code: '6111', label: 'Achats de marchandises', cls: 6, nature: 'debit' },
  { code: '6131', label: 'Locations et charges locatives', cls: 6, nature: 'debit' },
  { code: '6125', label: 'Achats non stockés (eau, électricité)', cls: 6, nature: 'debit' },
  { code: '6141', label: 'Transports', cls: 6, nature: 'debit' },
  { code: '6142', label: 'Frais postaux et télécommunications', cls: 6, nature: 'debit' },
  { code: '6134', label: 'Primes d’assurances', cls: 6, nature: 'debit' },
  { code: '6145', label: 'Fournitures de bureau', cls: 6, nature: 'debit' },
  { code: '6182', label: 'Charges externes diverses', cls: 6, nature: 'debit' },
  { code: '7111', label: 'Ventes de marchandises', cls: 7, nature: 'credit' },
  { code: '7581', label: 'Produits divers', cls: 7, nature: 'credit' },
]

export const accountLabel = (code: string) => ACCOUNTS.find((a) => a.code === code)?.label ?? code

/** Dépense → compte de charge, d'après sa catégorie. */
const EXPENSE_ACCOUNT: Record<string, string> = {
  'Loyer': '6131', 'Électricité': '6125', 'Internet': '6142', 'Fournitures': '6145',
  'Assurance': '6134', 'Bureau': '6145', 'Transport': '6141', 'Autre': '6182',
}

/* -------------------------------- Journaux ------------------------------- */

export type JournalCode = 'VE' | 'AC' | 'BQ' | 'CA' | 'OD'

export const JOURNALS: { code: JournalCode; label: string }[] = [
  { code: 'VE', label: 'Ventes' },
  { code: 'AC', label: 'Achats' },
  { code: 'BQ', label: 'Banque' },
  { code: 'CA', label: 'Caisse' },
  { code: 'OD', label: 'Opérations diverses' },
]

/* ------------------------------- Écritures ------------------------------- */

export interface EntryLine { account: string; debit: number; credit: number }

export interface Entry {
  id: string
  date: string
  journal: JournalCode
  ref: string
  label: string
  lines: EntryLine[]
}

/** Compte de trésorerie correspondant à un mode de règlement. */
const treasury = (method: string): { account: string; journal: JournalCode } =>
  method === 'especes'
    ? { account: '5161', journal: 'CA' }
    : { account: '5141', journal: 'BQ' } // carte, virement, chèque transitent par la banque

const r2 = (n: number) => Math.round(n * 100) / 100

/** Ventile un montant TTC en (HT, TVA) selon le taux en vigueur. */
export function splitVat(ttc: number, ratePct: number): { ht: number; vat: number } {
  const ht = r2(ttc / (1 + ratePct / 100))
  return { ht, vat: r2(ttc - ht) }
}

export interface SourceData {
  sales: Sale[]
  purchases: Purchase[]
  clientPayments: ClientPayment[]
  supplierPayments: SupplierPayment[]
  expenses: Expense[]
  revenues: Revenue[]
  vatRate: number
}

/**
 * Traduit tous les documents d'une période en écritures.
 * Chaque écriture est équilibrée par construction (débit = crédit).
 */
export function buildEntries(d: SourceData, from?: string, to?: string): Entry[] {
  const inRange = (iso: string) => {
    const t = new Date(iso).getTime()
    if (from && t < new Date(from).getTime()) return false
    if (to && t > new Date(to).getTime() + 86399999) return false
    return true
  }
  const out: Entry[] = []

  // --- Ventes : créance ou encaissement, produit HT, TVA facturée ---
  for (const s of d.sales) {
    if (!inRange(s.date)) continue
    const { ht, vat } = splitVat(s.total, d.vatRate)
    // À crédit la contrepartie est le client ; sinon la trésorerie.
    const counter = s.payment === 'credit' ? { account: '3421', journal: 'VE' as JournalCode } : treasury(s.payment === 'especes' ? 'especes' : 'carte')
    out.push({
      id: `ve_${s.id}`, date: s.date, journal: 'VE',
      ref: s.id.slice(-8).toUpperCase(),
      label: s.clientName ? `Vente — ${s.clientName}` : 'Vente comptoir',
      lines: [
        { account: counter.account, debit: r2(s.total), credit: 0 },
        { account: '7111', debit: 0, credit: ht },
        { account: '4455', debit: 0, credit: vat },
      ],
    })
  }

  // --- Achats : seuls les achats RÉCEPTIONNÉS constituent une charge ---
  for (const p of d.purchases) {
    if (!inRange(p.date) || p.status === 'en_attente') continue
    const { ht, vat } = splitVat(p.total, d.vatRate)
    out.push({
      id: `ac_${p.id}`, date: p.date, journal: 'AC',
      ref: p.ref,
      label: `Achat — ${p.supplierName}`,
      lines: [
        { account: '6111', debit: ht, credit: 0 },
        { account: '3455', debit: vat, credit: 0 },
        { account: '4411', debit: 0, credit: r2(p.total) },
      ],
    })
  }

  // --- Règlements clients : la créance s'éteint ---
  for (const c of d.clientPayments) {
    if (!inRange(c.date)) continue
    const tr = treasury(c.method)
    out.push({
      id: `rc_${c.id}`, date: c.date, journal: tr.journal,
      ref: c.id.slice(-8).toUpperCase(),
      label: `Règlement client — ${c.clientName}`,
      lines: [
        { account: tr.account, debit: r2(c.amount), credit: 0 },
        { account: '3421', debit: 0, credit: r2(c.amount) },
      ],
    })
  }

  // --- Règlements fournisseurs : la dette s'éteint ---
  for (const s of d.supplierPayments) {
    if (!inRange(s.date)) continue
    const tr = treasury(s.method)
    out.push({
      id: `rf_${s.id}`, date: s.date, journal: tr.journal,
      ref: s.id.slice(-8).toUpperCase(),
      label: `Règlement fournisseur — ${s.supplierName}`,
      lines: [
        { account: '4411', debit: r2(s.amount), credit: 0 },
        { account: tr.account, debit: 0, credit: r2(s.amount) },
      ],
    })
  }

  // --- Dépenses : charge par nature ; non payée = dette fournisseur ---
  for (const e of d.expenses) {
    if (!inRange(e.date)) continue
    const acc = EXPENSE_ACCOUNT[e.category] ?? '6182'
    const paid = e.status === 'payee'
    out.push({
      id: `dp_${e.id}`, date: e.date, journal: paid ? 'CA' : 'OD',
      ref: e.id.slice(-8).toUpperCase(),
      label: `${e.category} — ${e.label}`,
      lines: [
        { account: acc, debit: r2(e.amount), credit: 0 },
        { account: paid ? '5161' : '4411', debit: 0, credit: r2(e.amount) },
      ],
    })
  }

  // --- Recettes diverses ---
  for (const v of d.revenues) {
    if (!inRange(v.date)) continue
    out.push({
      id: `rv_${v.id}`, date: v.date, journal: 'CA',
      ref: v.id.slice(-8).toUpperCase(),
      label: `${v.category} — ${v.label}`,
      lines: [
        { account: '5161', debit: r2(v.amount), credit: 0 },
        { account: '7581', debit: 0, credit: r2(v.amount) },
      ],
    })
  }

  return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/* --------------------------------- Soldes -------------------------------- */

export interface AccountBalance { code: string; label: string; debit: number; credit: number; balance: number }

/** Cumul par compte. Le solde suit la nature du compte (actif/charge au débit). */
export function balances(entries: Entry[]): AccountBalance[] {
  const m = new Map<string, { d: number; c: number }>()
  for (const e of entries) {
    for (const l of e.lines) {
      const x = m.get(l.account) ?? { d: 0, c: 0 }
      x.d += l.debit
      x.c += l.credit
      m.set(l.account, x)
    }
  }
  return [...m.entries()]
    .map(([code, v]) => {
      const nature = ACCOUNTS.find((a) => a.code === code)?.nature ?? 'debit'
      return {
        code, label: accountLabel(code),
        debit: r2(v.d), credit: r2(v.c),
        balance: r2(nature === 'debit' ? v.d - v.c : v.c - v.d),
      }
    })
    .sort((a, b) => a.code.localeCompare(b.code))
}

/** Totaux de contrôle : en partie double, débit et crédit doivent coïncider. */
export function totals(entries: Entry[]): { debit: number; credit: number; balanced: boolean } {
  let debit = 0, credit = 0
  for (const e of entries) for (const l of e.lines) { debit += l.debit; credit += l.credit }
  debit = r2(debit); credit = r2(credit)
  return { debit, credit, balanced: Math.abs(debit - credit) < 0.01 }
}

/** Déclaration de TVA : collectée (4455) moins récupérable (3455). */
export function vatReport(entries: Entry[]): { collected: number; deductible: number; due: number } {
  let collected = 0, deductible = 0
  for (const e of entries) {
    for (const l of e.lines) {
      if (l.account === '4455') collected += l.credit - l.debit
      if (l.account === '3455') deductible += l.debit - l.credit
    }
  }
  collected = r2(collected)
  deductible = r2(deductible)
  return { collected, deductible, due: r2(collected - deductible) }
}
