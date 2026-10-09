<script setup lang="ts">
// Choix unique présenté sous forme de carte (ex. étudiant ou propriétaire).
const modele = defineModel<string>({ required: true })

defineProps<{ nom: string; valeur: string; libelle: string; description?: string }>()
</script>

<template>
  <label class="carte" :class="{ choisie: modele === valeur }">
    <input v-model="modele" type="radio" :name="nom" :value="valeur" />
    <span class="titre">{{ libelle }}</span>
    <span v-if="description" class="description">{{ description }}</span>
  </label>
</template>

<style scoped>
.carte {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--e1);
  min-height: var(--cible-min);
  padding: var(--e3) var(--e4);
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon);
  background: var(--surface);
  cursor: pointer;
}
.choisie {
  border-color: var(--indigo);
  background: var(--indigo-pale);
}
/* Le vrai radio reste dans la page (clavier, lecteurs d'écran) mais n'est pas dessiné */
input {
  position: absolute;
  opacity: 0;
  inset: 0;
  margin: 0;
  cursor: pointer;
}
.carte:has(input:focus-visible) {
  outline: 3px solid var(--indigo);
  outline-offset: 2px;
}
.titre {
  font-weight: 700;
}
.description {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
</style>
