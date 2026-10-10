<script setup lang="ts">
// Carte de statistique (tableaux de bord) : icône Lucide dans une pastille de 36 px, libellé, valeur qui défile,
// ligne d'évolution. La carte « à valider » est mise en avant en orange. Cliquable vers le module concerné.
import { computed } from 'vue'
import CompteurAnime from '../CompteurAnime.vue'
import { icones } from '../../design/icones'

const props = defineProps<{
  libelle: string
  valeur: number
  icone: string
  vers?: string
  /** Variation par rapport à la période précédente (nombre), ou texte libre de la ligne d'évolution. */
  evolution?: number | string
  /** Carte « à valider » mise en avant. */
  attention?: boolean
}>()

const composant = computed(() => icones[props.icone] ?? icones.info)
const ligne = computed(() => {
  if (props.evolution === undefined) return ''
  if (typeof props.evolution === 'string') return props.evolution
  if (props.evolution === 0) return 'Stable'
  return `${props.evolution > 0 ? '+' : ''}${props.evolution} par rapport à la période précédente`
})
const balise = computed(() => (props.vers ? 'RouterLink' : 'div'))
</script>

<template>
  <component :is="balise" :to="vers" class="carte" :class="{ attention }">
    <span class="pastille"><component :is="composant" :size="20" :stroke-width="2" aria-hidden="true" /></span>
    <span class="libelle">{{ libelle }}</span>
    <strong class="valeur"><CompteurAnime :valeur="valeur" /></strong>
    <span v-if="ligne" class="evolution">{{ ligne }}</span>
  </component>
</template>

<style scoped>
.carte {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
  color: var(--encre);
  text-decoration: none;
}
.attention {
  border-color: var(--orange);
}
.attention .pastille {
  background: var(--orange);
  color: #ffffff;
}
.pastille {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--rayon-rond);
  background: var(--indigo-pale);
  color: var(--indigo);
}
.libelle {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.valeur {
  font-family: var(--police-titre);
  font-size: var(--texte-xl);
  line-height: 1.1;
}
.evolution {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
</style>
