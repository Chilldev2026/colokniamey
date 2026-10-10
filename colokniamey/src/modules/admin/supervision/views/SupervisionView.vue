<script setup lang="ts">
// Supervision technique (RGA21 à RGA25) : les quatre indicateurs, sur 1 heure, 24 heures ou 7 jours.
//  1. taux de requêtes (appels mesurés et pages vues, par pas de temps et par module) ;
//  2. taux d'erreurs (global, par module, pages les plus en échec) ;
//  3. temps de réponse P50, P95 et P99 : P95 = ce que vivent les 5 % d'utilisateurs les plus lents, P99 = les 1 % ;
//  4. saturation : base, stockage, connexions, comparés aux limites de l'offre gratuite.
// Les seuils d'alerte et les limites sont réglables. Réservé au super-admin (section Pilotage).
import { computed, onMounted, reactive, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import GraphiqueCourbe from '@/core/ui/graphiques/GraphiqueCourbe.vue'
import { useToasts } from '@/core/ui/useToasts'
import { definirSeuil, lireSupervision, listerSeuils, type PeriodeSupervision, type Supervision } from '../../audit/services/auditService'

const PERIODES: { id: PeriodeSupervision; libelle: string }[] = [
  { id: '1h', libelle: '1 heure' }, { id: '24h', libelle: '24 heures' }, { id: '7j', libelle: '7 jours' },
]
const LIBELLES_SEUILS: Record<string, string> = {
  erreurs_pct: 'Alerte : taux d\'erreurs (%) sur 15 minutes',
  p95_ms: 'Alerte : temps de réponse P95 (ms)',
  saturation_pct: 'Alerte : saturation (%)',
  limite_base_mo: 'Limite de la base de données (Mo)',
  limite_stockage_mo: 'Limite du stockage de fichiers (Mo)',
  limite_connexions: 'Limite de connexions à la base',
  limite_appels_edge: 'Limite d\'appels aux Edge Functions par mois',
}

const { afficher } = useToasts()
const periode = ref<PeriodeSupervision>('24h')
const donnees = ref<Supervision | null>(null)
const seuils = reactive<Record<string, string>>({})
const chargement = ref(true)
const erreur = ref('')
const occupe = ref(false)

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    donnees.value = await lireSupervision(periode.value)
    const s = await listerSeuils()
    for (const [cle, valeur] of Object.entries(s)) seuils[cle] = String(valeur)
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger la supervision.'
  } finally {
    chargement.value = false
  }
}
onMounted(charger)

function changerPeriode(p: PeriodeSupervision) {
  periode.value = p
  void charger()
}

