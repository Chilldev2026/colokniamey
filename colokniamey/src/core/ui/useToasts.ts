import { ref } from 'vue'

export interface Toast {
  id: number
  message: string
  type: 'info' | 'succes' | 'erreur'
  /** Action facultative, par exemple « Mettre à jour ». */
  action?: { libelle: string; executer: () => void }
}

const toasts = ref<Toast[]>([])
let prochainId = 1

export function useToasts() {
  function retirer(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function afficher(message: string, type: Toast['type'] = 'info', action?: Toast['action']): number {
    const id = prochainId++
    toasts.value.push({ id, message, type, action })
    // Un toast avec action reste jusqu'à ce que l'utilisateur le ferme
    if (!action) window.setTimeout(() => retirer(id), 5000)
    return id
  }

  return { toasts, afficher, retirer }
}
