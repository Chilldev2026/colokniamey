<script setup lang="ts">
// File des annonces à valider (RG17, RGA11) : aperçu complet, photos, auteur, position sur la carte (zone publique),
// boutons Valider et Refuser (motif obligatoire). Le plus ancien d'abord.
import { onMounted, ref } from 'vue'
import type { Map as CarteLeaflet } from 'leaflet'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import CarteBase from '@/core/ui/CarteBase.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import ModaleMotif from '../components/ModaleMotif.vue'
import {
  listerAnnoncesEnAttente,
  lireAnnonceAModerer,
  refuserAnnonce,
  urlApercuPhoto,
  validerAnnonce,
  type AnnonceAModerer,
  type AnnonceEnAttente,
} from '../services/moderationService'

const LIBELLES_TYPE: Record<string, string> = { chambre: 'Chambre', studio: 'Studio', appartement: 'Appartement', place_colocation: 'Place en colocation' }
const { afficher } = useToasts()

const lignes = ref<AnnonceEnAttente[]>([])
const fiche = ref<AnnonceAModerer | null>(null)
const photos = ref<{ id: number; url: string; statut: string }[]>([])
const chargement = ref(true)
const chargementFiche = ref(false)
const occupe = ref(false)
const erreur = ref('')
const refusOuvert = ref(false)

async function charger() {
  erreur.value = ''
  fiche.value = null
  try {
    lignes.value = await listerAnnoncesEnAttente()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger la file.'
  } finally {
    chargement.value = false
  }
}
onMounted(charger)

async function ouvrir(id: number) {
  chargementFiche.value = true
  erreur.value = ''
  photos.value = []
  try {
    fiche.value = await lireAnnonceAModerer(id)
    const urls = await Promise.all(fiche.value.photos.map(async (p) => ({ id: p.id, statut: p.statut, url: await urlApercuPhoto(p.chemin, p.statut) })))
    photos.value = urls.flatMap((u) => (u.url ? [{ id: u.id, statut: u.statut, url: u.url }] : []))
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger cette annonce.'
  } finally {
    chargementFiche.value = false
  }
}

async function decider(travail: () => Promise<void>, message: string) {
  occupe.value = true
  erreur.value = ''
  try {
    await travail()
    afficher(message, 'succes')
    refusOuvert.value = false
    await charger()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'La décision n\'a pas été enregistrée.'
  } finally {
    occupe.value = false
  }
}

const valider = () => fiche.value && decider(() => validerAnnonce(fiche.value!.id), 'Annonce publiée.')
const refuser = (motif: string) => fiche.value && decider(() => refuserAnnonce(fiche.value!.id, motif), 'Annonce refusée. L\'auteur en est informé.')

function carteprete(carte: CarteLeaflet, L: typeof import('leaflet')) {
  const a = fiche.value
  if (!a || a.latitude === null || a.longitude === null) return
  carte.setView([a.latitude, a.longitude], 16)
  if (a.zoneRayonM > 0) L.circle([a.latitude, a.longitude], { radius: a.zoneRayonM, color: '#C4520F', weight: 2, fillOpacity: 0.15 }).addTo(carte)
  else L.circleMarker([a.latitude, a.longitude], { radius: 9, color: '#FFFFFF', weight: 3, fillColor: '#C4520F', fillOpacity: 1 }).addTo(carte)
}

function date(valeur: string): string {
  return new Date(valeur).toLocaleDateString('fr-FR')
}
</script>

