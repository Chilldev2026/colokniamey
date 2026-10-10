<script setup lang="ts">
// Courbe partagée des tableaux de bord (A1, A6) : type line, tension 0,35, trait de 2 px, UNE seule échelle verticale,
// légende dès deux séries, infobulles au survol et au toucher, animation d'entrée de 400 ms coupée si
// prefers-reduced-motion. Un tableau des valeurs, sous le graphique, reste lisible par les lecteurs d'écran.
// Chart.js est importé module par module pour garder le poids bas.
import { computed } from 'vue'
import { CategoryScale, Chart as ChartJS, Legend, LineElement, LinearScale, PointElement, Tooltip } from 'chart.js'
import { Line } from 'vue-chartjs'
import { animationsReduites, DUREES } from '../../design/useAnimation'
import { couleurSerie } from './couleurs'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

export interface SerieCourbe {
  nom: string
  valeurs: number[]
}

const props = defineProps<{ titre: string; etiquettes: string[]; series: SerieCourbe[]; hauteur?: number }>()

const donnees = computed(() => ({
  labels: props.etiquettes,
  datasets: props.series.map((s, i) => ({
    label: s.nom,
    data: s.valeurs,
    borderColor: couleurSerie(i),
    backgroundColor: couleurSerie(i),
    borderWidth: 2,
    tension: 0.35,
    pointRadius: 2,
    pointHoverRadius: 5,
  })),
}))

const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: animationsReduites() ? (false as const) : { duration: DUREES.lente },
  // Infobulle au survol et au toucher
  interaction: { mode: 'index' as const, intersect: false },
  plugins: { legend: { display: props.series.length > 1, position: 'bottom' as const }, tooltip: { enabled: true } },
  // Une seule échelle verticale, qui commence à zéro
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { maxTicksLimit: 8 } } },
}))
</script>

<template>
  <figure class="graphique">
    <figcaption>{{ titre }}</figcaption>
    <div class="zone" :style="{ height: `${hauteur ?? 220}px` }">
      <Line :data="donnees" :options="options" :aria-label="titre" role="img" />
    </div>
    <details class="valeurs">
      <summary>Voir les valeurs</summary>
      <table>
        <caption class="cache">{{ titre }}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th v-for="s in series" :key="s.nom" scope="col">{{ s.nom }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, i) in etiquettes" :key="e">
            <th scope="row">{{ e }}</th>
            <td v-for="s in series" :key="s.nom">{{ s.valeurs[i] ?? 0 }}</td>
          </tr>
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
.zone {
  position: relative;
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
