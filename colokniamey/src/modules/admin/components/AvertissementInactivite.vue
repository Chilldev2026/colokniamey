<script setup lang="ts">
// RGA36 : avertissement « Déconnexion dans 2 minutes » avec le bouton « Rester connecté ».
import { computed } from 'vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ModaleUi from '@/core/ui/ModaleUi.vue'

const props = defineProps<{ secondes: number | null }>()
defineEmits<{ rester: []; quitter: [] }>()

const visible = computed(() => props.secondes !== null)
const duree = computed(() => {
  const s = props.secondes ?? 0
  if (s > 60) return `${Math.ceil(s / 60)} minutes`
  return `${s} seconde${s > 1 ? 's' : ''}`
})
</script>

<template>
  <ModaleUi :model-value="visible" titre="Toujours là ?" bloquante>
    <p role="alert">Déconnexion dans {{ duree }}, faute d'activité. Tes décisions en cours ne sont pas perdues.</p>
    <template #actions>
      <BoutonUi variante="secondaire" @click="$emit('quitter')">Me déconnecter</BoutonUi>
      <BoutonUi variante="principal" @click="$emit('rester')">Rester connecté</BoutonUi>
    </template>
  </ModaleUi>
</template>
