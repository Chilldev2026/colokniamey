// Sous-module « audit » de l'espace admin (A6) : Journal d'audit complet (super-admin, Pilotage) et « Mon historique »
// (admin, ses seules actions, sans export). Même écran, droits différents, revérifiés par la base (RGA26, RGA27).
import type { SousModuleAdmin } from '../types'

export const auditSousModule: SousModuleAdmin = {
  nom: 'audit',
  routes: [
    {
      path: 'journal',
      name: 'admin-journal',
      component: () => import('./views/JournalView.vue'),
      meta: {
        module: 'admin',
        titre: 'Journal d\'audit',
        roles: ['super_admin'],
        menuAdmin: { libelle: 'Journal d\'audit', icone: 'historique', section: 'pilotage', ordre: 60 },
      },
    },
    {
      path: 'mon-historique',
      name: 'admin-mon-historique',
      component: () => import('./views/JournalView.vue'),
      meta: {
        module: 'admin',
        titre: 'Mon historique',
        roles: ['admin'],
        menuAdmin: { libelle: 'Mon historique', icone: 'historique', section: 'operations', ordre: 90 },
      },
    },
  ],
}
