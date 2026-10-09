<script setup lang="ts">
// File des dossiers d'identité (K, RG54, RG55, RG58), le plus ancien d'abord.
// Vue côte à côte : photo de profil, selfie, pièce recto et verso, code attendu. Les images ne se chargent qu'au clic
// sur « Afficher les images » : chaque consultation est journalisée (RGP10). Aucune image n'est gardée en cache.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { parametres } from '@/core/parametres'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import ModaleUi from '@/core/ui/ModaleUi.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import { urlAvatar } from '@/modules/profils'
import {
  consulterImage,
  deciderDossier,
  lireDossier,
  listerDossiers,
  type FicheDossier,
  type ImageDossier,
  type LigneDossier,
  type StatutFile,
} from '../services/identitesAdminService'

const { afficher } = useToasts()
const filtre = ref<StatutFile>('en_attente')
const lignes = ref<LigneDossier[]>([])
const fiche = ref<FicheDossier | null>(null)
const images = ref<Partial<Record<ImageDossier, string>>>({})
const chargement = ref(true)
const chargementFiche = ref(false)
const chargementImages = ref(false)
const erreur = ref('')
const occupe = ref(false)
const refusOuvert = ref(false)
const motif = ref('')

const FILTRES: { id: StatutFile; libelle: string }[] = [
  { id: 'en_attente', libelle: 'À vérifier' },
  { id: 'valide', libelle: 'Validés' },
  { id: 'refuse', libelle: 'Refusés' },
]
const LIBELLES_PIECE: Record<string, string> = { cni: 'Carte nationale d\'identité', passeport: 'Passeport' }
const enAttente = computed(() => fiche.value?.statut === 'en_attente')

function libererImages() {
  for (const url of Object.values(images.value)) if (url) URL.revokeObjectURL(url)
  images.value = {}
}

async function charger() {
  chargement.value = true
  erreur.value = ''
  fermer()
  try {
    lignes.value = await listerDossiers(filtre.value)
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger la file.'
  } finally {
    chargement.value = false
  }
}

function changerFiltre(f: StatutFile) {
  filtre.value = f
  void charger()
}

async function ouvrir(id: string) {
  libererImages()
  chargementFiche.value = true
  erreur.value = ''
  try {
    fiche.value = await lireDossier(id)
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger ce dossier.'
  } finally {
    chargementFiche.value = false
  }
}

function fermer() {
  libererImages()
  fiche.value = null
}

async function afficherImages() {
  if (!fiche.value) return
  chargementImages.value = true
  erreur.value = ''
  try {
    for (const type of ['recto', 'verso', 'selfie'] as const) {
      images.value = { ...images.value, [type]: await consulterImage(fiche.value.id, type) }
    }
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger les images.'
  } finally {
    chargementImages.value = false
  }
}

async function decider(valide: boolean) {
  if (!fiche.value) return
  occupe.value = true
  erreur.value = ''
  try {
    await deciderDossier(fiche.value.id, valide, valide ? undefined : motif.value.trim())
    afficher(valide ? 'Identité validée.' : 'Dossier refusé. L\'étudiant en est informé.', 'succes')
    refusOuvert.value = false
    motif.value = ''
    await charger()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'La décision n\'a pas été enregistrée.'
  } finally {
    occupe.value = false
  }
}

function date(valeur: string | null): string {
  return valeur ? new Date(valeur).toLocaleDateString('fr-FR') : ''
}

onMounted(charger)
onBeforeUnmount(libererImages)
</script>

