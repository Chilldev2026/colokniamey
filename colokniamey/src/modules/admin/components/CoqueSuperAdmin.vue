<script setup lang="ts">
// RGA26 : coque du super-admin. Barre latérale encre #14161B, badge SUPER-ADMIN orange,
// sections Pilotage et Opérations, accueil « Vue d'ensemble » (ou première page du menu tant qu'A1 est absent).
import type { EntreeMenuCalculee } from '../types'
import CoqueBase from './CoqueBase.vue'

defineProps<{ entrees: EntreeMenuCalculee[] }>()
</script>

<template>
  <CoqueBase variante="super" badge="SUPER-ADMIN" :entrees="entrees" statut="Super-admin · double authentification active" />
</template>
