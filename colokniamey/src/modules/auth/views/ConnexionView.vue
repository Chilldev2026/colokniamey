<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import TurnstileWidget from '@/core/ui/TurnstileWidget.vue'
import { CHEMIN_APRES_CONNEXION } from '@/core/acces'
import FormulaireAuth from '../components/FormulaireAuth.vue'
import { useAuthStore } from '../stores/authStore'
import { validerEmail } from '../validation'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const widget = useTemplateRef<InstanceType<typeof TurnstileWidget>>('widget')

const email = ref('')
const motDePasse = ref('')
const jeton = ref('')
const erreur = ref('')
const erreurEmail = ref('')
const envoi = ref(false)
const captchaActif = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY)

// On ne suit que des chemins internes (pas d'adresse externe via ?redirect=)
const destination = computed(() => {
  const voulue = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  return voulue.startsWith('/') && !voulue.startsWith('//') ? voulue : CHEMIN_APRES_CONNEXION
})

// Couvre la connexion par ce formulaire et celle faite via le lien de confirmation de l'e-mail
watch(
  () => auth.estConnecte,
  (connecte) => {
    if (connecte) void router.replace(destination.value)
  },
  { immediate: true },
)

async function envoyer() {
  erreur.value = ''
  erreurEmail.value = validerEmail(email.value) ?? ''
  if (erreurEmail.value) return
  if (captchaActif && !jeton.value) {
    erreur.value = 'Termine la vérification anti-robots.'
    return
  }
  envoi.value = true
  try {
    await auth.connecter(email.value, motDePasse.value, jeton.value)
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Connexion impossible.'
    // Un jeton Turnstile ne sert qu'une fois
    widget.value?.reinitialiser()
  } finally {
    envoi.value = false
  }
}
</script>

<template>
  <FormulaireAuth titre="Connexion" intro="Content de te revoir sur ColokNiamey.">
    <AlerteUi v-if="auth.raisonDeconnexion === 'inactivite'" type="info">
      Session fermée après une longue absence. Connecte-toi à nouveau.
    </AlerteUi>
    <AlerteUi v-if="auth.raisonDeconnexion === 'suspendu'" type="erreur">
      Compte suspendu.
      <template v-if="auth.motifSuspension"> Motif : {{ auth.motifSuspension }}</template>
    </AlerteUi>

    <form class="formulaire" novalidate @submit.prevent="envoyer">
      <ChampUi v-model="email" libelle="Adresse e-mail" type="email" autocomplete="email" :erreur="erreurEmail" requis />
      <ChampUi v-model="motDePasse" libelle="Mot de passe" type="password" autocomplete="current-password" requis />
      <TurnstileWidget ref="widget" @jeton="jeton = $event" />
      <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
      <BoutonUi type="submit" variante="principal" :chargement="envoi" pleine-largeur>Me connecter</BoutonUi>
    </form>

    <template #liens>
      <RouterLink to="/mot-de-passe-oublie">Mot de passe oublié ?</RouterLink>
      <RouterLink to="/inscription">Pas encore de compte ? Inscris-toi</RouterLink>
    </template>
  </FormulaireAuth>
</template>

<style scoped>
.formulaire {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
</style>
