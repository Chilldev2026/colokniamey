<script setup lang="ts">
import TexteJuridique from '../legal/TexteJuridique.vue'
import source from '../legal/confidentialite.md?raw'
</script>

<template>
  <TexteJuridique :source="source" />
</template>
