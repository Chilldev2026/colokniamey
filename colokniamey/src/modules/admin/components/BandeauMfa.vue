<script setup lang="ts">
// RGA37 : rappel tant qu'un seul appareil d'authentification est enregistré. Perdre ce téléphone
// bloquerait l'accès à l'espace admin : un deuxième appareil évite d'avoir à demander une réinitialisation.
import AlerteUi from '@/core/ui/AlerteUi.vue'
import { useAdminStore } from '../stores/adminStore'

const admin = useAdminStore()
</script>

<template>
  <AlerteUi v-if="admin.deuxiemeAppareilManquant" type="info">
    Un seul appareil protège ton compte. Si tu perds ce téléphone, tu perdras l'accès.
    <RouterLink to="/admin/securite">Ajouter un deuxième appareil</RouterLink>
  </AlerteUi>
</template>
