// Paramètres publics de la plateforme (maintenance, version des CGU…), lus par parametres_publics().
// Les paramètres non publics ne sont jamais envoyés au navigateur.

import { ref } from 'vue'
import { supabase } from './supabase'
import { estAdminCourant } from './acces'

export interface ParametresPublics {
  maintenance_active: boolean
  maintenance_message: string
  maintenance_fin: string | null
  inscriptions_ouvertes: boolean
  photos_max: number
  validation_annonces: boolean
  version_cgu: string
  inactivite_etudiant_jours: number
  inactivite_proprietaire_jours: number
  photo_taille_max_mo: number
  photo_dimension_min: number
  nsfw_seuil: number
}

const PAR_DEFAUT: ParametresPublics = {
  maintenance_active: false,
  maintenance_message: '',
  maintenance_fin: null,
  inscriptions_ouvertes: true,
  photos_max: 5,
  validation_annonces: true,
  version_cgu: '1.0',
  inactivite_etudiant_jours: 7,
  inactivite_proprietaire_jours: 14,
  photo_taille_max_mo: 10,
  photo_dimension_min: 400,
  nsfw_seuil: 0.7,
}

export const parametres = ref<ParametresPublics>({ ...PAR_DEFAUT })

export async function chargerParametres(): Promise<void> {
  const { data, error } = await supabase.rpc('parametres_publics')
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return
  parametres.value = { ...PAR_DEFAUT, ...(data as Partial<ParametresPublics>) }
}

// RGA16 : la maintenance est décidée par la base (en_maintenance()).
// Le rôle vient de acces.ts, renseigné par le module des comptes (M2).

// La réponse est gardée 60 s pour ne pas interroger la base à chaque changement de page
let dernierEtat = false
let derniereVerification = 0

export async function maintenanceBloquante(): Promise<boolean> {
  if (Date.now() - derniereVerification > 60_000) {
    const { data, error } = await supabase.rpc('en_maintenance')
    // En cas d'erreur réseau on n'enferme pas les utilisateurs : la base refusera les écritures (RGA16)
    dernierEtat = !error && data === true
    derniereVerification = Date.now()
  }
  return dernierEtat && !estAdminCourant.value
}
