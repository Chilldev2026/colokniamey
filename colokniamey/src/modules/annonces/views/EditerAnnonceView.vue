<script setup lang="ts">
// Création et édition d'une annonce en 6 étapes (RG13 à RG33) :
// 1. Logement et prix, 2. Équipements, 3. Localisation, 4. Règles et tâches partagées,
// 5. Colocataire recherché et contact, 6. Photos et aperçu, puis soumission.
// Chaque étape s'enregistre en brouillon : on peut quitter et reprendre. Les contrôles d'ici ne servent qu'au confort,
// la base refuse de toute façon une annonce incohérente (RG16, RG21, RG22…).
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { parametres } from '@/core/parametres'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import CaseACocher from '@/core/ui/CaseACocher.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import SelecteurUi from '@/core/ui/SelecteurUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import { useAuthStore } from '@/modules/auth'
import { BandeauIdentite } from '@/modules/identite'
import { listerQuartiers, listerUniversites, listerVilles, type Quartier, type Universite, type Ville } from '@/modules/referentiel'
import ListeReglesTaches from '../components/ListeReglesTaches.vue'
import PhotosAnnonce from '../components/PhotosAnnonce.vue'
import SelecteurPositionAnnonce from '../components/SelecteurPositionAnnonce.vue'
import {
  creerAnnonce,
  listerEquipements,
  lireAnnoncePourEdition,
  modifierAnnonce,
  soumettreAnnonce,
  synchroniserEquipements,
  synchroniserRegles,
  synchroniserTaches,
} from '../services/annoncesService'
import {
  formulaireVide,
  LIBELLES_GENRE,
  LIBELLES_STATUT,
  LIBELLES_TYPE,
  type FormulaireAnnonce,
  type LigneRegle,
  type LigneTache,
  type StatutAnnonce,
  type TypeAnnonce,
} from '../types'
import {
  formaterMontant,
  validerEtapeColocataire,
  validerEtapeLogement,
  validerEtapeRegles,
  type ErreursAnnonce,
} from '../validation'

const ETAPES = ['Logement et prix', 'Équipements', 'Localisation', 'Règles et tâches', 'Colocataire et contact', 'Photos et aperçu']

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { afficher } = useToasts()

const idRoute = typeof route.params.id === 'string' ? Number(route.params.id) : null
const annonceId = ref<number | null>(Number.isInteger(idRoute) ? idRoute : null)
const etape = ref(Math.min(Math.max(Number(route.query.etape ?? 0) || 0, 0), ETAPES.length - 1))

const estEtudiant = computed(() => auth.profil?.role === 'etudiant')
const typesPossibles = computed<TypeAnnonce[]>(() => (estEtudiant.value ? ['place_colocation'] : ['chambre', 'studio', 'appartement']))
const estColocation = computed(() => form.type === 'place_colocation')

const form = reactive<FormulaireAnnonce>(formulaireVide('place_colocation'))
const erreurs = ref<ErreursAnnonce>({})
const erreur = ref('')
const chargement = ref(true)
const envoi = ref(false)
const statut = ref<StatutAnnonce>('brouillon')
const motifRefus = ref<string | null>(null)
const nbPhotos = ref(0)
const positionConfirmee = ref(false)

// Ce qui est déjà en base : on n'écrit que les différences
let anciensEquipements: number[] = []
let anciennesRegles: LigneRegle[] = []
let anciennesTaches: LigneTache[] = []
let ancienTitre = ''
let ancienneDescription = ''

const villes = ref<Ville[]>([])
const villeId = ref('')
const quartiers = ref<Quartier[]>([])
const universites = ref<Universite[]>([])
const equipements = ref<{ id: number; nom: string }[]>([])

const ville = computed(() => villes.value.find((v) => String(v.id) === villeId.value) ?? null)
const zone = computed(() => (ville.value ? { latitude: ville.value.latitude, longitude: ville.value.longitude, rayonKm: ville.value.rayonKm } : null))

async function chargerVille(id: number) {
  const [q, u] = await Promise.all([listerQuartiers(id), listerUniversites(id)])
  quartiers.value = q
  universites.value = u
}

