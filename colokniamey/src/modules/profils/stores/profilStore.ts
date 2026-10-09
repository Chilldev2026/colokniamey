// Store du profil de la personne connectée : profil, avatar et enregistrement.

import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/modules/auth'
import * as service from '../services/profilsService'
import type { DonneesProfil, EtatAvatar, MonProfil } from '../types'

export const useProfilStore = defineStore('profils', () => {
  const profil = ref<MonProfil | null>(null)
  const avatar = ref<EtatAvatar>({ cheminValide: null, statut: null, motif: null })
  const chargement = ref(false)

  async function charger(): Promise<void> {
    const auth = useAuthStore()
    if (!auth.session) return
    chargement.value = true
    try {
      const [p, a] = await Promise.all([service.lireMonProfil(auth.session.user.id), service.lireMonAvatar()])
      profil.value = p
      avatar.value = a
    } finally {
      chargement.value = false
    }
  }

  async function chargerAvatar(): Promise<void> {
    avatar.value = await service.lireMonAvatar()
  }

  /** RG10 : enregistre les champs autorisés, puis met à jour le prénom affiché dans le reste de l'application. */
  async function enregistrer(donnees: DonneesProfil): Promise<void> {
    const auth = useAuthStore()
    if (!auth.session || !profil.value) return
    await service.enregistrerProfil(auth.session.user.id, profil.value.role, donnees)
    await Promise.all([charger(), auth.rafraichirProfil()])
  }

  async function desactiver(): Promise<void> {
    await service.desactiverCompte()
    await useAuthStore().fermerSessionLocale()
    profil.value = null
  }

  function vider() {
    profil.value = null
    avatar.value = { cheminValide: null, statut: null, motif: null }
  }

  // Les données d'une personne ne doivent jamais rester affichées après sa déconnexion ou pour la suivante
  watch(() => useAuthStore().session?.user.id, vider)

  return { profil, avatar, chargement, charger, chargerAvatar, enregistrer, desactiver, vider }
})
