// Contrat public du module M6 (messagerie). Dépend de : core, auth, securite, annonces.
// Le bouton « Envoyer un message » de l'annonce (M4) mène à /messages/nouveau/<id> par son chemin, sans importer ce module.
import type { DefinitionModule } from '@/core/modules/types'
import { routesMessagerie } from './routes'

export { compterNonLus } from './services/messagerieService'

export const messagerieModule: DefinitionModule = {
  nom: 'messagerie',
  routes: routesMessagerie,
  menu: [{ libelle: 'Messages', vers: '/messages', icone: 'messages', roles: ['etudiant', 'proprietaire'] }],
  dependances: ['auth', 'securite', 'annonces'],
}
