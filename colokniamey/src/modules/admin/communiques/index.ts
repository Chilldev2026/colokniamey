// Sous-module « communiques » de l'espace admin (A4) : création, programmation, fin anticipée.
// Admin et super-admin y accèdent ; le niveau « critique » est réservé au super-admin (RGA28), vérifié par la base.
import type { SousModuleAdmin } from '../types'

export const communiquesAdminSousModule: SousModuleAdmin = {
  nom: 'communiques',
  routes: [
    {
      path: 'communiques',
      name: 'admin-communiques',
      component: () => import('./views/CommuniquesView.vue'),
      meta: {
        module: 'admin',
        titre: 'Communiqués',
        roles: ['admin', 'super_admin'],
        menuAdmin: { libelle: 'Communiqués', icone: 'communique', section: 'operations', ordre: 80 },
      },
    },
  ],
}
