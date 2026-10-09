<script setup lang="ts">
// Administration du référentiel (RG07, RG22, RG25 bis, RG29) : villes, quartiers, universités, équipements.
// Réservée aux admins par la base (politiques d'écriture de 0950). Chaque opération est journalisée.
// Filtre « À placer » : universités sans position, qui n'ont ni marqueur ni distance tant qu'on ne les place pas.
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import ModaleUi from '@/core/ui/ModaleUi.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import SelecteurUi from '@/core/ui/SelecteurUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import { listerQuartiers, listerUniversites, listerVilles, aUnePosition } from '@/modules/referentiel'
import type { Quartier, Universite, Ville } from '@/modules/referentiel'
import { lireCoordonnees, formaterCoordonnee, type Point } from '../geo'
import {
  enregistrerEquipement, enregistrerQuartier, enregistrerUniversite, enregistrerVille, listerEquipements, supprimer,
  type Equipement, type TableReferentiel,
} from '../services/referentielAdminService'
import SelecteurPosition from '../components/SelecteurPosition.vue'

type Onglet = 'villes' | 'quartiers' | 'universites' | 'equipements'

const route = useRoute()
const { afficher } = useToasts()

const onglet = ref<Onglet>('universites')
const villes = ref<Ville[]>([])
const quartiers = ref<Quartier[]>([])
const universites = ref<Universite[]>([])
const equipements = ref<Equipement[]>([])
const villeChoisie = ref('')
const aPlacerSeulement = ref(route.query.filtre === 'a-placer')
const chargement = ref(true)
const erreur = ref('')

const nonPlacees = computed(() => universites.value.filter((u) => !aUnePosition(u)).length)
const universitesAffichees = computed(() => (aPlacerSeulement.value ? universites.value.filter((u) => !aUnePosition(u)) : universites.value))
const nomVille = (id: number) => villes.value.find((v) => v.id === id)?.nom ?? '-'

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    ;[villes.value, universites.value, equipements.value] = await Promise.all([listerVilles(), listerUniversites(), listerEquipements()])
    if (!villeChoisie.value && villes.value[0]) villeChoisie.value = String(villes.value[0].id)
    await chargerQuartiers()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger le référentiel.'
  } finally {
    chargement.value = false
  }
}

async function chargerQuartiers() {
  quartiers.value = villeChoisie.value ? await listerQuartiers(Number(villeChoisie.value)) : []
}

onMounted(charger)
watch(villeChoisie, () => void chargerQuartiers().catch(() => undefined))

// --- Formulaire ---
const formulaireOuvert = ref(false)
const type = ref<Onglet>('universites')
const idEdite = ref<number | null>(null)
const champs = reactive({
  nom: '', sigle: '', rayonKm: '20', commune: '', adresse: '', villeId: '', quartierId: '', ordre: '100', actif: true,
  latitude: '', longitude: '',
})
const quartiersDuFormulaire = ref<Quartier[]>([])
const erreurChamps = ref('')
const erreurFormulaire = ref('')
const envoi = ref(false)

const villeDuFormulaire = computed(() => villes.value.find((v) => String(v.id) === champs.villeId) ?? null)
const zone = computed(() => (type.value === 'villes' || !villeDuFormulaire.value ? null : villeDuFormulaire.value))
const titreFormulaire = computed(() => {
  const noms = { villes: 'la ville', quartiers: 'le quartier', universites: 'l\'université', equipements: 'l\'équipement' } as const
  return `${idEdite.value === null ? 'Ajouter' : 'Modifier'} ${noms[type.value]}`
})

watch(
  () => champs.villeId,
  async (id) => {
    champs.quartierId = ''
    quartiersDuFormulaire.value = id && type.value === 'universites' ? await listerQuartiers(Number(id)).catch(() => []) : []
  },
)

function ouvrir(t: Onglet, element?: Ville | Quartier | Universite | Equipement) {
  type.value = t
  idEdite.value = element?.id ?? null
  erreurFormulaire.value = ''
  erreurChamps.value = ''
  Object.assign(champs, {
    nom: element?.nom ?? '', sigle: '', rayonKm: '20', commune: '', adresse: '', ordre: '100', actif: true,
    villeId: villeChoisie.value, quartierId: '', latitude: '', longitude: '',
  })
  if (t === 'villes' && element) {
    const v = element as Ville
    Object.assign(champs, { rayonKm: String(v.rayonKm), latitude: formaterCoordonnee(v.latitude), longitude: formaterCoordonnee(v.longitude) })
  } else if (t === 'quartiers' && element) {
    const q = element as Quartier
    Object.assign(champs, {
      villeId: String(q.villeId), commune: q.commune ?? '',
      latitude: q.latitude === null ? '' : formaterCoordonnee(q.latitude), longitude: q.longitude === null ? '' : formaterCoordonnee(q.longitude),
    })
  } else if (t === 'universites' && element) {
    const u = element as Universite
    Object.assign(champs, {
      sigle: u.sigle ?? '', villeId: String(u.villeId), adresse: u.adresse ?? '',
      latitude: u.latitude === null ? '' : formaterCoordonnee(u.latitude), longitude: u.longitude === null ? '' : formaterCoordonnee(u.longitude),
    })
    void listerQuartiers(u.villeId).then((liste) => {
      quartiersDuFormulaire.value = liste
      champs.quartierId = u.quartierId === null ? '' : String(u.quartierId)
    })
  } else if (t === 'equipements' && element) {
    const e = element as Equipement
    Object.assign(champs, { ordre: String(e.ordre), actif: e.actif })
  }
  if (t === 'universites' && !element) quartiersDuFormulaire.value = []
  formulaireOuvert.value = true
}

