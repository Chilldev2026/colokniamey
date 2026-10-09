// Session de l'espace admin (RGA36) : déconnexion après 30 minutes d'inactivité, sans durée maximale tant que
// l'admin agit, avec l'avertissement « Déconnexion dans 2 minutes » et le bouton « Rester connecté ».
// La base applique la même règle (est_admin() exige une activité de moins de 30 minutes) : ce composable
// ne sert qu'à prévenir la base et à déconnecter proprement.

import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { demarrerInactivite, reinitialiserInactivite } from '@/core/useInactivite'
import { useAuthStore } from '@/modules/auth'
import { useAdminStore } from '../stores/adminStore'

export const DELAI_INACTIVITE_ADMIN_MS = 30 * 60_000
export const AVERTISSEMENT_AVANT_MS = 2 * 60_000

export function useSessionAdmin() {
  const auth = useAuthStore()
  const admin = useAdminStore()
  const router = useRouter()
  /** Secondes restantes pendant l'avertissement, sinon null. */
  const secondesRestantes = ref<number | null>(null)
  let arreter: (() => void) | null = null

  onMounted(() => {
    reinitialiserInactivite()
    // Ouverture de l'espace : la ligne de session est créée juste après la vérification du code (RGA36)
    void admin.signalerActivite(true)
    arreter = demarrerInactivite({
      delaiMs: () => DELAI_INACTIVITE_ADMIN_MS,
      intervalleMs: 10_000,
      avertirAvantMs: AVERTISSEMENT_AVANT_MS,
      surAvertissement: (reste) => {
        secondesRestantes.value = reste === null ? null : Math.max(0, Math.ceil(reste / 1000))
      },
      surAction: () => void admin.signalerActivite(),
      surExpiration: () => {
        secondesRestantes.value = null
        void auth.expirerSession().then(() => router.replace('/connexion'))
      },
    })
  })

  onBeforeUnmount(() => arreter?.())

  function resterConnecte() {
    reinitialiserInactivite()
    secondesRestantes.value = null
    void admin.signalerActivite(true)
  }

  return { secondesRestantes, resterConnecte }
}
