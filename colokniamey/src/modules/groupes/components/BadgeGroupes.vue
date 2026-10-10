<script setup lang="ts">
// Badge « N étudiants cherchent des colocataires » pour les cartes d'annonce et la carte (RG24, RG34).
// Il ne montre qu'un nombre : donnée publique.
import PuceUi from '@/core/ui/PuceUi.vue'

defineProps<{ nombre: number }>()
</script>

<template>
  <PuceUi v-if="nombre > 0" variante="validee">
    {{ nombre === 1 ? '1 groupe cherche des colocataires' : `${nombre} groupes cherchent des colocataires` }}
  </PuceUi>
</template>