async function changerVille(valeur: string) {
  villeId.value = valeur
  form.quartierId = ''
  form.universiteId = ''
  if (valeur !== '') await chargerVille(Number(valeur))
}

onMounted(async () => {
  try {
    // Le type est imposé par le rôle : un étudiant publie une place en colocation (RG13)
    form.type = typesPossibles.value[0] ?? 'place_colocation'
    form.nbPlaces = form.type === 'place_colocation' ? '3' : '1'
    const [v, e] = await Promise.all([listerVilles(), listerEquipements()])
    villes.value = v
    equipements.value = e

    if (annonceId.value !== null) {
      const lue = await lireAnnoncePourEdition(annonceId.value)
      if (!lue) {
        erreur.value = 'Cette annonce est introuvable.'
        return
      }
      Object.assign(form, lue.formulaire)
      statut.value = lue.statut
      motifRefus.value = lue.motifRefus
      anciensEquipements = [...lue.formulaire.equipementIds]
      anciennesRegles = lue.formulaire.regles.map((r) => ({ ...r }))
      anciennesTaches = lue.formulaire.taches.map((t) => ({ ...t }))
      ancienTitre = lue.formulaire.titre
      ancienneDescription = lue.formulaire.description
      positionConfirmee.value = lue.formulaire.position !== null
      // La ville est celle du quartier de l'annonce
      for (const vi of v) {
        const q = await listerQuartiers(vi.id)
        if (q.some((x) => String(x.id) === form.quartierId)) {
          villeId.value = String(vi.id)
          quartiers.value = q
          universites.value = await listerUniversites(vi.id)
          break
        }
      }
    } else if (v.length > 0) {
      villeId.value = String(v[0]?.id)
      await chargerVille(v[0]!.id)
    }
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger le formulaire.'
  } finally {
    chargement.value = false
  }
})

function valider(): ErreursAnnonce {
  switch (etape.value) {
    case 0: return validerEtapeLogement(form)
    case 2: {
      if (!form.position) return { position: 'Place ton logement sur la carte.' }
      if (!positionConfirmee.value) return { position: 'Confirme que le repère est bien placé.' }
      return {}
    }
    case 3: return validerEtapeRegles(form.regles, form.taches)
    case 4: return validerEtapeColocataire(form)
    default: return {}
  }
}

async function enregistrerEtape() {
  const id = annonceId.value
  switch (etape.value) {
    case 0: {
      if (id === null) {
        const cree = await creerAnnonce(auth.profil?.id ?? '', form)
        annonceId.value = cree
        await router.replace({ name: 'annonces-editer', params: { id: String(cree) }, query: { etape: '1' } })
        return 'redirige'
      }
      await modifierAnnonce(id, form, false, [form.titre !== ancienTitre ? form.titre : '', form.description !== ancienneDescription ? form.description : ''])
      ancienTitre = form.titre
      ancienneDescription = form.description
      return
    }
    case 1:
      if (id !== null) {
        await synchroniserEquipements(id, form.equipementIds, anciensEquipements)
        anciensEquipements = [...form.equipementIds]
      }
      return
    case 2:
      if (id !== null) {
        // La position est toujours envoyée à cette étape : identique à celle de la base, elle ne compte pas comme une modification
        await modifierAnnonce(id, form, true, [])
      }
      return
    case 3:
      if (id !== null) {
        form.regles = anciennesRegles = await synchroniserRegles(id, form.regles, anciennesRegles)
        form.taches = anciennesTaches = await synchroniserTaches(id, form.taches, anciennesTaches)
      }
      return
    case 4:
      if (id !== null) await modifierAnnonce(id, form, false, [])
      return
  }
}

async function suivant() {
  erreur.value = ''
  erreurs.value = valider()
  if (Object.keys(erreurs.value).length > 0) return
  envoi.value = true
  try {
    if ((await enregistrerEtape()) === 'redirige') return
    etape.value = Math.min(etape.value + 1, ETAPES.length - 1)
    window.scrollTo({ top: 0 })
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Enregistrement impossible.'
  } finally {
    envoi.value = false
  }
}

