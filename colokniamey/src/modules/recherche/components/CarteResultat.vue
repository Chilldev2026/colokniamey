<script setup lang="ts">
// Une annonce dans la liste : carte du socle + cœur de favori + distance à l'université (RG25, seulement si elle a une position).
import { computed } from 'vue'
import CarteAnnonce from '@/core/ui/CarteAnnonce.vue'
import { urlPhoto, type ResultatAnnonce } from '../services/rechercheService'
import { LIBELLES_TYPE, formaterDistance } from '../types'
import BoutonFavori from './BoutonFavori.vue'

const props = defineProps<{ annonce: ResultatAnnonce; quartier: string }>()

const loyer = computed(() => new Intl.NumberFormat('fr-FR').format(props.annonce.partMensuelle).replace(/[  ]/g, ' '))
const distance = computed(() => {
  const m = props.annonce.distanceRefM ?? props.annonce.distanceUniversiteM
  return m === null ? undefined : `À ${formaterDistance(m)} de l'université`
})
</script>

<template>
  <div class="resultat">
    <CarteAnnonce :vers="`/annonces/${annonce.id}`" :type="LIBELLES_TYPE[annonce.type] ?? annonce.type" :quartier="quartier" :loyer="loyer" :distance="distance">
      <template #photo>
        <img v-if="annonce.photoChemin" class="img" :src="urlPhoto(annonce.photoChemin)" :alt="`Photo : ${annonce.titre}`" loading="lazy" />
      </template>
    </CarteAnnonce>
    <div class="favori"><BoutonFavori :annonce-id="annonce.id" /></div>
  </div>
</template>

<style scoped>
.resultat {
  position: relative;
}
.img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.favori {
  position: absolute;
  top: var(--e1);
  right: var(--e1);
  border-radius: var(--rayon-rond);
  background: var(--surface);
}
</style>
