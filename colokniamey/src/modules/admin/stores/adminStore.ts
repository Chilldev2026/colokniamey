// Store de l'espace admin : niveau de double authentification, appareils, session, files et relances.

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as service from '../services/adminService'
import type { EtatFile, FacteurTotp, RelanceRecue } from '../types'

// La base est prévenue au plus toutes les 5 minutes tant que l'admin agit (RGA36)
const INTERVALLE_SIGNAL_MS = 5 * 60_000

export const useAdminStore = defineStore('admin', () => {
  const niveau = ref<'aal1' | 'aal2' | null>(null)
  const facteurs = ref<FacteurTotp[]>([])
  const files = ref<EtatFile[]>([])
  const relances = ref<RelanceRecue[]>([])
  let dernierSignal = 0

  const facteursVerifies = computed(() => facteurs.value.filter((f) => f.verifie))
  // RGA37 : rappel tant qu'il n'y a qu'un seul appareil (ou aucun chargé)
  const deuxiemeAppareilManquant = computed(() => niveau.value === 'aal2' && facteursVerifies.value.length < 2)

  async function rafraichirNiveau(): Promise<void> {
    niveau.value = await service.niveauAssurance()
  }

  async function chargerFacteurs(): Promise<void> {
    facteurs.value = await service.listerFacteurs()
  }

  /** Prévient la base que l'admin est actif. `forcer` ignore le délai de 5 minutes (ouverture, « Rester connecté »). */
  async function signalerActivite(forcer = false): Promise<void> {
    const maintenant = Date.now()
    if (!forcer && maintenant - dernierSignal < INTERVALLE_SIGNAL_MS) return
    dernierSignal = maintenant
    try {
      await service.signalerActivite()
    } catch {
      // Session expirée côté base : elle sera aussi constatée par le contrôle d'inactivité de l'interface
      dernierSignal = 0
    }
  }

  async function chargerFiles(): Promise<void> {
    try {
      files.value = await service.lireFiles()
    } catch {
      files.value = []
    }
  }

  async function chargerRelances(): Promise<void> {
    try {
      relances.value = await service.lireRelancesNonVues()
    } catch {
      relances.value = []
    }
  }

  /** RGA32 : le bandeau disparaît après « Vu », et vu_le est rempli par la base. */
  async function marquerVue(id: number): Promise<void> {
    await service.marquerRelanceVue(id)
    relances.value = relances.value.filter((r) => r.id !== id)
  }

  function vider() {
    niveau.value = null
    facteurs.value = []
    files.value = []
    relances.value = []
    dernierSignal = 0
  }

  return {
    niveau, facteurs, facteursVerifies, files, relances, deuxiemeAppareilManquant,
    rafraichirNiveau, chargerFacteurs, signalerActivite, chargerFiles, chargerRelances, marquerVue, vider,
  }
})