function precedent() {
  erreur.value = ''
  etape.value = Math.max(etape.value - 1, 0)
}

async function soumettre() {
  if (annonceId.value === null) return
  erreur.value = ''
  envoi.value = true
  try {
    const resultat = await soumettreAnnonce(annonceId.value)
    afficher(resultat === 'publiee' ? 'Ton annonce est publiée.' : 'Ton annonce est envoyée. Elle sera visible après vérification.', 'succes')
    await router.push({ name: 'annonces-mes' })
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'La soumission a échoué.'
  } finally {
    envoi.value = false
  }
}

function basculerEquipement(id: number) {
  form.equipementIds = form.equipementIds.includes(id) ? form.equipementIds.filter((e) => e !== id) : [...form.equipementIds, id]
}

const optionsType = computed(() => typesPossibles.value.map((t) => ({ valeur: t, libelle: LIBELLES_TYPE[t] })))
const optionsVilles = computed(() => villes.value.map((v) => ({ valeur: String(v.id), libelle: v.nom })))
const optionsQuartiers = computed(() => quartiers.value.map((q) => ({ valeur: String(q.id), libelle: q.nom })))
const optionsUniversites = computed(() => [
  { valeur: '', libelle: 'Aucune en particulier' },
  ...universites.value.map((u) => ({ valeur: String(u.id), libelle: u.sigle ? `${u.nom} (${u.sigle})` : u.nom })),
])
const optionsGenre = Object.entries(LIBELLES_GENRE).map(([valeur, libelle]) => ({ valeur, libelle }))
const nomQuartier = computed(() => quartiers.value.find((q) => String(q.id) === form.quartierId)?.nom ?? '')
const peutSoumettre = computed(() => annonceId.value !== null && (statut.value === 'brouillon' || statut.value === 'refusee'))
const partParPersonne = computed(() => (estColocation.value ? 'Ta part mensuelle' : 'Loyer mensuel'))
</script>

