<script setup lang="ts">
// Carte réutilisable Leaflet + tuiles OpenStreetMap (RG21 et suivantes dans M4/M5).
// Leaflet est chargé à la demande : les autres pages ne paient pas son poids.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Map as CarteLeaflet } from 'leaflet'

const props = withDefaults(
  defineProps<{
    // Centre par défaut : Niamey (valeur approximative, la zone exacte vient du référentiel M1)
    centre?: [number, number]
    zoom?: number
  }>(),
  { centre: () => [13.5116, 2.1254], zoom: 12 },
)

const emit = defineEmits<{ pret: [carte: CarteLeaflet, leaflet: typeof import('leaflet')] }>()

const conteneur = ref<HTMLDivElement | null>(null)
const echec = ref(false)
let carte: CarteLeaflet | null = null

onMounted(async () => {
  try {
    const L = await import('leaflet')
    await import('leaflet/dist/leaflet.css')
    if (!conteneur.value) return
    carte = L.map(conteneur.value).setView(props.centre, props.zoom)
    // L'attribution OpenStreetMap est obligatoire et reste visible
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(carte)
    emit('pret', carte, L)
  } catch {
    echec.value = true
  }
})

onBeforeUnmount(() => {
  carte?.remove()
  carte = null
})
</script>

<template>
  <div class="carte-zone">
    <p v-if="echec" class="echec">La carte n'a pas pu être chargée. Vérifie ta connexion.</p>
    <div ref="conteneur" class="carte" role="application" aria-label="Carte" />
  </div>
</template>

<style scoped>
.carte {
  width: 100%;
  height: 20rem;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
}
.echec {
  color: var(--orange);
}
</style>
