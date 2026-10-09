<script setup lang="ts">
// Composant obligatoire pour toute photo (RG49) : aucun module n'envoie directement vers Storage.
// Mode « televerser » : prépare la photo, la dépose dans photos_en_attente et l'enregistre (avatars, annonces).
// Mode « traiter » : prépare seulement la photo (signature, WebP sans EXIF/GPS, empreinte) et la rend
// à l'appelant sans rien publier ; utilisé par K pour les pièces d'identité, qui ne sont jamais publiées.
import { onBeforeUnmount, ref, useTemplateRef } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import { parametres } from '@/core/parametres'
import { ErreurPhoto, traiterImage, type PhotoTraitee } from '../images/traitement'
import { precontrolerPhoto, televerserPhoto, type UsagePhoto } from '../services/securiteService'

const props = withDefaults(
  defineProps<{
    usage: UsagePhoto
    mode?: 'televerser' | 'traiter'
    libelle?: string
    /** Ouvre l'appareil photo avant (selfie) plutôt que la galerie, sur les téléphones. */
    camera?: boolean
  }>(),
  { mode: 'televerser', libelle: 'Choisir une photo', camera: false },
)

const emit = defineEmits<{ envoyee: [photoId: number]; traitee: [photo: PhotoTraitee] }>()

const champ = useTemplateRef<HTMLInputElement>('champ')
const etat = ref<'repos' | 'preparation' | 'envoi' | 'termine'>('repos')
const erreur = ref('')
const apercu = ref('')

function oublierApercu() {
  if (apercu.value) URL.revokeObjectURL(apercu.value)
  apercu.value = ''
}
onBeforeUnmount(oublierApercu)

async function choisie(evenement: Event) {
  const entree = evenement.target as HTMLInputElement
  const fichier = entree.files?.[0]
  // Permet de rechoisir le même fichier après une erreur
  entree.value = ''
  if (!fichier) return

  erreur.value = ''
  oublierApercu()
  etat.value = 'preparation'
  try {
    const photo = await traiterImage(fichier, {
      tailleMaxOctets: parametres.value.photo_taille_max_mo * 1048576,
      dimensionMin: parametres.value.photo_dimension_min,
      seuilNsfw: parametres.value.nsfw_seuil,
    })
    apercu.value = URL.createObjectURL(photo.blob)

    if (props.mode === 'traiter') {
      etat.value = 'termine'
      emit('traitee', photo)
      return
    }

    etat.value = 'envoi'
    // RG50 : une image déjà refusée est bloquée avant même d'être envoyée
    await precontrolerPhoto(photo.empreinte)
    const id = await televerserPhoto(photo.blob, props.usage, photo.empreinte)
    etat.value = 'termine'
    emit('envoyee', id)
  } catch (e) {
    etat.value = 'repos'
    oublierApercu()
    erreur.value = e instanceof ErreurPhoto || e instanceof Error ? e.message : 'Une erreur est survenue.'
  }
}
</script>

<template>
  <div class="envoi">
    <img v-if="apercu" :src="apercu" alt="Aperçu de la photo choisie" class="apercu" />

    <input
      ref="champ"
      class="cache"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      :capture="camera ? 'user' : undefined"
      tabindex="-1"
      aria-hidden="true"
      @change="choisie"
    />
    <BoutonUi
      variante="secondaire"
      :chargement="etat === 'preparation' || etat === 'envoi'"
      @click="champ?.click()"
    >
      {{ etat === 'preparation' ? 'Préparation…' : etat === 'envoi' ? 'Envoi…' : etat === 'termine' ? 'Changer de photo' : libelle }}
    </BoutonUi>

    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <AlerteUi v-else-if="etat === 'termine' && mode === 'televerser'" type="succes">
      Photo envoyée. Elle sera visible après validation par l'équipe.
    </AlerteUi>
  </div>
</template>

<style scoped>
.envoi {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  align-items: flex-start;
}
.cache {
  display: none;
}
.apercu {
  width: 100%;
  max-width: 16rem;
  max-height: 16rem;
  object-fit: cover;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
}
</style>
