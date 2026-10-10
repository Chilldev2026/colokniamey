<script setup lang="ts">
// Résultats de recherche (RG24) : liste et carte avec les mêmes filtres, synchronisés dans l'URL (un lien partagé rouvre
// la même recherche). Pagination par curseur. États vides utiles.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import { listerEquipements } from '@/modules/annonces'
import { aUnePosition, listerQuartiers, listerUniversites, listerVilles, type Universite, type Ville } from '@/modules/referentiel'
import ApercuCarte from '../components/ApercuCarte.vue'
import CarteResultat from '../components/CarteResultat.vue'
import CarteResultats from '../components/CarteResultats.vue'
import FiltresPanneau from '../components/FiltresPanneau.vue'
import { rechercherAnnonces, TAILLE_PAGE, type MarqueurCarte, type ResultatAnnonce } from '../services/rechercheService'
import { compterFiltres, depuisRequeteUrl, filtresVides, versRequeteUrl, type FiltresRecherche } from '../types'

const route = useRoute()
const router = useRouter()

const initial = depuisRequeteUrl(route.query)
const filtres = ref<FiltresRecherche>(initial.filtres)
const filtresAppliques = ref<FiltresRecherche>({ ...initial.filtres })
const vue = ref<'liste' | 'carte'>(initial.vue)
const filtresOuverts = ref(false)

const ville = ref<Ville | null>(null)
const quartiers = ref<{ id: number; nom: string }[]>([])
const universites = ref<Universite[]>([])
const equipements = ref<{ id: number; nom: string }[]>([])
const resultats = ref<ResultatAnnonce[]>([])
const chargement = ref(true)
const chargementSuite = ref(false)
const peutContinuer = ref(false)
const erreur = ref('')
const choisi = ref<MarqueurCarte | null>(null)
const apercuOuvert = ref(false)
const nbCarte = ref<number | null>(null)

const nomsQuartiers = computed(() => new Map(quartiers.value.map((q) => [q.id, q.nom])))
const nbFiltres = computed(() => compterFiltres(filtresAppliques.value))
const optionsUniversites = computed(() =>
  universites.value.map((u) => ({ id: u.id, nom: u.sigle ? `${u.nom} (${u.sigle})` : u.nom, avecPosition: aUnePosition(u) })),
)
// RG25 bis : seules les universités qui ont une position ont un marqueur
const universitesCarte = computed(() =>
  universites.value.flatMap((u) => (aUnePosition(u) ? [{ id: u.id, nom: u.nom, latitude: u.latitude, longitude: u.longitude }] : [])),
)
const centre = computed<[number, number]>(() => (ville.value ? [ville.value.latitude, ville.value.longitude] : [13.5116, 2.1254]))

async function lancer() {
  chargement.value = true
  erreur.value = ''
  resultats.value = []
  try {
    const page = await rechercherAnnonces(filtresAppliques.value, ville.value?.id, null)
    resultats.value = page
    peutContinuer.value = page.length === TAILLE_PAGE
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'La recherche a échoué.'
  } finally {
    chargement.value = false
  }
}

async function suite() {
  const derniere = resultats.value[resultats.value.length - 1]
  if (!derniere) return
  chargementSuite.value = true
  try {
    const page = await rechercherAnnonces(filtresAppliques.value, ville.value?.id, { v: derniere.curseurValeur, id: derniere.id })
    resultats.value = [...resultats.value, ...page]
    peutContinuer.value = page.length === TAILLE_PAGE
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'La recherche a échoué.'
  } finally {
    chargementSuite.value = false
  }
}

function appliquer() {
  filtresAppliques.value = { ...filtres.value, equipements: [...filtres.value.equipements] }
  filtresOuverts.value = false
  void router.replace({ query: versRequeteUrl(filtresAppliques.value, vue.value) })
}

function effacer() {
  filtres.value = { ...filtresVides(), texte: filtres.value.texte }
  appliquer()
}

function changerVue(v: 'liste' | 'carte') {
  vue.value = v
  void router.replace({ query: versRequeteUrl(filtresAppliques.value, v) })
}

function choisir(m: MarqueurCarte) {
  choisi.value = m
  apercuOuvert.value = true
}

// Un lien ouvert ou un retour arrière change l'URL : la page suit
watch(
  () => route.query,
  (q) => {
    const lu = depuisRequeteUrl(q)
    filtres.value = lu.filtres
    filtresAppliques.value = { ...lu.filtres }
    vue.value = lu.vue
    void lancer()
  },
)

