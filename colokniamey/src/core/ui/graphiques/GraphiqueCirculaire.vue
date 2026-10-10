<script setup lang="ts">
// Graphique circulaire partagé (A1, A6) : type doughnut, total au centre, légende avec les valeurs, infobulles,
// animation d'entrée de 400 ms coupée si prefers-reduced-motion, tableau des valeurs accessible sous le graphique.
// Couleurs : #3A66B0, #E0731F, #3E9B6B, #B05A9A, puis gris #8A93A3 pour « autres, refusées ou retirées ».
import { computed } from 'vue'
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import { animationsReduites, DUREES } from '../../design/useAnimation'
import { COULEUR_AUTRES, couleurSerie } from './couleurs'

ChartJS.register(ArcElement, Tooltip, Legend)

export interface PartCirculaire {
  libelle: string
  valeur: number
  /** Couleur imposée ; sinon la couleur de la série selon l'ordre. */
  couleur?: string
  /** Catégorie « autres, refusées ou retirées » : grise. */
  autres?: boolean
}

const props = defineProps<{ titre: string; parts: PartCirculaire[] }>()

const couleurs = computed(() => props.parts.map((p, i) => p.couleur ?? (p.autres ? COULEUR_AUTRES : couleurSerie(i))))
const total = computed(() => props.parts.reduce((somme, p) => somme + p.valeur, 0))

const donnees = computed(() => ({
  labels: props.parts.map((p) => p.libelle),
  datasets: [{ data: props.parts.map((p) => p.valeur), backgroundColor: couleurs.value, borderColor: '#ffffff', borderWidth: 2 }],
}))

const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '65%',
  animation: animationsReduites() ? (false as const) : { duration: DUREES.lente },
  // La légende est celle de la page (avec les valeurs) : celle du graphique est masquée
  plugins: { legend: { display: false }, tooltip: { enabled: true } },
}))
</script>

<template>
  <figure class="graphique">
    <figcaption>{{ titre }}</figcaption>
    <div class="corps">
      <div class="zone">
        <Doughnut :data="donnees" :options="options" :aria-label="titre" role="img" />
        <div class="centre" aria-hidden="true">
          <strong>{{ total }}</strong>
          <span>au total</span>
        </div>
      </div>
      <ul class="legende">
        <li v-for="(p, i) in parts" :key="p.libelle">
          <span class="pastille" :style="{ background: couleurs[i] }" aria-hidden="true" />
          <span class="libelle">{{ p.libelle }}</span>
          <strong>{{ p.valeur }}</strong>
        </li>
      </ul>
    </div>
    <details class="valeurs">
      <summary>Voir les valeurs</summary>
      <table>
        <caption class="cache">{{ titre }}</caption>
        <thead>
          <tr><th scope="col">Catégorie</th><th scope="col">Valeur</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in parts" :key="p.libelle"><th scope="row">{{ p.libelle }}</th><td>{{ p.valeur }}</td></tr>
          <tr><th scope="row">Total</th><td>{{ total }}</td></tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>

<style scoped>
.graphique {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  margin: 0;
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
figcaption {
  font-weight: 700;
}
.corps {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e4);
  align-items: center;
}
.zone {
  position: relative;
  width: 11rem;
  height: 11rem;
}
.centre {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.centre strong {
  font-family: var(--police-titre);
  font-size: var(--texte-xl);
  line-height: 1;
}
.centre span {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.legende {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--e2);
  min-width: 10rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.legende li {
  display: flex;
  gap: var(--e2);
  align-items: center;
}
.libelle {
  flex: 1;
}
.pastille {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}
.valeurs summary {
  min-height: var(--cible-min);
  color: var(--indigo);
  cursor: pointer;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--texte-s);
}
th,
td {
  padding: var(--e1) var(--e2);
  border-bottom: 1px solid var(--bordure);
  text-align: left;
}
.cache {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
