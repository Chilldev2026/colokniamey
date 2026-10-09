<script setup lang="ts">
// Double authentification obligatoire pour entrer dans l'espace admin (RGA04) :
// première connexion = inscription de l'appareil (QR code) ; ensuite, code redemandé à chaque connexion.
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import { accueilPourRole } from '@/core/acces'
import { useAuthStore } from '@/modules/auth'
import FormulaireTotp from '../components/FormulaireTotp.vue'
import { useAdminStore } from '../stores/adminStore'

const auth = useAuthStore()
const admin = useAdminStore()
const route = useRoute()
const router = useRouter()

const etat = ref<'chargement' | 'inscription' | 'defi' | 'erreur'>('chargement')
const facteurId = ref('')

// On ne suit que des chemins internes
function destination(): string {
  const voulue = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  return voulue.startsWith('/') && !voulue.startsWith('//') ? voulue : accueilPourRole(auth.role)
}

onMounted(async () => {
  try {
    await admin.rafraichirNiveau()
    if (admin.niveau === 'aal2') {
      await router.replace(destination())
      return
    }
    await admin.chargerFacteurs()
    const verifie = admin.facteursVerifies[0]
    if (verifie) {
      facteurId.value = verifie.id
      etat.value = 'defi'
    } else {
      etat.value = 'inscription'
    }
  } catch {
    etat.value = 'erreur'
  }
})

async function termine() {
  await admin.rafraichirNiveau()
  // Crée la ligne de session admin : possible seulement juste après la vérification du code (RGA36)
  await admin.signalerActivite(true)
  await router.replace(destination())
}

async function sortir() {
  await auth.deconnecter()
  await router.replace('/connexion')
}
</script>

<template>
  <main class="mfa">
    <h1>Double authentification</h1>
    <ChargementUi v-if="etat === 'chargement'" />
    <AlerteUi v-else-if="etat === 'erreur'" type="erreur">
      Impossible de vérifier ta double authentification. Réessaie dans un moment.
    </AlerteUi>

    <template v-else-if="etat === 'inscription'">
      <p>
        L'espace admin demande une double authentification. Configure-la maintenant : elle te sera redemandée à chaque
        connexion.
      </p>
      <FormulaireTotp libelle-bouton="Activer la double authentification" @verifie="termine" />
      <p class="astuce">Conseil : enregistre ensuite un deuxième appareil dans « Sécurité du compte », pour ne pas perdre l'accès si tu perds ton téléphone.</p>
    </template>

    <template v-else-if="etat === 'defi'">
      <p>Entre le code affiché par ton application d'authentification pour continuer.</p>
      <FormulaireTotp :facteur-id="facteurId" libelle-bouton="Continuer" @verifie="termine" />
    </template>

    <BoutonUi variante="secondaire" pleine-largeur @click="sortir">Me déconnecter</BoutonUi>
  </main>
</template>

<style scoped>
.mfa {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 28rem;
  margin: 0 auto;
  padding: var(--e8) var(--e4);
}
h1 {
  margin: 0;
  font-family: var(--police-titre);
}
p {
  margin: 0;
}
.astuce {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
</style>
