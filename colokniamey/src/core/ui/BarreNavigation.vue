<script setup lang="ts">
// Barre de navigation basse (mobile). L'entrée active est en orange, comme sur la maquette.
import type { EntreeMenu } from '../modules/types'
import { icones } from '../design/icones'

defineProps<{ entrees: EntreeMenu[] }>()
</script>

<template>
  <nav class="barre" aria-label="Navigation principale">
    <RouterLink v-for="e in entrees" :key="e.vers" :to="e.vers" class="entree">
      <component :is="icones[e.icone ?? 'info']" :size="22" :stroke-width="2" aria-hidden="true" />
      <span>{{ e.libelle }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.barre {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  padding: 6px 4px 10px;
  border-top: 1px solid var(--bordure);
  background: var(--surface);
}
.entree {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  color: var(--texte-secondaire);
  font-size: 0.6875rem;
  text-decoration: none;
}
.entree.router-link-exact-active {
  color: var(--orange);
  font-weight: 700;
}
</style>
