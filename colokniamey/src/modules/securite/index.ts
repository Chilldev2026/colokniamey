// Contrat public du module S (sécurité du contenu) : seul fichier que les autres modules importent.
// Dépend de : core, auth. Aucune page ni entrée de menu : le module fournit un composant et des services.
//
// Règles pour les modules suivants :
//  - tout texte enregistré porte le déclencheur controler_colonnes_texte (voir supabase/migrations/0350) ;
//  - toute photo passe par EnvoiPhoto, jamais par un envoi direct vers Storage.
import type { DefinitionModule } from '@/core/modules/types'

export { default as EnvoiPhoto } from './components/EnvoiPhoto.vue'
export {
  controlerTexte,
  deciderPhoto,
  messageErreurContenu,
  precontrolerPhoto,
  televerserPhoto,
} from './services/securiteService'
export type { IssueTexte, UsagePhoto } from './services/securiteService'
export { traiterImage, ErreurPhoto } from './images/traitement'
export type { PhotoTraitee } from './images/traitement'

export const securiteModule: DefinitionModule = {
  nom: 'securite',
  routes: [],
  menu: [],
  dependances: ['auth'],
}
