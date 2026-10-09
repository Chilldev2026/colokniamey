<script setup lang="ts">
import { computed } from 'vue'
import { lireMarkdown } from './markdown'

const props = defineProps<{ source: string }>()
const blocs = computed(() => lireMarkdown(props.source))
</script>

<template>
  <article class="juridique">
    <template v-for="(b, i) in blocs" :key="i">
      <h1 v-if="b.type === 'titre' && b.niveau === 1">{{ b.texte }}</h1>
      <h2 v-else-if="b.type === 'titre' && b.niveau === 2">{{ b.texte }}</h2>
      <h3 v-else-if="b.type === 'titre'">{{ b.texte }}</h3>
      <ul v-else-if="b.type === 'liste'">
        <li v-for="(e, j) in b.elements" :key="j">{{ e }}</li>
      </ul>
      <p v-else>{{ b.texte }}</p>
    </template>
  </article>
</template>

<style scoped>
.juridique {
  max-width: 44rem;
  margin: 0 auto;
}
</style>
