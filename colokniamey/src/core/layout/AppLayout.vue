<script setup lang="ts">
// Layout mobile d'abord : en-tête, menu, zone de communiqué, contenu, pied de page.
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { EntreeMenu } from '../modules/types'
import { roleAutorise } from '../acces'
import BoutonInstaller from '../pwa/BoutonInstaller.vue'
import ConteneurToasts from '../ui/ConteneurToasts.vue'

const props = defineProps<{ menu: EntreeMenu[] }>()

const route = useRoute()
const menuOuvert = ref(false)

// Le menu ne montre que les entrées autorisées pour le rôle (RGA26)
const entrees = computed(() => props.menu.filter((e) => roleAutorise(e.roles)))
</script>

<template>
  <div class="app">
    <header class="entete">
      <RouterLink to="/" class="marque">ColokNiamey</RouterLink>
      <BoutonInstaller />
      <button
        class="burger"
        type="button"
        :aria-expanded="menuOuvert"
        aria-controls="menu-principal"
        @click="menuOuvert = !menuOuvert"
      >
        Menu
      </button>
    </header>

    <nav id="menu-principal" class="menu" :class="{ ouvert: menuOuvert }" aria-label="Navigation principale">
      <RouterLink
        v-for="e in entrees"
        :key="e.vers"
        :to="e.vers"
        @click="menuOuvert = false"
      >
        {{ e.libelle }}
      </RouterLink>
    </nav>

    <!-- Zone réservée aux communiqués (module A4, phase 2) -->
    <div id="zone-communique" />

    <main class="contenu">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>

    <footer class="pied">
      <RouterLink to="/cgu">Conditions d'utilisation</RouterLink>
      <RouterLink to="/confidentialite">Confidentialité</RouterLink>
      <RouterLink to="/installer">Installer l'application</RouterLink>
    </footer>

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
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--bordure);
  background: var(--surface);
}
.marque {
  color: var(--indigo);
  font-size: 1.2rem;
  font-weight: 800;
  text-decoration: none;
}
.burger {
  min-width: var(--cible-min);
  min-height: var(--cible-min);
  border: 1px solid var(--bordure-champ);
  border-radius: var(--rayon);
  background: var(--surface);
  font: inherit;
}
.menu {
  display: none;
  flex-direction: column;
  border-bottom: 1px solid var(--bordure);
  background: var(--surface);
}
.menu.ouvert {
  display: flex;
}
.menu a {
  display: flex;
  align-items: center;
  min-height: var(--cible-min);
  padding: 0 1rem;
  color: var(--encre);
  text-decoration: none;
}
.menu a.router-link-exact-active {
  color: var(--indigo);
  font-weight: 700;
}
.contenu {
  flex: 1;
  width: 100%;
  max-width: 64rem;
  margin: 0 auto;
  padding: 1rem;
}
.pied {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  justify-content: center;
  padding: 1rem;
  border-top: 1px solid var(--bordure);
  background: var(--surface);
}
.pied a {
  display: inline-flex;
  align-items: center;
  min-height: var(--cible-min);
  color: var(--texte-secondaire);
}
@media (min-width: 768px) {
  .burger {
    display: none;
  }
  .menu {
    display: flex;
    flex-direction: row;
  }
}
/* Transition de page : seulement opacity et transform */
.page-enter-active,
.page-leave-active {
  transition:
    opacity var(--duree-normale) var(--courbe),
    transform var(--duree-normale) var(--courbe);
}
.page-enter-from {
  opacity: 0;
  transform: translateX(1rem);
}
.page-leave-to {
  opacity: 0;
  transform: translateX(-1rem);
}
</style>
