// Contrat public du module M8 (groupes de colocation). Dépend de : core, auth, securite, annonces, identite.
// Il se branche sur le détail d'une annonce par le point d'extension « annonce-detail » (src/core/extensions.ts) :
// M4 n'importe jamais ce module, et sans lui la page d'annonce fonctionne.
import type { DefinitionModule } from '@/core/modules/types'
import { enregistrerExtension } from '@/core/extensions'
import SectionGroupes from './components/SectionGroupes.vue'
import { routesGroupes } from './routes'

export { default as BadgeGroupes } from './components/BadgeGroupes.vue'

enregistrerExtension('annonce-detail', SectionGroupes)

export const groupesModule: DefinitionModule = {
  nom: 'groupes',
  routes: routesGroupes,
  menu: [{ libelle: 'Groupes', vers: '/groupes', icone: 'groupes', roles: ['etudiant'] }],
  dependances: ['auth', 'securite', 'annonces', 'identite'],
  optionnel: true,
}
