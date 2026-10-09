<script setup lang="ts">
import { useToasts } from './useToasts'

const { toasts, retirer } = useToasts()
</script>

<template>
  <div class="zone" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type">
        <span>{{ t.message }}</span>
        <button
          v-if="t.action"
          class="lien"
          type="button"
          @click="
            t.action.executer();
            retirer(t.id)
          "
        >
          {{ t.action.libelle }}
        </button>
        <button class="lien" type="button" aria-label="Fermer" @click="retirer(t.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.zone {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  left: 1rem;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  pointer-events: none;
}
.toast {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  max-width: 28rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--encre);
  color: #fff;
  pointer-events: auto;
}
.succes {
  background: var(--vert);
}
.erreur {
  background: var(--orange);
}
.lien {
  min-width: var(--cible-min);
  min-height: var(--cible-min);
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}
.toast-enter-active,
.toast-leave-active {
  transition:
    transform var(--duree-normale) var(--courbe),
    opacity var(--duree-normale) var(--courbe);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(1rem);
}
</style>
