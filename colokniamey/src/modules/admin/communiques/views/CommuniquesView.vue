<script setup lang="ts">
// Communiqués (A4, RGA13, RGA14, RGA28) : liste en trois onglets (programmés, en cours, terminés), formulaire avec aperçu
// en direct, duplication, fin anticipée. Le niveau « critique » n'est proposé qu'au super-admin ; la base le refuse de toute
// façon aux autres (masquer une option n'est jamais la seule protection, RGA27).
import { computed, onMounted, ref } from 'vue'
import { roleCourant } from '@/core/acces'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import SelecteurUi from '@/core/ui/SelecteurUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import {
  creerCommunique,
  etatCommunique,
  listerCommuniques,
  modifierCommunique,
  supprimerCommunique,
  terminerCommunique,
  validerCommunique,
  versChampLocal,
  type CommuniqueAdmin,
  type EtatCommunique,
  type FormulaireCommunique,
} from '../services/communiquesAdminService'

const { afficher } = useToasts()
const NIVEAUX = { information: 'Information', avertissement: 'Avertissement', critique: 'Critique' }
const CIBLES = { tous: 'Tout le monde', etudiants: 'Les étudiants', proprietaires: 'Les propriétaires' }
const ONGLETS: { valeur: EtatCommunique; libelle: string }[] = [
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'programme', libelle: 'Programmés' },
  { valeur: 'termine', libelle: 'Terminés' },
]

const liste = ref<CommuniqueAdmin[]>([])
const onglet = ref<EtatCommunique>('en_cours')
const chargement = ref(true)
const erreur = ref('')
const enregistrement = ref(false)
const edition = ref<number | null>(null)
const formulaireOuvert = ref(false)
const erreurs = ref<Record<string, string>>({})

function formulaireVide(): FormulaireCommunique {
  const maintenant = new Date()
  const fin = new Date(maintenant.getTime() + 24 * 3600 * 1000)
  return { titre: '', message: '', niveau: 'information', cible: 'tous', debut: versChampLocal(maintenant.toISOString()), fin: versChampLocal(fin.toISOString()) }
}
const formulaire = ref<FormulaireCommunique>(formulaireVide())

const estSuperAdmin = computed(() => roleCourant.value === 'super_admin')
const optionsNiveau = computed(() =>
  Object.entries(NIVEAUX)
    .filter(([valeur]) => valeur !== 'critique' || estSuperAdmin.value)
    .map(([valeur, libelle]) => ({ valeur, libelle })),
)
const optionsCible = Object.entries(CIBLES).map(([valeur, libelle]) => ({ valeur, libelle }))
const affiches = computed(() => liste.value.filter((c) => etatCommunique(c) === onglet.value))

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    liste.value = await listerCommuniques()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger les communiqués.'
  } finally {
    chargement.value = false
  }
}
onMounted(charger)

function nouveau() {
  edition.value = null
  formulaire.value = formulaireVide()
  erreurs.value = {}
  formulaireOuvert.value = true
}
function modifier(c: CommuniqueAdmin) {
  edition.value = c.id
  formulaire.value = { titre: c.titre, message: c.message, niveau: c.niveau, cible: c.cible, debut: versChampLocal(c.debut), fin: versChampLocal(c.fin) }
  erreurs.value = {}
  formulaireOuvert.value = true
}
/** Duplication : même contenu, nouvelle période qui commence maintenant. */
function dupliquer(c: CommuniqueAdmin) {
  nouveau()
  formulaire.value = { ...formulaire.value, titre: c.titre, message: c.message, niveau: c.niveau === 'critique' && !estSuperAdmin.value ? 'avertissement' : c.niveau, cible: c.cible }
}

async function enregistrer() {
  erreurs.value = validerCommunique(formulaire.value)
  if (Object.keys(erreurs.value).length > 0) return
  enregistrement.value = true
  erreur.value = ''
  try {
    if (edition.value === null) await creerCommunique(formulaire.value)
    else await modifierCommunique(edition.value, formulaire.value)
    afficher('Communiqué enregistré.', 'succes')
    formulaireOuvert.value = false
    await charger()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Enregistrement impossible.'
  } finally {
    enregistrement.value = false
  }
}

async function terminer(c: CommuniqueAdmin) {
  erreur.value = ''
  try {
    // Pas encore commencé : on le supprime (une fin avant le début est refusée par la base)
    if (etatCommunique(c) === 'programme') await supprimerCommunique(c.id)
    else await terminerCommunique(c.id)
    afficher(etatCommunique(c) === 'programme' ? 'Communiqué supprimé.' : 'Communiqué terminé.', 'succes')
    await charger()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Action impossible.'
  }
}

