<script setup lang="ts">
// Barre de progression (formulaires en plusieurs étapes) : elle s'étire avec scaleX,
// jamais avec width, pour rester fluide sur les téléphones d'entrée de gamme.
import { computed } from 'vue'

const props = defineProps<{ etape: number; total: number }>()
const part = computed(() => Math.min(1, Math.max(0, props.etape / props.total)))
</script>

<template>
  <div
    class="piste"
    role="progressbar"
    :aria-valuemin="0"
    :aria-valuemax="total"
    :aria-valuenow="etape"
    :aria-label="`Étape ${etape} sur ${total}`"
  >
    <div class="barre" :style="{ transform: `scaleX(${part})` }" />
  </div>
</template>

<style scoped>
.piste {
  height: 6px;
  overflow: hidden;
  border-radius: var(--rayon-rond);
  background: var(--bordure);
}
.barre {
  height: 100%;
  background: var(--indigo);
  transform-origin: left;
  transition: transform var(--duree-lente) var(--courbe);
}
</style>
