<script setup lang="ts">
// Parcours « Vérifier mon identité » (RG51 à RG56), en 4 étapes d'après la maquette « Vérification de docs » :
// 1. photo de profil validée, 2. pièce d'identité (recto et verso) après consentement, 3. selfie en direct, 4. envoi.
// Quand le KYC est désactivé (RG59), l'écran n'a rien à montrer et aucune image n'est collectée.
import { computed, onMounted, ref } from 'vue'
import { parametres } from '@/core/parametres'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import CaseACocher from '@/core/ui/CaseACocher.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import RadioCarte from '@/core/ui/RadioCarte.vue'
import { useToasts } from '@/core/ui/useToasts'
import { EnvoiPhoto, type PhotoTraitee } from '@/modules/securite'
import SelfieDirect from '../components/SelfieDirect.vue'
import {
  annulerDossier,
  commencerDossier,
  deposerImage,
  lireAvatarPourKyc,
  lireMonKyc,
  soumettreDossier,
} from '../services/identiteService'
import { ETAPES_KYC, etapeCourante, LIBELLES_PIECE, type EtapeKyc, type EtatAvatarKyc, type EtatKyc, type ImageKyc, type TypePiece } from '../types'

const { afficher } = useToasts()
const chargement = ref(true)
const occupe = ref(false)
const erreur = ref('')
const etat = ref<EtatKyc | null>(null)
const avatar = ref<EtatAvatarKyc>({ valide: false, enAttente: false, refusee: false, motif: null })
const etape = ref<EtapeKyc>('photo')
const consentement = ref(false)
const typePiece = ref<TypePiece>('cni')
// Dossier en cours : l'identifiant sert au dépôt des images
const dossierId = ref<string | null>(null)

const indexEtape = computed(() => ETAPES_KYC.findIndex((e) => e.id === etape.value))
const pretPourEnvoi = computed(() => !!etat.value && etat.value.recto && etat.value.verso && etat.value.selfie)

async function charger() {
  erreur.value = ''
  try {
    const [kyc, photo] = await Promise.all([lireMonKyc(), lireAvatarPourKyc()])
    etat.value = kyc
    avatar.value = photo
    dossierId.value = kyc.statut === 'non_soumis' ? kyc.verificationId : null
    consentement.value = kyc.consentement
    if (kyc.typePiece) typePiece.value = kyc.typePiece
    etape.value = etapeCourante(kyc, photo)
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger ton dossier.'
  } finally {
    chargement.value = false
  }
}
onMounted(() => {
  // RG59 : KYC désactivé = aucun appel, rien à montrer
  if (parametres.value.kyc_actif) void charger()
  else chargement.value = false
})

async function agir(travail: () => Promise<void>) {
  erreur.value = ''
  occupe.value = true
  try {
    await travail()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Une erreur est survenue.'
  } finally {
    occupe.value = false
  }
}

// Étape 2 : le consentement précède tout dépôt (RG53)
function accepter() {
  void agir(async () => {
    dossierId.value = await commencerDossier()
    await charger()
  })
}

function deposer(type: ImageKyc, photo: PhotoTraitee) {
  void agir(async () => {
    if (!dossierId.value) throw new Error('Commence par accepter le traitement de ton dossier.')
    await deposerImage(dossierId.value, type, photo.blob, photo.empreinte)
    await charger()
  })
}

function envoyer() {
  void agir(async () => {
    await soumettreDossier(typePiece.value)
    afficher('Dossier envoyé. Tu seras prévenu de la décision.', 'succes')
    await charger()
  })
}

function annuler() {
  void agir(async () => {
    await annulerDossier()
    afficher('Dossier annulé. Tes images ont été effacées.', 'succes')
    consentement.value = false
    await charger()
  })
}

function nouveauDossier() {
  void agir(async () => {
    dossierId.value = await commencerDossier()
    await charger()
  })
}

function date(valeur: string | null): string {
  return valeur ? new Date(valeur).toLocaleDateString('fr-FR') : ''
}
</script>

