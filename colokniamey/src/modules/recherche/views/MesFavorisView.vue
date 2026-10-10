<script setup lang="ts">
// Mes favoris : les annonces gardées qui sont encore publiées. Un favori dont l'annonce a été retirée n'apparaît plus.
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import { listerQuartiers, listerVilles } from '@/modules/referentiel'
import CarteResultat from '../components/CarteResultat.vue'
import { listerMesFavoris, type ResultatAnnonce } from '../services/rechercheService'
import { useFavorisStore } from '../stores/favorisStore'

const router = useRouter()
const favoris = useFavorisStore()
const annonces = ref<ResultatAnnonce[]>([])
const quartiers = ref<Map<number, string>>(new Map())
const chargement = ref(true)
const erreur = ref('')

// Un favori retiré depuis cette page disparaît tout de suite de la liste
const visibles = computed(() => annonces.value.filter((a) => favoris.estFavori(a.id)))

onMounted(async () => {
  try {
    await favoris.charger()
    annonces.value = await listerMesFavoris()
    const noms = new Map<number, string>()
    for (const v of await listerVilles()) for (const q of await listerQuartiers(v.id)) noms.set(q.id, q.nom)
    quartiers.value = noms
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger tes favoris.'
  } finally {
    chargement.value = false
  }
})
</script>

<template>
  <section class="favoris">
    <h1>Mes favoris</h1>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-if="chargement" :lignes="3" />
    <EtatVide v-else-if="visibles.length === 0 && !erreur" message="Tu n'as pas encore de favori.">
      <p class="aide">Touche le cœur d'une annonce pour la retrouver ici.</p>
      <BoutonUi variante="principal" @click="router.push('/recherche')">Chercher un logement</BoutonUi>
    </EtatVide>
    <ul v-else class="liste">
      <li v-for="a in visibles" :key="a.id"><CarteResultat :annonce="a" :quartier="quartiers.get(a.quartierId) ?? ''" /></li>
    </ul>
  </section>
</template>

<style scoped>
.favoris {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 48rem;
  margin: 0 auto;
  padding: var(--e4);
}
h1,
p {
  margin: 0;
}
.aide {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.liste {
  display: grid;
  gap: var(--e3);
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
