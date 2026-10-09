<script setup lang="ts">
// Choisit la coque selon le rôle (RGA26) : chaque rôle voit la sienne. Le menu est construit à partir des
// routes des sous-modules actifs que ce rôle a le droit d'ouvrir.
import { computed } from 'vue'
import { roleCourant } from '@/core/acces'
import { construireMenu } from '../menu'
import { routesEnfantsAdmin } from '../routes'
import CoqueAdmin from './CoqueAdmin.vue'
import CoqueSuperAdmin from './CoqueSuperAdmin.vue'

const entrees = computed(() => construireMenu(routesEnfantsAdmin, roleCourant.value))
</script>

<template>
  <CoqueSuperAdmin v-if="roleCourant === 'super_admin'" :entrees="entrees" />
  <CoqueAdmin v-else :entrees="entrees" />
</template>
