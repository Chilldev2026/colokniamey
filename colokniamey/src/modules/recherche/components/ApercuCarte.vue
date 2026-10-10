<script setup lang="ts">
// Aperçu d'une annonce choisie sur la carte : photo, type, loyer, quartier, distance à l'université choisie,
// puis galerie plein écran et lien vers le détail (RG24, RG25). Feuille du bas du socle (rebond, tirer pour fermer).
import { ref } from 'vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import FeuilleBas from '@/core/ui/FeuilleBas.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import { listerPhotosPubliques, urlPhoto, type MarqueurCarte } from '../services/rechercheService'
import { LIBELLES_TYPE, formaterDistance } from '../types'
import BoutonFavori from './BoutonFavori.vue'
import GaleriePleinEcran from './GaleriePleinEcran.vue'

const ouverte = defineModel<boolean>({ required: true })
defineProps<{ marqueur: MarqueurCarte | null; quartier: string }>()

const photos = ref<string[]>([])
const galerieOuverte = ref(false)
const erreur = ref('')

async function voirPhotos(id: number) {
  erreur.value = ''
  try {
    photos.value = await listerPhotosPubliques(id)
    if (photos.value.length === 0) erreur.value = 'Cette annonce n\'a pas encore de photo validée.'
    else galerieOuverte.value = true
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger les photos.'
  }
}
function prix(montant: number): string {
  return new Intl.NumberFormat('fr-FR').format(montant).replace(/[  ]/g, ' ')
}
</script>

<template>
  <FeuilleBas v-model="ouverte" :titre="marqueur?.titre ?? 'Annonce'">
    <div v-if="marqueur" class="apercu">
      <button v-if="marqueur.photoChemin" type="button" class="photo" aria-label="Voir les photos en plein écran" @click="voirPhotos(marqueur.id)">
        <img :src="urlPhoto(marqueur.photoChemin)" :alt="`Photo : ${marqueur.titre}`" />
      </button>
      <div v-else class="photo vide" aria-hidden="true" />
      <div class="infos">
        <PuceUi variante="info">{{ LIBELLES_TYPE[marqueur.type] ?? marqueur.type }}</PuceUi>
        <PuceUi v-if="marqueur.groupeEnFormation" variante="validee">Groupe en formation</PuceUi>
        <h3>{{ marqueur.titre }}</h3>
        <p class="loyer"><strong>{{ prix(marqueur.partMensuelle) }} FCFA</strong> par mois</p>
        <p class="meta">
          {{ quartier }}<template v-if="marqueur.distanceRefM !== null"> · à {{ formaterDistance(marqueur.distanceRefM) }} de l'université choisie</template>
        </p>
        <p v-if="marqueur.zoneRayonM > 0" class="meta">Zone approximative : l'adresse exacte reste privée.</p>
        <p v-if="erreur" class="erreur" role="alert">{{ erreur }}</p>
      </div>
      <div class="actions">
        <BoutonFavori :annonce-id="marqueur.id" />
        <BoutonUi v-if="marqueur.photoChemin" variante="secondaire" @click="voirPhotos(marqueur.id)">Voir les photos</BoutonUi>
        <RouterLink class="detail" :to="`/annonces/${marqueur.id}`">Voir l'annonce</RouterLink>
      </div>
    </div>
    <GaleriePleinEcran v-if="galerieOuverte && marqueur" :photos="photos" :titre="marqueur.titre" @fermer="galerieOuverte = false" />
  </FeuilleBas>
</template>

<style scoped>
.apercu {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
}
.photo {
  width: 100%;
  aspect-ratio: 16 / 9;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--terre-cuite);
  cursor: pointer;
}
.photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.infos {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
  align-items: flex-start;
}
h3,
p {
  margin: 0;
}
.meta {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.erreur {
  color: var(--erreur);
  font-size: var(--texte-s);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
  align-items: center;
}
.detail {
  display: inline-flex;
  align-items: center;
  min-height: var(--cible-min);
  padding: 0 var(--e4);
  border-radius: var(--rayon);
  background: var(--orange);
  color: #ffffff;
  font-weight: 700;
  text-decoration: none;
}
</style>
