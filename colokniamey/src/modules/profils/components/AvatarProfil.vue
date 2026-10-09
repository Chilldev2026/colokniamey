<script setup lang="ts">
// Avatar rond : la photo validée si elle existe, sinon l'initiale du prénom.
import { computed } from 'vue'
import { urlAvatar } from '../services/profilsService'

const props = withDefaults(defineProps<{ prenom: string; chemin?: string | null; taille?: number }>(), {
  chemin: null,
  taille: 64,
})

const source = computed(() => (props.chemin ? urlAvatar(props.chemin) : ''))
const initiale = computed(() => props.prenom.trim().charAt(0).toUpperCase())
</script>

<template>
  <div class="avatar" :style="{ width: `${taille}px`, height: `${taille}px`, fontSize: `${taille / 2.4}px` }">
    <img v-if="source" :src="source" :alt="`Photo de ${prenom}`" loading="lazy" />
    <span v-else aria-hidden="true">{{ initiale }}</span>
  </div>
</template>

<style scoped>
.avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon-rond);
  background: var(--indigo-pale);
  color: var(--indigo);
  font-family: var(--police-titre);
  font-weight: 800;
}
img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
