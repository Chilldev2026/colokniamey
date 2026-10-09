// Contrat public du module admin (A2 : coque, double authentification, sessions, utilisateurs).
// Dépend de : core, auth, profils. Les sous-modules admin (modération, plateforme…) s'ajoutent dans sousModules.ts.
import { declarerAccueilRole, declarerVerificationAal2 } from '@/core/acces'
import type { DefinitionModule } from '@/core/modules/types'
import { accueilAdmin } from './menu'
import { routesAdmin, routesEnfantsAdmin } from './routes'
import { niveauAssurance } from './services/adminService'

export { useAdminStore } from './stores/adminStore'
export type { SousModuleAdmin } from './types'

// Branche le socle sur l'espace admin : niveau de double authentification et accueil de chaque rôle (RGA26)
declarerVerificationAal2(async () => (await niveauAssurance()) === 'aal2')
declarerAccueilRole((role) => (role === 'admin' || role === 'super_admin' ? accueilAdmin(routesEnfantsAdmin, role) : '/'))

export const adminModule: DefinitionModule = {
  nom: 'admin',
  routes: routesAdmin,
  menu: [{ libelle: 'Admin', vers: '/admin', icone: 'admin', roles: ['admin', 'super_admin'] }],
  dependances: ['auth', 'profils'],
}
