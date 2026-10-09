// Routes du module M2. Chaque route déclare qui peut la voir (meta) ; le garde du router applique ces règles.
// Rappel : ce contrôle sert à l'affichage, la vraie protection reste la RLS (RGA27).
import type { RouteRecordRaw } from 'vue-router'

export const routesAuth: RouteRecordRaw[] = [
  {
    path: '/connexion',
    name: 'connexion',
    component: () => import('./views/ConnexionView.vue'),
    // horsMaintenance : les admins doivent pouvoir se connecter pendant une maintenance (RGA16)
    meta: { module: 'auth', titre: 'Connexion', horsMaintenance: true },
  },
  {
    path: '/inscription',
    name: 'inscription',
    component: () => import('./views/InscriptionView.vue'),
    meta: { module: 'auth', titre: 'Inscription', visiteurSeulement: true },
  },
  {
    path: '/mot-de-passe-oublie',
    name: 'mot-de-passe-oublie',
    component: () => import('./views/MotDePasseOublieView.vue'),
    meta: { module: 'auth', titre: 'Mot de passe oublié', visiteurSeulement: true, horsMaintenance: true },
  },
  {
    // Ni « visiteur seulement » ni « connexion requise » : le lien ouvre une session de récupération
    path: '/reinitialiser',
    name: 'reinitialiser',
    component: () => import('./views/ReinitialiserView.vue'),
    meta: { module: 'auth', titre: 'Nouveau mot de passe', horsMaintenance: true },
  },
  {
    path: '/compte',
    name: 'compte',
    component: () => import('./views/CompteView.vue'),
    meta: { module: 'auth', titre: 'Mon compte', connexionRequise: true, horsMaintenance: true },
  },
]
