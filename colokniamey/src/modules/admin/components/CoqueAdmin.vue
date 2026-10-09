<script setup lang="ts">
// RGA26 : coque de l'admin. Barre latérale indigo #1E3966, badge ADMIN, menu limité à la modération avec
// compteurs, accueil « Ma file de travail ». Rappelle les fonctions réservées au super-admin.
import type { EntreeMenuCalculee } from '../types'
import CoqueBase from './CoqueBase.vue'

defineProps<{ entrees: EntreeMenuCalculee[] }>()
</script>

<template>
  <CoqueBase variante="admin" badge="ADMIN" :entrees="entrees" statut="Admin · double authentification active">
    <template #pied-menu>
      <p class="mention">
        Paramètres, maintenance, supervision technique et gestion des administrateurs sont réservés au super-admin.
      </p>
    </template>
  </CoqueBase>
</template>

<style scoped>
.mention {
  margin: 0;
  padding: var(--e3);
  border: 1px solid rgb(255 255 255 / 0.2);
  border-radius: var(--rayon-s);
  color: rgb(255 255 255 / 0.8);
  font-size: var(--texte-s);
}
</style>
