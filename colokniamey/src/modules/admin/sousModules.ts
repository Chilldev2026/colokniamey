// Sous-modules actifs de l'espace admin. Pour en activer ou désactiver un, on ajoute ou retire son import ici ;
// le menu et les routes de la coque sont construits à partir de cette liste.
import { auditSousModule } from './audit'
import { erreursSousModule } from './erreurs'
import { identitesSousModule } from './identites'
import { moderationSousModule } from './moderation'
import { plateformeSousModule } from './plateforme'
import { referentielAdminSousModule } from './referentiel'
import { signalementsAdminSousModule } from './signalements'
import { supervisionSousModule } from './supervision'
import { tableauDeBordSousModule } from './tableau-de-bord'
import { utilisateursSousModule } from './utilisateurs'
import type { SousModuleAdmin } from './types'

export const sousModulesAdmin: SousModuleAdmin[] = [
  tableauDeBordSousModule,
  utilisateursSousModule,
  identitesSousModule,
  moderationSousModule,
  signalementsAdminSousModule,
  auditSousModule,
  erreursSousModule,
  supervisionSousModule,
  plateformeSousModule,
  referentielAdminSousModule,
  // À venir : communiques (A4)
]
