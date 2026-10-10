<script setup lang="ts">
// Mes signalements : leur statut. La décision détaillée et le nom de l'admin ne sont pas communiqués.
import { onMounted, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import { LIBELLES_CIBLE, LIBELLES_MOTIF, LIBELLES_STATUT, listerMesSignalements, type MonSignalement } from '../services/signalementsService'

const signalements = ref<MonSignalement[]>([])
const chargement = ref(true)
const erreur = ref('')

onMounted(async () => {
  try {
    signalements.value = await listerMesSignalements()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger tes signalements.'
  } finally {
    chargement.value = false
  }
})

function date(valeur: string): string {
  return new Date(valeur).toLocaleDateString('fr-FR')
}
</script>

<template>
  <section class="signalements">
    <h1>Mes signalements</h1>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-if="chargement" :lignes="3" />
    <EtatVide v-else-if="signalements.length === 0 && !erreur" message="Tu n'as fait aucun signalement.">
      <p class="aide">Tu peux signaler une annonce, un profil ou un message qui te semble suspect.</p>
    </EtatVide>
    <ul v-else class="liste">
      <li v-for="s in signalements" :key="s.id" class="ligne">
        <div class="entete">
          <strong>{{ LIBELLES_CIBLE[s.cible] }} : {{ LIBELLES_MOTIF[s.motif] }}</strong>
          <PuceUi :variante="s.statut === 'traite' ? 'validee' : s.statut === 'rejete' ? 'neutre' : 'info'">{{ LIBELLES_STATUT[s.statut] }}</PuceUi>
        </div>
        <p v-if="s.commentaire" class="commentaire">{{ s.commentaire }}</p>
        <p class="aide">Envoyé le {{ date(s.creeLe) }}</p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.signalements {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 40rem;
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
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.ligne {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.entete {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
  align-items: center;
  justify-content: space-between;
}
</style>
