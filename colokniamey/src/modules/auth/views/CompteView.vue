<script setup lang="ts">
// Espace de la personne connectée. Le profil détaillé arrive avec le module M3.
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import FormulaireAuth from '../components/FormulaireAuth.vue'
import { useAuthStore } from '../stores/authStore'
import { LIBELLES_ROLE } from '../types'

const auth = useAuthStore()
const router = useRouter()
const { afficher } = useToasts()
const erreur = ref('')
const envoi = ref(false)

async function sortir(partout: boolean) {
  erreur.value = ''
  envoi.value = true
  try {
    // RG12 : fin de la session ; RGP06 : « partout » ferme aussi les autres appareils
    if (partout) await auth.deconnecterPartout()
    else await auth.deconnecter()
    afficher(partout ? 'Tu es déconnecté de tous tes appareils.' : 'Tu es déconnecté.', 'succes')
    await router.replace('/')
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'La déconnexion a échoué. Réessaie.'
  } finally {
    envoi.value = false
  }
}
</script>

<template>
  <FormulaireAuth v-if="auth.profil" :titre="`Bonjour ${auth.profil.prenom}`" :intro="LIBELLES_ROLE[auth.profil.role]">
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <!-- Pages du module profils, atteintes par leur chemin (aucun import entre modules) -->
    <nav class="liens-compte">
      <RouterLink to="/profil">Mon profil</RouterLink>
      <RouterLink to="/profil/donnees">Mes données</RouterLink>
      <RouterLink to="/profil/securite">Mot de passe et compte</RouterLink>
    </nav>
    <div class="actions">
      <BoutonUi variante="secondaire" :chargement="envoi" pleine-largeur @click="sortir(false)">Me déconnecter</BoutonUi>
      <BoutonUi variante="danger" :chargement="envoi" pleine-largeur @click="sortir(true)">
        Me déconnecter de tous les appareils
      </BoutonUi>
    </div>
  </FormulaireAuth>
</template>

<style scoped>
.liens-compte {
  display: flex;
  flex-direction: column;
}
.liens-compte a {
  display: inline-flex;
  align-items: center;
  min-height: var(--cible-min);
}
.actions {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
}
</style>
