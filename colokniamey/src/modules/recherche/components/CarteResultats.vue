<script setup lang="ts">
// Carte des annonces (RG23 à RG25) : seules les annonces publiées de la zone visible sont chargées, et rechargées quand
// la carte bouge. Les marqueurs proches sont regroupés ; une position approximative s'affiche en cercle de 150 m
// (jamais en point exact) ; les universités qui ont une position ont leur propre marqueur. Un clic ouvre l'aperçu.
// Animations : transform et opacity seulement, coupées si prefers-reduced-motion. Les tuiles ne sont pas mises en
// cache par le service worker.
import { onBeforeUnmount, ref, watch } from 'vue'
import type { Circle, LayerGroup, Map as CarteLeaflet, Marker } from 'leaflet'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import CarteBase from '@/core/ui/CarteBase.vue'
import { annoncesCarte, type MarqueurCarte } from '../services/rechercheService'
import { regrouper, type FiltresRecherche } from '../types'

export interface UniversiteCarte {
  id: number
  nom: string
  latitude: number
  longitude: number
}

const props = defineProps<{
  filtres: FiltresRecherche
  villeId?: number
  centre: [number, number]
  universites: UniversiteCarte[]
}>()
const emit = defineEmits<{ choisir: [marqueur: MarqueurCarte]; compte: [nombre: number] }>()

let carte: CarteLeaflet | null = null
let leaflet: typeof import('leaflet') | null = null
let couche: LayerGroup | null = null
let minuteur: ReturnType<typeof setTimeout> | null = null
let sequence = 0
const marqueurs = ref<MarqueurCarte[]>([])
const erreur = ref('')

function prix(montant: number): string {
  return new Intl.NumberFormat('fr-FR').format(montant).replace(/[  ]/g, ' ')
}

function dessiner() {
  if (!carte || !leaflet) return
  const L = leaflet
  couche?.clearLayers()
  couche ??= L.layerGroup().addTo(carte)

  // Universités qui ont une position (RG25 bis) : marqueur distinct
  for (const u of props.universites) {
    const icone = L.divIcon({ className: 'repere-univ', html: '<span>U</span>', iconSize: [28, 28], iconAnchor: [14, 14] })
    L.marker([u.latitude, u.longitude], { icon: icone, title: u.nom, keyboard: false }).addTo(couche)
  }

  const groupes = regrouper(marqueurs.value, carte.getZoom())
  for (const g of groupes) {
    if (g.points.length > 1) {
      const icone = L.divIcon({ className: 'repere-groupe', html: `<span>${g.points.length}</span>`, iconSize: [40, 40], iconAnchor: [20, 20] })
      const m: Marker = L.marker([g.latitude, g.longitude], { icon: icone, keyboard: false }).addTo(couche)
      m.on('click', () => carte?.setView([g.latitude, g.longitude], Math.min((carte?.getZoom() ?? 12) + 2, 18)))
      continue
    }
    const a = g.points[0]
    if (!a) continue
    if (a.zoneRayonM > 0) {
      // RG23 : zone approximative, jamais le point exact
      const cercle: Circle = L.circle([a.latitude, a.longitude], { radius: a.zoneRayonM, color: '#C4520F', weight: 2, fillOpacity: 0.15 }).addTo(couche)
      cercle.on('click', () => emit('choisir', a))
    }
    const icone = L.divIcon({
      className: a.groupeEnFormation ? 'repere-prix repere-groupe-formation' : 'repere-prix',
      html: `<span>${prix(a.partMensuelle)}</span>`,
      iconSize: [72, 28],
      iconAnchor: [36, 14],
    })
    L.marker([a.latitude, a.longitude], { icon: icone, title: a.titre, keyboard: true })
      .addTo(couche)
      .on('click', () => emit('choisir', a))
  }
}

async function charger() {
  if (!carte) return
  const limites = carte.getBounds()
  const moi = ++sequence
  try {
    const resultat = await annoncesCarte(
      { sud: limites.getSouth(), ouest: limites.getWest(), nord: limites.getNorth(), est: limites.getEast() },
      props.filtres,
      props.villeId,
    )
    // Une réponse plus ancienne que la dernière demande est ignorée
    if (moi !== sequence) return
    erreur.value = ''
    marqueurs.value = resultat
    emit('compte', resultat.length)
    dessiner()
  } catch (e) {
    if (moi === sequence) erreur.value = e instanceof Error ? e.message : 'La carte n\'a pas pu être chargée.'
  }
}

function planifier() {
  if (minuteur) clearTimeout(minuteur)
  minuteur = setTimeout(() => void charger(), 400)
}

function carteprete(c: CarteLeaflet, L: typeof import('leaflet')) {
  carte = c
  leaflet = L
  c.on('moveend', planifier)
  void charger()
}

watch(() => props.filtres, () => void charger(), { deep: true })
watch(() => props.universites, dessiner)
onBeforeUnmount(() => {
  if (minuteur) clearTimeout(minuteur)
  carte?.off('moveend', planifier)
  couche?.clearLayers()
})
</script>

<template>
  <div class="carte-resultats">
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <CarteBase :centre="centre" :zoom="12" @pret="carteprete" />
    <p class="legende">Un cercle orange indique une zone d'environ 150 m : l'adresse exacte n'est pas publique.</p>
  </div>
</template>

<style scoped>
.carte-resultats {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
}
.carte-resultats :deep(.carte) {
  height: 60vh;
  min-height: 22rem;
}
.legende {
  margin: 0;
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
</style>

<style>
/* Marqueurs créés par Leaflet hors du composant : style global, sans image ni ombre */
.repere-prix span,
.repere-groupe span,
.repere-univ span {
  display: grid;
  place-items: center;
  font-family: var(--police-texte);
  font-weight: 700;
  animation: repere-chute 250ms cubic-bezier(0, 0, 0.2, 1);
}
.repere-prix span {
  height: 28px;
  padding: 0 8px;
  border: 2px solid #ffffff;
  border-radius: 14px;
  background: #c4520f;
  color: #ffffff;
  font-size: 13px;
  white-space: nowrap;
}
.repere-groupe-formation span {
  background: #1e3966;
}
.repere-groupe span {
  width: 40px;
  height: 40px;
  border: 3px solid #ffffff;
  border-radius: 50%;
  background: #1e3966;
  color: #ffffff;
}
.repere-univ span {
  width: 28px;
  height: 28px;
  border: 2px solid #ffffff;
  border-radius: 6px;
  background: #2c7a4b;
  color: #ffffff;
  font-size: 13px;
}
@keyframes repere-chute {
  from {
    transform: translateY(-16px);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .repere-prix span,
  .repere-groupe span,
  .repere-univ span {
    animation: none;
  }
}
</style>
