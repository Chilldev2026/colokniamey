<script setup lang="ts">
withDefaults(defineProps<{ type?: 'info' | 'succes' | 'erreur' }>(), { type: 'info' })
</script>

<template>
  <div class="alerte" :class="type" :role="type === 'erreur' ? 'alert' : 'status'">
    <slot />
  </div>
</template>

<style scoped>
.alerte {
  padding: 0.75rem 1rem;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.info {
  border-color: var(--indigo);
}
.succes {
  border-color: var(--vert);
}
.erreur {
  border-color: var(--orange);
}
</style>
