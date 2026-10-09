<script setup lang="ts">
// Cadre commun des écrans d'authentification : titre, texte d'introduction, contenu, liens de bas de page.
defineProps<{ titre: string; intro?: string }>()
</script>

<template>
  <section class="auth">
    <h1>{{ titre }}</h1>
    <p v-if="intro" class="intro">{{ intro }}</p>
    <slot />
    <nav v-if="$slots.liens" class="liens"><slot name="liens" /></nav>
  </section>
</template>

<style scoped>
.auth {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 28rem;
  margin: 0 auto;
}
h1 {
  margin: 0;
  font-family: var(--police-titre);
}
.intro {
  margin: 0;
  color: var(--texte-secondaire);
}
.liens {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
}
.liens :deep(a) {
  display: inline-flex;
  align-items: center;
  min-height: var(--cible-min);
}
</style>
