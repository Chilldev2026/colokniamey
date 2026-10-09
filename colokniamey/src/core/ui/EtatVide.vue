<script setup lang="ts">
defineProps<{ message: string }>()
</script>

<template>
  <div class="vide">
    <p>{{ message }}</p>
    <slot />
  </div>
</template>

<style scoped>
.vide {
  padding: 2rem 1rem;
  border: 1px dashed var(--bordure-champ);
  border-radius: var(--rayon);
  color: var(--texte-secondaire);
  text-align: center;
}
</style>
