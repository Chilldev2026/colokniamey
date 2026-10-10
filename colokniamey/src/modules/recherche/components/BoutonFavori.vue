<script setup lang="ts">
// Cœur de favori d'une annonce. Un visiteur est invité à se connecter ; un compte connecté bascule tout de suite.
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CoeurFavori from '@/core/ui/CoeurFavori.vue'
import { useToasts } from '@/core/ui/useToasts'
import { useAuthStore } from '@/modules/auth'
import { useFavorisStore } from '../stores/favorisStore'

const props = defineProps<{ annonceId: number }>()

const auth = useAuthStore()
const favoris = useFavorisStore()
const router = useRouter()
const route = useRoute()
const { afficher } = useToasts()

const actif = computed(() => favoris.estFavori(props.annonceId))

onMounted(async () => {
  if (auth.estConnecte && !favoris.charge) {
    try {
      await favoris.charger()
    } catch {
      // le cœur reste vide : la base refusera de toute façon une action non autorisée
    }
  }
})

async function changer() {
  if (!auth.estConnecte) {
    afficher('Connecte-toi pour garder tes favoris.', 'info')
    await router.push({ path: '/connexion', query: { redirect: route.fullPath } })
    return
  }
  const erreur = await favoris.basculer(props.annonceId)
  if (erreur) afficher(erreur, 'erreur')
}
</script>

<template>
  <!-- Le composant du socle gère le battement ; l'action part immédiatement -->
  <CoeurFavori :model-value="actif" @update:model-value="changer" />
</template>
