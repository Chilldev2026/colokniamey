// Sous-module « signalements » de l'espace admin (volet signalements d'A3, avec M7) : file, prise en charge, décision.
// Ouvert aux admins et au super-admin (RGA01). Un seul admin prend un signalement en charge (RGA12).
import type { SousModuleAdmin } from '../types'

export const signalementsAdminSousModule: SousModuleAdmin = {
  nom: 'signalements',
  routes: [
    {
      path: 'signalements',
      name: 'admin-signalements',
      component: () => import('./views/SignalementsView.vue'),
      meta: {
        module: 'admin',
        titre: 'Signalements',
        roles: ['admin', 'super_admin'],
        menuAdmin: { libelle: 'Signalements', icone: 'attention', section: 'operations', ordre: 5, fileAdmin: 'signalements' },
      },
    },
  ],
}
