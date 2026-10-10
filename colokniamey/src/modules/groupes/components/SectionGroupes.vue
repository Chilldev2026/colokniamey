<script setup lang="ts">
// Section « groupes » du détail d'un logement (RG34 à RG38), branchée par le point d'extension « annonce-detail ».
// - Étudiant : voit les groupes en formation (RG35), demande à rejoindre ou lance le sien. Il doit avoir une identité
//   vérifiée quand le KYC est actif (RG52) : sinon un lien mène au parcours de vérification.
// - Propriétaire de l'annonce : « Groupes intéressés », en lecture seule (RG38).
// - Visiteur : invité à se connecter. Les autres rôles ne voient rien.
// Seuls le prénom et l'initiale de l'initiateur sont montrés (profil public minimal).
import { computed, onMounted, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import PlacesGroupe from '@/core/ui/PlacesGroupe.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import { parametres } from '@/core/parametres'
import { useAuthStore } from '@/modules/auth'
import { BandeauIdentite, lireIdentiteVerifiee } from '@/modules/identite'
import { creerGroupe, demanderAdhesion, groupesDuLogement, type GroupeLogement } from '../services/groupesService'

const props = defineProps<{ annonceId: number; type: string; auteurId: string; nbPlaces?: number; publiee?: boolean }>()

const auth = useAuthStore()
const { afficher } = useToasts()

const groupes = ref<GroupeLogement[]>([])
const chargement = ref(true)
const erreur = ref('')
const occupe = ref(false)
const verifiee = ref(true)
const formulaireOuvert = ref(false)
const places = ref('1')
const message = ref('')
const preferences = ref('')

const concerne = computed(() => props.publiee !== false && props.type !== 'place_colocation')
const estProprietaire = computed(() => auth.estConnecte && auth.profil?.id === props.auteurId)
const estEtudiant = computed(() => auth.estConnecte && auth.profil?.role === 'etudiant')
const placesMax = computed(() => Math.max((props.nbPlaces ?? 1) - 1, 0))
const optionsPlaces = computed(() => Array.from({ length: placesMax.value }, (_, i) => i + 1))
const dejaDansUnGroupe = computed(() => groupes.value.some((g) => g.monStatut === 'accepte' || g.monStatut === 'en_attente'))
const peutAgir = computed(() => estEtudiant.value && verifiee.value)

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    if (auth.estConnecte && (estEtudiant.value || estProprietaire.value)) groupes.value = await groupesDuLogement(props.annonceId)
    // RG52, RG59 : sans KYC actif, la base répond vrai pour tout étudiant actif
    if (estEtudiant.value && auth.profil) verifiee.value = !parametres.value.kyc_actif || (await lireIdentiteVerifiee(auth.profil.id))
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger les groupes.'
  } finally {
    chargement.value = false
  }
}
onMounted(() => {
  if (concerne.value) void charger()
  else chargement.value = false
})

async function agir(travail: () => Promise<void>, succes: string) {
  erreur.value = ''
  occupe.value = true
  try {
    await travail()
    afficher(succes, 'succes')
    formulaireOuvert.value = false
    await charger()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Action impossible.'
  } finally {
    occupe.value = false
  }
}

const rejoindre = (g: GroupeLogement) => agir(() => demanderAdhesion(g.id), 'Demande envoyée à l\'initiateur du groupe.')
const lancer = () =>
  agir(async () => {
    await creerGroupe(props.annonceId, Number(places.value), message.value, preferences.value)
  }, 'Ton groupe est lancé.')

function prix(montant: number): string {
  return new Intl.NumberFormat('fr-FR').format(montant).replace(/[  ]/g, ' ')
}
</script>

