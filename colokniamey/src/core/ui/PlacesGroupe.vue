<script setup lang="ts">
// Places d'un groupe de colocation : une place se remplit quand un membre est accepté (M8).
import { ref, watch } from 'vue'
import { useAnimation } from '../design/useAnimation'

const props = defineProps<{ total: number; occupees: number }>()

const { rebond } = useAnimation()
const places = ref<HTMLElement[]>([])

watch(
  () => props.occupees,
  (nouveau, ancien) => {
    // La place qui vient de se remplir fait un petit rebond
    if (nouveau > ancien) {
      const place = places.value[nouveau - 1]
      if (place) rebond(place)
    }
  },
)
</script>

<template>
  <div class="places" role="img" :aria-label="`${occupees} places occupées sur ${total}`">
    <span
      v-for="n in total"
      :key="n"
      :ref="(el) => { if (el) places[n - 1] = el as HTMLElement }"
      class="place"
      :class="{ pleine: n <= occupees }"
    />
  </div>
</template>

<style scoped>
.places {
  display: flex;
  gap: var(--e2);
}
.place {
  width: 28px;
  height: 28px;
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon-rond);
  background: var(--surface);
  transition: background-color var(--duree-normale) var(--courbe);
}
.pleine {
  border-color: var(--vert);
  background: var(--vert);
}
</style>
