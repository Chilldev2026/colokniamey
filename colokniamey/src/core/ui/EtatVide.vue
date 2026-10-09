<script setup lang="ts">
import MotifCroix from '../design/MotifCroix.vue'

defineProps<{ message: string }>()
</script>

<template>
  <div class="vide">
    <MotifCroix :taille="40" couleur="#B8643E" />
    <p>{{ message }}</p>
    <slot />
  </div>
</template>

<style scoped>
.vide {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  align-items: center;
  padding: var(--e8) var(--e4);
  border: 1px dashed var(--bordure-champ);
  border-radius: var(--rayon);
  color: var(--texte-secondaire);
  text-align: center;
}
.vide p {
  margin: 0;
}
</style>
