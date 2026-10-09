<script setup lang="ts">
// Selfie pris EN DIRECT (RG53) : getUserMedia, caméra avant, aucun import de fichier. L'image part dans un canvas,
// puis passe par le même traitement que toutes les photos (signature, analyse, WebP sans EXIF/GPS, empreinte).
import { onBeforeUnmount, ref, useTemplateRef } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import { parametres } from '@/core/parametres'
import { ErreurPhoto, traiterImage, type PhotoTraitee } from '@/modules/securite'

defineProps<{ code: string }>()
const emit = defineEmits<{ prise: [photo: PhotoTraitee] }>()

const video = useTemplateRef<HTMLVideoElement>('video')
const etat = ref<'repos' | 'camera' | 'traitement' | 'termine'>('repos')
const erreur = ref('')
const apercu = ref('')
let flux: MediaStream | null = null

function arreter() {
  flux?.getTracks().forEach((piste) => piste.stop())
  flux = null
}

function oublierApercu() {
  if (apercu.value) URL.revokeObjectURL(apercu.value)
  apercu.value = ''
}

onBeforeUnmount(() => {
  arreter()
  oublierApercu()
})

async function ouvrirCamera() {
  erreur.value = ''
  if (!navigator.mediaDevices?.getUserMedia) {
    erreur.value = 'Ton appareil ne permet pas d\'ouvrir la caméra depuis le navigateur.'
    return
  }
  try {
    flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
  } catch {
    erreur.value = 'La caméra n\'est pas accessible. Autorise-la dans ton navigateur, puis réessaie.'
    return
  }
  etat.value = 'camera'
  // La balise vidéo n'existe qu'après l'affichage de l'état « camera »
  await new Promise((resolve) => setTimeout(resolve, 0))
  if (video.value) {
    video.value.srcObject = flux
    await video.value.play().catch(() => undefined)
  }
}

async function prendre() {
  const lecteur = video.value
  if (!lecteur || lecteur.videoWidth === 0) return
  etat.value = 'traitement'
  try {
    const canvas = document.createElement('canvas')
    canvas.width = lecteur.videoWidth
    canvas.height = lecteur.videoHeight
    canvas.getContext('2d')?.drawImage(lecteur, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('capture impossible'))), 'image/jpeg', 0.92),
    )
    arreter()
    const photo = await traiterImage(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }), {
      tailleMaxOctets: parametres.value.photo_taille_max_mo * 1048576,
      dimensionMin: parametres.value.photo_dimension_min,
      seuilNsfw: parametres.value.nsfw_seuil,
      coteMax: 1280,
    })
    oublierApercu()
    apercu.value = URL.createObjectURL(photo.blob)
    etat.value = 'termine'
    emit('prise', photo)
  } catch (e) {
    arreter()
    etat.value = 'repos'
    erreur.value = e instanceof ErreurPhoto ? e.message : 'La photo n\'a pas pu être prise. Réessaie.'
  }
}

function recommencer() {
  oublierApercu()
  void ouvrirCamera()
}
</script>

<template>
  <div class="selfie">
    <p class="consigne">
      Écris ce code sur une feuille et tiens-la près de ton visage, à côté de ta pièce d'identité si possible :
    </p>
    <p class="code" aria-label="Code à écrire sur la feuille">{{ code }}</p>

    <video v-show="etat === 'camera'" ref="video" class="video" playsinline muted aria-label="Aperçu de la caméra"></video>
    <img v-if="apercu && etat === 'termine'" :src="apercu" alt="Ton selfie" class="video" />

    <div class="actions">
      <BoutonUi v-if="etat === 'repos'" variante="secondaire" @click="ouvrirCamera">Ouvrir la caméra</BoutonUi>
      <BoutonUi v-else-if="etat === 'camera'" variante="principal" @click="prendre">Prendre le selfie</BoutonUi>
      <BoutonUi v-else-if="etat === 'traitement'" variante="secondaire" chargement>Préparation…</BoutonUi>
      <BoutonUi v-else variante="secondaire" @click="recommencer">Reprendre le selfie</BoutonUi>
    </div>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
  </div>
</template>

<style scoped>
.selfie {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
}
.consigne {
  margin: 0;
}
.code {
  align-self: flex-start;
  margin: 0;
  padding: var(--e2) var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
  color: var(--indigo);
  font-family: var(--police-titre);
  font-size: var(--texte-xl);
  font-weight: 800;
  letter-spacing: 0.25em;
}
.video {
  width: 100%;
  max-width: 22rem;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--encre);
  /* miroir : plus naturel pour se cadrer ; l'image enregistrée n'est pas retournée */
  transform: scaleX(-1);
}
img.video {
  transform: none;
}
.actions {
  display: flex;
  gap: var(--e3);
}
</style>
