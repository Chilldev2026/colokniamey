// Sens de la navigation (avancer ou revenir) : la page glisse dans le bon sens.
// Vue Router garde un numéro de position dans history.state ; on le compare à la position précédente.

import { ref } from 'vue'

export const direction = ref<'avant' | 'arriere'>('avant')

let dernierePosition = 0

export function mettreAJourDirection(): void {
  const position = typeof window.history.state?.position === 'number' ? window.history.state.position : 0
  direction.value = position < dernierePosition ? 'arriere' : 'avant'
  dernierePosition = position
}
