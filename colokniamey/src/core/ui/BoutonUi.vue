<script setup lang="ts">
withDefaults(
  defineProps<{
    variante?: 'principal' | 'action' | 'secondaire'
    type?: 'button' | 'submit'
    chargement?: boolean
    desactive?: boolean
  }>(),
  { variante: 'secondaire', type: 'button', chargement: false, desactive: false },
)
</script>

<template>
  <button
    class="bouton"
    :class="variante"
    :type="type"
    :disabled="desactive || chargement"
    :aria-busy="chargement"
  >
    <slot />
  </button>
</template>

<style scoped>
.bouton {
  min-height: var(--cible-min);
  padding: 0 1rem;
  border: 1px solid var(--bordure-champ);
  border-radius: var(--rayon);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: transform var(--duree-rapide) var(--courbe);
}
.bouton:active:not(:disabled) {
  transform: scale(0.97);
}
.principal {
  background: var(--indigo);
  border-color: var(--indigo);
  color: #fff;
}
.action {
  background: var(--orange);
  border-color: var(--orange);
  color: #fff;
}
.bouton:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
