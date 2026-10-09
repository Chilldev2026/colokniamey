<script setup lang="ts">
// Ruban de triangles inspiré des tissages et cuirs du Sahel (bandeaux et en-têtes, avec retenue).
import { useId } from 'vue'

withDefaults(defineProps<{ hauteur?: number }>(), { hauteur: 12 })
const id = useId()
</script>

<template>
  <svg class="ruban" :height="hauteur" width="100%" aria-hidden="true" focusable="false">
    <defs>
      <pattern :id="id" width="24" height="12" patternUnits="userSpaceOnUse">
        <rect width="24" height="12" fill="#1E3966" />
        <path d="M0 12L6 0L12 12z" fill="#C4520F" />
        <path d="M12 12L18 0L24 12z" fill="#F5F6F8" />
        <path d="M16 12L18 8L20 12z" fill="#2C7A4B" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" :fill="`url(#${id})`" />
  </svg>
</template>

<style scoped>
.ruban {
  display: block;
  flex-shrink: 0;
}
</style>
