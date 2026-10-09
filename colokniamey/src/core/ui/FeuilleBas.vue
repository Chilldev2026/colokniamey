<script setup lang="ts">
// Feuille du bas : monte avec un léger rebond, se ferme en la tirant vers le bas.
// Seulement transform et opacity ; le geste suit le doigt sans délai.
import { nextTick, ref, watch } from 'vue'
import { useAnimation } from '../design/useAnimation'

const ouverte = defineModel<boolean>({ required: true })
defineProps<{ titre: string }>()

const { animer } = useAnimation()
const feuille = ref<HTMLElement | null>(null)
let departY: number | null = null
let decalage = 0
const SEUIL_FERMETURE = 100

watch(ouverte, async (valeur) => {
  if (!valeur) return
  await nextTick()
  if (!feuille.value) return
  // Montée avec un léger dépassement puis retour
  animer(
    feuille.value,
    [
      { transform: 'translateY(100%)' },
      { transform: 'translateY(-12px)', offset: 0.7 },
      { transform: 'translateY(0)' },
    ],
    'lente',
  )
})

function debut(e: PointerEvent) {
  departY = e.clientY
  decalage = 0
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function deplacement(e: PointerEvent) {
  if (departY === null || !feuille.value) return
  decalage = Math.max(0, e.clientY - departY)
  feuille.value.style.transform = `translateY(${decalage}px)`
}

function fin() {
  if (departY === null || !feuille.value) return
  departY = null
  if (decalage > SEUIL_FERMETURE) {
    ouverte.value = false
  } else {
    feuille.value.style.transform = ''
  }
  decalage = 0
}
</script>

<template>
  <Teleport to="body">
    <Transition name="voile">
      <div v-if="ouverte" class="voile" @click.self="ouverte = false">
        <section ref="feuille" class="feuille" role="dialog" aria-modal="true" :aria-label="titre">
          <div
            class="poignee"
            @pointerdown="debut"
            @pointermove="deplacement"
            @pointerup="fin"
            @pointercancel="fin"
          >
            <span />
          </div>
          <h2>{{ titre }}</h2>
          <slot />
        </section>
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
  background: rgb(20 22 27 / 0.5);
}
.feuille {
  width: 100%;
  max-height: 85dvh;
  overflow-y: auto;
  padding: 0 var(--e5) var(--e6);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon-l) var(--rayon-l) 0 0;
  background: var(--surface);
}
.poignee {
  display: flex;
  justify-content: center;
  padding: var(--e3) 0;
  touch-action: none;
  cursor: grab;
}
.poignee span {
  width: 40px;
  height: 4px;
  border-radius: var(--rayon-rond);
  background: var(--bordure-champ);
}
h2 {
  margin: 0 0 var(--e3);
  font-size: var(--texte-l);
}
.voile-enter-active,
.voile-leave-active {
  transition: opacity var(--duree-normale) var(--courbe);
}
.voile-enter-from,
.voile-leave-to {
  opacity: 0;
}
</style>
