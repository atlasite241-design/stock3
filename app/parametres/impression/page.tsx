'use client'

// Cette page a été retirée du menu : ses deux réglages — largeur du rouleau
// (58/80 mm) et message de bas de ticket — ont rejoint Paramètres › Société,
// onglet Ticket. Ils y sont accompagnés de l'aperçu du ticket, qui montre
// l'effet de chaque changement : un réglage d'impression se juge sur son
// rendu, pas sur son intitulé.
//
// Redirection plutôt que suppression : les favoris déjà posés continuent de
// mener quelque part.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'

export default function ImpressionPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/parametres/societe')
  }, [router])
  return (
    <AppShell>
      <Loader />
    </AppShell>
  )
}