<template>
  <section class="editeur">
    <h1>{{ annonceId === null ? 'Nouvelle annonce' : 'Modifier mon annonce' }}</h1>

    <ChargementUi v-if="chargement" :lignes="4" />
    <AlerteUi v-else-if="erreur && annonceId !== null && !form.titre" type="erreur">{{ erreur }}</AlerteUi>

    <template v-else>
      <AlerteUi v-if="statut === 'refusee'" type="erreur">Ton annonce a été refusée. <strong>Motif :</strong> {{ motifRefus }}. Corrige-la, puis soumets-la de nouveau.</AlerteUi>
      <AlerteUi v-else-if="statut === 'publiee' && parametres.validation_annonces" type="info">
        Cette annonce est publiée. Toute modification demandera une nouvelle vérification avant d'être visible.
      </AlerteUi>
      <AlerteUi v-else-if="statut === 'en_attente'" type="info">Cette annonce est en cours de vérification ({{ LIBELLES_STATUT[statut].toLowerCase() }}).</AlerteUi>

      <ol class="etapes" aria-label="Étapes de l'annonce">
        <li v-for="(libelle, i) in ETAPES" :key="libelle" :class="{ courante: i === etape, faite: i < etape }" :aria-current="i === etape ? 'step' : undefined">
          <span class="numero">{{ i + 1 }}</span>
          <span class="libelle">{{ libelle }}</span>
        </li>
      </ol>

      <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>

      <form class="etape" novalidate @submit.prevent="suivant">
        <!-- 1. Logement et prix -->
        <template v-if="etape === 0">
          <h2>Logement et prix</h2>
          <SelecteurUi v-if="typesPossibles.length > 1" v-model="form.type" libelle="Type de logement" :options="optionsType" />
          <p v-else class="aide">Tu publies une place en colocation.</p>
          <ChampUi v-model="form.titre" libelle="Titre de l'annonce" :erreur="erreurs.titre" aide="Exemple : Chambre calme près de l'université" />
          <div class="champ">
            <label for="description">Description</label>
            <textarea id="description" v-model="form.description" rows="5" maxlength="2000" :aria-invalid="erreurs.description ? true : undefined" />
            <p v-if="erreurs.description" class="erreur" role="alert">{{ erreurs.description }}</p>
          </div>
          <ChampUi v-if="estColocation" v-model="form.nbPlaces" libelle="Nombre de places du logement (toi compris)" inputmode="numeric" :erreur="erreurs.nbPlaces" />
          <ChampUi v-model="form.partMensuelle" :libelle="`${partParPersonne} (FCFA)`" inputmode="numeric" :erreur="erreurs.partMensuelle" />
          <ChampUi v-if="estColocation" v-model="form.loyerTotal" libelle="Loyer total du logement (FCFA)" inputmode="numeric" :erreur="erreurs.loyerTotal" />
          <CaseACocher v-model="form.chargesIncluses">Les charges (eau, électricité) sont comprises dans le loyer.</CaseACocher>
          <ChampUi v-if="!form.chargesIncluses" v-model="form.montantCharges" libelle="Charges estimées par mois (FCFA, facultatif)" inputmode="numeric" :erreur="erreurs.montantCharges" />
          <SelecteurUi v-if="villes.length > 1" :model-value="villeId" libelle="Ville" :options="optionsVilles" @update:model-value="changerVille" />
          <SelecteurUi v-model="form.quartierId" libelle="Quartier" :options="optionsQuartiers" placeholder="Choisis le quartier" :erreur="erreurs.quartierId" />
          <SelecteurUi v-model="form.universiteId" libelle="Université proche (facultatif)" :options="optionsUniversites" />
          <ChampUi v-model="form.disponibleLe" libelle="Disponible à partir du (facultatif)" type="date" />
        </template>

        <!-- 2. Équipements -->
        <template v-else-if="etape === 1">
          <h2>Équipements</h2>
          <p v-if="equipements.length === 0" class="aide">Aucun équipement n'est proposé pour le moment. Tu peux passer à l'étape suivante.</p>
          <ul v-else class="equipements">
            <li v-for="e in equipements" :key="e.id">
              <CaseACocher :model-value="form.equipementIds.includes(e.id)" @update:model-value="basculerEquipement(e.id)">{{ e.nom }}</CaseACocher>
            </li>
          </ul>
        </template>

        <!-- 3. Localisation -->
        <template v-else-if="etape === 2">
          <h2>Localisation</h2>
          <SelecteurPositionAnnonce v-model:position="form.position" v-model:precision="form.precision" v-model:confirmee="positionConfirmee" :zone="zone" />
          <p v-if="erreurs.position" class="erreur" role="alert">{{ erreurs.position }}</p>
        </template>

        <!-- 4. Règles et tâches partagées -->
        <template v-else-if="etape === 3">
          <h2>Règles et tâches partagées</h2>
          <ListeReglesTaches v-model:regles="form.regles" v-model:taches="form.taches" :erreur-regles="erreurs.regles" :erreur-taches="erreurs.taches" />
        </template>

        <!-- 5. Colocataire recherché et contact -->
        <template v-else-if="etape === 4">
          <h2>Colocataire recherché et contact</h2>
          <p class="aide">Ces préférences sont seulement affichées : elles n'empêchent personne de te contacter.</p>
          <SelecteurUi v-model="form.preferenceGenre" libelle="Préférence de genre" :options="optionsGenre" />
          <div class="deux">
            <ChampUi v-model="form.ageMin" libelle="Âge minimum (facultatif)" inputmode="numeric" :erreur="erreurs.ageMin" />
            <ChampUi v-model="form.ageMax" libelle="Âge maximum (facultatif)" inputmode="numeric" :erreur="erreurs.ageMax" />
          </div>
          <CaseACocher v-model="form.etudiantsUniquement">Étudiants uniquement</CaseACocher>
          <div class="deux">
            <ChampUi v-model="form.dureeMin" libelle="Séjour minimum (mois)" inputmode="numeric" :erreur="erreurs.dureeMin" />
            <ChampUi v-model="form.dureeMax" libelle="Séjour maximum (mois)" inputmode="numeric" :erreur="erreurs.dureeMax" />
          </div>
          <h3>Comment te contacter ?</h3>
          <p class="aide">La messagerie de ColokNiamey est toujours disponible. Ton numéro n'est montré qu'aux personnes connectées, et seulement si tu le permets.</p>
          <CaseACocher v-model="form.contactWhatsapp">Autoriser le contact par WhatsApp</CaseACocher>
          <CaseACocher v-model="form.contactAppel">Autoriser l'appel téléphonique</CaseACocher>
        </template>

        <!-- 6. Photos et aperçu -->
        <template v-else>
          <h2>Photos et aperçu</h2>
          <PhotosAnnonce v-if="annonceId !== null" :annonce-id="annonceId" @change="(n) => (nbPhotos = n)" />
          <div class="apercu">
            <h3>Aperçu</h3>
            <p class="titre-apercu">{{ form.titre }}</p>
            <p>{{ LIBELLES_TYPE[form.type] }} · {{ nomQuartier }}</p>
            <p><strong>{{ formaterMontant(Number(form.partMensuelle) || 0) }} FCFA</strong> par mois<span v-if="estColocation && form.loyerTotal"> (loyer total {{ formaterMontant(Number(form.loyerTotal)) }} FCFA pour {{ form.nbPlaces }} places)</span></p>
            <p>{{ form.equipementIds.length }} équipement(s) · {{ form.regles.filter((r) => r.texte.trim()).length }} règle(s) · {{ form.taches.filter((t) => t.libelle.trim()).length }} tâche(s) · {{ nbPhotos }} photo(s)</p>
            <RouterLink v-if="annonceId !== null" :to="`/annonces/${annonceId}`" target="_blank">Voir l'annonce comme les autres la verront</RouterLink>
          </div>
          <BandeauIdentite v-if="estColocation" />
          <AlerteUi v-if="parametres.validation_annonces" type="info">Ton annonce sera vérifiée par l'équipe avant d'être visible.</AlerteUi>
        </template>

        <div class="navigation">
          <BoutonUi v-if="etape > 0" variante="secondaire" :desactive="envoi" @click="precedent">Précédent</BoutonUi>
          <BoutonUi v-if="etape < ETAPES.length - 1" type="submit" variante="principal" :chargement="envoi">Enregistrer et continuer</BoutonUi>
          <BoutonUi v-else-if="peutSoumettre" variante="principal" :chargement="envoi" @click="soumettre">Soumettre l'annonce</BoutonUi>
        </div>
        <RouterLink to="/annonces/mes-annonces" class="retour">Retour à mes annonces</RouterLink>
      </form>
    </template>
  </section>
