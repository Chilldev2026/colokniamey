<script setup lang="ts">
// Cloudflare Turnstile (RGP19) : vérification anti-robots gratuite, sans traceur publicitaire.
// La clé publique vient de VITE_TURNSTILE_SITE_KEY ; la clé secrète n'existe que dans Supabase.
// Le script vient de challenges.cloudflare.com : c'est le seul script tiers de l'application,
// il doit figurer dans la politique de confidentialité et dans le Content-Security-Policy.
import { onBeforeUnmount, onMounted, ref } from 'vue'

interface ApiTurnstile {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string
      language: string
      callback: (jeton: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ) => string
  reset: (id: string) => void
  remove: (id: string) => void
}

const emit = defineEmits<{ jeton: [jeton: string]; erreur: [] }>()

const cleSite = import.meta.env.VITE_TURNSTILE_SITE_KEY
const conteneur = ref<HTMLElement | null>(null)
let idWidget: string | null = null
const echec = ref(false)

function api(): ApiTurnstile | undefined {
  return (window as unknown as { turnstile?: ApiTurnstile }).turnstile
}

let chargementScript: Promise<void> | null = null

function chargerScript(): Promise<void> {
  if (api()) return Promise.resolve()
  if (!chargementScript) {
    chargementScript = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Script Turnstile indisponible.'))
      document.head.appendChild(script)
    })
  }
  return chargementScript
}

/** À appeler après un échec : un jeton Turnstile ne sert qu'une fois. */
function reinitialiser() {
  const turnstile = api()
  if (turnstile && idWidget) turnstile.reset(idWidget)
  emit('jeton', '')
}

onMounted(async () => {
  if (!cleSite || !conteneur.value) return
  try {
    await chargerScript()
    const turnstile = api()
    if (!turnstile || !conteneur.value) return
    idWidget = turnstile.render(conteneur.value, {
      sitekey: cleSite,
      language: 'fr',
      callback: (jeton) => emit('jeton', jeton),
      'expired-callback': () => emit('jeton', ''),
      'error-callback': () => {
        echec.value = true
        emit('erreur')
      },
    })
  } catch {
    echec.value = true
    emit('erreur')
  }
})

onBeforeUnmount(() => {
  const turnstile = api()
  if (turnstile && idWidget) turnstile.remove(idWidget)
})

defineExpose({ reinitialiser })
</script>

<template>
  <div>
    <p v-if="!cleSite" class="manque" role="alert">
      Vérification anti-robots non configurée : renseigne VITE_TURNSTILE_SITE_KEY dans .env.
    </p>
    <p v-if="echec" class="manque" role="alert">
      La vérification anti-robots ne s'est pas chargée. Désactive ton bloqueur de publicités pour ce site, vérifie ta connexion, puis recharge la page.
    </p>
    <div ref="conteneur" />
  </div>
</template>

<style scoped>
.manque {
  margin: 0;
  color: var(--erreur);
  font-size: var(--texte-s);
}
</style>
