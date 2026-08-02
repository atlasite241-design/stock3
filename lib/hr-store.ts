'use client'

/**
 * Persistance des collections RH.
 *
 * Dix-huit collections partagent le même besoin : lire, ajouter, modifier,
 * supprimer, et se recharger quand la synchronisation rapatrie des données
 * d'un autre appareil. Les câbler une par une dans `store.ts` (déjà 3 500
 * lignes) aurait ajouté 18 états, 18 chargements et 18 persistances presque
 * identiques. Un seul hook générique fait le travail.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getActiveStoreId, loadCollection, saveCollection, uid } from './store'

export const HR_KEYS = {
  employees: 'dp_hr_employees',
  documents: 'dp_hr_documents',
  attendance: 'dp_hr_attendance',
  leaves: 'dp_hr_leaves',
  shifts: 'dp_hr_shifts',
  teams: 'dp_hr_teams',
  holidays: 'dp_hr_holidays',
  adjustments: 'dp_hr_adjustments',
  payslips: 'dp_hr_payslips',
  evaluations: 'dp_hr_evaluations',
  objectives: 'dp_hr_objectives',
  actions: 'dp_hr_actions',
  trainings: 'dp_hr_trainings',
  skills: 'dp_hr_skills',
  certifications: 'dp_hr_certifications',
  jobs: 'dp_hr_jobs',
  applications: 'dp_hr_applications',
  badges: 'dp_hr_badges',
} as const

export type HrCollection = keyof typeof HR_KEYS

/** Collections dont les enregistrements portent un magasin. Les référentiels
 *  (horaires, jours fériés) sont communs à toute l'enseigne. */
export const HR_SCOPED: HrCollection[] = [
  'employees', 'documents', 'attendance', 'leaves', 'teams', 'adjustments',
  'payslips', 'evaluations', 'objectives', 'actions', 'trainings', 'skills',
  'certifications', 'jobs', 'applications', 'badges',
]

interface HasId {
  id: string
  storeId?: string
}

export interface HrList<T extends HasId> {
  items: T[]
  /** Tous les enregistrements, magasin actif compris — pour les vues globales. */
  all: T[]
  add: (item: Omit<T, 'id'> & { id?: string }) => T
  /** Insère ou remplace selon l'id. Sert au pointage : un seul enregistrement
   *  par personne et par jour, quel que soit le nombre de scans. */
  put: (item: T) => T
  update: (id: string, patch: Partial<T>) => void
  remove: (id: string) => void
  replaceAll: (next: T[]) => void
}

/**
 * Liste RH persistée. `scoped` filtre sur le magasin actif à la lecture et
 * estampille les nouveaux enregistrements à l'écriture — même règle que le
 * reste de l'application.
 */
export function useHrList<T extends HasId>(name: HrCollection): HrList<T> {
  const key = HR_KEYS[name]
  const scoped = HR_SCOPED.includes(name)
  const [all, setAll] = useState<T[]>([])
  const [storeId, setStoreId] = useState('')

  const reload = useCallback(() => {
    setAll(loadCollection<T[]>(key, []))
    setStoreId(getActiveStoreId())
  }, [key])

  useEffect(() => {
    reload()
    // 'droguerie-store-change' couvre les écritures locales (y compris celles
    // d'un autre onglet), 'droguerie-sync-pull' les données venues du serveur.
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail === key || detail === 'dp_active_store' || detail === undefined) reload()
    }
    window.addEventListener('droguerie-store-change', onChange)
    window.addEventListener('droguerie-sync-pull', reload)
    return () => {
      window.removeEventListener('droguerie-store-change', onChange)
      window.removeEventListener('droguerie-sync-pull', reload)
    }
  }, [key, reload])

  const persist = useCallback((next: T[]) => {
    setAll(next)
    saveCollection(key, next)
  }, [key])

  const items = useMemo(
    () => (scoped && storeId ? all.filter((x) => !x.storeId || x.storeId === storeId) : all),
    [all, scoped, storeId]
  )

  const add: HrList<T>['add'] = useCallback((item) => {
    const created = {
      ...item,
      id: item.id ?? uid(),
      ...(scoped && !(item as HasId).storeId ? { storeId: getActiveStoreId() } : {}),
    } as T
    persist([created, ...loadCollection<T[]>(key, [])])
    return created
  }, [key, persist, scoped])

  const put: HrList<T>['put'] = useCallback((item) => {
    const current = loadCollection<T[]>(key, [])
    const stamped = {
      ...item,
      ...(scoped && !item.storeId ? { storeId: getActiveStoreId() } : {}),
    } as T
    const exists = current.some((x) => x.id === item.id)
    persist(exists ? current.map((x) => (x.id === item.id ? stamped : x)) : [stamped, ...current])
    return stamped
  }, [key, persist, scoped])

  const update = useCallback((id: string, patch: Partial<T>) => {
    persist(loadCollection<T[]>(key, []).map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }, [key, persist])

  const remove = useCallback((id: string) => {
    persist(loadCollection<T[]>(key, []).filter((x) => x.id !== id))
  }, [key, persist])

  const replaceAll = useCallback((next: T[]) => persist(next), [persist])

  return { items, all, add, put, update, remove, replaceAll }
}
