<script setup lang="ts">
import TexteJuridique from '../legal/TexteJuridique.vue'
import source from '../legal/cgu.md?raw'
</script>

<template>
  <TexteJuridique :source="source" />
</template>
