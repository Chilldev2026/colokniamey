<script setup lang="ts">
// « Signaler » sur un message reçu, branché par le point d'extension « message-actions » de la messagerie.
// Seul le message visé est joint au signalement : l'équipe ne lit pas le reste de la conversation (RGA10).
import BoutonSignaler from './BoutonSignaler.vue'

defineProps<{ messageId: number }>()
</script>

<template>
  <BoutonSignaler cible="message" :cible-id="String(messageId)" libelle="Signaler ce message" />
</template>
