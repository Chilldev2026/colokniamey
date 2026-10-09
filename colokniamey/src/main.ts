import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './app/router'
import { supabase } from './core/supabase'
import { demarrerCaptureErreurs } from './core/observabilite/erreurs'
import { demarrerMesures } from './core/observabilite/mesures'
import { chargerParametres } from './core/parametres'
import './core/ui/jetons.css'

const app = createApp(App)

app.use(createPinia())
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
void chargerParametres()

app.mount('#app')
