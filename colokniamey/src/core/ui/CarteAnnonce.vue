<script setup lang="ts">
// Carte d'annonce (liste et accueil). Les données viennent du module M4 ; ici, seulement l'aspect.
import PuceUi from './PuceUi.vue'

withDefaults(
  defineProps<{
    vers: string
    type: string
    quartier: string
    loyer: string
    distance?: string
    verifiee?: boolean
    /** Couleur de fond tant que la photo n'est pas chargée (terre cuite par défaut). */
    couleurPhoto?: string
  }>(),
  { couleurPhoto: '#B8643E' },
)
</script>

<template>
  <RouterLink :to="vers" class="carte">
    <div class="photo" :style="{ background: couleurPhoto }">
      <PuceUi v-if="verifiee" variante="validee" class="badge">Vérifiée</PuceUi>
      <slot name="photo" />
    </div>
    <div class="corps">
      <div class="meta">{{ type }} · {{ quartier }}</div>
      <div class="loyer">{{ loyer }} <span>FCFA/mois</span></div>
      <div v-if="distance" class="distance">{{ distance }}</div>
    </div>
  </RouterLink>
</template>

<style scoped>
.carte {
  display: block;
  overflow: hidden;
  border: 1px solid var(--bordure);
  border-radius: 14px;
  background: var(--surface);
  color: inherit;
  text-decoration: none;
}
.photo {
  position: relative;
  height: 120px;
}
.badge {
  position: absolute;
  top: var(--e3);
  left: var(--e3);
}
.corps {
  padding: var(--e3);
}
.meta {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.loyer {
  margin-top: 2px;
  font-family: var(--police-titre);
  font-size: 1.1875rem;
  font-weight: 800;
}
.loyer span {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
  font-weight: 600;
}
.distance {
  margin-top: var(--e1);
  color: var(--indigo);
  font-size: var(--texte-s);
  font-weight: 700;
}
</style>
