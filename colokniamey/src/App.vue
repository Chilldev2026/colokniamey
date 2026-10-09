<script setup lang="ts">
import AppLayout from '@/core/layout/AppLayout.vue'
import { useMiseAJour } from '@/core/pwa/useMiseAJour'
import { menu } from '@/app/router'
import { FenetreNouvellesConditions } from '@/modules/auth'

// RG27 : toast de nouvelle version
useMiseAJour()
</script>

<template>
  <AppLayout :menu="menu" />
  <!-- RGP12 : bloque l'accès tant que les nouvelles conditions ne sont pas acceptées -->
  <FenetreNouvellesConditions />
</template>