function date(valeur: string): string {
  return new Date(valeur).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <section class="communiques">
    <header class="entete">
      <h1>Communiqués</h1>
      <BoutonUi variante="principal" @click="nouveau">Nouveau communiqué</BoutonUi>
    </header>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>

    <form v-if="formulaireOuvert" class="formulaire" novalidate @submit.prevent="enregistrer">
      <h2>{{ edition === null ? 'Nouveau communiqué' : 'Modifier le communiqué' }}</h2>
      <ChampUi v-model="formulaire.titre" libelle="Titre" :erreur="erreurs.titre" aide="3 à 100 caractères." />
      <div class="champ">
        <label for="message-communique">Message</label>
        <textarea id="message-communique" v-model="formulaire.message" rows="3" maxlength="500" :aria-invalid="erreurs.message ? true : undefined" />
        <p v-if="erreurs.message" class="erreur" role="alert">{{ erreurs.message }}</p>
        <p v-else class="aide">{{ formulaire.message.length }} / 500 caractères. N'écris aucune donnée personnelle.</p>
      </div>
      <div class="grille">
        <SelecteurUi v-model="formulaire.niveau" libelle="Niveau" :options="optionsNiveau" />
        <SelecteurUi v-model="formulaire.cible" libelle="Pour qui ?" :options="optionsCible" />
        <ChampUi v-model="formulaire.debut" type="datetime-local" libelle="Début" :erreur="erreurs.debut" />
        <ChampUi v-model="formulaire.fin" type="datetime-local" libelle="Fin" :erreur="erreurs.fin" />
      </div>
      <p v-if="!estSuperAdmin" class="aide">Seul le super-admin peut publier un communiqué critique.</p>

      <div class="apercu">
        <h3>Aperçu</h3>
        <article class="exemple" :class="formulaire.niveau">
          <strong>{{ formulaire.titre || 'Titre du communiqué' }}</strong>
          <span>{{ formulaire.message || 'Le message apparaîtra ici.' }}</span>
          <small v-if="formulaire.niveau === 'critique'">Ce communiqué ne pourra pas être masqué.</small>
        </article>
      </div>

      <div class="actions">
        <BoutonUi variante="principal" type="submit" :chargement="enregistrement">Enregistrer</BoutonUi>
        <BoutonUi @click="formulaireOuvert = false">Annuler</BoutonUi>
      </div>
    </form>

    <div class="onglets" role="tablist">
      <button v-for="o in ONGLETS" :key="o.valeur" type="button" role="tab" :aria-selected="onglet === o.valeur" class="onglet" :class="{ actif: onglet === o.valeur }" @click="onglet = o.valeur">
        {{ o.libelle }}
      </button>
    </div>

    <ChargementUi v-if="chargement" :lignes="3" />
    <EtatVide v-else-if="affiches.length === 0" message="Aucun communiqué dans cet onglet." />
    <ul v-else class="liste">
      <li v-for="c in affiches" :key="c.id" class="carte">
        <div class="haut">
          <strong>{{ c.titre }}</strong>
          <PuceUi :variante="c.niveau === 'information' ? 'info' : c.niveau === 'critique' ? 'validee' : 'neutre'">{{ NIVEAUX[c.niveau] }}</PuceUi>
        </div>
        <p>{{ c.message }}</p>
        <p class="meta">{{ CIBLES[c.cible] }} · du {{ date(c.debut) }} au {{ date(c.fin) }}</p>
        <div class="actions">
          <BoutonUi v-if="etatCommunique(c) !== 'termine'" @click="modifier(c)">Modifier</BoutonUi>
          <BoutonUi @click="dupliquer(c)">Dupliquer</BoutonUi>
          <BoutonUi v-if="etatCommunique(c) !== 'termine'" variante="danger" @click="terminer(c)">
            {{ etatCommunique(c) === 'programme' ? 'Supprimer' : 'Terminer maintenant' }}
          </BoutonUi>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.communiques {
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
.entete,
.haut {
  display: flex;
  gap: var(--e3);
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}
.formulaire,
.carte {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.grille {
  display: grid;
  gap: var(--e3);
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}
.champ {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
}
label {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
  font-weight: 700;
}
textarea {
  padding: var(--e3);
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon-s);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
  resize: vertical;
}
.aide,
.meta {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.erreur {
  color: var(--erreur);
  font-size: var(--texte-s);
}
.exemple {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--e3);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
}
.exemple.avertissement {
  border-color: var(--orange);
}
.exemple.critique {
  border-color: var(--erreur);
}
.actions {
  display: flex;
  gap: var(--e2);
  flex-wrap: wrap;
}
.onglets {
  display: flex;
  gap: var(--e2);
  border-bottom: 1px solid var(--bordure);
}
.onglet {
  min-height: var(--cible-min);
  padding: 0 var(--e3);
  border: 0;
  border-bottom: 3px solid transparent;
  background: none;
  color: var(--texte-secondaire);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.onglet.actif {
  border-bottom-color: var(--indigo);
  color: var(--indigo);
}
.liste {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
