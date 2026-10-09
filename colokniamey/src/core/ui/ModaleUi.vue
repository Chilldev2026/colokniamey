<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'

const ouverte = defineModel<boolean>({ required: true })

const props = defineProps<{ titre: string; bloquante?: boolean }>()

// Une fenêtre bloquante ne se ferme ni par un clic à côté ni par Échap (ex. nouvelles conditions)
function fermer() {
  if (!props.bloquante) ouverte.value = false
}

function surTouche(e: KeyboardEvent) {
  if (e.key === 'Escape') fermer()
}

watch(ouverte, (valeur) => {
  if (valeur) document.addEventListener('keydown', surTouche)
  else document.removeEventListener('keydown', surTouche)
})

onBeforeUnmount(() => document.removeEventListener('keydown', surTouche))
</script>

<template>
  <Teleport to="body">
    <Transition name="modale">
      <div v-if="ouverte" class="voile" @click.self="fermer">
        <div class="boite" role="dialog" aria-modal="true" :aria-label="titre">
          <h2>{{ titre }}</h2>
          <slot />
          <div class="actions"><slot name="actions" /></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.voile {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(20 22 27 / 0.5);
}
.boite {
  width: 100%;
  max-width: 32rem;
  padding: 1.25rem;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon) var(--rayon) 0 0;
  background: var(--surface);
}
h2 {
  margin-top: 0;
}
.actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 1rem;
}
@media (min-width: 640px) {
  .voile {
    align-items: center;
  }
  .boite {
    border-radius: var(--rayon);
  }
}
.modale-enter-active,
.modale-leave-active {
  transition: opacity var(--duree-normale) var(--courbe);
}
.modale-enter-from,
.modale-leave-to {
  opacity: 0;
}
</style>
