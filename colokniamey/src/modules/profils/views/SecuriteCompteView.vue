<script setup lang="ts">
// Changement de mot de passe et désactivation du compte (RGA09).
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import ModaleUi from '@/core/ui/ModaleUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import { changerMotDePasse, useAuthStore, validerMotDePasse } from '@/modules/auth'
import { useProfilStore } from '../stores/profilStore'

const auth = useAuthStore()
const store = useProfilStore()
const router = useRouter()
const { afficher } = useToasts()

const motDePasse = ref('')
const confirmation = ref('')
const erreurs = ref<{ motDePasse?: string; confirmation?: string }>({})
const erreurMdp = ref('')
const envoiMdp = ref(false)

const modaleOuverte = ref(false)
const erreurSuppression = ref('')
const envoiSuppression = ref(false)
// Un compte admin se gère depuis l'espace d'administration (RGA03)
const peutDesactiver = computed(() => auth.role === 'etudiant' || auth.role === 'proprietaire')

async function changer() {
  erreurMdp.value = ''
  erreurs.value = {}
  const probleme = validerMotDePasse(motDePasse.value, auth.session?.user.email ?? '')
  if (probleme) erreurs.value.motDePasse = probleme
  if (motDePasse.value !== confirmation.value) erreurs.value.confirmation = 'Les deux mots de passe sont différents.'
  if (Object.keys(erreurs.value).length > 0) return

  envoiMdp.value = true
  try {
    await changerMotDePasse(motDePasse.value)
    motDePasse.value = ''
    confirmation.value = ''
    afficher('Mot de passe modifié.', 'succes')
  } catch (e) {
    erreurMdp.value = e instanceof Error ? e.message : 'Réessaie dans un moment.'
  } finally {
    envoiMdp.value = false
  }
}

async function desactiver() {
  erreurSuppression.value = ''
  envoiSuppression.value = true
  try {
    await store.desactiver()
    modaleOuverte.value = false
    afficher('Ton compte est désactivé. Au revoir.', 'info')
    await router.replace('/')
  } catch (e) {
    erreurSuppression.value = e instanceof Error ? e.message : 'Réessaie dans un moment.'
  } finally {
    envoiSuppression.value = false
  }
}
</script>

<template>
  <section class="securite">
    <h1>Mot de passe et compte</h1>

    <form class="bloc" novalidate @submit.prevent="changer">
      <h2>Changer mon mot de passe</h2>
      <ChampUi
        v-model="motDePasse"
        libelle="Nouveau mot de passe"
        type="password"
        autocomplete="new-password"
        aide="8 caractères au moins."
        :erreur="erreurs.motDePasse"
        requis
      />
      <ChampUi
        v-model="confirmation"
        libelle="Confirme le mot de passe"
        type="password"
        autocomplete="new-password"
        :erreur="erreurs.confirmation"
        requis
      />
      <AlerteUi v-if="erreurMdp" type="erreur">{{ erreurMdp }}</AlerteUi>
      <BoutonUi type="submit" variante="principal" :chargement="envoiMdp" pleine-largeur>Changer le mot de passe</BoutonUi>
    </form>

    <div v-if="peutDesactiver" class="bloc">
      <h2>Désactiver mon compte</h2>
      <p>
        Ton compte sera désactivé et tes informations personnelles effacées ou anonymisées : nom, téléphone, adresse e-mail,
        profil et notifications. Cette action est définitive et tu ne pourras plus te connecter.
      </p>
      <BoutonUi variante="danger" pleine-largeur @click="modaleOuverte = true">Désactiver mon compte</BoutonUi>
    </div>

    <ModaleUi v-model="modaleOuverte" titre="Désactiver ton compte ?">
      <p>
        Tes informations seront anonymisées et tu seras déconnecté sur tous tes appareils. Les photos que tu as envoyées
        et les contenus déjà publiés pourront être retirés par l'équipe. Il n'y a pas de retour en arrière.
      </p>
      <AlerteUi v-if="erreurSuppression" type="erreur">{{ erreurSuppression }}</AlerteUi>
      <template #actions>
        <BoutonUi variante="secondaire" @click="modaleOuverte = false">Annuler</BoutonUi>
        <BoutonUi variante="danger" :chargement="envoiSuppression" @click="desactiver">Oui, désactiver</BoutonUi>
      </template>
    </ModaleUi>

    <RouterLink to="/profil">Retour à mon profil</RouterLink>
  </section>
</template>

<style scoped>
.securite {
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
.bloc {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
.bloc p {
  margin: 0;
}
a {
  display: inline-flex;
  align-items: center;
  min-height: var(--cible-min);
}
</style>
