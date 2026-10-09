import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './app/router'
import { supabase } from './core/supabase'
import { demarrerCaptureErreurs } from './core/observabilite/erreurs'
import { demarrerMesures } from './core/observabilite/mesures'
import { declarerAttenteAuth } from './core/acces'
import { initialiserAuth } from './modules/auth'
import './core/design/tokens.css'

const app = createApp(App)

app.use(createPinia())
// M2 : la session est restaurée avant la première navigation (les gardes du router l'attendent)
declarerAttenteAuth(initialiserAuth())
app.use(router)

// RGA19 : erreurs envoyées sans donnée sensible
demarrerCaptureErreurs(app, async (message, module, page, session) => {
  await supabase.rpc('enregistrer_erreur', {
    p_message: message,
    p_module: module,
    p_page: page,
    p_session: session,
  })
})
demarrerMesures()

app.mount('#app')
