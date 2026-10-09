<script setup lang="ts">
// Fenêtre « motif obligatoire » : refuser ou retirer un contenu exige un motif de 3 à 300 caractères (RGA11).
// Le motif est communiqué à l'auteur ; la base le revérifie.
import { ref, watch } from 'vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import ModaleUi from '@/core/ui/ModaleUi.vue'

const ouverte = defineModel<boolean>({ required: true })
const props = defineProps<{ titre: string; explication: string; libelleAction: string; chargement?: boolean }>()
const emit = defineEmits<{ confirmer: [motif: string] }>()

const motif = ref('')
watch(ouverte, (valeur) => {
  if (valeur) motif.value = ''
})
</script>

<template>
  <ModaleUi v-model="ouverte" :titre="props.titre">
    <p>{{ props.explication }}</p>
    <ChampUi v-model="motif" libelle="Motif" aide="3 à 300 caractères. L'auteur le recevra." />
    <template #actions>
      <BoutonUi variante="secondaire" @click="ouverte = false">Annuler</BoutonUi>
      <BoutonUi variante="danger" :chargement="props.chargement" :desactive="motif.trim().length < 3 || motif.trim().length > 300" @click="emit('confirmer', motif.trim())">
        {{ props.libelleAction }}
      </BoutonUi>
    </template>
  </ModaleUi>
</template>