<template>
  <section class="moderation">
    <h1>Annonces à valider</h1>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-if="chargement" :lignes="3" />
    <EtatVide v-else-if="lignes.length === 0" message="Aucune annonce à valider." />

    <div v-else class="deux">
      <ul class="liste">
        <li v-for="a in lignes" :key="a.id">
          <button type="button" class="ligne" :class="{ choisie: fiche?.id === a.id }" @click="ouvrir(a.id)">
            <span class="nom">{{ a.titre }}</span>
            <span class="meta">{{ LIBELLES_TYPE[a.type] ?? a.type }} · {{ a.prenom }} {{ a.initialeNom }}. · {{ date(a.depuis) }}</span>
            <PuceUi v-if="a.enRevue">Texte à vérifier</PuceUi>
          </button>
        </li>
      </ul>

      <article v-if="chargementFiche || fiche" class="fiche">
        <ChargementUi v-if="chargementFiche" :lignes="5" />
        <template v-else-if="fiche">
          <header>
            <h2>{{ fiche.titre }}</h2>
            <BoutonUi variante="secondaire" @click="fiche = null">Fermer</BoutonUi>
          </header>
          <p class="meta">
            {{ LIBELLES_TYPE[fiche.type] ?? fiche.type }} · {{ fiche.quartier }}<template v-if="fiche.universite"> · près de {{ fiche.universite }}</template>
          </p>
          <p>
            <strong>{{ fiche.partMensuelle.toLocaleString('fr-FR') }} FCFA</strong> par mois<template v-if="fiche.loyerTotal">
              (loyer total {{ fiche.loyerTotal.toLocaleString('fr-FR') }} FCFA, {{ fiche.nbPlaces }} places)</template>,
            charges {{ fiche.chargesIncluses ? 'comprises' : 'en plus' }}.
          </p>
          <p class="meta">
            Auteur : {{ fiche.auteur.prenom }} {{ fiche.auteur.nom }} ({{ fiche.auteur.role === 'etudiant' ? 'étudiant' : 'propriétaire' }}, compte {{ fiche.auteur.statut }})
          </p>
          <AlerteUi v-if="fiche.enRevue" type="info">
            Un texte de cette annonce est en revue : traite-le d'abord dans « Contenus à vérifier ». La validation est bloquée jusque-là.
          </AlerteUi>
          <p class="texte">{{ fiche.description }}</p>
          <p v-if="fiche.equipements.length > 0" class="meta">Équipements : {{ fiche.equipements.join(', ') }}</p>
          <div v-if="fiche.regles.length > 0">
            <h3>Règles</h3>
            <ul><li v-for="r in fiche.regles" :key="r">{{ r }}</li></ul>
          </div>
          <div v-if="fiche.taches.length > 0">
            <h3>Tâches partagées</h3>
            <ul><li v-for="t in fiche.taches" :key="t.libelle">{{ t.libelle }} ({{ t.frequence }}, {{ t.repartition }})</li></ul>
          </div>

          <div v-if="photos.length > 0" class="photos">
            <figure v-for="p in photos" :key="p.id">
              <img :src="p.url" alt="Photo de l'annonce" loading="lazy" />
              <figcaption>{{ p.statut === 'validee' ? 'Photo validée' : 'Photo en attente de validation' }}</figcaption>
            </figure>
          </div>
          <p v-else class="meta">Aucune photo.</p>

          <div v-if="fiche.latitude !== null && fiche.longitude !== null">
            <h3>Localisation montrée au public</h3>
            <p class="meta">{{ fiche.zoneRayonM > 0 ? 'Zone approximative de 150 m' : 'Position exacte' }}. Vérifie qu'elle est cohérente avec le quartier.</p>
            <CarteBase :key="fiche.id" :centre="[fiche.latitude, fiche.longitude]" :zoom="16" @pret="carteprete" />
          </div>

          <div class="decision">
            <BoutonUi variante="principal" :chargement="occupe" :desactive="fiche.enRevue" @click="valider">Valider</BoutonUi>
            <BoutonUi variante="danger" :desactive="occupe" @click="refusOuvert = true">Refuser</BoutonUi>
          </div>
        </template>
      </article>
    </div>

    <ModaleMotif
      v-model="refusOuvert"
      titre="Refuser l'annonce"
      explication="Le motif est obligatoire : l'auteur le recevra pour pouvoir corriger son annonce."
      libelle-action="Refuser"
      :chargement="occupe"
      @confirmer="refuser"
    />
  </section>
</template>

<style scoped>
.moderation {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
h1,
h2,
h3,
p {
  margin: 0;
}
h3 {
  font-size: var(--texte-m);
}
.deux {
  display: grid;
  gap: var(--e4);
  grid-template-columns: minmax(0, 1fr);
}
@media (min-width: 60rem) {
  .deux {
    grid-template-columns: minmax(0, 20rem) minmax(0, 1fr);
    align-items: start;
  }
}
.liste {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.ligne {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
  align-items: flex-start;
  width: 100%;
  min-height: var(--cible-min);
  padding: var(--e3);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ligne.choisie {
  border-color: var(--indigo);
}
.nom {
  font-weight: 700;
}
.meta {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.fiche {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.fiche header {
  display: flex;
  gap: var(--e3);
  align-items: center;
  justify-content: space-between;
}
.texte {
  white-space: pre-line;
}
.photos {
  display: grid;
  gap: var(--e3);
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
}
figure {
  margin: 0;
}
figure img {
  width: 100%;
  aspect-ratio: 4 / 3;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon-s);
  object-fit: cover;
}
figcaption {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.decision {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
}
</style>
