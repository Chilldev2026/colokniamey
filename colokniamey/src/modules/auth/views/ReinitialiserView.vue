<script setup lang="ts">
// Page d'arrivée du lien reçu par e-mail : Supabase ouvre une session de récupération,
// qui ne sert qu'à choisir un nouveau mot de passe.
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import FormulaireAuth from '../components/FormulaireAuth.vue'
import { useAuthStore } from '../stores/authStore'
import { validerMotDePasse } from '../validation'

const auth = useAuthStore()
const router = useRouter()
const { afficher } = useToasts()

const motDePasse = ref('')
const confirmation = ref('')
const erreurs = ref<{ motDePasse?: string; confirmation?: string }>({})
const erreur = ref('')
const envoi = ref(false)

async function envoyer() {
  erreur.value = ''
  erreurs.value = {}
  const probleme = validerMotDePasse(motDePasse.value, auth.session?.user.email ?? '')
  if (probleme) erreurs.value.motDePasse = probleme
  if (motDePasse.value !== confirmation.value) erreurs.value.confirmation = 'Les deux mots de passe sont différents.'
  if (Object.keys(erreurs.value).length > 0) return

  envoi.value = true
  try {
    await auth.changerMotDePasse(motDePasse.value)
    afficher('Mot de passe modifié. Connecte-toi avec le nouveau.', 'succes')
    await router.replace('/connexion')
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Réessaie dans un moment.'
  } finally {
    envoi.value = false
  }
}
</script>

<template>
  <FormulaireAuth titre="Nouveau mot de passe">
    <AlerteUi v-if="!auth.session" type="erreur">
      Ce lien n'est plus valide. Demande un nouveau lien de réinitialisation.
    </AlerteUi>
    <form v-else class="formulaire" novalidate @submit.prevent="envoyer">
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
      <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
      <BoutonUi type="submit" variante="principal" :chargement="envoi" pleine-largeur>Enregistrer</BoutonUi>
    </form>
    <template #liens>
      <RouterLink v-if="!auth.session" to="/mot-de-passe-oublie">Demander un nouveau lien</RouterLink>
    </template>
  </FormulaireAuth>
</template>

<style scoped>
.formulaire {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
</style>
