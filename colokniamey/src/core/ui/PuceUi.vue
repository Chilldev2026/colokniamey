<script setup lang="ts">
withDefaults(defineProps<{ variante?: 'neutre' | 'validee' | 'info' }>(), { variante: 'neutre' })
</script>

<template>
  <span class="puce" :class="variante"><slot /></span>
</template>

<style scoped>
.puce {
  display: inline-flex;
  align-items: center;
  padding: var(--e1) var(--e2);
  border-radius: var(--rayon-rond);
  background: var(--bordure);
  color: var(--encre);
  font-size: 0.75rem;
  font-weight: 700;
}
.validee {
  background: var(--vert);
  color: #fff;
}
.info {
  background: var(--indigo-pale);
  color: var(--indigo);
}
</style>
