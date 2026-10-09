<script setup lang="ts">
// Étape « Localisation » (RG21 à RG23) : deux façons de placer le logement.
//  (a) « Localiser ma maison » : géolocalisation du téléphone, haute précision, 15 s au plus ; la précision obtenue
//      est affichée en mètres avec un cercle, et au-delà de 50 m on invite à ajuster le repère ;
//  (b) placement à la main : un clic sur la carte, ou on fait glisser le repère.
// Dans les deux cas le repère reste déplaçable et l'auteur confirme la position. Le point est refusé hors de la zone
// de la ville (RG22), ici pour prévenir et dans la base pour protéger.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Circle, Map as CarteLeaflet, Marker } from 'leaflet'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import CarteBase from '@/core/ui/CarteBase.vue'
import CaseACocher from '@/core/ui/CaseACocher.vue'
import RadioCarte from '@/core/ui/RadioCarte.vue'
import {
  contexteSecurise,
  formaterPrecision,
  messageGeolocalisation,
  OPTIONS_GEOLOCALISATION,
  precisionSuffisante,
  SEUIL_PRECISION_METRES,
} from '../geolocalisation'
import type { PointCarte, PrecisionPosition } from '../types'

export interface ZoneVilleAnnonce {
  latitude: number
  longitude: number
  rayonKm: number
}

const position = defineModel<PointCarte | null>('position', { required: true })
const precision = defineModel<PrecisionPosition>('precision', { required: true })
const confirmee = defineModel<boolean>('confirmee', { required: true })

const props = defineProps<{ zone: ZoneVilleAnnonce | null }>()

let carte: CarteLeaflet | null = null
let leaflet: typeof import('leaflet') | null = null
let repere: Marker | null = null
let cerclePrecision: Circle | null = null

const recherche = ref(false)
const message = ref('')
const precisionObtenue = ref<number | null>(null)

