<script setup lang="ts">
const modele = defineModel<boolean>({ required: true })

defineProps<{ erreur?: string }>()
</script>

<template>
  <div class="case">
    <label>
      <input v-model="modele" type="checkbox" :aria-invalid="erreur ? true : undefined" />
      <span><slot /></span>
    </label>
    <p v-if="erreur" class="erreur" role="alert">{{ erreur }}</p>
  </div>
</template>

<style scoped>
label {
  display: flex;
  gap: var(--e3);
  align-items: flex-start;
  min-height: var(--cible-min);
  padding: var(--e2) 0;
  cursor: pointer;
}
input {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  margin: 0;
  accent-color: var(--indigo);
}
.erreur {
  margin: 0;
  color: var(--erreur);
  font-size: var(--texte-s);
}
</style>
