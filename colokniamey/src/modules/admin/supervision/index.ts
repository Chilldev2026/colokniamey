// Sous-module « supervision » de l'espace admin (A6) : les quatre indicateurs (RGA21 à RGA25).
// Réservé au super-admin, section Pilotage (RGA26, RGA27).
import type { SousModuleAdmin } from '../types'

export const supervisionSousModule: SousModuleAdmin = {
  nom: 'supervision',
  routes: [
    {
      path: 'supervision',
      name: 'admin-supervision',
      component: () => import('./views/SupervisionView.vue'),
      meta: {
        module: 'admin',
        titre: 'Supervision technique',
        roles: ['super_admin'],
        menuAdmin: { libelle: 'Supervision technique', icone: 'supervision', section: 'pilotage', ordre: 20 },
      },
    },
  ],
}
