// Mesures de performance anonymes, échantillonnées et envoyées par lots (RGA21 à RGA25).
// Ce fichier ne dépend pas du client Supabase : il reçoit une fonction d'envoi,
// ce qui évite une dépendance circulaire (le client mesure ses propres appels).

import { idSession } from './session'

export interface Mesure {
  module: string
  operation: string
  duree_ms: number
  succes: boolean
}

type Envoi = (lot: Mesure[], session: string) => Promise<void>

const TAILLE_LOT = 20
const DELAI_ENVOI_MS = 30_000
// RGA25 : on ne garde qu'une partie des mesures pour rester dans les limites de l'offre gratuite
const TAUX_ECHANTILLONNAGE = 0.5

let tampon: Mesure[] = []
let envoyer: Envoi | null = null
let minuteur: number | undefined

export function configurerMesures(fonctionEnvoi: Envoi): void {
  envoyer = fonctionEnvoi
}

export function enregistrerMesure(mesure: Mesure, aleatoire: () => number = Math.random): void {
  if (aleatoire() >= TAUX_ECHANTILLONNAGE) return
  tampon.push({ ...mesure, duree_ms: Math.max(0, Math.round(mesure.duree_ms)) })
  if (tampon.length >= TAILLE_LOT) {
    void vider()
  } else if (minuteur === undefined) {
    minuteur = window.setTimeout(() => void vider(), DELAI_ENVOI_MS)
  }
}

export async function vider(): Promise<void> {
  if (minuteur !== undefined) {
    window.clearTimeout(minuteur)
    minuteur = undefined
  }
  if (tampon.length === 0 || !envoyer) return
  const lot = tampon
  tampon = []
  try {
    await envoyer(lot, idSession())
  } catch {
    // Une mesure perdue n'est pas grave : on n'insiste pas
  }
}

/** Envoie le reste quand l'onglet passe en arrière-plan. */
export function demarrerMesures(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void vider()
  })
}

/** Pour les tests. */
export function _tailleTampon(): number {
  return tampon.length
}
