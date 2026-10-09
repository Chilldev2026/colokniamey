import { createRouter, createWebHistory } from 'vue-router'
import { modulesActifs } from './modules'
import { menuCore, routeIntrouvable, routesCore } from '@/core/routes'
import { roleAutorise } from '@/core/acces'
import { maintenanceBloquante } from '@/core/parametres'
import { definirModuleCourant } from '@/core/observabilite/contexte'
import { mettreAJourDirection } from '@/core/design/direction'
import { enregistrerVisite } from '@/core/observabilite/visites'
import { supabase } from '@/core/supabase'
import type { EntreeMenu } from '@/core/modules/types'

// Router construit à partir du socle et des modules actifs
export const routes = [
  ...routesCore,
  ...modulesActifs.flatMap((m) => m.routes),
  routeIntrouvable,
]

export const menu: EntreeMenu[] = [...menuCore, ...modulesActifs.flatMap((m) => m.menu)]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  // RGA16 : en maintenance, seuls les admins accèdent à l'application
  if (!to.meta.horsMaintenance && (await maintenanceBloquante())) {
    return { name: 'maintenance' }
  }
  // RGA26 : une route interdite renvoie vers l'accueil
  if (!roleAutorise(to.meta.roles)) {
    return { name: 'accueil' }
  }
  return true
})

router.afterEach((to) => {
  mettreAJourDirection()
  definirModuleCourant(to.meta.module)
  document.title = to.meta.titre ? `${to.meta.titre} — ColokNiamey` : 'ColokNiamey'
  // RGA18 : visite anonyme, chemin sans paramètres
  enregistrerVisite(to.path, async (chemin, appareil, session) => {
    await supabase.rpc('enregistrer_visite', { p_chemin: chemin, p_appareil: appareil, p_session: session })
  })
})

export default router
