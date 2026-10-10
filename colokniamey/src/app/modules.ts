// Liste des modules actifs (contrat d'indépendance, point 4).
// Pour activer ou désactiver un module, on ajoute ou retire son import ici ;
// le router et le menu sont construits à partir de cette liste.
// M0 (le socle) n'est pas un module optionnel : il est branché directement dans router.ts.

import type { DefinitionModule } from '@/core/modules/types'
import { referentielModule } from '@/modules/referentiel'
import { authModule } from '@/modules/auth'
import { securiteModule } from '@/modules/securite'
import { profilsModule } from '@/modules/profils'
import { identiteModule } from '@/modules/identite'
import { annoncesModule } from '@/modules/annonces'
import { rechercheModule } from '@/modules/recherche'
import { messagerieModule } from '@/modules/messagerie'
import { groupesModule } from '@/modules/groupes'
import { signalementsModule } from '@/modules/signalements'
import { communiquesModule } from '@/modules/communiques'
import { adminModule } from '@/modules/admin'

export const modulesActifs: DefinitionModule[] = [
  referentielModule,
  authModule,
  securiteModule,
  profilsModule,
  identiteModule,
  annoncesModule,
  rechercheModule,
  messagerieModule,
  groupesModule,
  signalementsModule,
  adminModule,
  communiquesModule,
  // Les modules suivants s'ajoutent ici au fil du développement :
]
