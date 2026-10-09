<script setup lang="ts">
// Bandeau « Vérifie ton identité » (RG52), à placer sur les écrans qui exigent une identité vérifiée
// (publier une place en colocation, lancer ou rejoindre un groupe). Invisible quand le KYC est désactivé (RG59),
// pour les rôles non concernés et quand l'identité est déjà vérifiée.
import { computed, onMounted, ref } from 'vue'
import { roleCourant } from '@/core/acces'
import { parametres } from '@/core/parametres'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import { lireMonKyc } from '../services/identiteService'

const verifiee = ref(true)
const concerne = computed(
  () => parametres.value.kyc_actif && (roleCourant.value === 'etudiant' || (roleCourant.value === 'proprietaire' && parametres.value.kyc_proprietaires)),
)

onMounted(async () => {
  if (!concerne.value) return
  try {
    verifiee.value = (await lireMonKyc()).verifiee
  } catch {
    // En cas d'échec de lecture, on ne montre pas de bandeau trompeur : la base refusera de toute façon l'action.
    verifiee.value = true
  }
})
</script>

<template>
  <AlerteUi v-if="concerne && !verifiee" type="info">
    Vérifie ton identité pour devenir colocataire.
    <RouterLink to="/identite">Commencer la vérification</RouterLink>
  </AlerteUi>
</template>
