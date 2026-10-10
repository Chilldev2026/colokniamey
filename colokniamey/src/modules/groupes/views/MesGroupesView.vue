<script setup lang="ts">
// Mes groupes : statut, membres, demandes reçues à accepter ou refuser (initiateur seulement), quitter le groupe.
import { onMounted, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import PlacesGroupe from '@/core/ui/PlacesGroupe.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import { membresDuGroupe, mesGroupes, quitterGroupe, repondreDemande, type MembreGroupe, type MonGroupe } from '../services/groupesService'

const LIBELLES_STATUT = { en_formation: 'En formation', complet: 'Complet', cloture: 'Clos' } as const

const { afficher } = useToasts()
const groupes = ref<MonGroupe[]>([])
const membres = ref<Record<number, MembreGroupe[]>>({})
const chargement = ref(true)
const occupe = ref<number | null>(null)
const erreur = ref('')

function prix(montant: number): string {
  return new Intl.NumberFormat('fr-FR').format(montant).replace(/[  ]/g, ' ')
}

async function charger() {
  erreur.value = ''
  try {
    groupes.value = await mesGroupes()
    const resultat: Record<number, MembreGroupe[]> = {}
    for (const g of groupes.value) resultat[g.id] = await membresDuGroupe(g.id)
    membres.value = resultat
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger tes groupes.'
  } finally {
    chargement.value = false
  }
}
onMounted(charger)

async function agir(id: number, travail: () => Promise<void>, succes: string) {
  erreur.value = ''
  occupe.value = id
  try {
    await travail()
    afficher(succes, 'succes')
    await charger()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Action impossible.'
  } finally {
    occupe.value = null
  }
}

const repondre = (g: MonGroupe, m: MembreGroupe, accepter: boolean) =>
  agir(g.id, () => repondreDemande(m.membreId, accepter), accepter ? 'Demande acceptée.' : 'Demande refusée.')

function quitter(g: MonGroupe) {
  const texte = g.monStatut === 'en_attente' ? 'Annuler ta demande ?' : 'Quitter ce groupe ?'
  if (window.confirm(texte)) void agir(g.id, () => quitterGroupe(g.id), g.monStatut === 'en_attente' ? 'Demande annulée.' : 'Tu as quitté le groupe.')
}
</script>

<template>
  <section class="mes-groupes">
    <h1>Mes groupes</h1>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-if="chargement" :lignes="3" />
    <EtatVide v-else-if="groupes.length === 0 && !erreur" message="Tu n'as pas encore de groupe.">
      <p class="aide">Ouvre l'annonce d'un logement de propriétaire pour lancer ou rejoindre un groupe.</p>
      <RouterLink to="/recherche?groupes=1">Voir les colocations en formation</RouterLink>
    </EtatVide>

    <ul v-else class="liste">
      <li v-for="g in groupes" :key="g.id" class="groupe">
        <div class="entete">
          <RouterLink :to="`/annonces/${g.annonceId}`" class="titre">{{ g.annonceTitre }}</RouterLink>
          <PuceUi :variante="g.statut === 'cloture' ? 'neutre' : g.statut === 'complet' ? 'validee' : 'info'">{{ LIBELLES_STATUT[g.statut] }}</PuceUi>
          <PuceUi v-if="g.monStatut === 'en_attente'">Demande en attente</PuceUi>
          <PuceUi v-else-if="g.monRole === 'initiateur'">Initiateur</PuceUi>
        </div>
        <PlacesGroupe :total="g.placesRecherchees + 1" :occupees="g.membres" />
        <p class="meta">{{ g.membres }} sur {{ g.placesRecherchees + 1 }} places · part estimée {{ prix(g.partEstimee) }} FCFA par mois</p>

        <ul v-if="(membres[g.id] ?? []).length > 0" class="membres" aria-label="Membres du groupe">
          <li v-for="m in membres[g.id]" :key="m.membreId">
            <span>{{ m.prenom }} {{ m.initiale }}.</span>
            <PuceUi v-if="m.role === 'initiateur'">Initiateur</PuceUi>
            <template v-if="m.statut === 'en_attente' && g.monRole === 'initiateur'">
              <PuceUi variante="info">Demande reçue</PuceUi>
              <BoutonUi variante="principal" :desactive="occupe === g.id" @click="repondre(g, m, true)">Accepter</BoutonUi>
              <BoutonUi variante="secondaire" :desactive="occupe === g.id" @click="repondre(g, m, false)">Refuser</BoutonUi>
            </template>
          </li>
        </ul>

        <BoutonUi v-if="g.statut !== 'cloture'" variante="secondaire" :chargement="occupe === g.id" @click="quitter(g)">
          {{ g.monStatut === 'en_attente' ? 'Annuler ma demande' : 'Quitter le groupe' }}
        </BoutonUi>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.mes-groupes {
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
.aide,
.meta {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.liste,
.membres {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.groupe {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  align-items: flex-start;
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.entete,
.membres li {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
  align-items: center;
}
.titre {
  color: var(--indigo);
  font-weight: 700;
}
</style>
