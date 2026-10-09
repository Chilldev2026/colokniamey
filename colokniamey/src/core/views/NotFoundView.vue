<script setup lang="ts">
import EtatVide from '../ui/EtatVide.vue'
</script>

<template>
  <section>
    <h1>Page introuvable</h1>
    <EtatVide message="Cette page n'existe pas ou a été déplacée.">
      <RouterLink to="/">Retour à l'accueil</RouterLink>
    </EtatVide>
  </section>
</template>
