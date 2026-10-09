// Routes du module M4. L'édition et « Mes annonces » exigent une connexion ; le détail est public (RG24).
// Ces contrôles servent à l'affichage : la vraie protection reste la RLS (RGA27).
import type { RouteRecordRaw } from 'vue-router'

export const routesAnnonces: RouteRecordRaw[] = [
  {
    path: '/annonces/mes-annonces',
    name: 'annonces-mes',
    component: () => import('./views/MesAnnoncesView.vue'),
    meta: { module: 'annonces', titre: 'Mes annonces', connexionRequise: true, roles: ['etudiant', 'proprietaire'] },
  },
  {
    path: '/annonces/nouvelle',
    name: 'annonces-nouvelle',
    component: () => import('./views/EditerAnnonceView.vue'),
    meta: { module: 'annonces', titre: 'Nouvelle annonce', connexionRequise: true, roles: ['etudiant', 'proprietaire'] },
  },
  {
    path: '/annonces/:id([0-9]+)/editer',
    name: 'annonces-editer',
    component: () => import('./views/EditerAnnonceView.vue'),
    meta: { module: 'annonces', titre: 'Modifier mon annonce', connexionRequise: true, roles: ['etudiant', 'proprietaire'] },
  },
  {
    path: '/annonces/:id([0-9]+)',
    name: 'annonce-detail',
    component: () => import('./views/DetailAnnonceView.vue'),
    meta: { module: 'annonces', titre: 'Annonce' },
  },
]
