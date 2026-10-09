<script setup lang="ts">
// Étape « Règles et tâches partagées » (RG30, RG31) : ajout, suppression, réordonnancement, suggestions en un clic.
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import {
  LIBELLES_FREQUENCE,
  LIBELLES_REPARTITION,
  LIMITES,
  REGLES_SUGGEREES,
  TACHES_SUGGEREES,
  type FrequenceTache,
  type LigneRegle,
  type LigneTache,
  type RepartitionTache,
} from '../types'

const regles = defineModel<LigneRegle[]>('regles', { required: true })
const taches = defineModel<LigneTache[]>('taches', { required: true })
defineProps<{ erreurRegles?: string; erreurTaches?: string }>()

function deplacer<T>(liste: T[], index: number, delta: number): T[] {
  const cible = index + delta
  if (cible < 0 || cible >= liste.length) return liste
  const copie = [...liste]
  const [element] = copie.splice(index, 1)
  copie.splice(cible, 0, element as T)
  return copie
}

function ajouterRegle(texte = '') {
  if (regles.value.length >= LIMITES.regles) return
  regles.value = [...regles.value, { texte }]
}
function majRegle(index: number, texte: string) {
  regles.value = regles.value.map((r, i) => (i === index ? { ...r, texte } : r))
}
function ajouterTache(base: { libelle: string; frequence: FrequenceTache; repartition: RepartitionTache } = { libelle: '', frequence: 'hebdomadaire', repartition: 'tour_de_role' }) {
  if (taches.value.length >= LIMITES.taches) return
  taches.value = [...taches.value, { ...base }]
}
function majTache(index: number, valeurs: Partial<LigneTache>) {
  taches.value = taches.value.map((t, i) => (i === index ? { ...t, ...valeurs } : t))
}

const dejaPresente = (texte: string) => regles.value.some((r) => r.texte.trim() === texte)
const dejaPresenteTache = (libelle: string) => taches.value.some((t) => t.libelle.trim() === libelle)
</script>

<template>
  <div class="listes">
    <section class="bloc">
      <h3>Règles du logement</h3>
      <p class="aide">{{ regles.length }} sur {{ LIMITES.regles }}. Une règle par ligne, {{ LIMITES.regleCaracteres }} caractères au plus.</p>
      <ul class="suggestions" aria-label="Règles suggérées">
        <li v-for="s in REGLES_SUGGEREES" :key="s">
          <BoutonUi variante="secondaire" :desactive="dejaPresente(s) || regles.length >= LIMITES.regles" @click="ajouterRegle(s)">+ {{ s }}</BoutonUi>
        </li>
      </ul>
      <ol class="lignes">
        <li v-for="(r, i) in regles" :key="r.id ?? `n${i}`" class="ligne">
          <input
            :value="r.texte"
            :maxlength="LIMITES.regleCaracteres"
            :aria-label="`Règle ${i + 1}`"
            @input="majRegle(i, ($event.target as HTMLInputElement).value)"
          />
          <div class="boutons">
            <BoutonUi variante="secondaire" :desactive="i === 0" aria-label="Monter" @click="regles = deplacer(regles, i, -1)">↑</BoutonUi>
            <BoutonUi variante="secondaire" :desactive="i === regles.length - 1" aria-label="Descendre" @click="regles = deplacer(regles, i, 1)">↓</BoutonUi>
            <BoutonUi variante="secondaire" aria-label="Supprimer la règle" @click="regles = regles.filter((_, k) => k !== i)">Supprimer</BoutonUi>
          </div>
        </li>
      </ol>
      <BoutonUi variante="secondaire" :desactive="regles.length >= LIMITES.regles" @click="ajouterRegle()">Ajouter une règle</BoutonUi>
      <AlerteUi v-if="erreurRegles" type="erreur">{{ erreurRegles }}</AlerteUi>
    </section>

    <section class="bloc">
      <h3>Tâches partagées</h3>
      <p class="aide">{{ taches.length }} sur {{ LIMITES.taches }}. Chaque tâche a une fréquence et une répartition.</p>
      <ul class="suggestions" aria-label="Tâches suggérées">
        <li v-for="s in TACHES_SUGGEREES" :key="s.libelle">
          <BoutonUi variante="secondaire" :desactive="dejaPresenteTache(s.libelle) || taches.length >= LIMITES.taches" @click="ajouterTache(s)">
            + {{ s.libelle }}
          </BoutonUi>
        </li>
      </ul>
      <ol class="lignes">
        <li v-for="(t, i) in taches" :key="t.id ?? `n${i}`" class="ligne tache">
          <input :value="t.libelle" maxlength="80" :aria-label="`Tâche ${i + 1}`" @input="majTache(i, { libelle: ($event.target as HTMLInputElement).value })" />
          <select :value="t.frequence" :aria-label="`Fréquence de la tâche ${i + 1}`" @change="majTache(i, { frequence: ($event.target as HTMLSelectElement).value as FrequenceTache })">
            <option v-for="(libelle, valeur) in LIBELLES_FREQUENCE" :key="valeur" :value="valeur">{{ libelle }}</option>
          </select>
          <select :value="t.repartition" :aria-label="`Répartition de la tâche ${i + 1}`" @change="majTache(i, { repartition: ($event.target as HTMLSelectElement).value as RepartitionTache })">
            <option v-for="(libelle, valeur) in LIBELLES_REPARTITION" :key="valeur" :value="valeur">{{ libelle }}</option>
          </select>
          <div class="boutons">
            <BoutonUi variante="secondaire" :desactive="i === 0" aria-label="Monter" @click="taches = deplacer(taches, i, -1)">↑</BoutonUi>
            <BoutonUi variante="secondaire" :desactive="i === taches.length - 1" aria-label="Descendre" @click="taches = deplacer(taches, i, 1)">↓</BoutonUi>
            <BoutonUi variante="secondaire" aria-label="Supprimer la tâche" @click="taches = taches.filter((_, k) => k !== i)">Supprimer</BoutonUi>
          </div>
        </li>
      </ol>
      <BoutonUi variante="secondaire" :desactive="taches.length >= LIMITES.taches" @click="ajouterTache()">Ajouter une tâche</BoutonUi>
      <AlerteUi v-if="erreurTaches" type="erreur">{{ erreurTaches }}</AlerteUi>
    </section>
  </div>
</template>

<style scoped>
.listes {
  display: flex;
  flex-direction: column;
  gap: var(--e6);
}
.bloc {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  align-items: flex-start;
}
h3,
.aide {
  margin: 0;
}
.aide {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.suggestions,
.lignes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.lignes {
  flex-direction: column;
  width: 100%;
}
.ligne {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  padding: var(--e3);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.boutons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
}
input,
select {
  min-height: var(--cible-min);
  padding: 0 var(--e3);
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon-s);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
}
</style>
