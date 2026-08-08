'use client'

// Cette page n'était référencée par aucun menu — elle était donc invisible.
//
// Elle portait pourtant une version 3-en-1 des quatre écrans du menu
// Utilisateurs (équipe, permissions, journal), avec sa PROPRE matrice de
// permissions codée en dur : sept familles (pos, produits, stock, achats,
// rapports, caisse, parametres) qui ne correspondent plus au catalogue réel
// de lib/permissions.ts — quatre-vingts permissions réparties en neuf
// catégories. Un écran caché qui affiche des droits faux est pire qu'un écran
// absent : il fait croire à un état des lieux.
//
// Elle redirige donc vers la liste des employés, dont les onglets Rôles,
// Permissions et Journal ont chacun leur entrée au menu. Une redirection
// plutôt qu'une suppression : les favoris déjà posés continuent de mener
// quelque part.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'

export default function UtilisateursPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/utilisateurs/employes')
  }, [router])
  return (
    <AppShell>
      <Loader />
    </AppShell>
  )
}
