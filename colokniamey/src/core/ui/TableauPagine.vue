<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, ref, watch } from 'vue'
import EtatVide from './EtatVide.vue'

const props = withDefaults(
  defineProps<{
    colonnes: { cle: keyof T & string; libelle: string }[]
    lignes: T[]
    parPage?: number
    messageVide?: string
  }>(),
  { parPage: 10, messageVide: 'Rien à afficher pour le moment.' },
)

const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(props.lignes.length / props.parPage)))
const visibles = computed(() => props.lignes.slice((page.value - 1) * props.parPage, page.value * props.parPage))

// Si la liste raccourcit, on revient à une page qui existe
watch(totalPages, (n) => {
  if (page.value > n) page.value = n
})
</script>

<template>
  <EtatVide v-if="lignes.length === 0" :message="messageVide" />
  <div v-else>
    <div class="defilement">
      <table>
        <thead>
          <tr>
            <th v-for="c in colonnes" :key="c.cle" scope="col">{{ c.libelle }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(ligne, i) in visibles" :key="i">
            <td v-for="c in colonnes" :key="c.cle">{{ ligne[c.cle] }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <nav class="pagination" aria-label="Pagination">
      <button type="button" :disabled="page <= 1" @click="page--">Précédent</button>
      <span>Page {{ page }} sur {{ totalPages }}</span>
      <button type="button" :disabled="page >= totalPages" @click="page++">Suivant</button>
    </nav>
  </div>
</template>

<style scoped>
.defilement {
  overflow-x: auto;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--bordure);
  text-align: left;
}
.pagination {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: center;
  margin-top: 0.75rem;
}
.pagination button {
  min-height: var(--cible-min);
  padding: 0 1rem;
  border: 1px solid var(--bordure-champ);
  border-radius: var(--rayon);
  background: var(--surface);
  font: inherit;
  cursor: pointer;
}
.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
