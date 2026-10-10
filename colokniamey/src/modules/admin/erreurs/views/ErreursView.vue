<script setup lang="ts">
// Erreurs de l'application (RGA19, RGA20) : regroupées par empreinte (message et module), avec le nombre d'occurrences,
// la première et la dernière apparition, la page, le navigateur et la version. Détail avec la pile, changement de statut.
// Une erreur résolue qui réapparaît repasse à « nouveau » (fait par la base). Super-admin seulement.
import { onMounted, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import SelecteurUi from '@/core/ui/SelecteurUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import { changerStatutErreur, listerErreurs, type ErreurApp, type StatutErreur } from '../../audit/services/auditService'

const STATUTS: Record<StatutErreur, string> = { nouveau: 'Nouvelle', en_cours: 'En cours', resolu: 'Résolue', ignore: 'Ignorée' }
const { afficher } = useToasts()

const statut = ref('')
const jours = ref('30')
const erreurs = ref<ErreurApp[]>([])
const choisie = ref<ErreurApp | null>(null)
const chargement = ref(true)
const erreur = ref('')

const optionsStatut = [{ valeur: '', libelle: 'Tous les statuts' }, ...Object.entries(STATUTS).map(([valeur, libelle]) => ({ valeur, libelle }))]
const optionsPeriode = [{ valeur: '7', libelle: '7 jours' }, { valeur: '30', libelle: '30 jours' }, { valeur: '90', libelle: '90 jours' }]
const optionsChangement = Object.entries(STATUTS).map(([valeur, libelle]) => ({ valeur, libelle }))

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    erreurs.value = await listerErreurs(statut.value, Number(jours.value))
    if (choisie.value) choisie.value = erreurs.value.find((e) => e.id === choisie.value?.id) ?? null
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger les erreurs.'
  } finally {
    chargement.value = false
  }
}
onMounted(charger)

async function changer(e: ErreurApp, valeur: string) {
  erreur.value = ''
  try {
    await changerStatutErreur(e.id, valeur as StatutErreur)
    afficher('Statut mis à jour.', 'succes')
    await charger()
  } catch (err) {
    erreur.value = err instanceof Error ? err.message : 'Action impossible.'
  }
}

function date(valeur: string): string {
  return new Date(valeur).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <section class="erreurs">
    <h1>Erreurs</h1>
    <div class="filtres">
      <SelecteurUi v-model="statut" libelle="Statut" :options="optionsStatut" @update:model-value="charger" />
      <SelecteurUi v-model="jours" libelle="Période" :options="optionsPeriode" @update:model-value="charger" />
    </div>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-if="chargement" :lignes="4" />
    <EtatVide v-else-if="erreurs.length === 0" message="Aucune erreur pour ces filtres." />

    <div v-else class="deux">
      <ul class="liste">
        <li v-for="e in erreurs" :key="e.id">
          <button type="button" class="ligne" :class="{ choisie: choisie?.id === e.id }" @click="choisie = e">
            <span class="message">{{ e.message }}</span>
            <span class="meta">{{ e.module ?? 'module inconnu' }} · {{ e.occurrences }} fois · dernière : {{ date(e.derniereVue) }}</span>
            <PuceUi :variante="e.statut === 'resolu' ? 'validee' : e.statut === 'nouveau' ? 'info' : 'neutre'">{{ STATUTS[e.statut] }}</PuceUi>
          </button>
        </li>
      </ul>

      <article v-if="choisie" class="detail">
        <h2>{{ choisie.message }}</h2>
        <dl>
          <dt>Occurrences</dt><dd>{{ choisie.occurrences }}</dd>
          <dt>Première fois</dt><dd>{{ date(choisie.premiereVue) }}</dd>
          <dt>Dernière fois</dt><dd>{{ date(choisie.derniereVue) }}</dd>
          <dt>Module</dt><dd>{{ choisie.module ?? '-' }}</dd>
          <dt>Page</dt><dd>{{ choisie.page ?? '-' }}</dd>
          <dt>Navigateur</dt><dd>{{ choisie.navigateur ?? '-' }}</dd>
          <dt>Version</dt><dd>{{ choisie.version ?? '-' }}</dd>
        </dl>
        <SelecteurUi :model-value="choisie.statut" libelle="Statut" :options="optionsChangement" @update:model-value="(v) => changer(choisie!, v)" />
        <div v-if="choisie.pile">
          <h3>Pile</h3>
          <pre>{{ choisie.pile }}</pre>
        </div>
        <p v-else class="aide">Aucune pile enregistrée pour cette erreur.</p>
        <p class="aide">Les erreurs sont enregistrées sans donnée personnelle et supprimées après 90 jours.</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.erreurs {
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
.aide,
.meta {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.filtres {
  display: grid;
  gap: var(--e3);
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
}
.deux {
  display: grid;
  gap: var(--e4);
  grid-template-columns: minmax(0, 1fr);
}
@media (min-width: 60rem) {
  .deux {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
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
.message {
  font-weight: 700;
  overflow-wrap: anywhere;
}
.detail {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
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
pre {
  max-height: 14rem;
  margin: 0;
  padding: var(--e3);
  overflow: auto;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon-s);
  background: var(--fond);
  font-size: var(--texte-s);
  white-space: pre-wrap;
}
</style>
