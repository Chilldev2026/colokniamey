// Liste des modules actifs (contrat d'indépendance, point 4).
// Pour activer ou désactiver un module, on ajoute ou retire son import ici ;
// le router et le menu sont construits à partir de cette liste.
// M0 (le socle) n'est pas un module optionnel : il est branché directement dans router.ts.

import type { DefinitionModule } from '@/core/modules/types'
import { referentielModule } from '@/modules/referentiel'
import { authModule } from '@/modules/auth'
import { securiteModule } from '@/modules/securite'

export const modulesActifs: DefinitionModule[] = [
  referentielModule,
  authModule,
  securiteModule,
  // Les modules suivants s'ajoutent ici au fil du développement :
  // profilsModule, annoncesModule…
]
