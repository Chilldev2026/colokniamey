<script setup lang="ts">
// Accueil du super-admin : « Vue d'ensemble » de la plateforme (A1, RGA26). Tuiles cliquables, courbes (visites,
// inscriptions) et graphiques circulaires (annonces par statut, utilisateurs par rôle), période de 7, 30 ou 90 jours,
// export CSV. Tout est calculé par des fonctions SQL réservées au super-admin (RGA27) ; aucune donnée personnelle (RGA18).
import { computed, onMounted, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import CarteStatistique from '@/core/ui/graphiques/CarteStatistique.vue'
import GraphiqueCirculaire from '@/core/ui/graphiques/GraphiqueCirculaire.vue'
import GraphiqueCourbe from '@/core/ui/graphiques/GraphiqueCourbe.vue'
import { telechargerCsv } from '@/core/ui/graphiques/csv'
import {
  libelleJour,
  lireStatsAnnonces,
  lireStatsErreurs,
  lireStatsModeration,
  lireStatsUtilisateurs,
  lireStatsVisites,
  PERIODES,
  type Periode,
  type StatsAnnonces,
  type StatsErreurs,
  type StatsModeration,
  type StatsUtilisateurs,
  type StatsVisites,
} from '../services/statsService'

const periode = ref<Periode>(30)
const chargement = ref(true)
const erreur = ref('')
const utilisateurs = ref<StatsUtilisateurs | null>(null)
const annonces = ref<StatsAnnonces | null>(null)
const visites = ref<StatsVisites | null>(null)
const moderation = ref<StatsModeration | null>(null)
const erreurs = ref<StatsErreurs | null>(null)

const STATUTS: Record<string, string> = {
  publiee: 'Publiées', en_attente: 'En attente', brouillon: 'Brouillons', refusee: 'Refusées ou retirées', archivee: 'Archivées',
}
const ROLES: Record<string, string> = { etudiant: 'Étudiants', proprietaire: 'Propriétaires', admin: 'Admins', super_admin: 'Super-admins' }

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    ;[utilisateurs.value, annonces.value, visites.value, moderation.value, erreurs.value] = await Promise.all([
      lireStatsUtilisateurs(periode.value), lireStatsAnnonces(periode.value), lireStatsVisites(periode.value),
      lireStatsModeration(periode.value), lireStatsErreurs(),
    ])
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger les statistiques.'
  } finally {
    chargement.value = false
  }
}
onMounted(charger)

function changerPeriode(p: Periode) {
  periode.value = p
  void charger()
}

const signalementsOuverts = computed(() => (moderation.value?.signalementsNouveaux ?? 0) + (moderation.value?.signalementsEnCours ?? 0))
const partsAnnonces = computed(() =>
  Object.entries(annonces.value?.parStatut ?? {})
    .filter(([, n]) => n > 0)
    .map(([statut, valeur]) => ({ libelle: STATUTS[statut] ?? statut, valeur, autres: statut === 'refusee' })),
)
const partsRoles = computed(() =>
  Object.entries(utilisateurs.value?.parRole ?? {}).filter(([, n]) => n > 0).map(([role, valeur]) => ({ libelle: ROLES[role] ?? role, valeur })),
)
const etiquettesVisites = computed(() => (visites.value?.parJour ?? []).map((j) => libelleJour(j.jour)))
const etiquettesInscriptions = computed(() => (utilisateurs.value?.inscriptions ?? []).map((j) => libelleJour(j.jour)))

// Export CSV réservé au super-admin : cette page l'est déjà, et les fonctions SQL le revérifient
function exporter() {
  if (!utilisateurs.value || !annonces.value || !visites.value) return
  telechargerCsv(`colokniamey-statistiques-${periode.value}j.csv`, [
    ['Jour', 'Visites', 'Sessions', 'Inscriptions étudiants', 'Inscriptions propriétaires'],
    ...visites.value.parJour.map((j, i) => [j.jour, j.visites, j.sessions, utilisateurs.value?.inscriptions[i]?.etudiant ?? 0, utilisateurs.value?.inscriptions[i]?.proprietaire ?? 0]),
    [],
    ['Annonces par statut', 'Nombre'],
    ...Object.entries(annonces.value.parStatut).map(([s, n]) => [STATUTS[s] ?? s, n]),
    [],
    ['Utilisateurs par rôle', 'Nombre'],
    ...Object.entries(utilisateurs.value.parRole).map(([r, n]) => [ROLES[r] ?? r, n]),
  ])
}
</script>

