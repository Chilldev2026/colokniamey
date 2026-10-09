// Contrat public du module K (vérification d'identité). Dépend de : core, auth, profils, securite.
// Développé et testé en entier, mais désactivé par défaut : paramètre kyc_actif = faux (RG59).
// Les autres modules n'importent que ce fichier :
//  - BadgeIdentite : badge public, affiché par la carte de profil quand K est actif ;
//  - BandeauIdentite : invite à se faire vérifier (M4 : publier une place en colocation ; M8 : groupes) ;
//  - côté base, identite_verifiee(uid) et exiger_identite_verifiee() (voir supabase/migrations/0960_kyc.sql).
import type { DefinitionModule } from '@/core/modules/types'
import { routesIdentite } from './routes'

export { default as BadgeIdentite } from './components/BadgeIdentite.vue'
export { default as BandeauIdentite } from './components/BandeauIdentite.vue'
export { lireIdentiteVerifiee } from './services/identiteService'

export const identiteModule: DefinitionModule = {
  nom: 'identite',
  routes: routesIdentite,
  // Accès par la page « Compte » (lien affiché seulement si le KYC est actif) : pas d'entrée de menu propre
  menu: [],
  dependances: ['auth', 'profils', 'securite'],
  optionnel: true,
}