const horsZone = computed(() => {
  const p = position.value
  const z = props.zone
  if (!p || !z) return false
  const rayon = 6371000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(p.latitude - z.latitude)
  const dLng = rad(p.longitude - z.longitude)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(z.latitude)) * Math.cos(rad(p.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * rayon * Math.asin(Math.sqrt(a)) > z.rayonKm * 1000
})

function fixer(latitude: number, longitude: number) {
  position.value = { latitude, longitude }
  confirmee.value = false
}

function dessiner() {
  if (!carte || !leaflet) return
  const p = position.value
  if (!p) {
    repere?.remove()
    repere = null
    return
  }
  if (!repere) {
    const icone = leaflet.divIcon({ className: 'repere-annonce', html: '<span></span>', iconSize: [30, 30], iconAnchor: [15, 30] })
    repere = leaflet.marker([p.latitude, p.longitude], { draggable: true, icon: icone, keyboard: false }).addTo(carte)
    repere.on('dragend', () => {
      const pos = repere?.getLatLng()
      if (pos) {
        // Le repère déplacé à la main n'a plus la précision du GPS
        precisionObtenue.value = null
        cerclePrecision?.remove()
        cerclePrecision = null
        fixer(pos.lat, pos.lng)
      }
    })
  } else {
    repere.setLatLng([p.latitude, p.longitude])
  }
}

function carteprete(c: CarteLeaflet, L: typeof import('leaflet')) {
  carte = c
  leaflet = L
  if (props.zone) {
    L.circle([props.zone.latitude, props.zone.longitude], {
      radius: props.zone.rayonKm * 1000, color: '#1E3966', weight: 1, fillOpacity: 0.03, interactive: false,
    }).addTo(c)
  }
  const p = position.value
  if (p) c.setView([p.latitude, p.longitude], 17)
  else if (props.zone) c.setView([props.zone.latitude, props.zone.longitude], 12)
  c.on('click', (e) => {
    precisionObtenue.value = null
    cerclePrecision?.remove()
    cerclePrecision = null
    message.value = ''
    fixer(e.latlng.lat, e.latlng.lng)
  })
  dessiner()
}

function localiser() {
  message.value = ''
  if (!contexteSecurise()) {
    message.value = 'La localisation demande une connexion sécurisée (HTTPS). Place le repère toi-même sur la carte.'
    return
  }
  if (!('geolocation' in navigator)) {
    message.value = 'Ton navigateur ne sait pas te localiser. Place le repère toi-même sur la carte.'
    return
  }
  recherche.value = true
  navigator.geolocation.getCurrentPosition(
    (reponse) => {
      recherche.value = false
      const { latitude, longitude, accuracy } = reponse.coords
      fixer(latitude, longitude)
      precisionObtenue.value = accuracy
      if (carte && leaflet) {
        carte.setView([latitude, longitude], accuracy > 200 ? 16 : 18)
        cerclePrecision?.remove()
        cerclePrecision = leaflet.circle([latitude, longitude], { radius: accuracy, color: '#C4520F', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(carte)
      }
    },
    (erreur) => {
      recherche.value = false
      message.value = messageGeolocalisation(erreur.code)
    },
    OPTIONS_GEOLOCALISATION,
  )
}

watch(position, dessiner)
onBeforeUnmount(() => {
  repere?.remove()
  cerclePrecision?.remove()
  repere = null
  cerclePrecision = null
})

const centreInitial = computed<[number, number]>(() => {
  const p = position.value
  if (p) return [p.latitude, p.longitude]
  return props.zone ? [props.zone.latitude, props.zone.longitude] : [13.5116, 2.1254]
})
</script>

<template>
  <div class="position">
    <div class="actions">
      <BoutonUi variante="principal" :chargement="recherche" @click="localiser">Localiser ma maison</BoutonUi>
      <p class="aide">À utiliser une fois sur place, avec le GPS du téléphone. Sinon, touche la carte à l'endroit du logement.</p>
    </div>

    <AlerteUi v-if="message" type="info">{{ message }}</AlerteUi>
    <AlerteUi v-if="precisionObtenue !== null && precisionSuffisante(precisionObtenue)" type="succes">
      Position trouvée, précision d'environ {{ formaterPrecision(precisionObtenue) }}.
    </AlerteUi>
    <AlerteUi v-else-if="precisionObtenue !== null" type="info">
      Précision d'environ {{ formaterPrecision(precisionObtenue) }} : c'est moins précis que {{ SEUIL_PRECISION_METRES }} m. Ajuste le repère
      en le faisant glisser jusqu'à ton logement.
    </AlerteUi>

    <CarteBase :centre="centreInitial" :zoom="position ? 17 : 12" @pret="carteprete" />
    <p class="aide">Tu peux faire glisser le repère pour l'ajuster.</p>

    <AlerteUi v-if="horsZone" type="erreur">Ce point est en dehors de la zone de la ville : il sera refusé.</AlerteUi>

    <fieldset class="precision">
      <legend>Ce que les autres voient</legend>
      <RadioCarte
        v-model="precision"
        nom="precision-position"
        valeur="approximative"
        libelle="Zone approximative (recommandé)"
        description="Une zone d'environ 150 m autour du logement. Ton adresse exacte reste cachée."
      />
      <RadioCarte
        v-model="precision"
        nom="precision-position"
        valeur="exacte"
        libelle="Position exacte"
        description="Le repère s'affiche à l'endroit précis. Tout le monde peut voir où tu habites."
      />
    </fieldset>

    <CaseACocher v-if="position" v-model="confirmee">
      Je confirme que le repère est bien placé sur le logement.
    </CaseACocher>
  </div>
</template>

<style scoped>
.position {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
}
.actions {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  align-items: flex-start;
}
.aide {
  margin: 0;
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.precision {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  margin: 0;
  padding: 0;
  border: 0;
}
.precision legend {
  margin-bottom: var(--e2);
  font-weight: 700;
}
</style>

<style>
/* Le repère est créé par Leaflet hors du composant : style global. Il tombe sur la carte (transform seulement). */
.repere-annonce span {
  display: block;
  width: 24px;
  height: 24px;
  margin: 3px;
  border: 3px solid #ffffff;
  border-radius: 50% 50% 50% 0;
  background: #c4520f;
  transform: rotate(-45deg);
  animation: repere-tombe 250ms cubic-bezier(0, 0, 0.2, 1);
}
@keyframes repere-tombe {
  from {
    transform: translateY(-24px) rotate(-45deg);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .repere-annonce span {
    animation: none;
  }
}
</style>
