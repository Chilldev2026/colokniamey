// Contrat public du module référentiel : seul fichier que les autres modules peuvent importer.
// Aucune page propre : le module ne fournit ni route ni entrée de menu.
import type { DefinitionModule } from '@/core/modules/types'

export { listerVilles, listerQuartiers, listerUniversites } from './services/referentielService'
export { default as SelecteurUniversite } from './components/SelecteurUniversite.vue'
export { aUnePosition } from './types'
export type { Ville, Quartier, Universite } from './types'

export const referentielModule: DefinitionModule = {
  nom: 'referentiel',
  routes: [],
  menu: [],
}