function lirePoint(obligatoire: boolean): Point | null | undefined {
  const lu = lireCoordonnees(champs.latitude, champs.longitude)
  if (lu !== null && 'erreur' in lu) {
    erreurChamps.value = lu.erreur
    return undefined
  }
  if (lu === null && obligatoire) {
    erreurChamps.value = 'Place le point sur la carte.'
    return undefined
  }
  return lu
}

async function enregistrer() {
  erreurChamps.value = ''
  erreurFormulaire.value = ''
  if (champs.nom.trim() === '') {
    erreurChamps.value = 'Le nom est obligatoire.'
    return
  }
  if (type.value !== 'equipements' && type.value !== 'villes' && champs.villeId === '') {
    erreurChamps.value = 'Choisis la ville.'
    return
  }
  const point = type.value === 'equipements' ? null : lirePoint(type.value === 'villes')
  if (point === undefined) return

  envoi.value = true
  try {
    if (type.value === 'villes') {
      const rayon = Number(champs.rayonKm.replace(',', '.'))
      if (!(rayon > 0 && rayon <= 200)) {
        erreurChamps.value = 'Le rayon doit être entre 0 et 200 km.'
        return
      }
      await enregistrerVille(idEdite.value, { nom: champs.nom, rayonKm: rayon, centre: point! })
    } else if (type.value === 'quartiers') {
      await enregistrerQuartier(idEdite.value, { nom: champs.nom, villeId: Number(champs.villeId), commune: champs.commune, centre: point })
    } else if (type.value === 'universites') {
      await enregistrerUniversite(idEdite.value, {
        nom: champs.nom, sigle: champs.sigle, villeId: Number(champs.villeId), adresse: champs.adresse,
        quartierId: champs.quartierId ? Number(champs.quartierId) : null, position: point,
      })
    } else {
      const ordre = Number(champs.ordre)
      if (!Number.isInteger(ordre)) {
        erreurChamps.value = 'L\'ordre doit être un nombre entier.'
        return
      }
      await enregistrerEquipement(idEdite.value, { nom: champs.nom, actif: champs.actif, ordre })
    }
    formulaireOuvert.value = false
    afficher('Enregistré et inscrit au journal.', 'succes')
    await charger()
  } catch (e) {
    erreurFormulaire.value = e instanceof Error ? e.message : 'Une erreur est survenue.'
  } finally {
    envoi.value = false
  }
}

// --- Suppression ---
const aSupprimer = ref<{ table: TableReferentiel; id: number; nom: string } | null>(null)
const suppressionOuverte = ref(false)
const erreurSuppression = ref('')

function demanderSuppression(table: TableReferentiel, element: { id: number; nom: string }) {
  aSupprimer.value = { table, id: element.id, nom: element.nom }
  erreurSuppression.value = ''
  suppressionOuverte.value = true
}

async function confirmerSuppression() {
  if (!aSupprimer.value) return
  envoi.value = true
  erreurSuppression.value = ''
  try {
    await supprimer(aSupprimer.value.table, aSupprimer.value.id)
    suppressionOuverte.value = false
    afficher('Supprimé et inscrit au journal.', 'succes')
    await charger()
  } catch (e) {
    // Si l'élément est utilisé, la base explique par quoi
    erreurSuppression.value = e instanceof Error ? e.message : 'Une erreur est survenue.'
  } finally {
    envoi.value = false
  }
}

const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: 'universites', libelle: 'Universités' },
  { cle: 'quartiers', libelle: 'Quartiers' },
  { cle: 'villes', libelle: 'Villes' },
  { cle: 'equipements', libelle: 'Équipements' },
]
const optionsVilles = computed(() => villes.value.map((v) => ({ valeur: String(v.id), libelle: v.nom })))
const optionsQuartiers = computed(() => [{ valeur: '', libelle: 'Aucun quartier' }, ...quartiersDuFormulaire.value.map((q) => ({ valeur: String(q.id), libelle: q.nom }))])
</script>

