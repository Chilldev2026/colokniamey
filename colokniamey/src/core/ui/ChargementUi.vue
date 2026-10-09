<script setup lang="ts">
// Squelette de chargement à la place d'un spinner (module D).
withDefaults(defineProps<{ lignes?: number }>(), { lignes: 3 })
</script>

<template>
  <div class="squelette" role="status" aria-label="Chargement en cours">
    <div v-for="n in lignes" :key="n" class="ligne" />
  </div>
</template>

<style scoped>
.squelette {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.ligne {
  height: 1.1rem;
  border-radius: 6px;
  background: var(--bordure);
  animation: pulse 1.2s ease-in-out infinite;
}
.ligne:last-child {
  width: 60%;
}
/* Seulement opacity : jamais width ou height animés */
@keyframes pulse {
  50% {
    opacity: 0.45;
  }
}
</style>
