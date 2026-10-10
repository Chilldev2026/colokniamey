<script setup lang="ts">
// File des signalements (RGA12, RGA10, RGA11) : liste par statut et motif, fiche avec la cible en contexte et l'historique
// sur la même cible. Un seul admin prend un signalement en charge ; lui seul le clôt : rejeter, retirer l'annonce
// (motif notifié à l'auteur), suspendre l'auteur (règles de A2) ou marquer comme traité.
// L'admin ne lit jamais une conversation : il ne voit que le message joint au signalement.
import { computed, onMounted, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import SelecteurUi from '@/core/ui/SelecteurUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import {
  cloturer,
  lireSignalement,
  listerSignalements,
  prendreEnCharge,
  relacher,
  type Decision,
  type FicheSignalement,
  type LigneSignalement,
  type StatutFile,
} from '../services/signalementsAdminService'

const FILTRES: { id: StatutFile; libelle: string }[] = [
  { id: 'nouveau', libelle: 'Nouveaux' },
  { id: 'en_cours', libelle: 'En cours' },
  { id: 'traite', libelle: 'Traités' },
  { id: 'rejete', libelle: 'Rejetés' },
]
const MOTIFS: Record<string, string> = {
  arnaque: 'Arnaque', contenu_inapproprie: 'Contenu inapproprié', fausse_annonce: 'Fausse annonce', harcelement: 'Harcèlement', autre: 'Autre',
}
const CIBLES: Record<string, string> = { annonce: 'Annonce', profil: 'Profil', message: 'Message' }
const DECISIONS: Record<string, string> = {
  rejeter: 'Rejeté', retirer_annonce: 'Annonce retirée', suspendre_auteur: 'Auteur suspendu', traiter: 'Traité',
}

const { afficher } = useToasts()
const filtre = ref<StatutFile>('nouveau')
const motif = ref('')
const lignes = ref<LigneSignalement[]>([])
const fiche = ref<FicheSignalement | null>(null)
const commentaire = ref('')
const chargement = ref(true)
const occupe = ref(false)
const erreur = ref('')

const optionsMotif = [{ valeur: '', libelle: 'Tous les motifs' }, ...Object.entries(MOTIFS).map(([valeur, libelle]) => ({ valeur, libelle }))]
const ouvert = computed(() => fiche.value?.statut === 'nouveau' || fiche.value?.statut === 'en_cours')
const texteContexte = (cle: string): string => {
  const v = fiche.value?.contexte[cle]
  return typeof v === 'string' ? v : ''
}
const auteurContexte = computed(() => (fiche.value?.contexte.auteur ?? null) as Record<string, string> | null)

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    lignes.value = await listerSignalements(filtre.value, motif.value)
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger la file.'
  } finally {
    chargement.value = false
  }
}
onMounted(charger)

function changerFiltre(f: StatutFile) {
  filtre.value = f
  fiche.value = null
  void charger()
}

async function ouvrir(id: number) {
  erreur.value = ''
  commentaire.value = ''
  try {
    fiche.value = await lireSignalement(id)
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger ce signalement.'
  }
}

async function agir(travail: () => Promise<void>, message: string, rouvrir = true) {
  occupe.value = true
  erreur.value = ''
  try {
    await travail()
    afficher(message, 'succes')
    const id = fiche.value?.id
    await charger()
    if (rouvrir && id !== undefined) await ouvrir(id)
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Action impossible.'
  } finally {
    occupe.value = false
  }
}

const prendre = () => fiche.value && agir(() => prendreEnCharge(fiche.value!.id), 'Signalement pris en charge.')
const remettre = () => fiche.value && agir(() => relacher(fiche.value!.id), 'Signalement remis dans la file.')
const decider = (d: Decision) =>
  fiche.value &&
  agir(async () => {
    await cloturer(fiche.value!.id, d, commentaire.value)
    fiche.value = null
  }, 'Décision enregistrée.', false)

function date(valeur: string): string {
  return new Date(valeur).toLocaleDateString('fr-FR')
}
</script>

