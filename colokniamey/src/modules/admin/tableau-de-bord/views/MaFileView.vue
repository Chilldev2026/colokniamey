<script setup lang="ts">
// Accueil de l'admin : « Ma file de travail » (A1, RGA26) : ce qui attend une décision, l'ancienneté de la plus vieille
// demande, la prochaine annonce à valider, la courbe des demandes reçues et traitées et la répartition de la file.
// stats_moderation est ouverte à tout admin ; aucune statistique de la plateforme entière n'est montrée ici (RGA27).
import { computed, onMounted, ref } from 'vue'
import { parametres } from '@/core/parametres'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import CarteStatistique from '@/core/ui/graphiques/CarteStatistique.vue'
import GraphiqueCirculaire from '@/core/ui/graphiques/GraphiqueCirculaire.vue'
import GraphiqueCourbe from '@/core/ui/graphiques/GraphiqueCourbe.vue'
import { anciennete, libelleJour, lireStatsModeration, PERIODES, type Periode, type StatsModeration } from '../services/statsService'

const periode = ref<Periode>(30)
const stats = ref<StatsModeration | null>(null)
const chargement = ref(true)
const erreur = ref('')

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    stats.value = await lireStatsModeration(periode.value)
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger ta file de travail.'
  } finally {
    chargement.value = false
  }
}
onMounted(charger)

function changerPeriode(p: Periode) {
  periode.value = p
  void charger()
}

const total = computed(() => {
  const s = stats.value
  return s ? s.annoncesEnAttente + s.photosEnAttente + s.contenusEnAttente + s.signalementsNouveaux + (parametres.value.kyc_actif ? s.identitesEnAttente : 0) : 0
})
// La plus vieille demande, toutes files confondues
const plusAncienne = computed(() => {
  const s = stats.value
  if (!s) return null
  const dates = [s.annonceLaPlusAncienne, s.photoLaPlusAncienne, s.signalementLePlusAncien].filter((d): d is string => d !== null)
  return dates.sort()[0] ?? null
})
const parts = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    { libelle: 'Annonces', valeur: s.annoncesEnAttente },
    { libelle: 'Photos', valeur: s.photosEnAttente },
    { libelle: 'Contenus', valeur: s.contenusEnAttente },
    { libelle: 'Signalements', valeur: s.signalementsNouveaux },
    ...(parametres.value.kyc_actif ? [{ libelle: 'Identités', valeur: s.identitesEnAttente }] : []),
  ].filter((p) => p.valeur > 0)
})
</script>

<template>
  <section class="file">
    <header>
      <h1>Ma file de travail</h1>
      <div class="periodes" role="group" aria-label="Période">
        <BoutonUi v-for="p in PERIODES" :key="p" :variante="periode === p ? 'principal' : 'secondaire'" :aria-pressed="periode === p" @click="changerPeriode(p)">
          {{ p }} jours
        </BoutonUi>
      </div>
    </header>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-if="chargement" :lignes="4" />

    <template v-else-if="stats">
      <AlerteUi v-if="total === 0" type="succes">Rien n'attend ta décision pour le moment.</AlerteUi>
      <AlerteUi v-else type="info">
        {{ total }} demande(s) attendent ta décision. La plus ancienne date d'il y a {{ anciennete(plusAncienne) }}.
      </AlerteUi>

      <div class="tuiles">
        <CarteStatistique libelle="Annonces à valider" :valeur="stats.annoncesEnAttente" icone="annonce" vers="/admin/moderation" :attention="stats.annoncesEnAttente > 0" :evolution="stats.annoncesEnAttente > 0 ? `Plus ancienne : ${anciennete(stats.annonceLaPlusAncienne)}` : 'Rien en attente'" />
        <CarteStatistique libelle="Photos à valider" :valeur="stats.photosEnAttente" icone="profil" vers="/admin/photos" :evolution="stats.photosEnAttente > 0 ? `Plus ancienne : ${anciennete(stats.photoLaPlusAncienne)}` : 'Rien en attente'" />
        <CarteStatistique libelle="Contenus à vérifier" :valeur="stats.contenusEnAttente" icone="attention" vers="/admin/contenus" />
        <CarteStatistique libelle="Signalements" :valeur="stats.signalementsNouveaux" icone="signalement" vers="/admin/signalements" :evolution="`${stats.signalementsEnCours} en cours`" />
        <CarteStatistique v-if="parametres.kyc_actif" libelle="Identités à vérifier" :valeur="stats.identitesEnAttente" icone="identite" vers="/admin/identites" />
      </div>

      <section v-if="stats.prochaineAnnonce" class="prochaine">
        <h2>Prochaine annonce à valider</h2>
        <p>{{ stats.prochaineAnnonce.titre }}</p>
        <RouterLink class="lien" to="/admin/moderation">Ouvrir la file des annonces</RouterLink>
      </section>

      <div class="graphiques">
        <GraphiqueCourbe
          titre="Demandes reçues et traitées par jour"
          :etiquettes="stats.parJour.map((j) => libelleJour(j.jour))"
          :series="[{ nom: 'Reçues', valeurs: stats.parJour.map((j) => j.recues) }, { nom: 'Traitées', valeurs: stats.parJour.map((j) => j.traitees) }]"
        />
        <GraphiqueCirculaire titre="Ma file par type" :parts="parts" />
      </div>
    </template>
  </section>
</template>

<style scoped>
.file {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
  align-items: center;
  justify-content: space-between;
}
h1,
h2,
p {
  margin: 0;
}
.periodes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
}
.tuiles {
  display: grid;
  gap: var(--e3);
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
}
.graphiques {
  display: grid;
  gap: var(--e4);
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
}
.prochaine {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.lien {
  color: var(--indigo);
  font-weight: 700;
}
</style>
