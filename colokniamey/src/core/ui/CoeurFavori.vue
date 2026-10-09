<script setup lang="ts">
// Cœur des favoris : il bat quand on l'ajoute. L'action part tout de suite, l'animation suit.
import { ref } from 'vue'
import { Heart } from 'lucide-vue-next'
import { useAnimation } from '../design/useAnimation'

const actif = defineModel<boolean>({ required: true })

const { rebond } = useAnimation()
const bouton = ref<HTMLElement | null>(null)

function basculer() {
  actif.value = !actif.value
  if (actif.value && bouton.value) rebond(bouton.value)
}
</script>

<template>
  <button
    ref="bouton"
    class="coeur"
    type="button"
    :aria-pressed="actif"
    :aria-label="actif ? 'Retirer des favoris' : 'Ajouter aux favoris'"
    @click="basculer"
  >
    <Heart :size="24" :stroke-width="2" :fill="actif ? 'currentColor' : 'none'" aria-hidden="true" />
  </button>
</template>

<style scoped>
.coeur {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--cible-min);
  height: var(--cible-min);
  border: 0;
  background: none;
  color: var(--texte-secondaire);
  cursor: pointer;
}
.coeur[aria-pressed='true'] {
  color: var(--orange);
}
</style>
