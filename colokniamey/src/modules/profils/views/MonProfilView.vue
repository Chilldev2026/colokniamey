<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import SelecteurUi from '@/core/ui/SelecteurUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import { LIBELLES_ROLE } from '@/modules/auth'
import { SelecteurUniversite } from '@/modules/referentiel'
import { EnvoiPhoto } from '@/modules/securite'
import AvatarProfil from '../components/AvatarProfil.vue'
import { useProfilStore } from '../stores/profilStore'
import { LIBELLES_STATUT, type DonneesProfil } from '../types'
import { validerProfil, type ErreursProfil } from '../validation'

const store = useProfilStore()
const { afficher } = useToasts()

const donnees = reactive<DonneesProfil>({
  nom: '', prenom: '', telephone: '', universiteId: '', niveauEtude: '', filiere: '', budgetMax: '',
  bio: '', typeProprietaire: 'particulier', adresse: '', profession: '', centresInteret: '',
})
const erreurs = ref<ErreursProfil>({})
const erreur = ref('')
const envoi = ref(false)

const estEtudiant = computed(() => store.profil?.role === 'etudiant')
const estProprietaire = computed(() => store.profil?.role === 'proprietaire')
// RG51 : la photo de profil est obligatoire pour les étudiants
const avatarManquant = computed(() => estEtudiant.value && store.avatar.cheminValide === null)

function remplir() {
  const p = store.profil
  if (!p) return
  donnees.nom = p.nom
  donnees.prenom = p.prenom
  donnees.telephone = p.telephone
  donnees.universiteId = p.etudiant?.universiteId ?? ''
  donnees.niveauEtude = p.etudiant?.niveauEtude ?? ''
  donnees.filiere = p.etudiant?.filiere ?? ''
  donnees.budgetMax = p.etudiant?.budgetMax ?? ''
  donnees.bio = p.etudiant?.bio ?? ''
  donnees.typeProprietaire = p.proprietaire?.typeProprietaire ?? 'particulier'
  donnees.adresse = p.proprietaire?.adresse ?? ''
  donnees.profession = p.profession
  donnees.centresInteret = p.centresInteret.join(', ')
}

onMounted(async () => {
  try {
    await store.charger()
    remplir()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger ton profil.'
  }
})
// Le formulaire reste à jour si le profil est rechargé (après un enregistrement)
watch(() => store.profil, remplir)

function choisirType(valeur: string) {
  donnees.typeProprietaire = valeur === 'agence' ? 'agence' : 'particulier'
}

async function enregistrer() {
  erreur.value = ''
  if (!store.profil) return
  erreurs.value = validerProfil(donnees, store.profil.role)
  if (Object.keys(erreurs.value).length > 0) return
  envoi.value = true
  try {
    await store.enregistrer(donnees)
    afficher('Profil enregistré.', 'succes')
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Enregistrement impossible.'
  } finally {
    envoi.value = false
  }
}
</script>

