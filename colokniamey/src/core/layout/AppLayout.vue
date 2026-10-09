<script setup lang="ts">
// Layout mobile d'abord : en-tête avec ruban, zone de communiqué, contenu, pied de page,
// barre de navigation basse.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { EntreeMenu } from '../modules/types'
import { roleAutorise } from '../acces'
import { direction } from '../design/direction'
import MotifRuban from '../design/MotifRuban.vue'
import BoutonInstaller from '../pwa/BoutonInstaller.vue'
import BarreNavigation from '../ui/BarreNavigation.vue'
import ConteneurToasts from '../ui/ConteneurToasts.vue'

const props = defineProps<{ menu: EntreeMenu[] }>()

const route = useRoute()

// Le menu ne montre que les entrées autorisées pour le rôle (RGA26)
const entrees = computed(() => props.menu.filter((e) => roleAutorise(e.roles)))
</script>

<template>
  <div class="app">
    <header class="entete">
      <RouterLink to="/" class="marque" aria-label="ColokNiamey, accueil">
        <span class="colok">Colok</span><span class="niamey">Niamey</span>
      </RouterLink>
      <BoutonInstaller />
    </header>
    <MotifRuban />

    <!-- Zone réservée aux communiqués (module A4, phase 2) -->
    <div id="zone-communique" />

    <main class="contenu">
      <RouterView v-slot="{ Component }">
        <Transition :name="`page-${direction}`" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>

    <footer class="pied">
      <RouterLink to="/cgu">Conditions d'utilisation</RouterLink>
      <RouterLink to="/confidentialite">Confidentialité</RouterLink>
      <RouterLink to="/installer">Installer l'application</RouterLink>
    </footer>

    <BarreNavigation :entrees="entrees" class="nav" />
    <ConteneurToasts />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}
.entete {
  display: flex;
  gap: var(--e3);
  align-items: center;
  justify-content: space-between;
  padding: 14px var(--e5) 10px;
}
.marque {
  font-family: var(--police-titre);
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
  text-decoration: none;
}
.colok {
  color: var(--indigo);
}
.niamey {
  color: var(--orange);
}
.contenu {
  flex: 1;
  width: 100%;
  max-width: 64rem;
  margin: 0 auto;
  padding: var(--e5);
  overflow-x: hidden;
}
.pied {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2) var(--e5);
  justify-content: center;
  padding: var(--e3) var(--e4);
  font-size: var(--texte-s);
}
.pied a {
  display: inline-flex;
  align-items: center;
  min-height: var(--cible-min);
  color: var(--texte-secondaire);
}
.nav {
  position: sticky;
  bottom: 0;
}

/* Transitions de page : seulement opacity et transform, dans le sens de la navigation */
.page-avant-enter-active,
.page-avant-leave-active,
.page-arriere-enter-active,
.page-arriere-leave-active {
  transition:
    opacity var(--duree-normale) var(--courbe),
    transform var(--duree-normale) var(--courbe);
}
.page-avant-enter-from,
.page-arriere-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
.page-avant-leave-to,
.page-arriere-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}
</style>
