<script setup lang="ts">
withDefaults(
  defineProps<{
    variante?: 'principal' | 'secondaire' | 'danger' | 'action'
    type?: 'button' | 'submit'
    chargement?: boolean
    desactive?: boolean
    pleineLargeur?: boolean
  }>(),
  { variante: 'secondaire', type: 'button', chargement: false, desactive: false, pleineLargeur: false },
)
</script>

<template>
  <button
    class="bouton"
    :class="[variante, { pleine: pleineLargeur }]"
    :type="type"
    :disabled="desactive || chargement"
    :aria-busy="chargement"
  >
    <slot />
  </button>
</template>

<style scoped>
.bouton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--e2);
  min-height: 48px;
  padding: 0 var(--e5);
  border: 1.5px solid var(--indigo);
  border-radius: var(--rayon);
  background: transparent;
  color: var(--indigo);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  /* Retour au toucher : léger enfoncement, seulement transform */
  transition:
    transform var(--duree-rapide) var(--courbe),
    background-color var(--duree-rapide) var(--courbe);
}
.bouton:active:not(:disabled) {
  transform: scale(0.97);
}
.pleine {
  width: 100%;
}
.principal {
  background: var(--indigo);
  color: #fff;
}
.action {
  border-color: var(--orange);
  background: var(--orange);
  color: #fff;
}
.danger {
  border-color: var(--erreur);
  background: var(--erreur);
  color: #fff;
}
.bouton:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
/* Au survol (ordinateur) : seulement un léger changement de couleur */
@media (hover: hover) {
  .principal:hover:not(:disabled) {
    background: var(--indigo-fonce);
  }
  .secondaire:hover:not(:disabled) {
    background: var(--indigo-pale);
  }
}
</style>