<template>
  <section class="referentiel">
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-else-if="chargement" :lignes="5" />

    <template v-else>
      <div class="onglets" role="tablist">
        <button
          v-for="o in ONGLETS"
          :key="o.cle"
          type="button"
          role="tab"
          class="onglet"
          :class="{ actif: onglet === o.cle }"
          :aria-selected="onglet === o.cle"
          @click="onglet = o.cle"
        >
          {{ o.libelle }}
          <span v-if="o.cle === 'universites' && nonPlacees > 0" class="compteur" :aria-label="`${nonPlacees} à placer`">{{ nonPlacees }}</span>
        </button>
      </div>

      <!-- Universités -->
      <div v-if="onglet === 'universites'" class="liste-zone">
        <div class="barre">
          <div class="filtres">
            <BoutonUi :variante="aPlacerSeulement ? 'secondaire' : 'principal'" @click="aPlacerSeulement = false">Toutes ({{ universites.length }})</BoutonUi>
            <BoutonUi :variante="aPlacerSeulement ? 'principal' : 'secondaire'" @click="aPlacerSeulement = true">À placer ({{ nonPlacees }})</BoutonUi>
          </div>
          <BoutonUi variante="action" @click="ouvrir('universites')">Ajouter une université</BoutonUi>
        </div>
        <EtatVide v-if="universitesAffichees.length === 0" :message="aPlacerSeulement ? 'Toutes les universités ont une position.' : 'Aucune université.'" />
        <ul v-else class="liste">
          <li v-for="u in universitesAffichees" :key="u.id">
            <div class="info">
              <strong>{{ u.nom }}<template v-if="u.sigle"> ({{ u.sigle }})</template></strong>
              <span class="secondaire">{{ nomVille(u.villeId) }}</span>
              <PuceUi :variante="aUnePosition(u) ? 'validee' : 'neutre'">{{ aUnePosition(u) ? 'Placée sur la carte' : 'À placer' }}</PuceUi>
            </div>
            <div class="actions">
              <BoutonUi variante="secondaire" @click="ouvrir('universites', u)">{{ aUnePosition(u) ? 'Modifier' : 'Placer sur la carte' }}</BoutonUi>
              <BoutonUi variante="secondaire" @click="demanderSuppression('universites', u)">Supprimer</BoutonUi>
            </div>
          </li>
        </ul>
      </div>

      <!-- Quartiers -->
      <div v-else-if="onglet === 'quartiers'" class="liste-zone">
        <div class="barre">
          <SelecteurUi v-model="villeChoisie" libelle="Ville" :options="optionsVilles" />
          <BoutonUi variante="action" @click="ouvrir('quartiers')">Ajouter un quartier</BoutonUi>
        </div>
        <EtatVide v-if="quartiers.length === 0" message="Aucun quartier pour cette ville." />
        <ul v-else class="liste">
          <li v-for="q in quartiers" :key="q.id">
            <div class="info">
              <strong>{{ q.nom }}</strong>
              <span class="secondaire">{{ q.commune ?? '' }}</span>
              <PuceUi :variante="q.latitude !== null ? 'validee' : 'neutre'">{{ q.latitude !== null ? 'Placé' : 'Sans position' }}</PuceUi>
            </div>
            <div class="actions">
              <BoutonUi variante="secondaire" @click="ouvrir('quartiers', q)">Modifier</BoutonUi>
              <BoutonUi variante="secondaire" @click="demanderSuppression('quartiers', q)">Supprimer</BoutonUi>
            </div>
          </li>
        </ul>
      </div>

      <!-- Villes -->
      <div v-else-if="onglet === 'villes'" class="liste-zone">
        <div class="barre"><span /><BoutonUi variante="action" @click="ouvrir('villes')">Ajouter une ville</BoutonUi></div>
        <ul class="liste">
          <li v-for="v in villes" :key="v.id">
            <div class="info"><strong>{{ v.nom }}</strong><span class="secondaire">Zone de {{ v.rayonKm }} km</span></div>
            <div class="actions">
              <BoutonUi variante="secondaire" @click="ouvrir('villes', v)">Modifier</BoutonUi>
              <BoutonUi variante="secondaire" @click="demanderSuppression('villes', v)">Supprimer</BoutonUi>
            </div>
          </li>
        </ul>
      </div>

      <!-- Équipements -->
      <div v-else class="liste-zone">
        <div class="barre"><span /><BoutonUi variante="action" @click="ouvrir('equipements')">Ajouter un équipement</BoutonUi></div>
        <EtatVide v-if="equipements.length === 0" message="Aucun équipement. Ajoute la liste validée : elle est proposée dans les annonces." />
        <ul v-else class="liste">
          <li v-for="e in equipements" :key="e.id">
            <div class="info">
              <strong>{{ e.nom }}</strong>
              <PuceUi :variante="e.actif ? 'validee' : 'neutre'">{{ e.actif ? 'Proposé' : 'Masqué' }}</PuceUi>
            </div>
            <div class="actions">
              <BoutonUi variante="secondaire" @click="ouvrir('equipements', e)">Modifier</BoutonUi>
              <BoutonUi variante="secondaire" @click="demanderSuppression('equipements', e)">Supprimer</BoutonUi>
            </div>
          </li>
        </ul>
      </div>
    </template>

    <ModaleUi v-model="formulaireOuvert" :titre="titreFormulaire">
      <form class="formulaire" novalidate @submit.prevent="enregistrer">
        <ChampUi v-model="champs.nom" libelle="Nom" requis />
        <ChampUi v-if="type === 'universites'" v-model="champs.sigle" libelle="Sigle (facultatif)" />
        <template v-if="type === 'villes'">
          <ChampUi v-model="champs.rayonKm" libelle="Rayon de la zone (km)" aide="Un point en dehors de ce rayon est refusé." />
        </template>
        <SelecteurUi v-if="type === 'quartiers' || type === 'universites'" v-model="champs.villeId" libelle="Ville" :options="optionsVilles" placeholder="Choisis la ville" />
        <ChampUi v-if="type === 'quartiers'" v-model="champs.commune" libelle="Commune (facultatif)" />
        <template v-if="type === 'universites'">
          <SelecteurUi v-model="champs.quartierId" libelle="Quartier (facultatif)" :options="optionsQuartiers" />
          <ChampUi v-model="champs.adresse" libelle="Adresse (facultatif)" />
        </template>
        <template v-if="type === 'equipements'">
          <ChampUi v-model="champs.ordre" libelle="Ordre d'affichage" />
          <label class="case"><input v-model="champs.actif" type="checkbox" /> Proposé dans les annonces</label>
        </template>
        <SelecteurPosition v-if="type !== 'equipements' && (type === 'villes' || champs.villeId)" v-model:latitude="champs.latitude" v-model:longitude="champs.longitude" :zone="zone" />
        <p v-if="type === 'universites'" class="aide">Sans position, l'université reste proposée à l'inscription mais n'a ni marqueur ni distance (RG25 bis). Aucune coordonnée n'est inventée.</p>
        <AlerteUi v-if="erreurChamps || erreurFormulaire" type="erreur">{{ erreurChamps || erreurFormulaire }}</AlerteUi>
        <div class="boutons">
          <BoutonUi variante="secondaire" @click="formulaireOuvert = false">Annuler</BoutonUi>
          <BoutonUi type="submit" variante="principal" :chargement="envoi">Enregistrer</BoutonUi>
        </div>
      </form>
    </ModaleUi>

    <ModaleUi v-model="suppressionOuverte" titre="Supprimer cet élément ?">
      <p v-if="aSupprimer">« {{ aSupprimer.nom }} » sera supprimé. S'il est utilisé ailleurs, la suppression est refusée.</p>
      <AlerteUi v-if="erreurSuppression" type="erreur">{{ erreurSuppression }}</AlerteUi>
      <template #actions>
        <BoutonUi variante="secondaire" @click="suppressionOuverte = false">Annuler</BoutonUi>
        <BoutonUi variante="danger" :chargement="envoi" @click="confirmerSuppression">Supprimer</BoutonUi>
      </template>
    </ModaleUi>
  </section>
