// Sous-module « plateforme » de l'espace admin (A5) : maintenance et paramètres, section Pilotage.
// Les deux écrans sont visibles des admins en lecture seule (RGA26) ; la base refuse toute modification
// qui ne vient pas d'un super-admin (RGA27).
import type { SousModuleAdmin } from '../types'

export const plateformeSousModule: SousModuleAdmin = {
  nom: 'plateforme',
  routes: [
    {
      path: 'maintenance',
      name: 'admin-maintenance',
      component: () => import('./views/MaintenanceView.vue'),
      meta: {
        module: 'admin',
        titre: 'Maintenance',
        roles: ['admin', 'super_admin'],
        menuAdmin: { libelle: 'Maintenance', icone: 'parametres', section: 'pilotage', ordre: 40 },
      },
    },
    {
      path: 'parametres',
      name: 'admin-parametres',
      component: () => import('./views/ParametresView.vue'),
      meta: {
        module: 'admin',
        titre: 'Paramètres',
        roles: ['admin', 'super_admin'],
        menuAdmin: { libelle: 'Paramètres', icone: 'parametres', section: 'pilotage', ordre: 50 },
      },
    },
  ],
}
