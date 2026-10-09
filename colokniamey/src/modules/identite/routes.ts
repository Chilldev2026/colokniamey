// Routes du module K. Le parcours est réservé aux personnes connectées (contrôle d'affichage ; la base décide).
import type { RouteRecordRaw } from 'vue-router'

export const routesIdentite: RouteRecordRaw[] = [
  {
    path: '/identite',
    name: 'identite',
    component: () => import('./views/VerifierIdentiteView.vue'),
    meta: { module: 'identite', titre: 'Vérifier mon identité', connexionRequise: true, roles: ['etudiant', 'proprietaire'] },
  },
]
