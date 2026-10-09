// Diffusion en temps réel de l'état de la plateforme (A5, RGA15, RGP23).
// Un canal privé « plateforme » reçoit les changements des paramètres publics (maintenance, inscriptions…) :
// les utilisateurs connectés basculent vers la page de maintenance, ou en sortent, sans recharger.
// Si la connexion Realtime échoue, rien ne casse : l'état est relu à la navigation suivante (cache de 60 s).

import type { Router } from 'vue-router'
import { supabase } from './supabase'
import { estAdminCourant } from './acces'
import { appliquerEtatMaintenance, parametres, type ParametresPublics } from './parametres'

interface MessageParametre {
  cle: keyof ParametresPublics
  valeur: unknown
}

function estMessageParametre(charge: unknown): charge is MessageParametre {
  return typeof charge === 'object' && charge !== null && 'cle' in charge && typeof charge.cle === 'string' && 'valeur' in charge
}

/** Applique un paramètre reçu. Exportée pour les tests. */
export function appliquerParametreRecu(charge: unknown, router: Pick<Router, 'currentRoute' | 'replace'>): void {
  if (!estMessageParametre(charge)) return
  // Seules les clés connues sont prises en compte
  if (!(charge.cle in parametres.value)) return
  ;(parametres.value as unknown as Record<string, unknown>)[charge.cle] = charge.valeur

  if (charge.cle === 'maintenance_active' && typeof charge.valeur === 'boolean') {
    appliquerEtatMaintenance(charge.valeur)
    const route = router.currentRoute.value
    if (charge.valeur && !estAdminCourant.value && !route.meta.horsMaintenance) {
      void router.replace({ name: 'maintenance' })
    } else if (!charge.valeur && route.name === 'maintenance') {
      void router.replace('/')
    }
  }
}

export function demarrerDiffusionPlateforme(router: Router): () => void {
  const canal = supabase
    .channel('plateforme', { config: { private: true } })
    .on('broadcast', { event: 'parametre' }, (message) => appliquerParametreRecu(message.payload, router))
    .subscribe()
  return () => void supabase.removeChannel(canal)
}
