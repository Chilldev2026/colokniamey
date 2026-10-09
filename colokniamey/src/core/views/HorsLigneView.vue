<script setup lang="ts">
import EtatVide from '../ui/EtatVide.vue'
import BoutonUi from '../ui/BoutonUi.vue'

function recharger() {
  window.location.reload()
}
</script>

<template>
  <EtatVide message="Tu es hors ligne. Reconnecte-toi à Internet pour continuer.">
    <BoutonUi variante="principal" @click="recharger">Réessayer</BoutonUi>
  </EtatVide>
</template>
