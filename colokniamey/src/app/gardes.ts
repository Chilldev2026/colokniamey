// Décisions d'accès aux routes (RGA04, RGA26). Fonction pure : le router lui donne l'état, elle répond.
// Ces contrôles servent à l'affichage ; la vraie protection reste la base et les Edge Functions (RGA27).

import type { RouteMeta } from 'vue-router'
import type { Role } from '@/core/modules/types'
import { accueilPourRole, CHEMIN_APRES_CONNEXION, CHEMIN_CONNEXION } from '@/core/acces'

export interface EtatAcces {
  role: Role | null
  /** Double authentification faite pour la session (calculé seulement si la route l'exige). */
  aal2: boolean
}

export type Decision = true | { path: string; query?: Record<string, string>; message?: string }

export const CHEMIN_MFA = '/admin/mfa'

export function decider(meta: RouteMeta, cheminComplet: string, etat: EtatAcces): Decision {
  // Page réservée aux visiteurs (connexion, inscription) : une personne connectée va à son espace
  if (meta.visiteurSeulement && etat.role !== null) {
    return { path: etat.role === 'admin' || etat.role === 'super_admin' ? accueilPourRole(etat.role) : CHEMIN_APRES_CONNEXION }
  }
  // Page qui exige une connexion : retour à la page voulue après la connexion
  if (meta.connexionRequise && etat.role === null) {
    return { path: CHEMIN_CONNEXION, query: { redirect: cheminComplet } }
  }
  // RGA26 : une route interdite renvoie vers l'accueil du rôle, avec un message pour les admins
  const roles = meta.roles ?? []
  if (roles.length > 0 && (etat.role === null || !roles.includes(etat.role))) {
    if (etat.role === 'admin' || etat.role === 'super_admin') {
      return { path: accueilPourRole(etat.role), message: 'Cette page est réservée au super-administrateur.' }
    }
    return { path: '/' }
  }
  // RGA04 : l'espace admin exige la double authentification
  if (meta.exigeAal2 && !etat.aal2) {
    return { path: CHEMIN_MFA, query: { redirect: cheminComplet } }
  }
  return true
}