function etiquette(t: string): string {
  const d = new Date(t)
  if (periode.value === '1h') return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (periode.value === '24h') return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
const etiquettes = computed(() => (donnees.value?.requetes.parPas ?? []).map((p) => etiquette(p.t)))

async function enregistrer(cle: string) {
  const valeur = Number(String(seuils[cle]).replace(',', '.'))
  if (!Number.isFinite(valeur) || valeur <= 0) {
    erreur.value = 'Indique un nombre supérieur à 0.'
    return
  }
  erreur.value = ''
  occupe.value = true
  try {
    await definirSeuil(cle, valeur)
    afficher('Seuil enregistré.', 'succes')
    await charger()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Enregistrement impossible.'
  } finally {
    occupe.value = false
  }
}

const barres = computed(() => {
  const s = donnees.value?.saturation
  if (!s) return []
  return [
    { nom: 'Base de données', texte: `${s.baseMo} Mo sur ${s.limiteBaseMo} Mo`, pct: s.basePct },
    { nom: 'Stockage de fichiers', texte: `${s.stockageMo} Mo sur ${s.limiteStockageMo} Mo`, pct: s.stockagePct },
    { nom: 'Connexions à la base', texte: `${s.connexions} sur ${s.limiteConnexions}`, pct: s.connexionsPct },
  ]
})
</script>

<template>
  <section class="supervision">
    <header>
      <h1>Supervision technique</h1>
      <div class="periodes" role="group" aria-label="Période">
        <BoutonUi v-for="p in PERIODES" :key="p.id" :variante="periode === p.id ? 'principal' : 'secondaire'" :aria-pressed="periode === p.id" @click="changerPeriode(p.id)">
          {{ p.libelle }}
        </BoutonUi>
      </div>
    </header>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-if="chargement" :lignes="5" />

    <template v-else-if="donnees">
      <!-- 1. Requêtes -->
      <section class="bloc">
        <h2>1. Requêtes</h2>
        <p class="aide">{{ donnees.requetes.total }} appel(s) mesuré(s) et {{ donnees.requetes.pagesVues }} page(s) vue(s) sur la période. Les mesures sont anonymes et échantillonnées.</p>
        <GraphiqueCourbe titre="Requêtes et pages vues" :etiquettes="etiquettes" :series="[{ nom: 'Appels mesurés', valeurs: donnees.requetes.parPas.map((p) => p.requetes) }, { nom: 'Pages vues', valeurs: donnees.requetes.parPas.map((p) => p.pagesVues) }]" />
        <table v-if="donnees.requetes.parModule.length > 0">
          <caption>Appels par module</caption>
          <thead><tr><th scope="col">Module</th><th scope="col">Appels</th></tr></thead>
          <tbody><tr v-for="m in donnees.requetes.parModule" :key="m.module"><th scope="row">{{ m.module }}</th><td>{{ m.requetes }}</td></tr></tbody>
        </table>
      </section>

      <!-- 2. Erreurs -->
      <section class="bloc">
        <h2>2. Erreurs</h2>
        <p>Taux d'erreurs global : <strong>{{ donnees.erreurs.tauxGlobal }} %</strong> (alerte au-delà de {{ seuils.erreurs_pct }} % sur 15 minutes).</p>
        <table v-if="donnees.erreurs.parModule.length > 0">
          <caption>Erreurs par module</caption>
          <thead><tr><th scope="col">Module</th><th scope="col">Appels</th><th scope="col">Erreurs</th><th scope="col">Taux</th></tr></thead>
          <tbody><tr v-for="m in donnees.erreurs.parModule" :key="m.module"><th scope="row">{{ m.module }}</th><td>{{ m.requetes }}</td><td>{{ m.erreurs }}</td><td>{{ m.taux }} %</td></tr></tbody>
        </table>
        <table v-if="donnees.erreurs.pagesEnEchec.length > 0">
          <caption>Pages les plus en échec</caption>
          <thead><tr><th scope="col">Page</th><th scope="col">Occurrences</th></tr></thead>
          <tbody><tr v-for="p in donnees.erreurs.pagesEnEchec" :key="p.page"><th scope="row">{{ p.page }}</th><td>{{ p.occurrences }}</td></tr></tbody>
        </table>
        <p v-if="donnees.erreurs.parModule.length === 0 && donnees.erreurs.pagesEnEchec.length === 0" class="aide">Aucune mesure d'erreur sur cette période.</p>
      </section>

      <!-- 3. Temps de réponse -->
      <section class="bloc">
        <h2>3. Temps de réponse</h2>
        <p class="aide">P95 : 95 % des appels vont plus vite ; ce que vivent les 5 % d'utilisateurs les plus lents. P99 : même idée pour les 1 % les plus lents.</p>
        <p v-if="donnees.latence.global">
          Global : P50 <strong>{{ donnees.latence.global.p50 }} ms</strong> · P95 <strong>{{ donnees.latence.global.p95 }} ms</strong> · P99 <strong>{{ donnees.latence.global.p99 }} ms</strong>
        </p>
        <p v-else class="aide">Aucune mesure sur cette période.</p>
        <table v-if="donnees.latence.parModule.length > 0">
          <caption>Temps de réponse par module (ms)</caption>
          <thead><tr><th scope="col">Module</th><th scope="col">P50</th><th scope="col">P95</th><th scope="col">P99</th></tr></thead>
          <tbody><tr v-for="m in donnees.latence.parModule" :key="m.module"><th scope="row">{{ m.module }}</th><td>{{ m.p50 }}</td><td>{{ m.p95 }}</td><td>{{ m.p99 }}</td></tr></tbody>
        </table>
      </section>

      <!-- 4. Saturation -->
      <section class="bloc">
        <h2>4. Saturation</h2>
        <p class="aide">Comparée aux limites de l'offre gratuite saisies ci-dessous ; alerte à {{ donnees.saturation.seuilAlertePct }} %. Les appels aux Edge Functions ne sont pas mesurés par l'application : consulte le tableau de bord Supabase (limite saisie : {{ donnees.saturation.limiteAppelsEdge }} par mois).</p>
        <ul class="barres">
          <li v-for="b in barres" :key="b.nom">
            <div class="ligne"><span>{{ b.nom }}</span><strong>{{ b.pct }} %</strong></div>
            <div class="piste" role="progressbar" :aria-valuenow="Math.min(100, b.pct)" aria-valuemin="0" aria-valuemax="100" :aria-label="`${b.nom} : ${b.texte}`">
              <div class="barre" :class="{ alerte: b.pct >= donnees.saturation.seuilAlertePct }" :style="{ transform: `scaleX(${Math.min(1, b.pct / 100)})` }" />
            </div>
            <span class="aide">{{ b.texte }}</span>
          </li>
        </ul>
      </section>

      <!-- Seuils -->
      <section class="bloc">
        <h2>Seuils d'alerte et limites</h2>
        <p class="aide">Quand un seuil est dépassé, un bandeau apparaît dans cet espace et tous les super-admins sont notifiés.</p>
        <form v-for="(libelle, cle) in LIBELLES_SEUILS" :key="cle" class="seuil" novalidate @submit.prevent="enregistrer(cle)">
          <ChampUi :model-value="seuils[cle] ?? ''" :libelle="libelle" inputmode="decimal" @update:model-value="(v) => (seuils[cle] = v)" />
          <BoutonUi type="submit" variante="secondaire" :chargement="occupe">Enregistrer</BoutonUi>
        </form>
      </section>
    </template>
  </section>
</template>

<style scoped>
.supervision {
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
.bloc {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--fond);
}
.aide {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
  font-size: var(--texte-s);
}
caption {
  padding: var(--e2);
  font-weight: 700;
  text-align: left;
}
th,
td {
  padding: var(--e2);
  border-bottom: 1px solid var(--bordure);
  text-align: left;
}
.barres {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.ligne {
  display: flex;
  justify-content: space-between;
}
.piste {
  height: 10px;
  overflow: hidden;
  border-radius: var(--rayon-rond);
  background: var(--bordure);
}
.barre {
  height: 100%;
  transform-origin: left;
  background: var(--indigo);
  transition: transform 400ms cubic-bezier(0, 0, 0.2, 1);
}
.barre.alerte {
  background: var(--orange);
}
@media (prefers-reduced-motion: reduce) {
  .barre {
    transition: none;
  }
}
.seuil {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
  align-items: flex-end;
}
</style>
