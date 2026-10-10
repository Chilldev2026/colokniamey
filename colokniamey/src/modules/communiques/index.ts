// Contrat public du module A4 (communiqués : affichage). Dépend de : core.
// Il se branche sur la zone de communiqué du layout (M0) par le point d'extension « zone-communique » :
// si le module est retiré de src/app/modules.ts, la zone reste vide et l'application fonctionne.
import type { DefinitionModule } from '@/core/modules/types'
import { enregistrerExtension } from '@/core/extensions'
import BandeauCommunique from './components/BandeauCommunique.vue'

export { default as BandeauCommunique } from './components/BandeauCommunique.vue'

enregistrerExtension('zone-communique', BandeauCommunique)

export const communiquesModule: DefinitionModule = {
  nom: 'communiques',
  routes: [],
  menu: [],
  optionnel: true,
}
