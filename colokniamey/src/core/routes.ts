// Routes du socle. Les vues sont chargées à la demande pour garder le premier chargement léger.
import type { RouteRecordRaw } from 'vue-router'

export const routesCore: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'accueil',
    component: () => import('./views/AccueilView.vue'),
    meta: { module: 'core', titre: 'Accueil' },
  },
  {
    path: '/cgu',
    name: 'cgu',
    component: () => import('./views/CguView.vue'),
    meta: { module: 'core', titre: 'Conditions d\'utilisation', horsMaintenance: true },
  },
  {
    path: '/confidentialite',
    name: 'confidentialite',
    component: () => import('./views/ConfidentialiteView.vue'),
    meta: { module: 'core', titre: 'Politique de confidentialité', horsMaintenance: true },
  },
  {
    path: '/installer',
    name: 'installer',
    component: () => import('./views/InstallerView.vue'),
    meta: { module: 'core', titre: 'Installer l\'application' },
  },
  {
    path: '/hors-ligne',
    name: 'hors-ligne',
    component: () => import('./views/HorsLigneView.vue'),
    meta: { module: 'core', titre: 'Hors ligne', horsMaintenance: true },
  },
  {
    path: '/maintenance',
    name: 'maintenance',
    component: () => import('./views/MaintenanceView.vue'),
    meta: { module: 'core', titre: 'Maintenance', horsMaintenance: true },
  },
]

// Catalogue des composants : accessible en développement uniquement (module D)
if (import.meta.env.DEV) {
  routesCore.push({
    path: '/design-system',
    name: 'design-system',
    component: () => import('./views/DesignSystemView.vue'),
    meta: { module: 'core', titre: 'Design system', horsMaintenance: true },
  })
}

// Doit rester la dernière route de la liste finale
export const routeIntrouvable: RouteRecordRaw = {
  path: '/:chemin(.*)*',
  name: 'introuvable',
  component: () => import('./views/NotFoundView.vue'),
  meta: { module: 'core', titre: 'Page introuvable', horsMaintenance: true },
}

export const menuCore = [{ libelle: 'Accueil', vers: '/', icone: 'accueil' }]
