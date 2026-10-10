// Contrat public du module M4 (annonces). Dépend de : core, referentiel, auth, securite, profils, identite.
// Les modules suivants (M5 recherche, M6 messagerie, M8 groupes) n'importent que ce fichier.
import type { DefinitionModule } from '@/core/modules/types'
import { routesAnnonces } from './routes'

export { lireAnnonceDetail, listerEquipements } from './services/annoncesService'
export { formaterMontant } from './validation'
export { LIBELLES_TYPE } from './types'
export type { AnnonceDetail, StatutAnnonce, TypeAnnonce } from './types'

export const annoncesModule: DefinitionModule = {
  nom: 'annonces',
  routes: routesAnnonces,
  menu: [{ libelle: 'Mes annonces', vers: '/annonces/mes-annonces', icone: 'accueil', roles: ['etudiant', 'proprietaire'] }],
  dependances: ['referentiel', 'auth', 'securite', 'profils', 'identite'],
}