<template>
  <section class="ensemble">
    <header>
      <h1>Vue d'ensemble</h1>
      <div class="outils">
        <div class="periodes" role="group" aria-label="Période">
          <BoutonUi v-for="p in PERIODES" :key="p" :variante="periode === p ? 'principal' : 'secondaire'" :aria-pressed="periode === p" @click="changerPeriode(p)">
            {{ p }} jours
          </BoutonUi>
        </div>
        <BoutonUi variante="secondaire" :desactive="chargement || !visites" @click="exporter">Exporter en CSV</BoutonUi>
      </div>
    </header>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-if="chargement" :lignes="4" />

    <template v-else-if="utilisateurs && annonces && visites && moderation && erreurs">
      <div class="tuiles">
        <CarteStatistique libelle="Utilisateurs" :valeur="utilisateurs.total" icone="utilisateurs" vers="/admin/utilisateurs" :evolution="utilisateurs.nouveaux - utilisateurs.nouveauxPrecedente" />
        <CarteStatistique libelle="Annonces publiées" :valeur="annonces.parStatut.publiee ?? 0" icone="annonce" :evolution="annonces.publiees - annonces.publieesPrecedente" />
        <CarteStatistique libelle="Annonces en attente" :valeur="moderation.annoncesEnAttente" icone="file" vers="/admin/moderation" attention :evolution="annonces.delaiMoyenHeures === null ? 'Délai de validation : pas encore de mesure' : `Délai moyen de validation : ${annonces.delaiMoyenHeures} h`" />
        <CarteStatistique libelle="Signalements ouverts" :valeur="signalementsOuverts" icone="signalement" vers="/admin/signalements" :evolution="`${moderation.signalementsNouveaux} nouveau(x)`" />
        <CarteStatistique libelle="Erreurs nouvelles (24 h)" :valeur="erreurs.nouvelles24h" icone="erreur" vers="/admin/erreurs" :evolution="`${erreurs.ouvertes} erreur(s) ouverte(s)`" />
        <CarteStatistique libelle="Visites du jour" :valeur="visites.aujourdhui.visites" icone="visites" vers="/admin/supervision" :evolution="visites.aujourdhui.visites - visites.hier.visites" />
      </div>

      <div class="graphiques">
        <GraphiqueCourbe titre="Visites et sessions par jour" :etiquettes="etiquettesVisites" :series="[{ nom: 'Visites', valeurs: visites.parJour.map((j) => j.visites) }, { nom: 'Sessions', valeurs: visites.parJour.map((j) => j.sessions) }]" />
        <GraphiqueCourbe titre="Inscriptions par jour" :etiquettes="etiquettesInscriptions" :series="[{ nom: 'Étudiants', valeurs: utilisateurs.inscriptions.map((j) => j.etudiant) }, { nom: 'Propriétaires', valeurs: utilisateurs.inscriptions.map((j) => j.proprietaire) }]" />
        <GraphiqueCirculaire titre="Annonces par statut" :parts="partsAnnonces" />
        <GraphiqueCirculaire titre="Utilisateurs par rôle" :parts="partsRoles" />
      </div>

      <section v-if="annonces.parQuartier.length > 0" class="quartiers">
        <h2>Quartiers les plus actifs</h2>
        <ol>
          <li v-for="q in annonces.parQuartier" :key="q.quartier"><span>{{ q.quartier }}</span><strong>{{ q.annonces }}</strong></li>
        </ol>
      </section>
    </template>
  </section>
</template>

<style scoped>
.ensemble {
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
h2 {
  margin: 0;
}
.outils,
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
.quartiers {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.quartiers ol {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
  margin: 0;
  padding-left: var(--e5);
}
.quartiers li {
  display: flex;
  gap: var(--e3);
  justify-content: space-between;
}
</style>
