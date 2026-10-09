<script setup lang="ts">
// Compteur qui défile de l'ancienne à la nouvelle valeur (tableaux de bord admin).
// Il ne change que du texte : aucun impact sur la mise en page ni sur les actions.
import { onBeforeUnmount, ref, watch } from 'vue'
import { animationsReduites, DUREES } from '../design/useAnimation'

const props = defineProps<{ valeur: number }>()

const affichee = ref(props.valeur)
let image = 0

function defiler(vers: number) {
  cancelAnimationFrame(image)
  if (animationsReduites()) {
    affichee.value = vers
    return
  }
  const depart = affichee.value
  const debut = performance.now()
  const pas = (maintenant: number) => {
    const t = Math.min(1, (maintenant - debut) / DUREES.lente)
    // ease-out : démarre vite, ralentit à l'arrivée
    const adouci = 1 - (1 - t) ** 3
    affichee.value = Math.round(depart + (vers - depart) * adouci)
    if (t < 1) image = requestAnimationFrame(pas)
  }
  image = requestAnimationFrame(pas)
}

watch(() => props.valeur, defiler)
onBeforeUnmount(() => cancelAnimationFrame(image))
</script>

<template>
  <span>{{ affichee.toLocaleString('fr-FR') }}</span>
</template>
