// Routes du module M6. Tout exige une connexion (contrôle d'affichage ; la RLS décide : seuls les deux participants lisent).
import type { RouteMeta, RouteRecordRaw } from 'vue-router'

const meta: RouteMeta = { module: 'messagerie', connexionRequise: true, roles: ['etudiant', 'proprietaire'] }

export const routesMessagerie: RouteRecordRaw[] = [
  { path: '/messages', name: 'messages', component: () => import('./views/ConversationsView.vue'), meta: { ...meta, titre: 'Messages' } },
  {
    path: '/messages/nouveau/:annonceId([0-9]+)',
    name: 'message-nouveau',
    component: () => import('./views/NouveauMessageView.vue'),
    meta: { ...meta, titre: 'Nouveau message' },
  },
  {
    path: '/messages/:id([0-9]+)',
    name: 'conversation',
    component: () => import('./views/ConversationView.vue'),
    meta: { ...meta, titre: 'Conversation' },
  },
]
