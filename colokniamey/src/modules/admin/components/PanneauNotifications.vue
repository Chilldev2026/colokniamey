<script setup lang="ts">
// Notifications dans l'application pour les admins (RGA29) : alertes de files, relances, changements de rôle…
// Le texte ne contient jamais de donnée personnelle (RGA33).
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ModaleUi from '@/core/ui/ModaleUi.vue'
import { icones } from '@/core/design/icones'
import { lireNotifications, marquerNotificationsLues, type NotificationApp } from '../services/adminService'

const notifications = ref<NotificationApp[]>([])
const ouvert = ref(false)
const nonLues = computed(() => notifications.value.filter((n) => !n.lu).length)
let minuteur = 0

async function charger() {
  try {
    notifications.value = await lireNotifications()
  } catch {
    // Les notifications sont un confort : en cas d'échec on garde l'affichage précédent
  }
}

async function ouvrir() {
  ouvert.value = true
  await charger()
  if (nonLues.value > 0) {
    await marquerNotificationsLues().catch(() => undefined)
    // le compteur tombe à zéro tout de suite ; les lignes restent visibles dans la liste ouverte
    notifications.value = notifications.value.map((n) => ({ ...n, lu: true }))
  }
}

onMounted(() => {
  void charger()
  minuteur = window.setInterval(charger, 60_000)
})
onBeforeUnmount(() => window.clearInterval(minuteur))

function quand(date: string): string {
  return new Date(date).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <button type="button" class="cloche" :aria-label="nonLues > 0 ? `Notifications, ${nonLues} non lues` : 'Notifications'" @click="ouvrir">
    <component :is="icones.relance" :size="24" :stroke-width="2" aria-hidden="true" />
    <span v-if="nonLues > 0" class="pastille" aria-hidden="true">{{ nonLues > 9 ? '9+' : nonLues }}</span>
  </button>

  <ModaleUi v-model="ouvert" titre="Notifications">
    <p v-if="notifications.length === 0" class="vide">Rien de nouveau pour le moment.</p>
    <ul v-else class="liste">
      <li v-for="n in notifications" :key="n.id" :class="{ nouvelle: !n.lu }">
        <component :is="n.lien ? 'RouterLink' : 'span'" :to="n.lien ?? undefined" class="ligne" @click="ouvert = false">
          {{ n.titre }}
        </component>
        <span class="quand">{{ quand(n.creeLe) }}</span>
      </li>
    </ul>
    <template #actions><BoutonUi variante="secondaire" @click="ouvert = false">Fermer</BoutonUi></template>
  </ModaleUi>
</template>

<style scoped>
.cloche {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--cible-min);
  height: var(--cible-min);
  border: 0;
  background: transparent;
  color: var(--encre);
  cursor: pointer;
}
.pastille {
  position: absolute;
  top: 4px;
  right: 2px;
  min-width: 20px;
  padding: 0 4px;
  border-radius: var(--rayon-rond);
  background: var(--orange);
  color: #ffffff;
  font-size: 0.6875rem;
  font-weight: 800;
  line-height: 20px;
  text-align: center;
}
.liste {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  max-height: 50dvh;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.liste li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--e2) var(--e3);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon-s);
}
.liste li.nouvelle {
  border-color: var(--orange);
}
.ligne {
  color: var(--encre);
}
.quand,
.vide {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
</style>