</template>

<style scoped>
.editeur {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 40rem;
  margin: 0 auto;
  padding: var(--e4);
}
h1,
h2,
h3,
p {
  margin: 0;
}
.etapes {
  display: flex;
  gap: var(--e2);
  margin: 0;
  padding: 0 0 var(--e1);
  overflow-x: auto;
  list-style: none;
}
.etapes li {
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
  gap: var(--e1);
  align-items: center;
  min-width: 4.5rem;
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
  text-align: center;
}
.numero {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon-rond);
  background: var(--surface);
  font-weight: 700;
}
.courante {
  color: var(--encre);
  font-weight: 700;
}
.courante .numero {
  border-color: var(--indigo);
  background: var(--indigo);
  color: #fff;
}
.faite .numero {
  border-color: var(--vert);
  color: var(--vert);
}
.etape {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
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
textarea {
  padding: var(--e3);
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon-s);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
  resize: vertical;
}
.erreur {
  color: var(--erreur);
  font-size: var(--texte-s);
}
.aide {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.deux {
  display: grid;
  gap: var(--e3);
  grid-template-columns: 1fr 1fr;
}
.equipements {
  display: grid;
  gap: var(--e2);
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}
.apercu {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  padding: var(--e3);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--fond);
}
.titre-apercu {
  font-family: var(--police-titre);
  font-size: var(--texte-l);
  font-weight: 800;
}
.navigation {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
}
.retour {
  align-self: flex-start;
  color: var(--indigo);
}
</style>
