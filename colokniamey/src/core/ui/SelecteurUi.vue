<script setup lang="ts">
import { useId } from 'vue'

const modele = defineModel<string>({ required: true })

defineProps<{
  libelle: string
  options: { valeur: string; libelle: string }[]
  placeholder?: string
  erreur?: string
}>()

const id = useId()
</script>

<template>
  <div class="champ">
    <label :for="id">{{ libelle }}</label>
    <select :id="id" v-model="modele" :aria-invalid="erreur ? true : undefined">
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="o in options" :key="o.valeur" :value="o.valeur">{{ o.libelle }}</option>
    </select>
    <p v-if="erreur" class="erreur" role="alert">{{ erreur }}</p>
  </div>
</template>

<style scoped>
.champ {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
}
label {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
  font-weight: 700;
}
select {
  min-height: var(--cible-min);
  padding: 0 var(--e3);
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon-s);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
  font-size: 1rem;
}
select[aria-invalid='true'] {
  border-color: var(--erreur);
}
.erreur {
  margin: 0;
  color: var(--erreur);
  font-size: var(--texte-s);
}
</style>
