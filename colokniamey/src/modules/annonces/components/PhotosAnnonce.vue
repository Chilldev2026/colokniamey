<script setup lang="ts">
// Étape « Photos » (RG18, RG48 à RG50). Les photos passent obligatoirement par EnvoiPhoto de S : espace privé, puis
// validation par un admin. Ici : rattachement à l'annonce, ordre, retrait. Le nombre est limité par photos_max.
import { computed, onMounted, ref } from 'vue'
import { parametres } from '@/core/parametres'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import { EnvoiPhoto } from '@/modules/securite'
import { ajouterPhoto, listerPhotosAnnonce, ordonnerPhotos, retirerPhoto, urlPhotoEnAttente, urlPhotoPublique } from '../services/annoncesService'
import type { PhotoAnnonceVue } from '../types'

const props = defineProps<{ annonceId: number }>()
const emit = defineEmits<{ change: [nombre: number] }>()

const photos = ref<PhotoAnnonceVue[]>([])
const adresses = ref<Record<number, string>>({})
const chargement = ref(true)
const erreur = ref('')

const complet = computed(() => photos.value.length >= parametres.value.photos_max)

async function charger() {
  erreur.value = ''
  try {
    photos.value = await listerPhotosAnnonce(props.annonceId)
    const urls: Record<number, string> = {}
    for (const p of photos.value) {
      const u = p.statut === 'validee' ? urlPhotoPublique(p.chemin) : await urlPhotoEnAttente(p.chemin)
      if (u) urls[p.id] = u
    }
    adresses.value = urls
    emit('change', photos.value.length)
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger les photos.'
  } finally {
    chargement.value = false
  }
}
onMounted(charger)

async function agir(travail: () => Promise<void>) {
  erreur.value = ''
  try {
    await travail()
    await charger()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Une erreur est survenue.'
  }
}

// Photo envoyée par EnvoiPhoto (déjà enregistrée dans la table photos) : on la rattache à l'annonce
function envoyee(photoId: number) {
  void agir(() => ajouterPhoto(props.annonceId, photoId))
}

function deplacer(index: number, delta: number) {
  const ids = photos.value.map((p) => p.id)
  const cible = index + delta
  if (cible < 0 || cible >= ids.length) return
  const [id] = ids.splice(index, 1)
  ids.splice(cible, 0, id as number)
  void agir(() => ordonnerPhotos(ids))
}

const LIBELLES: Record<PhotoAnnonceVue['statut'], string> = {
  en_attente: 'En cours de validation',
  validee: 'Validée',
  refusee: 'Refusée',
}
</script>

<template>
  <div class="photos">
    <p class="aide">
      {{ photos.length }} sur {{ parametres.photos_max }} photos. Chaque photo est vérifiée par l'équipe avant d'être visible.
      La première est la photo principale.
    </p>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-if="chargement" :lignes="2" />
    <ul v-else class="liste">
      <li v-for="(p, i) in photos" :key="p.id" class="photo">
        <img v-if="adresses[p.id]" :src="adresses[p.id]" :alt="`Photo ${i + 1}`" />
        <div v-else class="vide" aria-hidden="true" />
        <PuceUi :variante="p.statut === 'validee' ? 'validee' : 'neutre'">{{ LIBELLES[p.statut] }}</PuceUi>
        <p v-if="p.statut === 'refusee' && p.motif" class="motif">Motif : {{ p.motif }}</p>
        <div class="boutons">
          <BoutonUi variante="secondaire" :desactive="i === 0" aria-label="Avancer la photo" @click="deplacer(i, -1)">←</BoutonUi>
          <BoutonUi variante="secondaire" :desactive="i === photos.length - 1" aria-label="Reculer la photo" @click="deplacer(i, 1)">→</BoutonUi>
          <BoutonUi variante="secondaire" @click="agir(() => retirerPhoto(p.id))">Retirer</BoutonUi>
        </div>
      </li>
    </ul>
    <AlerteUi v-if="complet" type="info">Tu as atteint le maximum de photos. Retires-en une pour en ajouter une autre.</AlerteUi>
    <EnvoiPhoto v-else usage="annonce" libelle="Ajouter une photo" :cote-max="1600" @envoyee="envoyee" />
  </div>
</template>

<style scoped>
.photos {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
}
.aide,
.motif {
  margin: 0;
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.liste {
  display: grid;
  gap: var(--e3);
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}
.photo {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  padding: var(--e2);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
img,
.vide {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: var(--rayon-s);
  background: var(--terre-cuite);
  object-fit: cover;
}
.boutons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e1);
}
</style>
