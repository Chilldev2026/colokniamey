<script setup lang="ts">
// Catalogue de tous les composants du module D. Accessible en développement seulement.
import { ref } from 'vue'
import MotifRuban from '../design/MotifRuban.vue'
import MotifCroix from '../design/MotifCroix.vue'
import MotifLosange from '../design/MotifLosange.vue'
import { useAnimation } from '../design/useAnimation'
import { icones } from '../design/icones'
import AlerteUi from '../ui/AlerteUi.vue'
import BarreNavigation from '../ui/BarreNavigation.vue'
import BarreProgression from '../ui/BarreProgression.vue'
import BoutonUi from '../ui/BoutonUi.vue'
import CarteAnnonce from '../ui/CarteAnnonce.vue'
import ChampUi from '../ui/ChampUi.vue'
import ChargementUi from '../ui/ChargementUi.vue'
import CoeurFavori from '../ui/CoeurFavori.vue'
import CompteurAnime from '../ui/CompteurAnime.vue'
import EtatVide from '../ui/EtatVide.vue'
import FeuilleBas from '../ui/FeuilleBas.vue'
import ModaleUi from '../ui/ModaleUi.vue'
import PlacesGroupe from '../ui/PlacesGroupe.vue'
import PuceUi from '../ui/PuceUi.vue'
import RadioCarte from '../ui/RadioCarte.vue'
import SelecteurUi from '../ui/SelecteurUi.vue'
import TableauPagine from '../ui/TableauPagine.vue'
import { useToasts } from '../ui/useToasts'

const { afficher } = useToasts()
const { cascade } = useAnimation()

const texte = ref('')
const choix = ref('etudiant')
const univ = ref('uam')
const favori = ref(false)
const feuille = ref(false)
const modale = ref(false)
const etape = ref(2)
const compteur = ref(128)
const occupees = ref(1)

const entreesNav = [
  { libelle: 'Accueil', vers: '/design-system', icone: 'accueil' },
  { libelle: 'Carte', vers: '/carte', icone: 'carte' },
  { libelle: 'Favoris', vers: '/favoris', icone: 'favoris' },
  { libelle: 'Messages', vers: '/messages', icone: 'messages' },
  { libelle: 'Profil', vers: '/profil', icone: 'profil' },
]

const colonnes: { cle: 'nom' | 'statut'; libelle: string }[] = [
  { cle: 'nom', libelle: 'Nom' },
  { cle: 'statut', libelle: 'Statut' },
]
const lignes = [
  { nom: 'Exemple A', statut: 'actif' },
  { nom: 'Exemple B', statut: 'suspendu' },
]

const liste = ref<HTMLElement | null>(null)
function rejouerCascade() {
  if (liste.value) cascade(Array.from(liste.value.children))
}
</script>

<template>
  <div class="catalogue">
    <h1>Design system</h1>

    <section>
      <h2>Motifs</h2>
      <MotifRuban />
      <div class="rangee"><MotifCroix /><MotifCroix :taille="40" couleur="#B8643E" /></div>
      <MotifLosange />
    </section>

    <section>
      <h2>Icônes (Lucide)</h2>
      <div class="rangee">
        <component :is="ic" v-for="(ic, nom) in icones" :key="nom" :size="24" :stroke-width="2" :title="nom" />
      </div>
    </section>

    <section>
      <h2>Boutons</h2>
      <div class="rangee">
        <BoutonUi variante="principal">Principal</BoutonUi>
        <BoutonUi>Secondaire</BoutonUi>
        <BoutonUi variante="danger">Danger</BoutonUi>
        <BoutonUi variante="action">Action</BoutonUi>
        <BoutonUi variante="principal" desactive>Désactivé</BoutonUi>
      </div>
    </section>

    <section>
      <h2>Champs</h2>
      <ChampUi v-model="texte" libelle="Prénom" aide="Comme sur ta carte d'étudiant." />
      <ChampUi v-model="texte" libelle="Téléphone" erreur="Le numéro est obligatoire." />
      <SelecteurUi
        v-model="univ"
        libelle="Université"
        :options="[{ valeur: 'uam', libelle: 'Université Abdou Moumouni (UAM)' }]"
      />
      <div class="rangee">
        <RadioCarte v-model="choix" nom="role" valeur="etudiant" libelle="Étudiant" description="Je cherche une place." />
        <RadioCarte v-model="choix" nom="role" valeur="proprietaire" libelle="Propriétaire" description="Je propose un logement." />
      </div>
    </section>

    <section>
      <h2>Puces et bandeaux</h2>
      <div class="rangee">
        <PuceUi>Neutre</PuceUi><PuceUi variante="validee">Vérifiée</PuceUi><PuceUi variante="info">Info</PuceUi>
      </div>
      <AlerteUi>Information.</AlerteUi>
      <AlerteUi type="succes">Enregistré.</AlerteUi>
      <AlerteUi type="erreur">Une erreur est survenue.</AlerteUi>
    </section>

    <section>
      <h2>Cartes d'annonce (cascade)</h2>
      <BoutonUi @click="rejouerCascade">Rejouer l'apparition</BoutonUi>
      <div ref="liste" class="grille">
        <CarteAnnonce vers="/design-system" type="Chambre meublée" quartier="[QUARTIER]" loyer="[LOYER]" distance="[X] km de l'UAM" verifiee />
        <CarteAnnonce vers="/design-system" type="Place en colocation" quartier="[QUARTIER]" loyer="[LOYER]" couleur-photo="#8C6A3F" />
      </div>
    </section>

    <section>
      <h2>Animations</h2>
      <div class="rangee">
        <CoeurFavori v-model="favori" />
        <span>Compteur : <strong><CompteurAnime :valeur="compteur" /></strong></span>
        <BoutonUi @click="compteur += 250">+250</BoutonUi>
      </div>
      <BarreProgression :etape="etape" :total="4" />
      <div class="rangee">
        <BoutonUi @click="etape = Math.min(4, etape + 1)">Étape suivante</BoutonUi>
        <PlacesGroupe :total="4" :occupees="occupees" />
        <BoutonUi @click="occupees = Math.min(4, occupees + 1)">Accepter un membre</BoutonUi>
      </div>
      <ChargementUi />
    </section>

    <section>
      <h2>Feuille, modale, toast</h2>
      <div class="rangee">
        <BoutonUi @click="feuille = true">Feuille du bas</BoutonUi>
        <BoutonUi @click="modale = true">Modale</BoutonUi>
        <BoutonUi @click="afficher('Message de confirmation.', 'succes')">Toast</BoutonUi>
      </div>
      <FeuilleBas v-model="feuille" titre="Feuille du bas">
        <p>Tire la poignée vers le bas pour fermer.</p>
      </FeuilleBas>
      <ModaleUi v-model="modale" titre="Modale">
        <p>Contenu de la fenêtre.</p>
        <template #actions><BoutonUi @click="modale = false">Fermer</BoutonUi></template>
      </ModaleUi>
    </section>

    <section>
      <h2>Tableau admin et état vide</h2>
      <TableauPagine :colonnes="colonnes" :lignes="lignes" />
      <EtatVide message="Rien à afficher pour le moment." />
    </section>

    <section>
      <h2>Barre de navigation</h2>
      <BarreNavigation :entrees="entreesNav" />
    </section>
  </div>
</template>

<style scoped>
.catalogue {
  display: flex;
  flex-direction: column;
  gap: var(--e6);
}
section {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
}
.rangee {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
  align-items: center;
}
.grille {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--e3);
}
h2 {
  margin: 0;
  font-size: var(--texte-l);
}
</style>
