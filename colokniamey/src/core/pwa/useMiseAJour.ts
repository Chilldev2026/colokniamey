// RG27 : toast « Nouvelle version disponible » avec mise à jour en un clic.
import { watch } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useToasts } from '../ui/useToasts'

export function useMiseAJour(): void {
  const { needRefresh, updateServiceWorker } = useRegisterSW()
  const { afficher } = useToasts()

  watch(needRefresh, (besoin) => {
    if (!besoin) return
    afficher('Nouvelle version disponible.', 'info', {
      libelle: 'Mettre à jour',
      executer: () => void updateServiceWorker(true),
    })
  })
}
