<script setup lang="ts">
// RGA32 : bandeau « Relance du super-admin » dans la coque admin, jusqu'au clic sur « Vu ».
// Le texte ne contient aucune donnée personnelle (RGA33) : seulement l'ancienneté et le motif libre du super-admin.
import { useAdminStore } from '../stores/adminStore'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import { icones } from '@/core/design/icones'

const admin = useAdminStore()

function depuis(date: string): string {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 60000))
  return minutes >= 60 ? `il y a ${Math.floor(minutes / 60)} h` : `il y a ${minutes} min`
}
</script>

<template>
  <div v-for="r in admin.relances" :key="r.id" class="bandeau" role="alert">
    <component :is="icones.relance" :size="22" :stroke-width="2" aria-hidden="true" />
    <div class="texte">
      <strong>Relance du super-admin</strong> <span class="quand">{{ depuis(r.creeLe) }}</span>
      <p>Des éléments attendent ta décision.<template v-if="r.motif"> {{ r.motif }}</template></p>
    </div>
    <BoutonUi variante="action" @click="admin.marquerVue(r.id)">Vu</BoutonUi>
  </div>
</template>

<style scoped>
.bandeau {
  display: flex;
  gap: var(--e3);
  align-items: center;
  padding: var(--e3) var(--e4);
  border: 1.5px solid var(--orange);
  border-radius: var(--rayon);
  background: var(--surface);
}
.texte {
  flex: 1;
  min-width: 0;
}
.texte p {
  margin: 0;
}
.quand {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
</style>
