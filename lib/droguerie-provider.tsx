'use client'

import React from 'react'
import { DroguerieContext, useDroguerieState } from './store'

/** Calcule l'état Droguerie UNE seule fois et le partage à toute l'app via le contexte.
 *  Évite que chaque page recharge/re-parse les produits (50 000+) depuis IndexedDB. */
export function DroguerieProvider({ children }: { children: React.ReactNode }) {
  const value = useDroguerieState()
  return <DroguerieContext.Provider value={value}>{children}</DroguerieContext.Provider>
}
