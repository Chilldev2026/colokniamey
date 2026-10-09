// Contrat public du module M3 (profils) : seul fichier que les autres modules importent.
// Dépend de : core, referentiel, auth, securite.
import type { DefinitionModule } from '@/core/modules/types'
import { routesProfils } from './routes'

/** Carte du profil public minimal d'un utilisateur (annonces, messagerie). */
export { default as CarteProfilPublic } from './components/CarteProfilPublic.vue'
export { default as AvatarProfil } from './components/AvatarProfil.vue'
export { lireProfilPublic, urlAvatar } from './services/profilsService'
export type { ProfilPublic } from './types'

export const profilsModule: DefinitionModule = {
  nom: 'profils',
  routes: routesProfils,
  // Accès par la page « Compte » (M2) : pas d'entrée de menu propre
  menu: [],
  dependances: ['referentiel', 'auth', 'securite'],
}
