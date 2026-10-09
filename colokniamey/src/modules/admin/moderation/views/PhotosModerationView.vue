<script setup lang="ts">
// File des photos à valider (RG49, RG50) : aperçu, usage, auteur, alerte si l'empreinte est déjà connue.
// La décision passe par l'Edge Function securite-photos-decision (via le service de S), qui déplace le fichier.
import { onMounted, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import { useToasts } from '@/core/ui/useToasts'
import { deciderPhoto } from '@/modules/securite'
import ModaleMotif from '../components/ModaleMotif.vue'
import { listerPhotosAValider, urlApercuPhoto, type PhotoAValider } from '../services/moderationService'

const { afficher } = useToasts()
const photos = ref<(PhotoAValider & { url: string | null })[]>([])
const chargement = ref(true)
const occupe = ref<number | null>(null)
const erreur = ref('')
const aRefuser = ref<number | null>(null)
const refusOuvert = ref(false)

const USAGES: Record<string, string> = { avatar: 'Photo de profil', annonce: 'Photo d\'annonce' }

async function charger() {
  erreur.value = ''
  try {
    const liste = await listerPhotosAValider()
    photos.value = await Promise.all(liste.map(async (p) => ({ ...p, url: await urlApercuPhoto(p.chemin, 'en_attente') })))
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger la file.'
  } finally {
    chargement.value = false
  }
}
onMounted(charger)

async function decider(id: number, decision: 'valider' | 'refuser', motif?: string) {
  occupe.value = id
  erreur.value = ''
  try {
    await deciderPhoto(id, decision, motif)
    afficher(decision === 'valider' ? 'Photo validée.' : 'Photo refusée. L\'auteur en est informé.', 'succes')
    refusOuvert.value = false
    await charger()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'La décision n\'a pas été enregistrée.'
  } finally {
    occupe.value = null
  }
}

function demanderRefus(id: number) {
  aRefuser.value = id
  refusOuvert.value = true
}
function date(valeur: string): string {
  return new Date(valeur).toLocaleDateString('fr-FR')
}
</script>

<template>
  <section class="photos">
    <h1>Photos à valider</h1>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-if="chargement" :lignes="3" />
    <EtatVide v-else-if="photos.length === 0" message="Aucune photo à valider." />
    <ul v-else class="grille">
      <li v-for="p in photos" :key="p.id" class="carte">
        <img v-if="p.url" :src="p.url" :alt="`${USAGES[p.usage] ?? 'Photo'} de ${p.prenom}`" loading="lazy" />
        <div v-else class="vide" aria-hidden="true" />
        <p><strong>{{ USAGES[p.usage] ?? p.usage }}</strong> · {{ p.prenom }} {{ p.initialeNom }}. · {{ date(p.creeeLe) }}</p>
        <AlerteUi v-if="p.suspecte" type="erreur">Cette image ressemble à une photo déjà utilisée par un autre compte.</AlerteUi>
        <div class="actions">
          <BoutonUi variante="principal" :chargement="occupe === p.id" @click="decider(p.id, 'valider')">Valider</BoutonUi>
          <BoutonUi variante="danger" :desactive="occupe === p.id" @click="demanderRefus(p.id)">Refuser</BoutonUi>
        </div>
      </li>
    </ul>

    <ModaleMotif
      v-model="refusOuvert"
      titre="Refuser la photo"
      explication="Le motif est obligatoire : l'auteur le recevra pour pouvoir envoyer une autre photo."
      libelle-action="Refuser"
      :chargement="occupe !== null"
      @confirmer="(motif) => aRefuser !== null && decider(aRefuser, 'refuser', motif)"
    />
  </section>
</template>

<style scoped>
.photos {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
h1,
p {
  margin: 0;
}
.grille {
  display: grid;
  gap: var(--e4);
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}
.carte {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  padding: var(--e3);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
img,
.vide {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: var(--rayon-s);
  background: var(--terre-cuite);
  object-fit: cover;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
}
</style>
