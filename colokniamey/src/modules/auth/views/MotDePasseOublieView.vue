<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import TurnstileWidget from '@/core/ui/TurnstileWidget.vue'
import FormulaireAuth from '../components/FormulaireAuth.vue'
import { useAuthStore } from '../stores/authStore'
import { validerEmail } from '../validation'

const auth = useAuthStore()
const widget = useTemplateRef<InstanceType<typeof TurnstileWidget>>('widget')

const email = ref('')
const jeton = ref('')
const erreur = ref('')
const erreurEmail = ref('')
const envoi = ref(false)
const envoye = ref(false)
const captchaActif = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY)

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
    await auth.demanderReinitialisation(email.value, jeton.value)
    envoye.value = true
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Réessaie dans un moment.'
    widget.value?.reinitialiser()
  } finally {
    envoi.value = false
  }
}
</script>

<template>
  <FormulaireAuth
    titre="Mot de passe oublié"
    intro="Entre ton adresse e-mail : nous t'enverrons un lien pour choisir un nouveau mot de passe."
  >
    <!-- RGP26 : même message que l'adresse existe ou non -->
    <AlerteUi v-if="envoye" type="succes">
      Si un compte existe avec cette adresse, un e-mail vient de partir. Pense à regarder tes courriers indésirables.
    </AlerteUi>
    <form v-else class="formulaire" novalidate @submit.prevent="envoyer">
      <ChampUi v-model="email" libelle="Adresse e-mail" type="email" autocomplete="email" :erreur="erreurEmail" requis />
      <TurnstileWidget ref="widget" @jeton="jeton = $event" />
      <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
      <BoutonUi type="submit" variante="principal" :chargement="envoi" pleine-largeur>Envoyer le lien</BoutonUi>
    </form>
    <template #liens><RouterLink to="/connexion">Retour à la connexion</RouterLink></template>
  </FormulaireAuth>
</template>

<style scoped>
.formulaire {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
</style>