</template>

<style scoped>
.referentiel,
.liste-zone {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
.onglets {
  display: flex;
  gap: var(--e1);
  overflow-x: auto;
  border-bottom: 1px solid var(--bordure);
}
.onglet {
  display: inline-flex;
  gap: var(--e2);
  align-items: center;
  min-height: var(--cible-min);
  padding: 0 var(--e4);
  border: 0;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: var(--texte-secondaire);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.onglet.actif {
  border-bottom-color: var(--orange);
  color: var(--encre);
}
.compteur {
  min-width: 22px;
  padding: 0 var(--e2);
  border-radius: var(--rayon-rond);
  background: var(--orange);
  color: #ffffff;
  font-size: 0.75rem;
  text-align: center;
}
.barre {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
  align-items: flex-end;
  justify-content: space-between;
}
.filtres {
  display: flex;
  gap: var(--e2);
}
.liste {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.liste li {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
  align-items: center;
  justify-content: space-between;
  padding: var(--e3) var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.info {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2) var(--e3);
  align-items: center;
}
.actions,
.boutons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
}
.secondaire,
.aide {
  margin: 0;
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.formulaire {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  max-height: 70dvh;
  overflow-y: auto;
}
.case {
  display: flex;
  gap: var(--e3);
  align-items: center;
  min-height: var(--cible-min);
}
.case input {
  width: 22px;
  height: 22px;
  accent-color: var(--indigo);
}
</style>
