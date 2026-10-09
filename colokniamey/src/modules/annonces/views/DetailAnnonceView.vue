<script setup lang="ts">
// Détail d'une annonce (RG19, RG23 à RG25, RG28 à RG33) : photos, prix par personne et loyer total, équipements,
// règles, tâches partagées, colocataire recherché, profil de l'annonceur et contact selon RG32.
// Le public ne voit jamais le point exact : une zone d'environ 150 m, ou le point si l'auteur l'a choisi (RG23).
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { Map as CarteLeaflet } from 'leaflet'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import CarteBase from '@/core/ui/CarteBase.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import { useAuthStore } from '@/modules/auth'
import { BadgeIdentite } from '@/modules/identite'
import { CarteProfilPublic } from '@/modules/profils'
import { listerQuartiers, listerUniversites, listerVilles } from '@/modules/referentiel'
import { lireAnnonceDetail, lireContactAnnonce } from '../services/annoncesService'
import { LIBELLES_FREQUENCE, LIBELLES_GENRE, LIBELLES_REPARTITION, LIBELLES_STATUT, LIBELLES_TYPE, type AnnonceDetail } from '../types'
import { formaterMontant } from '../validation'

const route = useRoute()
const auth = useAuthStore()

const annonce = ref<AnnonceDetail | null>(null)
const chargement = ref(true)
const erreur = ref('')
const quartier = ref('')
const universite = ref('')
const photoActive = ref(0)
const contactEnCours = ref(false)
const messageContact = ref('')

const id = Number(route.params.id)
const estPubliee = computed(() => annonce.value?.statut === 'publiee')
const estColocation = computed(() => annonce.value?.type === 'place_colocation')
const redirection = computed(() => encodeURIComponent(route.fullPath))

onMounted(async () => {
  try {
    if (!Number.isInteger(id)) return
    annonce.value = await lireAnnonceDetail(id)
    if (!annonce.value) return
    // Noms du quartier et de l'université (référentiel M1)
    const villes = await listerVilles()
    for (const v of villes) {
      const q = (await listerQuartiers(v.id)).find((x) => x.id === annonce.value?.quartierId)
      if (q) {
        quartier.value = q.nom
        break
      }
    }
    if (annonce.value.universiteId !== null) {
      const u = (await listerUniversites()).find((x) => x.id === annonce.value?.universiteId)
      universite.value = u ? (u.sigle ?? u.nom) : ''
    }
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger l\'annonce.'
  } finally {
    chargement.value = false
  }
})

function carteprete(carte: CarteLeaflet, L: typeof import('leaflet')) {
  const a = annonce.value
  if (!a || a.latitude === null || a.longitude === null) return
  carte.setView([a.latitude, a.longitude], a.zoneRayonM > 0 ? 16 : 17)
  if (a.zoneRayonM > 0) {
    // RG23 : une zone, jamais un point
    L.circle([a.latitude, a.longitude], { radius: a.zoneRayonM, color: '#C4520F', weight: 2, fillOpacity: 0.15, interactive: false }).addTo(carte)
  } else {
    L.circleMarker([a.latitude, a.longitude], { radius: 9, color: '#FFFFFF', weight: 3, fillColor: '#C4520F', fillOpacity: 1 }).addTo(carte)
  }
}

// RG32 : le numéro n'est demandé qu'au clic, pour les utilisateurs connectés (30 consultations par jour)
async function contacter(canal: 'appel' | 'whatsapp') {
  if (!annonce.value) return
  messageContact.value = ''
  contactEnCours.value = true
  try {
    const c = await lireContactAnnonce(annonce.value.id)
    if (canal === 'appel' && c.telephone) {
      window.location.href = `tel:${c.telephone}`
    } else if (canal === 'whatsapp' && c.whatsapp) {
      const texte = `Bonjour, je suis intéressé(e) par ton annonce « ${annonce.value.titre} » sur ColokNiamey.`
      window.open(`https://wa.me/${c.whatsapp}?text=${encodeURIComponent(texte)}`, '_blank', 'noopener')
    } else {
      messageContact.value = 'L\'annonceur ne propose pas ce moyen de contact.'
    }
  } catch (e) {
    messageContact.value = e instanceof Error ? e.message : 'Contact impossible pour le moment.'
  } finally {
    contactEnCours.value = false
  }
}

