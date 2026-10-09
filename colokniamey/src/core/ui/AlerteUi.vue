<script setup lang="ts">
// Bandeau d'information. Pas de bordure colorée à gauche : la couleur est portée par l'icône.
import { computed } from 'vue'
import { icones } from '../design/icones'

const props = withDefaults(defineProps<{ type?: 'info' | 'succes' | 'erreur' }>(), { type: 'info' })

const icone = computed(() => icones[props.type === 'succes' ? 'valide' : props.type === 'erreur' ? 'attention' : 'info'])
</script>

<template>
  <div class="alerte" :class="type" :role="type === 'erreur' ? 'alert' : 'status'">
    <component :is="icone" class="icone" :size="20" :stroke-width="2" aria-hidden="true" />
    <div><slot /></div>
  </div>
</template>

<style scoped>
.alerte {
  display: flex;
  gap: var(--e3);
  align-items: flex-start;
  padding: var(--e3) var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.icone {
  flex-shrink: 0;
  margin-top: 2px;
}
.info .icone {
  color: var(--indigo);
}
.succes .icone {
  color: var(--vert);
}
.erreur .icone {
  color: var(--erreur);
}
</style>
