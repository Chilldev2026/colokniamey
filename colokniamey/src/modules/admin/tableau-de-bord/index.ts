// Sous-module « tableau de bord » de l'espace admin (A1) : les deux pages d'accueil de /admin (RGA26).
// Super-admin : « Vue d'ensemble » de la plateforme. Admin : « Ma file de travail ». Chaque route déclare ses rôles ;
// la base revérifie le droit à chaque lecture (RGA27).
import type { SousModuleAdmin } from '../types'

export const tableauDeBordSousModule: SousModuleAdmin = {
  nom: 'tableau-de-bord',
  routes: [
    {
      path: 'vue-ensemble',
      name: 'admin-vue-ensemble',
      component: () => import('./views/VueEnsembleView.vue'),
      meta: {
        module: 'admin',
        titre: 'Vue d\'ensemble',
        roles: ['super_admin'],
        menuAdmin: { libelle: 'Vue d\'ensemble', icone: 'tableau', section: 'pilotage', ordre: 10 },
      },
    },
    {
      path: 'ma-file',
      name: 'admin-ma-file',
      component: () => import('./views/MaFileView.vue'),
      meta: {
        module: 'admin',
        titre: 'Ma file de travail',
        roles: ['admin'],
        menuAdmin: { libelle: 'Ma file de travail', icone: 'tableau', section: 'operations', ordre: 1 },
      },
    },
  ],
}
