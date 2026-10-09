<script setup lang="ts">
import { useId } from 'vue'

const modele = defineModel<string>({ required: true })

defineProps<{
  libelle: string
  type?: 'text' | 'email' | 'password' | 'tel' | 'number'
  erreur?: string
  aide?: string
  autocomplete?: string
  requis?: boolean
}>()

const id = useId()
</script>

<template>
  <div class="champ">
    <label :for="id">{{ libelle }}</label>
    <input
      :id="id"
      v-model="modele"
      :type="type ?? 'text'"
      :autocomplete="autocomplete"
      :required="requis"
      :aria-invalid="erreur ? true : undefined"
      :aria-describedby="erreur ? `${id}-erreur` : aide ? `${id}-aide` : undefined"
    />
    <p v-if="erreur" :id="`${id}-erreur`" class="erreur" role="alert">{{ erreur }}</p>
    <p v-else-if="aide" :id="`${id}-aide`" class="aide">{{ aide }}</p>
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
input {
  min-height: var(--cible-min);
  padding: 0 0.75rem;
  border: 1px solid var(--bordure-champ);
  border-radius: var(--rayon);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
}
input:focus-visible {
  outline: 2px solid var(--indigo);
  outline-offset: 1px;
}
input[aria-invalid='true'] {
  border-color: var(--orange);
}
.erreur {
  margin: 0;
  color: var(--orange);
  font-size: 0.9rem;
}
.aide {
  margin: 0;
  color: var(--texte-secondaire);
  font-size: 0.9rem;
}
</style>
