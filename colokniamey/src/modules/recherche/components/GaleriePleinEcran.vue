<script setup lang="ts">
// Galerie de photos en plein écran : précédent, suivant, fermer (Échap). Les images viennent du bucket public (photos validées).
import { onBeforeUnmount, onMounted, ref } from 'vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'

const props = defineProps<{ photos: string[]; titre: string }>()
const emit = defineEmits<{ fermer: [] }>()

const index = ref(0)

function aller(delta: number) {
  index.value = (index.value + delta + props.photos.length) % props.photos.length
}
function touche(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('fermer')
  else if (e.key === 'ArrowRight') aller(1)
  else if (e.key === 'ArrowLeft') aller(-1)
}
onMounted(() => document.addEventListener('keydown', touche))
onBeforeUnmount(() => document.removeEventListener('keydown', touche))
</script>

<template>
  <Teleport to="body">
    <div class="galerie" role="dialog" aria-modal="true" :aria-label="`Photos : ${titre}`">
      <img :src="photos[index]" :alt="`Photo ${index + 1} sur ${photos.length}`" />
      <p class="compteur">{{ index + 1 }} / {{ photos.length }}</p>
      <div class="boutons">
        <BoutonUi v-if="photos.length > 1" variante="secondaire" aria-label="Photo précédente" @click="aller(-1)">←</BoutonUi>
        <BoutonUi variante="principal" @click="emit('fermer')">Fermer</BoutonUi>
        <BoutonUi v-if="photos.length > 1" variante="secondaire" aria-label="Photo suivante" @click="aller(1)">→</BoutonUi>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.galerie {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  align-items: center;
  justify-content: center;
  padding: var(--e4);
  background: rgb(20 22 27 / 0.95);
}
img {
  max-width: 100%;
  max-height: 75vh;
  border-radius: var(--rayon);
  object-fit: contain;
}
.compteur {
  margin: 0;
  color: #ffffff;
  font-size: var(--texte-s);
}
.boutons {
  display: flex;
  gap: var(--e3);
}
</style>
