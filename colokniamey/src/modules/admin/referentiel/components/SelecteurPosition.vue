<script setup lang="ts">
// « Placer sur la carte » (RG21 à RG25 bis) : on déplace la carte pour trouver le lieu, puis on clique, on fait glisser
// le repère ou on place le repère au centre. Les coordonnées s'affichent et se corrigent à la main.
// Un point hors de la zone de la ville est signalé ici, et refusé par la base (RG22).
import { computed, onBeforeUnmount, watch } from 'vue'
import type { Map as CarteLeaflet, Marker } from 'leaflet'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import CarteBase from '@/core/ui/CarteBase.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import { dansLaZone, formaterCoordonnee, lireCoordonnees, type ZoneVille } from '../geo'

const latitude = defineModel<string>('latitude', { required: true })
const longitude = defineModel<string>('longitude', { required: true })

const props = defineProps<{ zone: ZoneVille | null }>()

let carte: CarteLeaflet | null = null
let leaflet: typeof import('leaflet') | null = null
let repere: Marker | null = null

const point = computed(() => lireCoordonnees(latitude.value, longitude.value))
const erreurSaisie = computed(() => (point.value && 'erreur' in point.value ? point.value.erreur : ''))
const horsZone = computed(() => {
  const p = point.value
  return p !== null && !('erreur' in p) && props.zone !== null && !dansLaZone(p, props.zone)
})

function fixer(lat: number, lng: number) {
  latitude.value = formaterCoordonnee(lat)
  longitude.value = formaterCoordonnee(lng)
}

function dessinerRepere() {
  if (!carte || !leaflet) return
  const p = point.value
  if (p === null || 'erreur' in p) {
    repere?.remove()
    repere = null
    return
  }
  if (!repere) {
    const icone = leaflet.divIcon({ className: 'repere-position', html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 28] })
    repere = leaflet.marker([p.latitude, p.longitude], { draggable: true, icon: icone, keyboard: false }).addTo(carte)
    repere.on('dragend', () => {
      const pos = repere?.getLatLng()
      if (pos) fixer(pos.lat, pos.lng)
    })
  } else {
    repere.setLatLng([p.latitude, p.longitude])
  }
}

function carteprete(c: CarteLeaflet, L: typeof import('leaflet')) {
  carte = c
  leaflet = L
  if (props.zone) {
    // La zone de la ville (centre + rayon) : en dehors, le point est refusé
    L.circle([props.zone.latitude, props.zone.longitude], { radius: props.zone.rayonKm * 1000, color: '#1E3966', weight: 1, fillOpacity: 0.04, interactive: false }).addTo(c)
  }
  const p = point.value
  if (p && !('erreur' in p)) c.setView([p.latitude, p.longitude], 16)
  else if (props.zone) c.setView([props.zone.latitude, props.zone.longitude], 12)
  c.on('click', (e) => fixer(e.latlng.lat, e.latlng.lng))
  dessinerRepere()
}

function placerAuCentre() {
  const centre = carte?.getCenter()
  if (centre) fixer(centre.lat, centre.lng)
}

function effacer() {
  latitude.value = ''
  longitude.value = ''
}

watch([latitude, longitude], dessinerRepere)
onBeforeUnmount(() => {
  repere?.remove()
  repere = null
})

// La carte démarre sur la ville (ou sur un centre par défaut si la ville n'est pas encore choisie)
const centreInitial = computed<[number, number]>(() => (props.zone ? [props.zone.latitude, props.zone.longitude] : [13.5116, 2.1254]))
</script>

<template>
  <div class="position">
    <p class="aide">Déplace la carte jusqu'au lieu, puis touche-la pour poser le repère. Tu peux le faire glisser pour l'ajuster.</p>
    <CarteBase :centre="centreInitial" :zoom="12" @pret="carteprete" />
    <div class="boutons">
      <BoutonUi variante="secondaire" @click="placerAuCentre">Placer au centre de la carte</BoutonUi>
      <BoutonUi variante="secondaire" :desactive="latitude === '' && longitude === ''" @click="effacer">Retirer la position</BoutonUi>
    </div>
    <div class="coordonnees">
      <ChampUi v-model="latitude" libelle="Latitude" />
      <ChampUi v-model="longitude" libelle="Longitude" />
    </div>
    <AlerteUi v-if="erreurSaisie" type="erreur">{{ erreurSaisie }}</AlerteUi>
    <AlerteUi v-else-if="horsZone" type="erreur">Ce point est en dehors de la zone de la ville : il sera refusé.</AlerteUi>
  </div>
</template>

<style scoped>
.position,
.boutons {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
}
.boutons {
  flex-flow: row wrap;
}
.coordonnees {
  display: grid;
  gap: var(--e3);
  grid-template-columns: 1fr 1fr;
}
.aide {
  margin: 0;
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
</style>

<style>
/* Le repère est créé par Leaflet hors du composant : style global, sans image ni ombre */
.repere-position span {
  display: block;
  width: 22px;
  height: 22px;
  margin: 3px;
  border: 3px solid #ffffff;
  border-radius: 50% 50% 50% 0;
  background: #c4520f;
  transform: rotate(-45deg);
}
</style>
