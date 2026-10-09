<script setup lang="ts">
import { useId } from 'vue'

const modele = defineModel<string>({ required: true })

defineProps<{
  libelle: string
  type?: 'text' | 'email' | 'password' | 'tel' | 'number' | 'date'
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
  gap: var(--e1);
}
label {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
  font-weight: 700;
}
input {
  min-height: var(--cible-min);
  padding: 0 var(--e3);
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon-s);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
  font-size: 1rem;
}
input[aria-invalid='true'] {
  border-color: var(--erreur);
}
.erreur {
  margin: 0;
  color: var(--erreur);
  font-size: var(--texte-s);
}
.aide {
  margin: 0;
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
</style>
