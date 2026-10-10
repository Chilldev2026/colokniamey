// Routes du module M5. La recherche et la carte sont publiques (RG24) ; les favoris exigent une connexion
// (contrôle d'affichage : la RLS limite de toute façon les favoris à leur propriétaire).
import type { RouteRecordRaw } from 'vue-router'

export const routesRecherche: RouteRecordRaw[] = [
  {
    path: '/recherche',
    name: 'recherche',
    component: () => import('./views/ResultatsView.vue'),
    meta: { module: 'recherche', titre: 'Trouver un logement' },
  },
  {
    path: '/favoris',
    name: 'favoris',
    component: () => import('./views/MesFavorisView.vue'),
    meta: { module: 'recherche', titre: 'Mes favoris', connexionRequise: true, roles: ['etudiant', 'proprietaire'] },
  },
]
