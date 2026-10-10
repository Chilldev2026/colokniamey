// Contrat public du module M5 (recherche, carte, favoris). Dépend de : core, referentiel, auth, securite, annonces.
// M8 pourra remplacer filtrer_annonces() et annonces_carte() (base) pour le filtre « colocations en formation ».
import type { DefinitionModule } from '@/core/modules/types'
import { routesRecherche } from './routes'

export { default as BoutonFavori } from './components/BoutonFavori.vue'
export { useFavorisStore } from './stores/favorisStore'

export const rechercheModule: DefinitionModule = {
  nom: 'recherche',
  routes: routesRecherche,
  menu: [
    { libelle: 'Rechercher', vers: '/recherche', icone: 'recherche' },
    { libelle: 'Favoris', vers: '/favoris', icone: 'favoris', roles: ['etudiant', 'proprietaire'] },
  ],
  dependances: ['referentiel', 'auth', 'securite', 'annonces'],
}