function distance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${m} m`
}
function date(valeur: string): string {
  return new Date(valeur).toLocaleDateString('fr-FR')
}
</script>

<template>
  <section class="detail">
    <ChargementUi v-if="chargement" :lignes="5" />
    <AlerteUi v-else-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <p v-else-if="!annonce" class="vide">Cette annonce n'est plus disponible.</p>

    <template v-else>
      <AlerteUi v-if="!estPubliee" :type="annonce.statut === 'refusee' ? 'erreur' : 'info'">
        Aperçu visible par toi seulement : annonce « {{ LIBELLES_STATUT[annonce.statut].toLowerCase() }} ».
        <template v-if="annonce.motifRefus"> <strong>Motif :</strong> {{ annonce.motifRefus }}</template>
      </AlerteUi>

      <!-- Photos -->
      <div v-if="annonce.photos.length > 0" class="galerie">
        <img class="principale" :src="annonce.photos[photoActive]" :alt="`Photo ${photoActive + 1} sur ${annonce.photos.length}`" />
        <ul v-if="annonce.photos.length > 1" class="vignettes">
          <li v-for="(p, i) in annonce.photos" :key="p">
            <button type="button" :class="{ active: i === photoActive }" :aria-label="`Voir la photo ${i + 1}`" @click="photoActive = i">
              <img :src="p" alt="" loading="lazy" />
            </button>
          </li>
        </ul>
      </div>
      <div v-else class="sans-photo" aria-hidden="true" />

      <header class="titre">
        <PuceUi variante="info">{{ LIBELLES_TYPE[annonce.type] }}</PuceUi>
        <h1>{{ annonce.titre }}</h1>
        <p class="lieu">
          {{ quartier }}<template v-if="universite"> · près de {{ universite }}</template>
          <template v-if="annonce.distanceUniversiteM !== null"> ({{ distance(annonce.distanceUniversiteM) }})</template>
        </p>
      </header>

      <!-- Prix (RG28) -->
      <div class="prix">
        <p class="part"><strong>{{ formaterMontant(annonce.partMensuelle) }} FCFA</strong> <span>{{ estColocation ? 'par mois et par colocataire' : 'par mois' }}</span></p>
        <p v-if="annonce.loyerTotal" class="secondaire">
          Loyer total {{ formaterMontant(annonce.loyerTotal) }} FCFA<template v-if="estColocation"> pour {{ annonce.nbPlaces }} places</template>
        </p>
        <p class="secondaire">
          {{ annonce.chargesIncluses ? 'Charges comprises.' : annonce.montantCharges !== null ? `Charges en plus : environ ${formaterMontant(annonce.montantCharges)} FCFA par mois.` : 'Charges en plus.' }}
        </p>
        <p v-if="annonce.disponibleLe" class="secondaire">Disponible à partir du {{ date(annonce.disponibleLe) }}</p>
        <p v-if="annonce.dureeMin || annonce.dureeMax" class="secondaire">
          Séjour
          <template v-if="annonce.dureeMin">d'au moins {{ annonce.dureeMin }} mois</template>
          <template v-if="annonce.dureeMin && annonce.dureeMax"> et </template>
          <template v-if="annonce.dureeMax">d'au plus {{ annonce.dureeMax }} mois</template>
        </p>
      </div>

      <AlerteUi type="info"><strong>Ne payez jamais avant d'avoir visité le logement.</strong></AlerteUi>

      <section class="bloc">
        <h2>Description</h2>
        <p class="texte">{{ annonce.description }}</p>
      </section>

      <section v-if="annonce.equipements.length > 0" class="bloc">
        <h2>Équipements</h2>
        <ul class="puces"><li v-for="e in annonce.equipements" :key="e"><PuceUi>{{ e }}</PuceUi></li></ul>
      </section>

      <section v-if="annonce.regles.length > 0" class="bloc">
        <h2>Règles du logement</h2>
        <ul class="liste"><li v-for="r in annonce.regles" :key="r">{{ r }}</li></ul>
      </section>

      <section v-if="annonce.taches.length > 0" class="bloc">
        <h2>Tâches partagées</h2>
        <ul class="liste">
          <li v-for="t in annonce.taches" :key="t.libelle">
            {{ t.libelle }} <span class="secondaire">({{ LIBELLES_FREQUENCE[t.frequence].toLowerCase() }}, {{ LIBELLES_REPARTITION[t.repartition].toLowerCase() }})</span>
          </li>
        </ul>
      </section>

      <!-- Colocataire recherché (RG33) : seulement affiché, jamais bloquant -->
      <section v-if="annonce.preferenceGenre !== 'indifferent' || annonce.ageMin || annonce.ageMax || annonce.etudiantsUniquement" class="bloc">
        <h2>Colocataire recherché</h2>
        <ul class="liste">
          <li v-if="annonce.preferenceGenre !== 'indifferent'">{{ LIBELLES_GENRE[annonce.preferenceGenre] }}</li>
          <li v-if="annonce.ageMin || annonce.ageMax">
            Âge :
            <template v-if="annonce.ageMin && annonce.ageMax">entre {{ annonce.ageMin }} et {{ annonce.ageMax }} ans</template>
            <template v-else-if="annonce.ageMin">{{ annonce.ageMin }} ans ou plus</template>
            <template v-else>{{ annonce.ageMax }} ans ou moins</template>
          </li>
          <li v-if="annonce.etudiantsUniquement">Étudiants uniquement</li>
        </ul>
        <p class="secondaire">Ces préférences sont indicatives : elles n'empêchent personne d'écrire.</p>
      </section>

      <!-- Carte : zone ou point selon le choix de l'auteur (RG23) -->
      <section v-if="annonce.latitude !== null && annonce.longitude !== null" class="bloc">
        <h2>Où se trouve le logement</h2>
        <p v-if="annonce.zoneRayonM > 0" class="secondaire">Zone approximative : l'adresse exacte est donnée par l'annonceur.</p>
        <CarteBase :centre="[annonce.latitude, annonce.longitude]" :zoom="16" @pret="carteprete" />
      </section>

      <section class="bloc">
        <h2>L'annonceur</h2>
        <CarteProfilPublic :user-id="annonce.auteurId">
          <template #badge="{ userId }"><BadgeIdentite :user-id="userId" /></template>
        </CarteProfilPublic>
      </section>

      <!-- Contact (RG32) -->
      <section v-if="estPubliee" class="bloc contact">
        <h2>Contacter l'annonceur</h2>
        <template v-if="auth.estConnecte">
          <div class="boutons">
            <BoutonUi v-if="annonce.contactAppel" variante="principal" :chargement="contactEnCours" @click="contacter('appel')">Appeler</BoutonUi>
            <BoutonUi v-if="annonce.contactWhatsapp" variante="secondaire" :chargement="contactEnCours" @click="contacter('whatsapp')">Écrire sur WhatsApp</BoutonUi>
          </div>
          <p v-if="!annonce.contactAppel && !annonce.contactWhatsapp" class="secondaire">L'annonceur préfère être contacté par la messagerie de ColokNiamey.</p>
          <AlerteUi v-if="messageContact" type="info">{{ messageContact }}</AlerteUi>
        </template>
        <p v-else>
          <RouterLink :to="`/connexion?redirect=${redirection}`">Connecte-toi</RouterLink> pour contacter l'annonceur.
        </p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 40rem;
  margin: 0 auto;
  padding: var(--e4);
}
h1,
h2,
p {
  margin: 0;
}
h1 {
  font-size: var(--texte-xl);
  line-height: 1.15;
}
h2 {
  font-size: var(--texte-l);
}
.vide,
.secondaire {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.galerie {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
}
.principale {
  width: 100%;
  aspect-ratio: 4 / 3;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--terre-cuite);
  object-fit: cover;
}
.sans-photo {
  aspect-ratio: 16 / 7;
  border-radius: var(--rayon);
  background: var(--terre-cuite);
}
.vignettes {
  display: flex;
  gap: var(--e2);
  margin: 0;
  padding: 0;
  overflow-x: auto;
  list-style: none;
}
.vignettes button {
  display: block;
  width: 4.5rem;
  height: 3.5rem;
  padding: 0;
  overflow: hidden;
  border: 2px solid var(--bordure);
  border-radius: var(--rayon-s);
  background: var(--surface);
  cursor: pointer;
}
.vignettes button.active {
  border-color: var(--indigo);
}
.vignettes img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.titre {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  align-items: flex-start;
}
.lieu {
  color: var(--texte-secondaire);
}
.prix {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.part strong {
  color: var(--indigo);
  font-family: var(--police-titre);
  font-size: var(--texte-xl);
  font-weight: 800;
}
.bloc {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
}
.texte {
  white-space: pre-line;
}
.puces,
.liste {
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;
}
.puces {
  flex-wrap: wrap;
  gap: var(--e2);
}
.liste {
  flex-direction: column;
  gap: var(--e2);
}
.boutons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
}
</style>
