<script setup lang="ts">
// Journal d'audit (RGA06, RGA07, RGA26) : filtres par admin, action, type de cible et période ; détail avec comparaison
// avant / après ; export CSV (super-admin). Aucune action de modification : le journal est en ajout seul.
// « Mon historique » (admin) réutilise cet écran sans filtre d'acteur, sans export : la base ne lui renvoie de toute façon
// que ses propres lignes.
import { computed, onMounted, reactive, ref } from 'vue'
import { roleCourant } from '@/core/acces'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import SelecteurUi from '@/core/ui/SelecteurUi.vue'
import { telechargerCsv } from '@/core/ui/graphiques/csv'
import { comparerDetails, lireFiltresJournal, listerJournal, TAILLE_PAGE_JOURNAL, type FiltresJournal, type LigneJournal } from '../services/auditService'

const estSuper = computed(() => roleCourant.value === 'super_admin')
const filtres = reactive<FiltresJournal>({ acteur: '', action: '', cible: '', depuis: '', jusqua: '' })
const lignes = ref<LigneJournal[]>([])
const choisie = ref<LigneJournal | null>(null)
const options = ref<{ actions: string[]; cibles: string[]; acteurs: { id: string; prenom: string }[] }>({ actions: [], cibles: [], acteurs: [] })
const page = ref(1)
const chargement = ref(true)
const erreur = ref('')

const optionsActeur = computed(() => [{ valeur: '', libelle: 'Tous' }, ...options.value.acteurs.map((a) => ({ valeur: a.id, libelle: a.prenom }))])
const optionsAction = computed(() => [{ valeur: '', libelle: 'Toutes' }, ...options.value.actions.map((a) => ({ valeur: a, libelle: a }))])
const optionsCible = computed(() => [{ valeur: '', libelle: 'Toutes' }, ...options.value.cibles.map((c) => ({ valeur: c, libelle: c }))])
const comparaison = computed(() => (choisie.value ? comparerDetails(choisie.value.details) : null))

async function charger() {
  chargement.value = true
  erreur.value = ''
  choisie.value = null
  try {
    lignes.value = await listerJournal(filtres, page.value)
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger le journal.'
  } finally {
    chargement.value = false
  }
}

onMounted(async () => {
  if (estSuper.value) {
    try {
      options.value = await lireFiltresJournal()
    } catch {
      // les filtres restent utilisables sans listes
    }
  }
  await charger()
})

function appliquer() {
  page.value = 1
  void charger()
}
function aller(delta: number) {
  page.value = Math.max(1, page.value + delta)
  void charger()
}

function valeur(v: unknown): string {
  return typeof v === 'string' ? v : JSON.stringify(v)
}
function date(valeur: string): string {
  return new Date(valeur).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function exporter() {
  const toutes = await listerJournal(filtres, 1, 500)
  telechargerCsv('colokniamey-journal-audit.csv', [
    ['Date', 'Acteur', 'Action', 'Type de cible', 'Cible', 'Détails'],
    ...toutes.map((l) => [l.creeLe, l.acteurPrenom, l.action, l.cibleType, l.cibleId, JSON.stringify(l.details)]),
  ])
}
</script>

<template>
  <section class="journal">
    <h1>{{ estSuper ? 'Journal d\'audit' : 'Mon historique' }}</h1>
    <p v-if="!estSuper" class="aide">Ici, seulement tes propres actions d'administration.</p>

    <form class="filtres" novalidate @submit.prevent="appliquer">
      <template v-if="estSuper">
        <SelecteurUi v-model="filtres.acteur" libelle="Admin" :options="optionsActeur" />
        <SelecteurUi v-model="filtres.action" libelle="Action" :options="optionsAction" />
        <SelecteurUi v-model="filtres.cible" libelle="Type de cible" :options="optionsCible" />
      </template>
      <ChampUi v-model="filtres.depuis" libelle="Du" type="date" />
      <ChampUi v-model="filtres.jusqua" libelle="Au" type="date" />
      <div class="boutons">
        <BoutonUi type="submit" variante="principal">Filtrer</BoutonUi>
        <BoutonUi v-if="estSuper" variante="secondaire" :desactive="lignes.length === 0" @click="exporter">Exporter en CSV</BoutonUi>
      </div>
    </form>

    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-if="chargement" :lignes="4" />
    <EtatVide v-else-if="lignes.length === 0" message="Aucune ligne pour ces filtres." />

    <div v-else class="deux">
      <table class="table">
        <thead>
          <tr><th scope="col">Date</th><th v-if="estSuper" scope="col">Admin</th><th scope="col">Action</th><th scope="col">Cible</th></tr>
        </thead>
        <tbody>
          <tr v-for="l in lignes" :key="l.id" :class="{ choisie: choisie?.id === l.id }">
            <td>{{ date(l.creeLe) }}</td>
            <td v-if="estSuper">{{ l.acteurPrenom ?? 'Système' }}</td>
            <th scope="row"><button type="button" class="action" @click="choisie = l">{{ l.action }}</button></th>
            <td>{{ l.cibleType ?? '' }} {{ l.cibleId ?? '' }}</td>
          </tr>
        </tbody>
      </table>

      <article v-if="choisie" class="detail">
        <h2>{{ choisie.action }}</h2>
        <p class="aide">{{ date(choisie.creeLe) }} · {{ choisie.acteurPrenom ?? 'Système' }}</p>
        <table v-if="comparaison" class="comparaison">
          <caption class="cache">Comparaison avant et après</caption>
          <thead><tr><th scope="col">Avant</th><th scope="col">Après</th></tr></thead>
          <tbody><tr><td>{{ valeur(comparaison.avant) }}</td><td>{{ valeur(comparaison.apres) }}</td></tr></tbody>
        </table>
        <dl v-if="Object.keys(choisie.details).length > 0">
          <template v-for="(v, k) in choisie.details" :key="k"><dt>{{ k }}</dt><dd>{{ valeur(v) }}</dd></template>
        </dl>
        <p v-else class="aide">Aucun détail enregistré.</p>
        <p class="aide">Le journal est en ajout seul : cette ligne ne peut être ni modifiée ni supprimée.</p>
      </article>
    </div>

    <div class="pagination">
      <BoutonUi variante="secondaire" :desactive="page === 1 || chargement" @click="aller(-1)">Précédent</BoutonUi>
      <span>Page {{ page }}</span>
      <BoutonUi variante="secondaire" :desactive="lignes.length < TAILLE_PAGE_JOURNAL || chargement" @click="aller(1)">Suivant</BoutonUi>
    </div>
  </section>
</template>

<style scoped>
.journal {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
h1,
h2,
p {
  margin: 0;
}
.aide {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.filtres {
  display: grid;
  gap: var(--e3);
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  align-items: end;
}
.boutons,
.pagination {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
  align-items: center;
}
.deux {
  display: grid;
  gap: var(--e4);
  grid-template-columns: minmax(0, 1fr);
}
@media (min-width: 60rem) {
  .deux {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    align-items: start;
  }
}
.table,
.comparaison {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--texte-s);
}
th,
td {
  padding: var(--e2);
  border-bottom: 1px solid var(--bordure);
  text-align: left;
  vertical-align: top;
}
.choisie {
  background: var(--indigo-pale);
}
.action {
  min-height: var(--cible-min);
  padding: 0;
  border: 0;
  background: none;
  color: var(--indigo);
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.detail {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
dl {
  display: grid;
  gap: var(--e1) var(--e3);
  grid-template-columns: auto 1fr;
  margin: 0;
}
dt {
  color: var(--texte-secondaire);
}
dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.cache {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
