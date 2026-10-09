// Sous-modules actifs de l'espace admin. Pour en activer ou désactiver un, on ajoute ou retire son import ici ;
// le menu et les routes de la coque sont construits à partir de cette liste.
import { identitesSousModule } from './identites'
import { moderationSousModule } from './moderation'
import { plateformeSousModule } from './plateforme'
import { referentielAdminSousModule } from './referentiel'
import { utilisateursSousModule } from './utilisateurs'
import type { SousModuleAdmin } from './types'

export const sousModulesAdmin: SousModuleAdmin[] = [
  utilisateursSousModule,
  identitesSousModule,
  moderationSousModule,
  plateformeSousModule,
  referentielAdminSousModule,
  // À venir : audit (A6), communiques (A4), tableau-de-bord (A1)
]
