<script setup lang="ts">
// Liste filtrable et paginée des utilisateurs (RGA01). La base ne renvoie rien à un non-admin.
import { computed, onMounted, reactive, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import SelecteurUi from '@/core/ui/SelecteurUi.vue'
import { listerUtilisateurs, PAR_PAGE } from '../services/utilisateursService'
import { LIBELLES_ROLE_COMPTE, LIBELLES_STATUT_COMPTE, type FiltresUtilisateurs, type UtilisateurListe } from '../types'

const filtres = reactive<FiltresUtilisateurs>({ recherche: '', role: '', statut: '', depuis: '', jusqua: '' })
const lignes = ref<UtilisateurListe[]>([])
const total = ref(0)
const page = ref(1)
const chargement = ref(true)
const erreur = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAR_PAGE)))

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    const resultat = await listerUtilisateurs(filtres, page.value)
    lignes.value = resultat.lignes
    total.value = resultat.total
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger la liste.'
  } finally {
    chargement.value = false
  }
}

function rechercher() {
  page.value = 1
  void charger()
}

function reinitialiser() {
  Object.assign(filtres, { recherche: '', role: '', statut: '', depuis: '', jusqua: '' })
  rechercher()
}

function aller(delta: number) {
  page.value = Math.min(totalPages.value, Math.max(1, page.value + delta))
  void charger()
}

function date(valeur: string): string {
  return new Date(valeur).toLocaleDateString('fr-FR')
}

onMounted(charger)
</script>

<template>
  <section class="utilisateurs">
    <form class="filtres" @submit.prevent="rechercher">
      <ChampUi v-model="filtres.recherche" libelle="Nom, e-mail ou téléphone" />
      <SelecteurUi
        v-model="filtres.role"
        libelle="Rôle"
        placeholder="Tous les rôles"
        :options="[
          { valeur: '', libelle: 'Tous les rôles' },
          { valeur: 'etudiant', libelle: 'Étudiants' },
          { valeur: 'proprietaire', libelle: 'Propriétaires' },
          { valeur: 'admin', libelle: 'Admins' },
          { valeur: 'super_admin', libelle: 'Super-admins' },
        ]"
      />
      <SelecteurUi
        v-model="filtres.statut"
        libelle="Statut"
        placeholder="Tous les statuts"
        :options="[
          { valeur: '', libelle: 'Tous les statuts' },
          { valeur: 'actif', libelle: 'Actifs' },
          { valeur: 'suspendu', libelle: 'Suspendus' },
          { valeur: 'desactive', libelle: 'Désactivés' },
        ]"
      />
      <ChampUi v-model="filtres.depuis" libelle="Inscrits depuis le" type="date" />
      <ChampUi v-model="filtres.jusqua" libelle="Inscrits jusqu'au" type="date" />
      <div class="boutons">
        <BoutonUi type="submit" variante="principal">Rechercher</BoutonUi>
        <BoutonUi variante="secondaire" @click="reinitialiser">Réinitialiser</BoutonUi>
      </div>
    </form>

    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-else-if="chargement" :lignes="5" />
    <EtatVide v-else-if="lignes.length === 0" message="Aucun utilisateur ne correspond à cette recherche." />

    <template v-else>
      <p class="total">{{ total }} utilisateur{{ total > 1 ? 's' : '' }}</p>
      <div class="defilement">
        <table>
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">Contact</th>
              <th scope="col">Rôle</th>
              <th scope="col">Statut</th>
              <th scope="col">Inscrit le</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in lignes" :key="u.id">
              <td><RouterLink :to="`/admin/utilisateurs/${u.id}`" class="nom">{{ u.prenom }} {{ u.nom }}</RouterLink></td>
              <td>{{ u.email }}<br /><span class="secondaire">{{ u.telephone }}</span></td>
              <td><PuceUi variante="info">{{ LIBELLES_ROLE_COMPTE[u.role] }}</PuceUi></td>
              <td><PuceUi :variante="u.statut === 'actif' ? 'validee' : 'neutre'">{{ LIBELLES_STATUT_COMPTE[u.statut] }}</PuceUi></td>
              <td>{{ date(u.creeLe) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <nav class="pagination" aria-label="Pagination">
        <BoutonUi variante="secondaire" :desactive="page <= 1" @click="aller(-1)">Précédent</BoutonUi>
        <span>Page {{ page }} sur {{ totalPages }}</span>
        <BoutonUi variante="secondaire" :desactive="page >= totalPages" @click="aller(1)">Suivant</BoutonUi>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.utilisateurs {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
.filtres {
  display: grid;
  gap: var(--e3);
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  align-items: end;
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.boutons {
  display: flex;
  gap: var(--e2);
}
.total {
  margin: 0;
  color: var(--texte-secondaire);
}
.defilement {
  overflow-x: auto;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: var(--e3);
  border-bottom: 1px solid var(--bordure);
  text-align: left;
  vertical-align: top;
}
th {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
tr:last-child td {
  border-bottom: 0;
}
.nom {
  display: inline-flex;
  align-items: center;
  min-height: var(--cible-min);
  font-weight: 700;
}
.secondaire {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.pagination {
  display: flex;
  gap: var(--e3);
  align-items: center;
  justify-content: space-between;
}
</style>
