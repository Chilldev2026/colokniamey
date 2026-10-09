// Sous-module « référentiel » de l'espace admin (A5) : villes, quartiers, universités, équipements.
// Ouvert aux admins et au super-admin (RGA01) ; le compteur « à placer » vient de la file universites_a_placer.
import type { SousModuleAdmin } from '../types'

export const referentielAdminSousModule: SousModuleAdmin = {
  nom: 'referentiel',
  routes: [
    {
      path: 'referentiel',
      name: 'admin-referentiel',
      component: () => import('./views/ReferentielView.vue'),
      meta: {
        module: 'admin',
        titre: 'Référentiel',
        roles: ['admin', 'super_admin'],
        menuAdmin: { libelle: 'Référentiel', icone: 'file', section: 'operations', ordre: 60, fileAdmin: 'universites_a_placer' },
      },
    },
  ],
}