<template>
  <section class="identite">
    <h1>Vérifier mon identité</h1>

    <AlerteUi v-if="!parametres.kyc_actif" type="info">
      La vérification d'identité n'est pas demandée pour le moment. Tu n'as rien à faire.
    </AlerteUi>

    <ChargementUi v-else-if="chargement" :lignes="4" />

    <template v-else-if="etat">
      <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>

      <!-- Identité vérifiée -->
      <AlerteUi v-if="etat.verifiee" type="succes">
        Ton identité est vérifiée. Le badge « Identité vérifiée » s'affiche sur ton profil.
      </AlerteUi>

      <!-- En attente de décision -->
      <template v-else-if="etat.statut === 'en_attente'">
        <AlerteUi type="info">Ton dossier est en cours d'examen. Tu recevras une notification dès qu'une décision est prise.</AlerteUi>
        <p class="aide">Tu peux annuler ton dossier : tes images seront effacées tout de suite.</p>
        <BoutonUi variante="secondaire" :chargement="occupe" @click="annuler">Annuler mon dossier</BoutonUi>
      </template>

      <!-- Refusé -->
      <template v-else-if="etat.statut === 'refuse'">
        <AlerteUi type="erreur">
          Ton dossier a été refusé<span v-if="etat.decideLe"> le {{ date(etat.decideLe) }}</span>.
          <strong>Motif :</strong> {{ etat.motifRefus }}
        </AlerteUi>
        <p class="aide">Il te reste {{ etat.dossiersRestants }} dossier(s) possible(s) sur 30 jours.</p>
        <BoutonUi v-if="etat.dossiersRestants > 0" variante="principal" :chargement="occupe" @click="nouveauDossier">
          Envoyer un nouveau dossier
        </BoutonUi>
      </template>

      <!-- Validé mais nom, prénom ou photo modifiés depuis (RG57) -->
      <template v-else-if="etat.statut === 'valide'">
        <AlerteUi type="info">
          Ton identité n'est plus vérifiée, car ton nom, ton prénom ou ta photo de profil a changé depuis la dernière vérification.
          Envoie un nouveau dossier.
        </AlerteUi>
        <BoutonUi v-if="etat.dossiersRestants > 0" variante="principal" :chargement="occupe" @click="nouveauDossier">
          Envoyer un nouveau dossier
        </BoutonUi>
        <p v-else class="aide">Tu as déjà déposé trois dossiers ces 30 derniers jours. Réessaie plus tard.</p>
      </template>

      <!-- Préparation du dossier : les 4 étapes -->
      <template v-else>
        <ol class="etapes" aria-label="Étapes">
          <li v-for="(e, i) in ETAPES_KYC" :key="e.id" :class="{ courante: e.id === etape, faite: i < indexEtape }">
            <span class="numero">{{ i + 1 }}</span>
            <span class="libelle">{{ e.libelle }}</span>
          </li>
        </ol>

        <!-- 1. Photo de profil (RG51) -->
        <div v-if="etape === 'photo'" class="bloc">
          <h2>1. Ta photo de profil</h2>
          <AlerteUi v-if="avatar.enAttente" type="info">
            Ta photo de profil est en cours de validation. Reviens ici dès qu'elle est validée.
          </AlerteUi>
          <template v-else>
            <p>Ton visage doit être visible, de face, sans filtre. Une équipe la valide avant la vérification.</p>
            <AlerteUi v-if="avatar.refusee" type="erreur">Ta dernière photo a été refusée : {{ avatar.motif }}</AlerteUi>
            <RouterLink class="lien-action" to="/profil">Ajouter ma photo de profil</RouterLink>
          </template>
          <BoutonUi variante="secondaire" :chargement="occupe" @click="charger">J'ai terminé, actualiser</BoutonUi>
        </div>

        <!-- 2. Pièce d'identité (RG53) -->
        <div v-else-if="etape === 'piece'" class="bloc">
          <h2>2. Ta pièce d'identité</h2>
          <template v-if="!etat.consentement">
            <p>
              Pour vérifier que tu es bien celui ou celle que tu dis être, un membre de l'équipe regardera ta pièce d'identité et un selfie.
            </p>
            <ul class="promesses">
              <li>Les images sont chiffrées et visibles seulement par l'équipe de vérification ; chaque consultation est enregistrée.</li>
              <li>Nous n'enregistrons ni le numéro de ta pièce ni ta date de naissance.</li>
              <li>Les images sont effacées 30 jours après la décision. Seul le badge « Identité vérifiée » est public.</li>
              <li>Tu peux annuler à tout moment : tes images sont alors effacées tout de suite.</li>
            </ul>
            <CaseACocher v-model="consentement">J'accepte que mes images soient traitées pour vérifier mon identité.</CaseACocher>
            <BoutonUi variante="principal" :desactive="!consentement" :chargement="occupe" @click="accepter">Accepter et continuer</BoutonUi>
          </template>
          <template v-else>
            <fieldset class="types">
              <legend>Type de pièce</legend>
              <RadioCarte v-model="typePiece" nom="piece" valeur="cni" :libelle="LIBELLES_PIECE.cni" />
              <RadioCarte v-model="typePiece" nom="piece" valeur="passeport" :libelle="LIBELLES_PIECE.passeport" />
            </fieldset>
            <p class="aide">Pièce en cours de validité, photographiée à plat, bien éclairée, texte lisible.</p>
            <div class="face">
              <p><strong>Recto</strong> <span v-if="etat.recto" class="ok">envoyé</span></p>
              <EnvoiPhoto usage="avatar" mode="traiter" :libelle="etat.recto ? 'Remplacer le recto' : 'Photographier le recto'" :cote-max="1600" @traitee="(p) => deposer('recto', p)" />
            </div>
            <div class="face">
              <p><strong>Verso</strong> <span v-if="etat.verso" class="ok">envoyé</span></p>
              <EnvoiPhoto usage="avatar" mode="traiter" :libelle="etat.verso ? 'Remplacer le verso' : 'Photographier le verso'" :cote-max="1600" @traitee="(p) => deposer('verso', p)" />
            </div>
            <BoutonUi variante="principal" :desactive="!(etat.recto && etat.verso)" @click="etape = 'selfie'">Continuer</BoutonUi>
          </template>
        </div>

        <!-- 3. Selfie en direct (RG53) -->
        <div v-else-if="etape === 'selfie'" class="bloc">
          <h2>3. Ton selfie</h2>
          <SelfieDirect v-if="etat.codeSelfie" :code="etat.codeSelfie" @prise="(p) => deposer('selfie', p)" />
        </div>

        <!-- 4. Envoi -->
        <div v-else class="bloc">
          <h2>4. Envoi du dossier</h2>
          <ul class="recap">
            <li>Photo de profil : validée</li>
            <li>Pièce d'identité : {{ LIBELLES_PIECE[typePiece] }}, recto et verso envoyés</li>
            <li>Selfie avec le code : envoyé</li>
          </ul>
          <div class="boutons">
            <BoutonUi variante="principal" :desactive="!pretPourEnvoi" :chargement="occupe" @click="envoyer">Envoyer mon dossier</BoutonUi>
            <BoutonUi variante="secondaire" :chargement="occupe" @click="annuler">Annuler et effacer mes images</BoutonUi>
          </div>
        </div>

        <BoutonUi v-if="etat.consentement && etape !== 'envoi'" variante="secondaire" :chargement="occupe" @click="annuler">
          Annuler et effacer mes images
        </BoutonUi>
      </template>
    </template>
  </section>
</template>

<style scoped>
.identite {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 34rem;
  margin: 0 auto;
  padding: var(--e4);
}
h1,
h2,
p {
  margin: 0;
}
.etapes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--e2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.etapes li {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
  align-items: center;
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
.courante .numero {
  border-color: var(--indigo);
  background: var(--indigo);
  color: #fff;
}
.courante {
  color: var(--encre);
  font-weight: 700;
}
.faite .numero {
  border-color: var(--vert);
  color: var(--vert);
}
.bloc {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.promesses,
.recap {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  margin: 0;
  padding-left: var(--e5);
}
.types {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  margin: 0;
  padding: 0;
  border: 0;
}
.types legend {
  margin-bottom: var(--e2);
  font-weight: 700;
}
.face {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
}
.ok {
  color: var(--vert);
  font-weight: 700;
}
.aide {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.boutons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
}
.lien-action {
  align-self: flex-start;
  color: var(--indigo);
  font-weight: 700;
}
</style>
