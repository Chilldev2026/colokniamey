// Contrat public du module M7 (signalements). Dépend de : core, auth, securite, annonces, messagerie.
// - BoutonSignaler : bouton et formulaire modal réutilisables (annonce, profil, message) ;
// - le détail d'une annonce (M4) et un message (M6) reçoivent leur bouton par des points d'extension
//   (« annonce-detail » et « message-actions », src/core/extensions.ts) : ces modules n'importent jamais M7.
import type { DefinitionModule } from '@/core/modules/types'
import { enregistrerExtension } from '@/core/extensions'
import SignalerAnnonce from './components/SignalerAnnonce.vue'
import SignalerMessage from './components/SignalerMessage.vue'
import { routesSignalements } from './routes'

export { default as BoutonSignaler } from './components/BoutonSignaler.vue'
export type { CibleSignalement, MotifSignalement } from './services/signalementsService'

enregistrerExtension('annonce-detail', SignalerAnnonce)
enregistrerExtension('message-actions', SignalerMessage)

export const signalementsModule: DefinitionModule = {
  nom: 'signalements',
  routes: routesSignalements,
  // Accès par la page « Compte » : pas d'entrée dans la barre de navigation
  menu: [],
  dependances: ['auth', 'securite', 'annonces', 'messagerie'],
  optionnel: true,
}
