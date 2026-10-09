// Contrat public du module M2 (comptes et authentification) : seul fichier que les autres modules importent.
// Dépend de : core, referentiel (SélecteurUniversite).
import type { DefinitionModule } from '@/core/modules/types'
import { routesAuth } from './routes'
import { useAuthStore } from './stores/authStore'

export { useAuthStore } from './stores/authStore'
export { default as FenetreNouvellesConditions } from './components/FenetreNouvellesConditions.vue'
export { LIBELLES_ROLE } from './types'
export { changerMotDePasse } from './services/authService'
export { validerMotDePasse, validerTelephone } from './validation'
export type { Profil } from './types'

/** Restaure la session au démarrage. Ne rejette jamais : une erreur laisse simplement l'application en mode visiteur. */
export function initialiserAuth(): Promise<void> {
  return useAuthStore()
    .initialiser()
    .catch(() => undefined)
}

export const authModule: DefinitionModule = {
  nom: 'auth',
  routes: routesAuth,
  // « Compte » mène à la connexion pour un visiteur (garde connexionRequise)
  menu: [{ libelle: 'Compte', vers: '/compte', icone: 'profil' }],
  dependances: ['referentiel'],
}
