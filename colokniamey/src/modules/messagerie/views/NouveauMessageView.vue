<script setup lang="ts">
// Premier message à l'auteur d'une annonce publiée (RG19). Si une conversation existe déjà pour cette annonce,
// on y retourne directement. La messagerie interne est toujours disponible ; WhatsApp et l'appel restent sur l'annonce (RG32).
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import { lireAnnonceDetail } from '@/modules/annonces'
import { useAuthStore } from '@/modules/auth'
import { conversationDeLAnnonce, demarrerConversation, LONGUEUR_MAX } from '../services/messagerieService'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const annonceId = Number(route.params.annonceId)

const titre = ref('')
const texte = ref('')
const chargement = ref(true)
const envoi = ref(false)
const erreur = ref('')

onMounted(async () => {
  try {
    const existante = await conversationDeLAnnonce(annonceId)
    if (existante !== null) {
      await router.replace(`/messages/${existante}`)
      return
    }
    const a = await lireAnnonceDetail(annonceId)
    if (!a || a.statut !== 'publiee') {
      erreur.value = 'Cette annonce n\'est plus disponible.'
      return
    }
    if (a.auteurId === auth.profil?.id) {
      erreur.value = 'C\'est ton annonce : tu ne peux pas t\'écrire à toi-même.'
      return
    }
    titre.value = a.titre
    texte.value = `Bonjour, ton annonce « ${a.titre} » m'intéresse. Est-elle toujours disponible ?`
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger l\'annonce.'
  } finally {
    chargement.value = false
  }
})

async function envoyer() {
  erreur.value = ''
  envoi.value = true
  try {
    const id = await demarrerConversation(annonceId, texte.value)
    await router.replace(`/messages/${id}`)
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Le message n\'a pas pu être envoyé.'
  } finally {
    envoi.value = false
  }
}
</script>

<template>
  <section class="nouveau">
    <h1>Écrire à l'annonceur</h1>
    <ChargementUi v-if="chargement" :lignes="3" />
    <template v-else>
      <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
      <form v-if="titre" class="formulaire" @submit.prevent="envoyer">
        <p class="annonce">À propos de : <strong>{{ titre }}</strong></p>
        <label for="premier">Ton message</label>
        <textarea id="premier" v-model="texte" rows="5" :maxlength="LONGUEUR_MAX" />
        <p class="aide">Ton numéro de téléphone n'est pas partagé. Ne donne jamais d'argent avant d'avoir visité le logement.</p>
        <BoutonUi type="submit" variante="principal" :chargement="envoi" :desactive="texte.trim() === ''">Envoyer le message</BoutonUi>
      </form>
      <RouterLink :to="`/annonces/${annonceId}`">Retour à l'annonce</RouterLink>
    </template>
  </section>
</template>

<style scoped>
.nouveau {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 36rem;
  margin: 0 auto;
  padding: var(--e4);
}
h1,
p {
  margin: 0;
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
label {
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
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
</style>
