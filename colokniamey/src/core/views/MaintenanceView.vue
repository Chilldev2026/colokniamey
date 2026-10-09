<script setup lang="ts">
import { onMounted } from 'vue'
import { chargerParametres, parametres } from '../parametres'
import EtatVide from '../ui/EtatVide.vue'

onMounted(() => void chargerParametres())
</script>

<template>
  <section>
    <h1>Maintenance en cours</h1>
    <EtatVide :message="parametres.maintenance_message || 'ColokNiamey revient très bientôt.'">
      <p v-if="parametres.maintenance_fin">Fin prévue : {{ parametres.maintenance_fin }}</p>
    </EtatVide>
  </section>
</template>
