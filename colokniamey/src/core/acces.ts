// Rôle de la personne connectée, tel que le module des comptes (M2) le renseigne.
// Le socle ne connaît pas l'authentification : il lit seulement ces valeurs.
// Ce contrôle sert à l'affichage ; la vraie protection reste la RLS (RGA27).

import { computed, ref } from 'vue'
import type { Role } from './modules/types'

export const roleCourant = ref<Role | null>(null)

export const estAdminCourant = computed(
  () => roleCourant.value === 'admin' || roleCourant.value === 'super_admin',
)

export function definirRoleCourant(role: Role | null): void {
  roleCourant.value = role
}

/** Vrai si le rôle courant figure dans la liste (liste absente = accès public). */
export function roleAutorise(roles: Role[] | undefined): boolean {
  if (!roles || roles.length === 0) return true
  return roleCourant.value !== null && roles.includes(roleCourant.value)
}

// Les gardes de route attendent que la session soit restaurée avant de décider :
// sinon un utilisateur connecté serait renvoyé vers la connexion à chaque rechargement.
let attente: Promise<void> = Promise.resolve()

export function declarerAttenteAuth(restauration: Promise<void>): void {
  attente = restauration
}

export function attendreAuth(): Promise<void> {
  return attente
}

export const CHEMIN_CONNEXION = '/connexion'
export const CHEMIN_APRES_CONNEXION = '/compte'
