<script setup lang="ts">
// Filtres de la recherche (liste et carte partagent les mêmes). Les valeurs sont du texte tant qu'on saisit ;
// « Appliquer » les envoie à la page, qui les met dans l'URL.
import { computed } from 'vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import CaseACocher from '@/core/ui/CaseACocher.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import SelecteurUi from '@/core/ui/SelecteurUi.vue'
import { LIBELLES_TRI, filtresVides, type FiltresRecherche } from '../types'

export interface OptionUniversite {
  id: number
  nom: string
  avecPosition: boolean
}

const filtres = defineModel<FiltresRecherche>({ required: true })
const props = defineProps<{
  quartiers: { id: number; nom: string }[]
  universites: OptionUniversite[]
  equipements: { id: number; nom: string }[]
}>()
const emit = defineEmits<{ appliquer: []; reinitialiser: [] }>()

const optionsQuartiers = computed(() => [{ valeur: '', libelle: 'Tous les quartiers' }, ...props.quartiers.map((q) => ({ valeur: String(q.id), libelle: q.nom }))])
const optionsProches = computed(() => [{ valeur: '', libelle: 'Toutes les universités' }, ...props.universites.map((u) => ({ valeur: String(u.id), libelle: u.nom }))])
// RG25 bis : une université sans position ne peut pas servir de référence pour la distance (grisée, expliquée)
const optionsReference = computed(() => [
  { valeur: '', libelle: 'Aucune', desactive: false },
  ...props.universites.map((u) => ({
    valeur: String(u.id),
    libelle: u.avecPosition ? u.nom : `${u.nom} : position pas encore renseignée`,
    desactive: !u.avecPosition,
  })),
])
const optionsType = [
  { valeur: '', libelle: 'Tous les types' },
  { valeur: 'chambre', libelle: 'Chambre' },
  { valeur: 'studio', libelle: 'Studio' },
  { valeur: 'appartement', libelle: 'Appartement' },
  { valeur: 'place_colocation', libelle: 'Place en colocation' },
]
const optionsTri = Object.entries(LIBELLES_TRI).map(([valeur, libelle]) => ({ valeur, libelle }))

function majType(valeur: string) {
  filtres.value = { ...filtres.value, type: valeur as FiltresRecherche['type'] }
}
function majTri(valeur: string) {
  filtres.value = { ...filtres.value, tri: valeur as FiltresRecherche['tri'] }
}
function basculerEquipement(id: number) {
  const e = filtres.value.equipements
  filtres.value = { ...filtres.value, equipements: e.includes(id) ? e.filter((x) => x !== id) : [...e, id] }
}
function reinitialiser() {
  filtres.value = { ...filtresVides(), texte: filtres.value.texte }
  emit('reinitialiser')
}
</script>

<template>
  <form class="filtres" novalidate @submit.prevent="emit('appliquer')">
    <SelecteurUi v-model="filtres.quartierId" libelle="Quartier" :options="optionsQuartiers" />
    <SelecteurUi :model-value="filtres.type" libelle="Type de logement" :options="optionsType" @update:model-value="majType" />
    <div class="deux">
      <ChampUi v-model="filtres.loyerMin" libelle="Loyer minimum (FCFA)" inputmode="numeric" />
      <ChampUi v-model="filtres.loyerMax" libelle="Loyer maximum (FCFA)" inputmode="numeric" />
    </div>
    <SelecteurUi v-model="filtres.universiteId" libelle="Université proche" :options="optionsProches" />
    <div class="champ">
      <label for="universite-ref">Calculer la distance depuis</label>
      <select id="universite-ref" v-model="filtres.universiteRefId">
        <option v-for="o in optionsReference" :key="o.valeur" :value="o.valeur" :disabled="o.desactive">{{ o.libelle }}</option>
      </select>
    </div>
    <ChampUi v-model="filtres.disponibleAvant" libelle="Disponible avant le" type="date" />
    <ChampUi v-model="filtres.dureeMois" libelle="Durée de séjour souhaitée (mois)" inputmode="numeric" />
    <fieldset v-if="equipements.length > 0" class="equipements">
      <legend>Équipements</legend>
      <CaseACocher v-for="e in equipements" :key="e.id" :model-value="filtres.equipements.includes(e.id)" @update:model-value="basculerEquipement(e.id)">
        {{ e.nom }}
      </CaseACocher>
    </fieldset>
    <CaseACocher v-model="filtres.groupes">Seulement les colocations en formation (des étudiants cherchent déjà des colocataires)</CaseACocher>
    <CaseACocher v-model="filtres.compatible">Seulement les annonces compatibles avec mon profil</CaseACocher>
    <SelecteurUi :model-value="filtres.tri" libelle="Trier par" :options="optionsTri" @update:model-value="majTri" />
    <div class="boutons">
      <BoutonUi type="submit" variante="principal">Appliquer</BoutonUi>
      <BoutonUi variante="secondaire" @click="reinitialiser">Effacer les filtres</BoutonUi>
    </div>
  </form>
</template>

<style scoped>
.filtres {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.deux {
  display: grid;
  gap: var(--e3);
  grid-template-columns: 1fr 1fr;
}
.champ {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
}
.champ label {
  font-weight: 700;
}
select {
  min-height: var(--cible-min);
  padding: 0 var(--e3);
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon-s);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
}
.equipements {
  display: grid;
  gap: var(--e2);
  margin: 0;
  padding: 0;
  border: 0;
}
.equipements legend {
  margin-bottom: var(--e2);
  font-weight: 700;
}
.boutons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
}
</style>
