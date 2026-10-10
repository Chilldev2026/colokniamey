// Routes du module M8. Réservées aux étudiants connectés (contrôle d'affichage ; la base décide).
import type { RouteRecordRaw } from 'vue-router'

export const routesGroupes: RouteRecordRaw[] = [
  {
    path: '/groupes',
    name: 'groupes',
    component: () => import('./views/MesGroupesView.vue'),
    meta: { module: 'groupes', titre: 'Mes groupes', connexionRequise: true, roles: ['etudiant'] },
  },
]