<template>
  <section class="profil">
    <h1>Mon profil</h1>
    <ChargementUi v-if="store.chargement && !store.profil" />
    <AlerteUi v-else-if="!store.profil && erreur" type="erreur">{{ erreur }}</AlerteUi>

    <template v-else-if="store.profil">
      <div class="entete">
        <AvatarProfil :prenom="store.profil.prenom" :chemin="store.avatar.cheminValide" :taille="72" />
        <div>
          <p class="nom">{{ store.profil.prenom }} {{ store.profil.nom }}</p>
          <p class="meta">
            <PuceUi variante="info">{{ LIBELLES_ROLE[store.profil.role] }}</PuceUi>
            <PuceUi :variante="store.profil.statut === 'actif' ? 'validee' : 'neutre'">{{ LIBELLES_STATUT[store.profil.statut] }}</PuceUi>
          </p>
        </div>
      </div>

      <!-- Photo de profil (RG49, RG51) -->
      <div class="bloc">
        <h2>Photo de profil</h2>
        <AlerteUi v-if="avatarManquant && store.avatar.statut === null" type="info">
          La photo de profil est obligatoire pour les étudiants : elle rassure les futurs colocataires.
        </AlerteUi>
        <AlerteUi v-if="store.avatar.statut === 'en_attente'" type="info">
          Ta photo est en attente de validation par l'équipe. Elle sera visible ensuite.
        </AlerteUi>
        <AlerteUi v-if="store.avatar.statut === 'refusee'" type="erreur">
          Ta dernière photo a été refusée<template v-if="store.avatar.motif"> : {{ store.avatar.motif }}</template>.
          Envoie-en une autre.
        </AlerteUi>
        <p class="consigne">
          Consigne : ton visage doit être visible, de face, sans filtre ni lunettes de soleil, et tu dois être seul(e) sur la photo.
        </p>
        <EnvoiPhoto usage="avatar" :cote-max="512" libelle="Choisir ma photo" @envoyee="store.chargerAvatar()" />
      </div>

      <form class="formulaire" novalidate @submit.prevent="enregistrer">
        <h2>Mes informations</h2>
        <ChampUi v-model="donnees.prenom" libelle="Prénom" autocomplete="given-name" :erreur="erreurs.prenom" requis />
        <ChampUi v-model="donnees.nom" libelle="Nom" autocomplete="family-name" :erreur="erreurs.nom" requis />
        <ChampUi
          v-model="donnees.telephone"
          libelle="Téléphone"
          type="tel"
          autocomplete="tel"
          aide="Visible seulement par les personnes à qui tu choisis de répondre."
          :erreur="erreurs.telephone"
          requis
        />

        <template v-if="estEtudiant">
          <SelecteurUniversite v-model="donnees.universiteId" :erreur="erreurs.universiteId" />
          <ChampUi v-model="donnees.niveauEtude" libelle="Niveau d'études" :erreur="erreurs.niveauEtude" />
          <ChampUi v-model="donnees.filiere" libelle="Filière" :erreur="erreurs.filiere" />
          <ChampUi
            v-model="donnees.budgetMax"
            libelle="Budget maximum par mois (FCFA)"
            type="number"
            :erreur="erreurs.budgetMax"
          />
          <div class="champ-bio">
            <label for="bio">Présente-toi en quelques mots</label>
            <textarea id="bio" v-model="donnees.bio" rows="4" maxlength="500" />
            <p v-if="erreurs.bio" class="erreur" role="alert">{{ erreurs.bio }}</p>
          </div>
        </template>

        <template v-if="estProprietaire">
          <SelecteurUi
            :model-value="donnees.typeProprietaire"
            libelle="Type de propriétaire"
            :options="[
              { valeur: 'particulier', libelle: 'Particulier' },
              { valeur: 'agence', libelle: 'Agence' },
            ]"
            @update:model-value="choisirType"
          />
          <ChampUi v-model="donnees.adresse" libelle="Adresse" :erreur="erreurs.adresse" />
        </template>

        <ChampUi
          v-model="donnees.profession"
          libelle="Profession (facultatif)"
          aide="Affichée sur la carte de tes annonces."
          :erreur="erreurs.profession"
        />
        <ChampUi
          v-model="donnees.centresInteret"
          libelle="Centres d'intérêt (facultatif)"
          aide="5 au plus, séparés par des virgules."
          :erreur="erreurs.centresInteret"
        />

        <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
        <BoutonUi type="submit" variante="principal" :chargement="envoi" pleine-largeur>Enregistrer</BoutonUi>
      </form>

      <nav class="liens">
        <RouterLink to="/profil/securite">Mot de passe et suppression du compte</RouterLink>
        <RouterLink to="/profil/donnees">Mes données</RouterLink>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.profil {
  display: flex;
  flex-direction: column;
  gap: var(--e5);
  max-width: 32rem;
  margin: 0 auto;
}
h1,
h2 {
  margin: 0;
  font-family: var(--police-titre);
}
h2 {
  font-size: var(--texte-l);
}
.entete {
  display: flex;
  gap: var(--e4);
  align-items: center;
}
.nom {
  margin: 0 0 var(--e1);
  font-family: var(--police-titre);
  font-size: var(--texte-l);
  font-weight: 800;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
  margin: 0;
}
.bloc,
.formulaire {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
.consigne {
  margin: 0;
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.champ-bio {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
}
.champ-bio label {
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
.erreur {
  margin: 0;
  color: var(--erreur);
  font-size: var(--texte-s);
}
.liens {
  display: flex;
  flex-direction: column;
}
.liens a {
  display: inline-flex;
  align-items: center;
  min-height: var(--cible-min);
}
</style>
