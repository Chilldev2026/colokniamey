<script setup lang="ts">
// Accueil : une barre de recherche qui ouvre la page de résultats (module M5) par son chemin, sans importer le module.
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import BoutonInstaller from '../pwa/BoutonInstaller.vue'

const router = useRouter()
const texte = ref('')

function chercher() {
  const t = texte.value.trim()
  void router.push({ path: '/recherche', query: t ? { texte: t } : {} })
}
</script>

<template>
  <section class="accueil">
    <h1>ColokNiamey</h1>
    <p>Trouve ta colocation étudiante à Niamey.</p>
    <form class="recherche" role="search" @submit.prevent="chercher">
      <input v-model="texte" type="search" aria-label="Rechercher un logement" placeholder="Quartier, université, mot-clé…" maxlength="200" />
      <button type="submit">Rechercher</button>
    </form>
    <RouterLink class="carte" to="/recherche?vue=carte">Voir les annonces sur la carte</RouterLink>
    <BoutonInstaller />
  </section>
</template>

<style scoped>
.accueil {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  align-items: flex-start;
}
h1,
p {
  margin: 0;
}
.recherche {
  display: flex;
  gap: var(--e2);
  width: 100%;
  max-width: 32rem;
}
.recherche input {
  flex: 1;
  min-width: 0;
  min-height: var(--cible-min);
  padding: 0 var(--e3);
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon-s);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
}
.recherche button {
  min-height: var(--cible-min);
  padding: 0 var(--e4);
  border: 0;
  border-radius: var(--rayon);
  background: var(--orange);
  color: #ffffff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.carte {
  color: var(--indigo);
  font-weight: 700;
}
</style>
