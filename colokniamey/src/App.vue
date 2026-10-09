<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/core/layout/AppLayout.vue'
import ConteneurToasts from '@/core/ui/ConteneurToasts.vue'
import { useMiseAJour } from '@/core/pwa/useMiseAJour'
import { menu } from '@/app/router'
import { FenetreNouvellesConditions } from '@/modules/auth'

// RG27 : toast de nouvelle version
useMiseAJour()

// L'espace admin a sa propre coque (A2) : le layout public n'est pas affiché
const route = useRoute()
const coquePropre = computed(() => route.matched.some((r) => r.meta.sansLayout))
</script>

<template>
  <AppLayout v-if="!coquePropre" :menu="menu" />
  <template v-else>
    <RouterView />
    <ConteneurToasts />
  </template>
  <!-- RGP12 : bloque l'accès tant que les nouvelles conditions ne sont pas acceptées -->
  <FenetreNouvellesConditions />
</template>