<template>
  <section v-if="concerne" class="groupes" aria-labelledby="titre-groupes">
    <ChargementUi v-if="chargement" :lignes="2" />

    <template v-else>
      <p v-if="!auth.estConnecte" class="info">
        <RouterLink to="/connexion">Connecte-toi</RouterLink> pour voir les étudiants qui cherchent des colocataires ici.
      </p>

      <template v-else-if="estProprietaire || estEtudiant">
        <h2 id="titre-groupes">
          {{ estProprietaire ? 'Groupes intéressés' : groupes.length > 0 ? 'Des étudiants cherchent déjà des colocataires ici' : 'Forme ton groupe' }}
        </h2>
        <AlerteUi v-if="erreur" type="erreur">
          {{ erreur }}
          <RouterLink v-if="/identité/.test(erreur)" to="/identite">Vérifier mon identité</RouterLink>
        </AlerteUi>

        <p v-if="groupes.length === 0" class="info">
          {{ estProprietaire ? 'Aucun groupe ne s\'est encore formé sur ton logement.' : 'Aucun groupe n\'existe encore sur ce logement. Tu peux lancer le tien.' }}
        </p>

        <ul class="liste">
          <li v-for="g in groupes" :key="g.id" class="groupe">
            <div class="entete">
              <strong>Groupe de {{ g.initiateurPrenom }} {{ g.initiateurInitiale }}.</strong>
              <PuceUi v-if="g.statut === 'complet'" variante="validee">Complet</PuceUi>
              <PuceUi v-else-if="g.monStatut === 'accepte'" variante="validee">Tu en fais partie</PuceUi>
              <PuceUi v-else-if="g.monStatut === 'en_attente'" variante="info">Demande envoyée</PuceUi>
            </div>
            <PlacesGroupe :total="g.placesRecherchees + 1" :occupees="g.membres" />
            <p class="meta">
              {{ g.membres }} sur {{ g.placesRecherchees + 1 }} places remplies · {{ g.placesRestantes }} restante(s) ·
              part estimée : <strong>{{ prix(g.partEstimee) }} FCFA</strong> par mois
            </p>
            <p v-if="g.message" class="texte">{{ g.message }}</p>
            <p v-if="g.preferences" class="meta">Préférences : {{ g.preferences }}</p>
            <BoutonUi
              v-if="estEtudiant && g.statut === 'en_formation' && g.monStatut === null"
              variante="secondaire"
              :desactive="!peutAgir || occupe"
              @click="rejoindre(g)"
            >
              Demander à rejoindre
            </BoutonUi>
          </li>
        </ul>

        <!-- RG52 : lien vers la vérification d'identité quand elle est exigée -->
        <template v-if="estEtudiant">
          <BandeauIdentite v-if="!verifiee" />
          <template v-if="placesMax >= 1 && !dejaDansUnGroupe">
            <BoutonUi v-if="!formulaireOuvert" variante="principal" :desactive="!peutAgir" @click="formulaireOuvert = true">Lancer mon groupe</BoutonUi>
            <form v-else class="formulaire" novalidate @submit.prevent="lancer">
              <p v-if="groupes.length > 0" class="info">
                Des groupes existent déjà (ci-dessus). Tu peux en rejoindre un, ou créer le tien.
              </p>
              <div class="champ">
                <label for="places">Colocataires recherchés (toi en plus)</label>
                <select id="places" v-model="places">
                  <option v-for="n in optionsPlaces" :key="n" :value="String(n)">{{ n }}</option>
                </select>
              </div>
              <div class="champ">
                <label for="message-groupe">Message aux futurs colocataires (facultatif)</label>
                <textarea id="message-groupe" v-model="message" rows="3" maxlength="500" />
              </div>
              <ChampUi v-model="preferences" libelle="Préférences (facultatif)" aide="Exemple : étudiants sérieux, non-fumeurs" />
              <div class="boutons">
                <BoutonUi type="submit" variante="principal" :chargement="occupe">Lancer le groupe</BoutonUi>
                <BoutonUi variante="secondaire" @click="formulaireOuvert = false">Annuler</BoutonUi>
              </div>
            </form>
          </template>
          <p v-else-if="placesMax < 1" class="info">Ce logement n'a qu'une place : il n'y a pas de groupe à former.</p>
          <p v-if="dejaDansUnGroupe" class="info"><RouterLink to="/groupes">Voir mes groupes</RouterLink></p>
        </template>
      </template>
    </template>
  </section>
</template>

<style scoped>
.groupes {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
}
h2,
p {
  margin: 0;
}
h2 {
  font-size: var(--texte-l);
}
.info,
.meta {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.liste {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.groupe {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  align-items: flex-start;
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.entete {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
  align-items: center;
}
.formulaire {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.champ {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
}
.champ label {
  font-weight: 700;
}
select,
textarea {
  padding: var(--e2) var(--e3);
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon-s);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
}
select {
  min-height: var(--cible-min);
}
.boutons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
}
</style>
