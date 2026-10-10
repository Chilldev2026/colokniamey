// Routes du module M7. Réservées aux personnes connectées (contrôle d'affichage ; la RLS limite à l'auteur).
import type { RouteRecordRaw } from 'vue-router'

export const routesSignalements: RouteRecordRaw[] = [
  {
    path: '/signalements',
    name: 'signalements',
    component: () => import('./views/MesSignalementsView.vue'),
    meta: { module: 'signalements', titre: 'Mes signalements', connexionRequise: true, roles: ['etudiant', 'proprietaire'] },
  },
]
