// Sous-module « utilisateurs » de l'espace admin (A2) : routes enfants de /admin.
// Chaque route déclare meta.roles (RGA26) ; le menu de la coque est construit à partir de meta.menuAdmin.
import type { SousModuleAdmin } from '../types'

export const utilisateursSousModule: SousModuleAdmin = {
  nom: 'utilisateurs',
  routes: [
    {
      path: 'utilisateurs',
      name: 'admin-utilisateurs',
      component: () => import('./views/UtilisateursView.vue'),
      meta: {
        module: 'admin',
        titre: 'Utilisateurs',
        roles: ['admin', 'super_admin'],
        menuAdmin: { libelle: 'Utilisateurs', icone: 'utilisateurs', section: 'operations', ordre: 10 },
      },
    },
    {
      path: 'utilisateurs/:id',
      name: 'admin-utilisateur',
      component: () => import('./views/FicheUtilisateurView.vue'),
      meta: { module: 'admin', titre: 'Fiche utilisateur', roles: ['admin', 'super_admin'] },
    },
    {
      // RGA01 : gestion des administrateurs, super-admin seulement
      path: 'administrateurs',
      name: 'admin-administrateurs',
      component: () => import('./views/AdministrateursView.vue'),
      meta: {
        module: 'admin',
        titre: 'Administrateurs',
        roles: ['super_admin'],
        menuAdmin: { libelle: 'Administrateurs', icone: 'administrateurs', section: 'pilotage', ordre: 30 },
      },
    },
  ],
}
