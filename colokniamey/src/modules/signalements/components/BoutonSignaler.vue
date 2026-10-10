<script setup lang="ts">
// Bouton « Signaler » et formulaire modal réutilisables (RG20). Exportés par index.ts : les autres modules (annonces,
// messagerie…) les placent là où un contenu peut être signalé. Un visiteur est invité à se connecter.
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ModaleUi from '@/core/ui/ModaleUi.vue'
import SelecteurUi from '@/core/ui/SelecteurUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import { useAuthStore } from '@/modules/auth'
import { COMMENTAIRE_MAX, LIBELLES_MOTIF, signaler, type CibleSignalement, type MotifSignalement } from '../services/signalementsService'

const props = withDefaults(defineProps<{ cible: CibleSignalement; cibleId: string; libelle?: string }>(), { libelle: 'Signaler' })

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { afficher } = useToasts()

const ouverte = ref(false)
const motif = ref<MotifSignalement | ''>('')
const commentaire = ref('')
const erreur = ref('')
const envoi = ref(false)

const options = Object.entries(LIBELLES_MOTIF).map(([valeur, libelle]) => ({ valeur, libelle }))

async function ouvrir() {
  if (!auth.estConnecte) {
    afficher('Connecte-toi pour signaler un contenu.', 'info')
    await router.push({ path: '/connexion', query: { redirect: route.fullPath } })
    return
  }
  erreur.value = ''
  motif.value = ''
  commentaire.value = ''
  ouverte.value = true
}

async function envoyer() {
  if (motif.value === '') {
    erreur.value = 'Choisis la raison du signalement.'
    return
  }
  erreur.value = ''
  envoi.value = true
  try {
    await signaler(props.cible, props.cibleId, motif.value, commentaire.value)
    ouverte.value = false
    afficher('Merci. Ton signalement a été envoyé à l\'équipe.', 'succes')
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Le signalement n\'a pas pu être envoyé.'
  } finally {
    envoi.value = false
  }
}
</script>

<template>
  <button type="button" class="signaler" @click="ouvrir">{{ libelle }}</button>
  <ModaleUi v-model="ouverte" titre="Signaler ce contenu">
    <form class="formulaire" novalidate @submit.prevent="envoyer">
      <SelecteurUi v-model="motif" libelle="Raison" :options="options" placeholder="Choisis une raison" />
      <div class="champ">
        <label for="commentaire-signalement">Précisions (facultatif)</label>
        <textarea id="commentaire-signalement" v-model="commentaire" rows="3" :maxlength="COMMENTAIRE_MAX" />
      </div>
      <p class="aide">Ton signalement est lu par l'équipe seulement. La personne signalée n'est pas prévenue.</p>
      <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
      <div class="boutons">
        <BoutonUi type="submit" variante="principal" :chargement="envoi">Envoyer le signalement</BoutonUi>
        <BoutonUi variante="secondaire" @click="ouverte = false">Annuler</BoutonUi>
      </div>
    </form>
  </ModaleUi>
</template>

<style scoped>
.signaler {
  min-height: var(--cible-min);
  padding: 0 var(--e3);
  border: 0;
  background: none;
  color: var(--texte-secondaire);
  font: inherit;
  font-size: var(--texte-s);
  text-decoration: underline;
  cursor: pointer;
}
.formulaire {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
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
.aide {
  margin: 0;
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.boutons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
}
</style>
