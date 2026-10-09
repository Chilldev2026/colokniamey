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
  gap: 0.25rem;
}
label {
  font-weight: 600;
}
select {
  min-height: var(--cible-min);
  padding: 0 0.75rem;
  border: 1px solid var(--bordure-champ);
  border-radius: var(--rayon);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
}
select:focus-visible {
  outline: 2px solid var(--indigo);
  outline-offset: 1px;
}
.erreur {
  margin: 0;
  color: var(--orange);
  font-size: 0.9rem;
}
</style>