onMounted(async () => {
  try {
    const villes = await listerVilles()
    ville.value = villes[0] ?? null
    if (ville.value) {
      const [q, u] = await Promise.all([listerQuartiers(ville.value.id), listerUniversites(ville.value.id)])
      quartiers.value = q.map((x) => ({ id: x.id, nom: x.nom }))
      universites.value = u
    }
    equipements.value = await listerEquipements()
  } catch {
    // les filtres restent utilisables sans ces listes
  }
  await lancer()
})
</script>

<template>
  <section class="resultats">
    <h1>Trouver un logement</h1>

    <form class="barre" role="search" @submit.prevent="appliquer">
      <input v-model="filtres.texte" type="search" aria-label="Rechercher une annonce" placeholder="Quartier, mot-clé, université…" maxlength="200" />
      <BoutonUi type="submit" variante="principal">Rechercher</BoutonUi>
    </form>

    <div class="outils">
      <div class="bascule" role="group" aria-label="Affichage">
        <BoutonUi :variante="vue === 'liste' ? 'principal' : 'secondaire'" :aria-pressed="vue === 'liste'" @click="changerVue('liste')">Liste</BoutonUi>
        <BoutonUi :variante="vue === 'carte' ? 'principal' : 'secondaire'" :aria-pressed="vue === 'carte'" @click="changerVue('carte')">Carte</BoutonUi>
      </div>
      <BoutonUi variante="secondaire" :aria-expanded="filtresOuverts" @click="filtresOuverts = !filtresOuverts">
        Filtres<template v-if="nbFiltres > 0"> ({{ nbFiltres }})</template>
      </BoutonUi>
    </div>

    <FiltresPanneau
      v-if="filtresOuverts"
      v-model="filtres"
      :quartiers="quartiers"
      :universites="optionsUniversites"
      :equipements="equipements"
      @appliquer="appliquer"
      @reinitialiser="effacer"
    />

    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>

    <!-- Carte : mêmes filtres, rechargée selon la zone visible -->
    <template v-if="vue === 'carte'">
      <CarteResultats :filtres="filtresAppliques" :ville-id="ville?.id" :centre="centre" :universites="universitesCarte" @choisir="choisir" @compte="(n) => (nbCarte = n)" />
      <p v-if="nbCarte === 0" class="vide-carte">Aucune annonce dans cette zone. Déplace la carte ou élargis tes filtres.</p>
      <ApercuCarte v-model="apercuOuvert" :marqueur="choisi" :quartier="choisi ? (nomsQuartiers.get(choisi.quartierId) ?? '') : ''" />
    </template>

    <!-- Liste -->
    <template v-else>
      <ChargementUi v-if="chargement" :lignes="4" />
      <EtatVide v-else-if="resultats.length === 0 && !erreur" message="Aucune annonce ne correspond à ta recherche.">
        <p class="aide">Essaie d'enlever un filtre, d'élargir le loyer ou de choisir un autre quartier.</p>
        <BoutonUi v-if="nbFiltres > 0 || filtresAppliques.texte" variante="secondaire" @click="effacer">Effacer les filtres</BoutonUi>
      </EtatVide>
      <TransitionGroup v-else name="cascade" tag="ul" class="liste">
        <li v-for="a in resultats" :key="a.id">
          <CarteResultat :annonce="a" :quartier="nomsQuartiers.get(a.quartierId) ?? ''" />
        </li>
      </TransitionGroup>
      <BoutonUi v-if="peutContinuer && !chargement" variante="secondaire" :chargement="chargementSuite" @click="suite">Voir plus d'annonces</BoutonUi>
    </template>
  </section>
</template>

<style scoped>
.resultats {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 48rem;
  margin: 0 auto;
  padding: var(--e4);
}
h1,
p {
  margin: 0;
}
.barre {
  display: flex;
  gap: var(--e2);
}
.barre input {
  flex: 1;
  min-width: 0;
  min-height: var(--cible-min);
  padding: 0 var(--e3);
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon-s);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
}
.outils {
  display: flex;
  gap: var(--e3);
  align-items: center;
  justify-content: space-between;
}
.bascule {
  display: flex;
  gap: var(--e2);
}
.liste {
  display: grid;
  gap: var(--e3);
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}
.aide,
.vide-carte {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
/* Apparition en cascade (transform et opacity seulement) */
.cascade-enter-active {
  transition: transform 250ms cubic-bezier(0, 0, 0.2, 1), opacity 250ms cubic-bezier(0, 0, 0.2, 1);
}
.cascade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
@media (prefers-reduced-motion: reduce) {
  .cascade-enter-active {
    transition: none;
  }
}
</style>