<template>
  <section class="identites">
    <h1>Identités</h1>
    <AlerteUi v-if="!parametres.kyc_actif" type="info">
      La vérification d'identité est désactivée (paramètre « kyc_actif »). Aucun nouveau dossier n'est reçu ; les dossiers
      déjà reçus suivent leur durée de conservation.
    </AlerteUi>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>

    <div class="filtres" role="tablist" aria-label="Filtrer les dossiers">
      <BoutonUi
        v-for="f in FILTRES"
        :key="f.id"
        :variante="filtre === f.id ? 'principal' : 'secondaire'"
        role="tab"
        :aria-selected="filtre === f.id"
        @click="changerFiltre(f.id)"
      >
        {{ f.libelle }}
      </BoutonUi>
    </div>

    <ChargementUi v-if="chargement" :lignes="3" />
    <EtatVide v-else-if="lignes.length === 0" message="Aucun dossier dans cette liste." />

    <div v-else class="deux">
      <ul class="liste">
        <li v-for="l in lignes" :key="l.id">
          <button type="button" class="ligne" :class="{ choisie: fiche?.id === l.id }" @click="ouvrir(l.id)">
            <span class="nom">{{ l.prenom }} {{ l.nom }}</span>
            <span class="meta">{{ LIBELLES_PIECE[l.typePiece ?? ''] ?? '-' }} · {{ date(l.soumisLe) }}</span>
            <PuceUi v-if="l.suspect">Déjà vu ailleurs</PuceUi>
          </button>
        </li>
      </ul>

      <article v-if="chargementFiche || fiche" class="fiche">
        <ChargementUi v-if="chargementFiche" :lignes="4" />
        <template v-else-if="fiche">
          <header>
            <h2>{{ fiche.prenom }} {{ fiche.nom }}</h2>
            <BoutonUi variante="secondaire" @click="fermer">Fermer</BoutonUi>
          </header>
          <AlerteUi v-if="fiche.suspect" type="erreur">
            Une image de ce dossier ressemble à une image déjà vue sur un autre compte. Compare avec soin.
          </AlerteUi>
          <p>
            <strong>Pièce :</strong> {{ LIBELLES_PIECE[fiche.typePiece ?? ''] ?? '-' }} ·
            <strong>Code attendu sur la feuille :</strong> <span class="code">{{ fiche.codeSelfie }}</span>
          </p>
          <p v-if="fiche.motifRefus"><strong>Motif du refus :</strong> {{ fiche.motifRefus }}</p>

          <div class="images">
            <figure>
              <figcaption>Photo de profil</figcaption>
              <img v-if="fiche.avatarChemin" :src="urlAvatar(fiche.avatarChemin)" alt="Photo de profil" />
              <p v-else class="absente">Aucune photo validée</p>
            </figure>
            <figure v-for="t in (['selfie', 'recto', 'verso'] as const)" :key="t">
              <figcaption>{{ t === 'selfie' ? 'Selfie' : t === 'recto' ? 'Pièce, recto' : 'Pièce, verso' }}</figcaption>
              <img v-if="images[t]" :src="images[t]" :alt="`Image : ${t}`" />
              <p v-else class="absente">Non affichée</p>
            </figure>
          </div>

          <BoutonUi
            v-if="fiche.imagesDisponibles && !images.recto"
            variante="secondaire"
            :chargement="chargementImages"
            @click="afficherImages"
          >
            Afficher les images (consultation enregistrée)
          </BoutonUi>
          <p v-else-if="!fiche.imagesDisponibles" class="absente">Les images ne sont plus conservées.</p>

          <div v-if="enAttente" class="decision">
            <BoutonUi variante="principal" :chargement="occupe" :desactive="!images.recto" @click="decider(true)">Valider</BoutonUi>
            <BoutonUi variante="danger" :desactive="occupe" @click="refusOuvert = true">Refuser</BoutonUi>
            <p v-if="!images.recto" class="aide">Affiche les images avant de décider.</p>
          </div>
        </template>
      </article>
    </div>

    <ModaleUi v-model="refusOuvert" titre="Refuser le dossier">
      <p>Le motif est obligatoire : l'étudiant le recevra pour pouvoir corriger son dossier.</p>
      <ChampUi v-model="motif" libelle="Motif du refus" />
      <template #actions>
        <BoutonUi variante="secondaire" @click="refusOuvert = false">Annuler</BoutonUi>
        <BoutonUi variante="danger" :chargement="occupe" :desactive="motif.trim().length < 3" @click="decider(false)">Refuser</BoutonUi>
      </template>
    </ModaleUi>
  </section>
</template>

<style scoped>
.identites {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
h1,
h2,
p {
  margin: 0;
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
.meta,
.aide,
.absente {
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
.code {
  padding: 2px var(--e2);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon-s);
  color: var(--indigo);
  font-family: var(--police-titre);
  font-weight: 800;
  letter-spacing: 0.15em;
}
.images {
  display: grid;
  gap: var(--e3);
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}
figure {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
  margin: 0;
}
figcaption {
  font-size: var(--texte-s);
  font-weight: 700;
}
figure img {
  width: 100%;
  max-height: 22rem;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon-s);
  background: var(--fond);
  object-fit: contain;
}
.decision {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
  align-items: center;
}
</style>
