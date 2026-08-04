'use client'

// Cette page n'était référencée par aucun menu — elle était donc invisible.
//
// Elle portait pourtant un second formulaire « Ma boutique » modifiant les MÊMES
// réglages que Paramètres › Société : nom, téléphone, TVA, adresse, devise,
// message du ticket, avec son propre bouton d'enregistrement. Deux formulaires
// concurrents sur les mêmes données finissent toujours par s'écraser l'un
// l'autre — celui qu'on ne remplit pas réécrit ce que l'autre vient de poser.
//
// Elle redirige donc vers la fiche Société, seule à faire autorité. La carte
// d'information sur l'application, qui n'existait qu'ici, y a été déplacée ;
// les sauvegardes et l'import ont déjà leurs propres écrans au menu.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import Loader from '@/components/Loader'

export default function ParametresPage() {
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
