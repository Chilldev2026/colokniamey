<script setup lang="ts">
import { ref } from 'vue'
import BoutonUi from '../ui/BoutonUi.vue'
import ModaleUi from '../ui/ModaleUi.vue'
import { useInstallation } from './useInstallation'

const { afficherBouton, installer } = useInstallation()
const guideOuvert = ref(false)

async function cliquer() {
  const resultat = await installer()
  // Pas d'installation native (iPhone) : on montre le guide Safari
  if (resultat === 'guide') guideOuvert.value = true
}
</script>

<template>
  <BoutonUi v-if="afficherBouton" variante="action" @click="cliquer">
    Télécharger l'application
  </BoutonUi>

  <ModaleUi v-model="guideOuvert" titre="Installer sur iPhone">
    <ol>
      <li>Ouvre ce site dans Safari.</li>
      <li>Touche le bouton Partager.</li>
      <li>Choisis « Sur l'écran d'accueil ».</li>
    </ol>
    <template #actions>
      <BoutonUi @click="guideOuvert = false">Compris</BoutonUi>
    </template>
  </ModaleUi>
</template>
