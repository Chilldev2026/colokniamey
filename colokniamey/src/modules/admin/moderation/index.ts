// Sous-module « modération » de l'espace admin (A3) : annonces, photos, contenus mis en revue et termes sensibles.
// Ouvert aux admins et au super-admin (RGA01) ; les termes se proposent par tout admin et se valident par le
// super-admin seulement (RGA28, revérifié par la base).
import type { SousModuleAdmin } from '../types'

export const moderationSousModule: SousModuleAdmin = {
  nom: 'moderation',
  routes: [
    {
      path: 'moderation',
      name: 'admin-moderation',
      component: () => import('./views/AnnoncesModerationView.vue'),
      meta: {
        module: 'admin',
        titre: 'Annonces à valider',
        roles: ['admin', 'super_admin'],
        menuAdmin: { libelle: 'Annonces', icone: 'file', section: 'operations', ordre: 15, fileAdmin: 'annonces' },
      },
    },
    {
      path: 'photos',
      name: 'admin-photos',
      component: () => import('./views/PhotosModerationView.vue'),
      meta: {
        module: 'admin',
        titre: 'Photos à valider',
        roles: ['admin', 'super_admin'],
        menuAdmin: { libelle: 'Photos', icone: 'profil', section: 'operations', ordre: 25, fileAdmin: 'photos' },
      },
    },
    {
      path: 'contenus',
      name: 'admin-contenus',
      component: () => import('./views/ContenusView.vue'),
      meta: {
        module: 'admin',
        titre: 'Contenus à vérifier',
        roles: ['admin', 'super_admin'],
        menuAdmin: { libelle: 'Contenus', icone: 'attention', section: 'operations', ordre: 27, fileAdmin: 'contenus' },
      },
    },
    {
      path: 'termes',
      name: 'admin-termes',
      component: () => import('./views/TermesView.vue'),
      meta: {
        module: 'admin',
        titre: 'Termes sensibles',
        roles: ['admin', 'super_admin'],
        menuAdmin: { libelle: 'Termes sensibles', icone: 'securite', section: 'operations', ordre: 35 },
      },
    },
  ],
}
