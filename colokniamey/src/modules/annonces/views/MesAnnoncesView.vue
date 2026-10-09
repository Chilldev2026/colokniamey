<script setup lang="ts">
// Mes annonces : état de chaque annonce, motif de refus, actions selon le statut (RG14, RG17, RGA11).
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import { archiverAnnonce, listerMesAnnonces, rouvrirAnnonce, soumettreAnnonce, supprimerAnnonce } from '../services/annoncesService'
import { LIBELLES_STATUT, LIBELLES_TYPE, type AnnonceResume } from '../types'
import { formaterMontant } from '../validation'

const router = useRouter()
const { afficher } = useToasts()
const annonces = ref<AnnonceResume[]>([])
const chargement = ref(true)
const erreur = ref('')
const occupe = ref<number | null>(null)

async function charger() {
  erreur.value = ''
  try {
    annonces.value = await listerMesAnnonces()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger tes annonces.'
  } finally {
    chargement.value = false
  }
}
onMounted(charger)

async function agir(id: number, travail: () => Promise<string | void>) {
  erreur.value = ''
  occupe.value = id
  try {
    const message = await travail()
    if (message) afficher(message, 'succes')
    await charger()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Action impossible.'
  } finally {
    occupe.value = null
  }
}

const soumettre = (a: AnnonceResume) =>
  agir(a.id, async () => ((await soumettreAnnonce(a.id)) === 'publiee' ? 'Ton annonce est publiée.' : 'Ton annonce est envoyée pour vérification.'))
const archiver = (a: AnnonceResume) => agir(a.id, async () => (await archiverAnnonce(a.id), 'Annonce archivée.'))
const rouvrir = (a: AnnonceResume) => agir(a.id, async () => (await rouvrirAnnonce(a.id), 'Annonce rouverte en brouillon.'))
const supprimer = (a: AnnonceResume) => {
  if (!window.confirm(`Supprimer « ${a.titre} » définitivement ?`)) return Promise.resolve()
  return agir(a.id, async () => (await supprimerAnnonce(a.id), 'Annonce supprimée.'))
}
</script>

<template>
  <section class="mes-annonces">
    <header>
      <h1>Mes annonces</h1>
      <BoutonUi variante="principal" @click="router.push({ name: 'annonces-nouvelle' })">Nouvelle annonce</BoutonUi>
    </header>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-if="chargement" :lignes="3" />
    <EtatVide v-else-if="annonces.length === 0" message="Tu n'as pas encore d'annonce.">
      <BoutonUi variante="principal" @click="router.push({ name: 'annonces-nouvelle' })">Créer ma première annonce</BoutonUi>
    </EtatVide>
    <TransitionGroup v-else name="liste" tag="ul" class="liste">
      <li v-for="a in annonces" :key="a.id" class="annonce">
        <div class="entete">
          <h2>{{ a.titre }}</h2>
          <PuceUi :variante="a.statut === 'publiee' ? 'validee' : a.statut === 'refusee' ? 'neutre' : 'info'">{{ LIBELLES_STATUT[a.statut] }}</PuceUi>
        </div>
        <p class="meta">{{ LIBELLES_TYPE[a.type] }} · {{ formaterMontant(a.partMensuelle) }} FCFA par mois</p>
        <AlerteUi v-if="a.statut === 'refusee'" type="erreur"><strong>Motif du refus :</strong> {{ a.motifRefus }}</AlerteUi>
        <AlerteUi v-if="a.enRevue" type="info">Un mot de ton annonce est en cours de vérification : elle reste masquée en attendant la décision de l'équipe.</AlerteUi>
        <div class="actions">
          <RouterLink class="lien" :to="`/annonces/${a.id}`">Voir</RouterLink>
          <RouterLink v-if="a.statut !== 'archivee'" class="lien" :to="`/annonces/${a.id}/editer`">Modifier</RouterLink>
          <BoutonUi v-if="a.statut === 'brouillon' || a.statut === 'refusee'" variante="principal" :chargement="occupe === a.id" @click="soumettre(a)">Soumettre</BoutonUi>
          <BoutonUi v-if="a.statut !== 'archivee'" variante="secondaire" :chargement="occupe === a.id" @click="archiver(a)">Archiver</BoutonUi>
          <BoutonUi v-else variante="secondaire" :chargement="occupe === a.id" @click="rouvrir(a)">Rouvrir</BoutonUi>
          <BoutonUi v-if="['brouillon', 'refusee', 'archivee'].includes(a.statut)" variante="danger" :chargement="occupe === a.id" @click="supprimer(a)">Supprimer</BoutonUi>
        </div>
      </li>
    </TransitionGroup>
  </section>
</template>

<style scoped>
.mes-annonces {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 40rem;
  margin: 0 auto;
  padding: var(--e4);
}
header {
  display: flex;
  gap: var(--e3);
  align-items: center;
  justify-content: space-between;
}
h1,
h2,
p {
  margin: 0;
}
h2 {
  font-size: var(--texte-m);
}
.liste {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.annonce {
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
  gap: var(--e3);
  align-items: flex-start;
  justify-content: space-between;
}
.meta {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
  align-items: center;
}
.lien {
  display: inline-flex;
  align-items: center;
  min-height: var(--cible-min);
  padding: 0 var(--e3);
  color: var(--indigo);
  font-weight: 700;
}
.liste-enter-active {
  transition: transform 250ms cubic-bezier(0, 0, 0.2, 1), opacity 250ms cubic-bezier(0, 0, 0.2, 1);
}
.liste-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
@media (prefers-reduced-motion: reduce) {
  .liste-enter-active {
    transition: none;
  }
}
</style>
