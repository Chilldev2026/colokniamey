<script setup lang="ts">
// Bandeau d'alerte de supervision (A6, RGA22, RGA24) : visible du super-admin seulement, tant qu'un seuil est dépassé.
// La base décide (alertes_supervision_actives exige est_super_admin) ; un admin ne reçoit rien.
import { computed, onMounted, ref } from 'vue'
import { roleCourant } from '@/core/acces'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import { lireAlertesSupervision } from '../audit/services/auditService'

const LIBELLES: Record<string, string> = {
  erreurs: 'le taux d\'erreurs',
  latence: 'les temps de réponse',
  base: 'la taille de la base',
  stockage: 'le stockage de fichiers',
  connexions: 'les connexions à la base',
}

const alertes = ref<{ type: string }[]>([])
const texte = computed(() => alertes.value.map((a) => LIBELLES[a.type] ?? a.type).join(', '))

onMounted(async () => {
  if (roleCourant.value === 'super_admin') alertes.value = await lireAlertesSupervision()
})
</script>

<template>
  <AlerteUi v-if="alertes.length > 0" type="erreur">
    Un seuil est dépassé : {{ texte }}.
    <RouterLink to="/admin/supervision">Voir la supervision</RouterLink>
  </AlerteUi>
</template>
