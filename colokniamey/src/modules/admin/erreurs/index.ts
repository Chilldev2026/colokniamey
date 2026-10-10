// Sous-module « erreurs » de l'espace admin (A6) : liste groupée par empreinte, détail, changement de statut.
// Réservé au super-admin (section Pilotage) ; un admin n'a aucun accès aux erreurs (RGA26, RGA27).
import type { SousModuleAdmin } from '../types'

export const erreursSousModule: SousModuleAdmin = {
  nom: 'erreurs',
  routes: [
    {
      path: 'erreurs',
      name: 'admin-erreurs',
      component: () => import('./views/ErreursView.vue'),
      meta: {
        module: 'admin',
        titre: 'Erreurs',
        roles: ['super_admin'],
        menuAdmin: { libelle: 'Erreurs', icone: 'erreur', section: 'pilotage', ordre: 25 },
      },
    },
  ],
}
