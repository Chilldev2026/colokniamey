<script setup lang="ts">
// Boutons « Signaler cette annonce » et « Signaler l'annonceur » du détail d'une annonce, branchés par le point
// d'extension « annonce-detail » (l'annonce n'importe pas ce module). Pas de bouton sur sa propre annonce.
import { computed } from 'vue'
import { useAuthStore } from '@/modules/auth'
import BoutonSignaler from './BoutonSignaler.vue'

const props = defineProps<{ annonceId: number; auteurId: string }>()
const auth = useAuthStore()
const estAuteur = computed(() => auth.estConnecte && auth.profil?.id === props.auteurId)
</script>

<template>
  <div v-if="!estAuteur" class="signaler">
    <BoutonSignaler cible="annonce" :cible-id="String(annonceId)" libelle="Signaler cette annonce" />
    <BoutonSignaler cible="profil" :cible-id="auteurId" libelle="Signaler l'annonceur" />
  </div>
</template>

<style scoped>
.signaler {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
}
</style>
