<script setup lang="ts">
import AppLayout from '@/core/layout/AppLayout.vue'
import { useMiseAJour } from '@/core/pwa/useMiseAJour'
import { menu } from '@/app/router'

// RG27 : toast de nouvelle version
useMiseAJour()
</script>

<template>
  <AppLayout :menu="menu" />
</template>
