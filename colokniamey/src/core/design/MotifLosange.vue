<script setup lang="ts">
// Rangée de losanges inspirée des reliefs de l'architecture haoussa en banco.
import { useId } from 'vue'

withDefaults(defineProps<{ hauteur?: number; couleur?: string }>(), {
  hauteur: 16,
  couleur: '#B8643E',
})
const id = useId()
</script>

<template>
  <svg :height="hauteur" width="100%" aria-hidden="true" focusable="false">
    <defs>
      <pattern :id="id" width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M8 1L15 8L8 15L1 8z" fill="none" :stroke="couleur" stroke-width="1.5" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" :fill="`url(#${id})`" />
  </svg>
</template>
