// Routes du module M3. Toutes exigent une connexion (le garde du router renvoie vers /connexion).
// Ce contrôle sert à l'affichage ; la vraie protection reste la RLS (RGA27).
import type { RouteRecordRaw } from 'vue-router'

export const routesProfils: RouteRecordRaw[] = [
  {
    path: '/profil',
    name: 'profil',
    component: () => import('./views/MonProfilView.vue'),
    meta: { module: 'profils', titre: 'Mon profil', connexionRequise: true },
  },
  {
    path: '/profil/securite',
    name: 'profil-securite',
    component: () => import('./views/SecuriteCompteView.vue'),
    meta: { module: 'profils', titre: 'Mot de passe et compte', connexionRequise: true },
  },
  {
    path: '/profil/donnees',
    name: 'profil-donnees',
    component: () => import('./views/MesDonneesView.vue'),
    meta: { module: 'profils', titre: 'Mes données', connexionRequise: true, horsMaintenance: true },
  },
]
