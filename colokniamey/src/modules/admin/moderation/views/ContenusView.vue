<script setup lang="ts">
// Contenus à vérifier (RG45) : textes mis en revue par S (terme sensible détecté), et alertes de récidive (RG47).
// L'admin voit le texte en contexte et les catégories détectées, puis publie ou refuse (motif obligatoire).
import { onMounted, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import ModaleMotif from '../components/ModaleMotif.vue'
import { deciderContenu, listerContenus, listerRecidives, lireContenu, type ContenuARevoir, type Recidive } from '../services/moderationService'

const TYPES: Record<string, string> = {
  annonce: 'Annonce', annonce_regle: 'Règle d\'une annonce', annonce_tache: 'Tâche d\'une annonce', profil: 'Profil',
}
const CATEGORIES: Record<string, string> = { sexuel: 'Sexuel', haine: 'Haine ou racisme', terrorisme: 'Terrorisme', violence: 'Violence', menace: 'Menace' }

const { afficher } = useToasts()
const contenus = ref<ContenuARevoir[]>([])
const recidives = ref<Recidive[]>([])
const choisi = ref<ContenuARevoir | null>(null)
const texte = ref<{ champ: string; valeur: string }[]>([])
const chargement = ref(true)
const occupe = ref(false)
const erreur = ref('')
const refusOuvert = ref(false)

async function charger() {
  erreur.value = ''
  choisi.value = null
  try {
    ;[contenus.value, recidives.value] = await Promise.all([listerContenus(), listerRecidives()])
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger la file.'
  } finally {
    chargement.value = false
  }
}
onMounted(charger)

async function ouvrir(c: ContenuARevoir) {
  erreur.value = ''
  choisi.value = c
  texte.value = []
  try {
    texte.value = await lireContenu(c.id)
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger ce contenu.'
  }
}

async function decider(publier: boolean, motif?: string) {
  if (!choisi.value) return
  occupe.value = true
  erreur.value = ''
  try {
    await deciderContenu(choisi.value.id, publier, motif)
    afficher(publier ? 'Contenu publié.' : 'Contenu refusé. L\'auteur en est informé.', 'succes')
    refusOuvert.value = false
    await charger()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'La décision n\'a pas été enregistrée.'
  } finally {
    occupe.value = false
  }
}

function date(valeur: string): string {
  return new Date(valeur).toLocaleDateString('fr-FR')
}
</script>

<template>
  <section class="contenus">
    <h1>Contenus à vérifier</h1>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-if="chargement" :lignes="3" />

    <template v-else>
      <section v-if="recidives.length > 0" class="recidives">
        <h2>Comptes à surveiller</h2>
        <p class="meta">Au moins 3 contenus bloqués en 30 jours.</p>
        <ul>
          <li v-for="r in recidives" :key="r.userId">
            <strong>{{ r.prenom }} {{ r.initialeNom }}.</strong> : {{ r.nombre }} blocages, le dernier le {{ date(r.dernier) }}
            <RouterLink :to="`/admin/utilisateurs/${r.userId}`">Voir la fiche</RouterLink>
          </li>
        </ul>
      </section>

      <EtatVide v-if="contenus.length === 0" message="Aucun contenu à vérifier." />
      <div v-else class="deux">
        <ul class="liste">
          <li v-for="c in contenus" :key="c.id">
            <button type="button" class="ligne" :class="{ choisie: choisi?.id === c.id }" @click="ouvrir(c)">
              <span class="nom">{{ TYPES[c.type] ?? c.type }}</span>
              <span class="meta">{{ c.prenom ?? 'Auteur inconnu' }} · {{ date(c.creeLe) }}</span>
            </button>
          </li>
        </ul>

        <article v-if="choisi" class="fiche">
          <header>
            <h2>{{ TYPES[choisi.type] ?? choisi.type }}</h2>
            <BoutonUi variante="secondaire" @click="choisi = null">Fermer</BoutonUi>
          </header>
          <p class="categories">
            Détecté :
            <PuceUi v-for="cat in choisi.categories" :key="cat">{{ CATEGORIES[cat] ?? cat }}</PuceUi>
          </p>
          <div v-for="t in texte" :key="t.champ" class="extrait">
            <p class="champ">{{ t.champ }}</p>
            <p class="valeur">{{ t.valeur }}</p>
          </div>
          <div class="decision">
            <BoutonUi variante="principal" :chargement="occupe" @click="decider(true)">Publier</BoutonUi>
            <BoutonUi variante="danger" :desactive="occupe" @click="refusOuvert = true">Refuser</BoutonUi>
          </div>
        </article>
      </div>
    </template>

    <ModaleMotif
      v-model="refusOuvert"
      titre="Refuser le contenu"
      explication="Le contenu est retiré. Le motif est obligatoire : l'auteur le recevra."
      libelle-action="Refuser"
      :chargement="occupe"
      @confirmer="(motif) => decider(false, motif)"
    />
  </section>
</template>

<style scoped>
.contenus {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
h1,
h2,
p {
  margin: 0;
}
.meta {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.recidives {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.recidives ul {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  margin: 0;
  padding-left: var(--e5);
}
.deux {
  display: grid;
  gap: var(--e4);
  grid-template-columns: minmax(0, 1fr);
}
@media (min-width: 60rem) {
  .deux {
    grid-template-columns: minmax(0, 20rem) minmax(0, 1fr);
    align-items: start;
  }
}
.liste {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.ligne {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
  align-items: flex-start;
  width: 100%;
  min-height: var(--cible-min);
  padding: var(--e3);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ligne.choisie {
  border-color: var(--indigo);
}
.nom {
  font-weight: 700;
}
.fiche {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.fiche header {
  display: flex;
  gap: var(--e3);
  align-items: center;
  justify-content: space-between;
}
.categories {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
  align-items: center;
}
.extrait {
  padding: var(--e3);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon-s);
  background: var(--fond);
}
.champ {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
  font-weight: 700;
}
.valeur {
  white-space: pre-line;
}
.decision {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
}
</style>
