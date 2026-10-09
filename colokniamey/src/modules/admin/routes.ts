// Routes de l'espace admin. /admin exige un rôle admin ou super_admin ET la double authentification (RGA04) ;
// chaque route enfant précise ses propres rôles (RGA26). Ces contrôles servent à l'affichage : la vraie
// protection est dans la base (est_admin()) et les Edge Functions (RGA27).
import type { RouteRecordRaw } from 'vue-router'
import { roleCourant } from '@/core/acces'
import { accueilAdmin } from './menu'
import { sousModulesAdmin } from './sousModules'

const ADMINS = ['admin', 'super_admin'] as const

export const routesEnfantsAdmin: RouteRecordRaw[] = [
  {
    // Tant qu'A1 n'est pas installé, l'accueil est la première page autorisée du menu du rôle
    path: '',
    name: 'admin-accueil',
    redirect: () => accueilAdmin(routesEnfantsAdmin, roleCourant.value),
  },
  {
    path: 'securite',
    name: 'admin-securite',
    component: () => import('./views/SecuriteAdminView.vue'),
    meta: { module: 'admin', titre: 'Sécurité du compte', roles: [...ADMINS] },
  },
  ...sousModulesAdmin.flatMap((m) => m.routes),
]

export const routesAdmin: RouteRecordRaw[] = [
  {
    // Hors coque : on n'a pas encore le niveau aal2
    path: '/admin/mfa',
    name: 'admin-mfa',
    component: () => import('./views/MfaView.vue'),
    meta: {
      module: 'admin',
      titre: 'Double authentification',
      roles: [...ADMINS],
      connexionRequise: true,
      sansLayout: true,
      horsMaintenance: true,
    },
  },
  {
    path: '/admin',
    component: () => import('./components/CoqueSelecteur.vue'),
    meta: {
      module: 'admin',
      roles: [...ADMINS],
      connexionRequise: true,
      exigeAal2: true,
      sansLayout: true,
    },
    children: routesEnfantsAdmin,
  },
]
