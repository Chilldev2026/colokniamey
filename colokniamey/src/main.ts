import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './app/router'
import { supabase } from './core/supabase'
import { demarrerCaptureErreurs } from './core/observabilite/erreurs'
import { demarrerMesures } from './core/observabilite/mesures'
import { declarerAttenteAuth } from './core/acces'
import { demarrerDiffusionPlateforme } from './core/plateforme'
import { initialiserAuth } from './modules/auth'
import './core/design/tokens.css'

const app = createApp(App)

app.use(createPinia())
// M2 : la session est restaurée avant la première navigation (les gardes du router l'attendent)
declarerAttenteAuth(initialiserAuth())
app.use(router)

// RGA19 : erreurs envoyées sans donnée sensible
demarrerCaptureErreurs(app, async (message, module, page, session, detail) => {
  await supabase.rpc('enregistrer_erreur_detail', {
    p_message: message,
    p_module: module,
    p_page: page,
    p_session: session,
    ...(detail.pile ? { p_pile: detail.pile } : {}),
    p_navigateur: detail.navigateur,
    p_version: detail.version,
  })
})
demarrerMesures()

app.mount('#app')
// A5 : l'état de la plateforme (maintenance…) arrive en temps réel
demarrerDiffusionPlateforme(router)
