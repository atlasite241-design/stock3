'use client'

/**
 * Fiche employé — vue unique.
 *
 * Une personne = un compte applicatif + une extension RH. L'écran n'en montre
 * qu'une seule fiche ; le stockage en tient deux, parce que la collection
 * `users` est lisible par toute session (l'écran de connexion en dépend) et
 * qu'on ne peut donc pas y ranger un salaire.
 *
 * Ce module fait la jointure dans les deux sens et garantit qu'on ne crée
 * jamais l'un sans l'autre.
 */

import { useCallback, useMemo } from 'react'
import { useHrList } from './hr-store'
import { useDroguerie, type AppUser } from './store'
import { todayISO, type Employee } from './hr'

/** Employé enrichi des informations du compte : c'est CE type que les écrans manipulent. */
export interface EmployeeView extends Employee {
  role: AppUser['role']
  /** Le compte peut-il se connecter ? Un employé sans identifiant existe, mais n'entre pas. */
  canLogin: boolean
  accountActive: boolean
}

export interface NewEmployee {
  name: string
  poste: string
  hireDate: string
  contract: Employee['contract']
  baseSalary: number
  role: AppUser['role']
  matricule?: string
  phone?: string
  email?: string
  cin?: string
  cnss?: string
  departement?: string
  address?: string
  birthDate?: string
  rib?: string
  maritalStatus?: Employee['maritalStatus']
  dependents?: number
  note?: string
}

/** Matricule séquentiel : MAT-001, MAT-002… Lisible, et propre à l'enseigne. */
export function nextMatricule(existing: Employee[]): string {
  const max = existing.reduce((m, e) => {
    const n = Number(/(\d+)\s*$/.exec(e.matricule ?? '')?.[1])
    return Number.isFinite(n) && n > m ? n : m
  }, 0)
  return `MAT-${String(max + 1).padStart(3, '0')}`
}

export function useEmployees() {
  const list = useHrList<Employee>('employees')
  const { users, addUser, updateUser } = useDroguerie()

  const byUser = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  const toView = useCallback(
    (e: Employee): EmployeeView => {
      const u = byUser.get(e.userId)
      return {
        ...e,
        // Le nom fait autorité côté compte : renommer dans Utilisateurs ne doit
        // pas laisser un ancien nom traîner dans la RH.
        name: u?.name ?? e.name,
        email: u?.email ?? e.email,
        phone: u?.phone || e.phone,
        role: u?.role ?? 'Vendeur',
        canLogin: !!(u?.passwordHash || u?.pinHash),
        accountActive: u?.active ?? false,
      }
    },
    [byUser]
  )

  const employees = useMemo(() => list.items.map(toView), [list.items, toView])
  const active = useMemo(() => employees.filter((e) => e.active), [employees])

  const byId = useCallback((id: string) => employees.find((e) => e.id === id), [employees])
  const nameOf = useCallback((id: string) => employees.find((e) => e.id === id)?.name ?? '—', [employees])

  /**
   * Crée la personne : compte applicatif PUIS extension RH. Les deux, toujours.
   * Le compte est créé sans mot de passe — l'employé existe dans la RH même
   * s'il n'utilise jamais l'application ; l'accès s'ouvre depuis Utilisateurs.
   */
  const create = useCallback(
    (data: NewEmployee): EmployeeView => {
      const user = addUser({
        name: data.name.trim(),
        phone: data.phone ?? '',
        email: data.email,
        role: data.role,
        active: true,
      })
      const employee = list.add({
        userId: user.id,
        matricule: data.matricule?.trim() || nextMatricule(list.all),
        name: data.name.trim(),
        poste: data.poste,
        departement: data.departement,
        hireDate: data.hireDate,
        contract: data.contract,
        baseSalary: Number(data.baseSalary) || 0,
        cin: data.cin,
        cnss: data.cnss,
        phone: data.phone,
        email: data.email,
        address: data.address,
        birthDate: data.birthDate,
        rib: data.rib,
        maritalStatus: data.maritalStatus,
        dependents: data.dependents,
        note: data.note,
        active: true,
      })
      return toView(employee)
    },
    [addUser, list, toView]
  )

  /** Modifie la fiche. Les champs partagés (nom, téléphone, e-mail, rôle) sont
   *  répercutés sur le compte : une seule fiche à l'écran, donc une seule saisie. */
  const patch = useCallback(
    (id: string, changes: Partial<EmployeeView>) => {
      const current = list.all.find((e) => e.id === id)
      if (!current) return
      const { role, canLogin: _canLogin, accountActive: _accountActive, ...hr } = changes
      list.update(id, hr)
      const account: Partial<AppUser> = {}
      if (changes.name !== undefined) account.name = changes.name
      if (changes.phone !== undefined) account.phone = changes.phone
      if (changes.email !== undefined) account.email = changes.email
      if (role !== undefined) account.role = role
      if (changes.active !== undefined) account.active = changes.active
      if (Object.keys(account).length) updateUser(current.userId, account)
    },
    [list, updateUser]
  )

  /** Désactive sans supprimer : les bulletins et le pointage passés restent rattachés. */
  const archive = useCallback(
    (id: string, endDate?: string) => patch(id, { active: false, endDate: endDate || new Date().toISOString().slice(0, 10) }),
    [patch]
  )

  /*
   * LE TROU DU MODÈLE « une personne = une fiche » : créer depuis la RH crée
   * compte + fiche, mais un compte né AILLEURS (inscription approuvée, écran
   * Utilisateurs) n'a jamais de fiche — la personne ne peut ni pointer, ni
   * être payée. Ces comptes orphelins sont détectés ici, et une fiche
   * minimale se crée en un clic : matricule auto, poste = rôle du compte,
   * embauche = aujourd'hui, salaire à compléter.
   */
  const sansFiche = useMemo(() => {
    const avecFiche = new Set(list.all.map((e) => e.userId))
    return users.filter((u) => u.active && !u.pendingApproval && !avecFiche.has(u.id))
  }, [users, list.all])

  const creerFichesManquantes = useCallback((): number => {
    let n = 0
    const dejaLa = new Set(list.all.map((e) => e.userId))
    for (const u of users) {
      if (!u.active || u.pendingApproval || dejaLa.has(u.id)) continue
      list.add({
        userId: u.id,
        matricule: nextMatricule(list.all),
        name: u.name,
        poste: u.role,
        hireDate: todayISO(),
        contract: 'cdi',
        baseSalary: 0,
        phone: u.phone,
        email: u.email,
        active: true,
      })
      dejaLa.add(u.id)
      n++
    }
    return n
  }, [users, list])

  return { employees, active, all: list.all, byId, nameOf, create, patch, archive, remove: list.remove, sansFiche, creerFichesManquantes }
}