<template>
  <section class="signalements">
    <h1>Signalements</h1>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>

    <div class="filtres" role="group" aria-label="Filtrer par statut">
      <BoutonUi v-for="f in FILTRES" :key="f.id" :variante="filtre === f.id ? 'principal' : 'secondaire'" :aria-pressed="filtre === f.id" @click="changerFiltre(f.id)">
        {{ f.libelle }}
      </BoutonUi>
    </div>
    <SelecteurUi v-model="motif" libelle="Motif" :options="optionsMotif" @update:model-value="charger" />

    <ChargementUi v-if="chargement" :lignes="3" />
    <EtatVide v-else-if="lignes.length === 0" message="Aucun signalement dans cette liste." />

    <div v-else class="deux">
      <ul class="liste">
        <li v-for="l in lignes" :key="l.id">
          <button type="button" class="ligne" :class="{ choisie: fiche?.id === l.id }" @click="ouvrir(l.id)">
            <span class="nom">{{ CIBLES[l.cible] ?? l.cible }} · {{ MOTIFS[l.motif] ?? l.motif }}</span>
            <span class="meta">{{ date(l.creeLe) }}<template v-if="l.nbSurLaCible > 1"> · {{ l.nbSurLaCible }} signalements sur cette cible</template></span>
            <PuceUi v-if="l.prisParMoi" variante="info">Pris par moi</PuceUi>
            <PuceUi v-else-if="l.prisParUnAutre">Pris par un autre admin</PuceUi>
          </button>
        </li>
      </ul>

      <article v-if="fiche" class="fiche">
        <header>
          <h2>{{ CIBLES[fiche.cible] }} signalé</h2>
          <BoutonUi variante="secondaire" @click="fiche = null">Fermer</BoutonUi>
        </header>
        <p>
          <strong>Raison :</strong> {{ MOTIFS[fiche.motif] ?? fiche.motif }} · signalé par {{ fiche.signalePar }} le {{ date(fiche.creeLe) }}
        </p>
        <p v-if="fiche.commentaire" class="commentaire">« {{ fiche.commentaire }} »</p>

        <div class="cible">
          <h3>Contenu signalé</h3>
          <template v-if="fiche.cible === 'message'">
            <p class="message">{{ texteContexte('message') }}</p>
            <p class="meta">Seul ce message est joint au signalement : le reste de la conversation reste privé.</p>
          </template>
          <template v-else-if="fiche.cible === 'annonce'">
            <p><strong>{{ texteContexte('titre') }}</strong> (statut : {{ texteContexte('statut') }})</p>
            <p class="texte">{{ texteContexte('description') }}</p>
            <RouterLink :to="`/annonces/${fiche.contexte.annonce_id}`">Voir l'annonce</RouterLink>
          </template>
          <template v-else>
            <p>
              <strong>{{ texteContexte('prenom') }} {{ texteContexte('nom') }}</strong> ({{ texteContexte('role') }}, compte {{ texteContexte('statut') }})
            </p>
          </template>
          <p v-if="auteurContexte && fiche.cible !== 'profil'" class="meta">
            Auteur : {{ auteurContexte.prenom }} {{ auteurContexte.nom }} (compte {{ auteurContexte.statut }})
          </p>
          <RouterLink v-if="fiche.cibleAuteurId" :to="`/admin/utilisateurs/${fiche.cibleAuteurId}`">Voir la fiche de cette personne</RouterLink>
          <p v-if="fiche.autresSurLaPersonne > 0" class="meta">{{ fiche.autresSurLaPersonne }} autre(s) signalement(s) visent cette personne.</p>
        </div>

        <div v-if="fiche.historique.length > 0">
          <h3>Autres signalements sur la même cible</h3>
          <ul class="historique">
            <li v-for="h in fiche.historique" :key="h.id">
              {{ date(h.creeLe) }} : {{ MOTIFS[h.motif] ?? h.motif }} ({{ h.statut }}<template v-if="h.decision">, {{ DECISIONS[h.decision] ?? h.decision }}</template>)
            </li>
          </ul>
        </div>

        <p v-if="fiche.decision" class="meta">Décision : {{ DECISIONS[fiche.decision] ?? fiche.decision }}<template v-if="fiche.decisionCommentaire"> : {{ fiche.decisionCommentaire }}</template></p>

        <div v-if="ouvert" class="actions">
          <template v-if="fiche.statut === 'nouveau'">
            <BoutonUi variante="principal" :chargement="occupe" @click="prendre">Prendre en charge</BoutonUi>
          </template>
          <template v-else-if="fiche.prisParMoi">
            <div class="champ">
              <label for="commentaire-decision">Motif ou commentaire (obligatoire pour retirer ou suspendre)</label>
              <textarea id="commentaire-decision" v-model="commentaire" rows="2" maxlength="300" />
            </div>
            <div class="boutons">
              <BoutonUi variante="secondaire" :desactive="occupe" @click="decider('rejeter')">Rejeter</BoutonUi>
              <BoutonUi variante="secondaire" :desactive="occupe" @click="decider('traiter')">Marquer comme traité</BoutonUi>
              <BoutonUi v-if="fiche.cible === 'annonce'" variante="danger" :desactive="occupe || commentaire.trim().length < 3" @click="decider('retirer_annonce')">
                Retirer l'annonce
              </BoutonUi>
              <BoutonUi variante="danger" :desactive="occupe || commentaire.trim().length < 3" @click="decider('suspendre_auteur')">Suspendre l'auteur</BoutonUi>
              <BoutonUi variante="secondaire" :desactive="occupe" @click="remettre">Remettre dans la file</BoutonUi>
            </div>
          </template>
          <p v-else class="meta">Un autre administrateur a pris ce signalement en charge.</p>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.signalements {
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
.filtres {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
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
.liste,
.historique {
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
.cible {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  padding: var(--e3);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon-s);
  background: var(--fond);
}
.message,
.texte {
  white-space: pre-line;
}
.actions,
.champ {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
}
.champ label {
  font-weight: 700;
}
textarea {
  padding: var(--e3);
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon-s);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
}
.boutons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
}
</style>
