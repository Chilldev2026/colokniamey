// Sous-module « identités » de l'espace admin (K) : file des dossiers d'identité à vérifier (RG54, RG55).
// Ouvert aux admins et au super-admin (RGA01). Masqué du menu tant que kyc_actif est faux (RG59).
import type { SousModuleAdmin } from '../types'

export const identitesSousModule: SousModuleAdmin = {
  nom: 'identites',
  routes: [
    {
      path: 'identites',
      name: 'admin-identites',
      component: () => import('./views/IdentitesView.vue'),
      meta: {
        module: 'admin',
        titre: 'Identités',
        roles: ['admin', 'super_admin'],
        menuAdmin: { libelle: 'Identités', icone: 'identite', section: 'operations', ordre: 20, fileAdmin: 'identites', visibleSi: 'kyc_actif' },
      },
    },
  ],
}
