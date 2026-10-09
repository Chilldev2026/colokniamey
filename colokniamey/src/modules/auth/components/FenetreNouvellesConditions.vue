<script setup lang="ts">
// RGP12 : si la version des conditions acceptée est plus ancienne que version_cgu,
// cette fenêtre bloque l'accès jusqu'à la nouvelle acceptation.
import { computed, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ModaleUi from '@/core/ui/ModaleUi.vue'
import { parametres } from '@/core/parametres'
import { useAuthStore } from '../stores/authStore'

const auth = useAuthStore()
const visible = computed(() => auth.estConnecte && !auth.cguAJour)
const envoi = ref(false)
const erreur = ref('')

async function accepter() {
  envoi.value = true
  erreur.value = ''
  try {
    await auth.accepterCgu()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Réessaie dans un moment.'
  } finally {
    envoi.value = false
  }
}
</script>

<template>
  <ModaleUi :model-value="visible" titre="Nos conditions ont changé" bloquante>
    <p>
      Les conditions d'utilisation et la politique de confidentialité ont été mises à jour
      (version {{ parametres.version_cgu }}). Lis-les, puis accepte-les pour continuer.
    </p>
    <p>
      <a href="/cgu" target="_blank" rel="noopener">Conditions d'utilisation</a> ·
      <a href="/confidentialite" target="_blank" rel="noopener">Politique de confidentialité</a>
    </p>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <template #actions>
      <BoutonUi variante="secondaire" @click="auth.deconnecter()">Me déconnecter</BoutonUi>
      <BoutonUi variante="principal" :chargement="envoi" @click="accepter">J'accepte</BoutonUi>
    </template>
  </ModaleUi>
</template>
