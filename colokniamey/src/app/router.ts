import { createRouter, createWebHistory } from 'vue-router'
import { modulesActifs } from './modules'
import { menuCore, routeIntrouvable, routesCore } from '@/core/routes'
import { attendreAuth, roleCourant, verifierAal2 } from '@/core/acces'
import { decider } from './gardes'
import { useToasts } from '@/core/ui/useToasts'
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
  // On attend la restauration de la session avant toute décision (M2)
  await attendreAuth()

  // RGA16 : en maintenance, seuls les admins accèdent à l'application
  if (!to.meta.horsMaintenance && (await maintenanceBloquante())) {
    return { name: 'maintenance' }
  }
  // Le niveau de double authentification n'est interrogé que pour les routes qui l'exigent (RGA04)
  const aal2 = to.meta.exigeAal2 && roleCourant.value !== null ? await verifierAal2() : false
  const decision = decider(to.meta, to.fullPath, { role: roleCourant.value, aal2 })
  if (decision === true) return true
  if (decision.message) useToasts().afficher(decision.message, 'info')
  return { path: decision.path, query: decision.query }
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
