<script setup lang="ts">
// Croix d'Agadez stylisée : un losange central, quatre bras pointus et un pied.
// Dessin géométrique simplifié, utilisé pour les états vides et les en-têtes.
withDefaults(defineProps<{ taille?: number; couleur?: string }>(), {
  taille: 64,
  couleur: '#1E3966',
})
</script>

<template>
  <svg :width="taille" :height="taille" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <g :fill="couleur">
      <path d="M32 6l6 10h-12z" />
      <path d="M58 32l-10 6v-12z" />
      <path d="M6 32l10-6v12z" />
      <path d="M32 18l12 14-12 14-12-14z" />
      <path d="M26 48h12l4 12h-20z" />
    </g>
    <circle cx="32" cy="32" r="3.5" fill="#F5F6F8" />
  </svg>
</template>
