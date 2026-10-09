// « Localiser ma maison » (RG21) : géolocalisation du téléphone, haute précision, délai maximal de 15 secondes.
// La logique pure (messages, seuil de précision) est ici pour être testée ; l'appel au navigateur est dans le composant.

/** Au-delà de cette précision (en mètres), on invite à ajuster le repère [À VALIDER : seuil]. */
export const SEUIL_PRECISION_METRES = 50
export const DELAI_MAX_MS = 15_000

export const OPTIONS_GEOLOCALISATION: PositionOptions = {
  enableHighAccuracy: true,
  timeout: DELAI_MAX_MS,
  maximumAge: 0,
}

/** Codes de GeolocationPositionError : 1 refus, 2 position indisponible, 3 délai dépassé. */
export function messageGeolocalisation(code: number): string {
  switch (code) {
    case 1:
      return 'Tu as refusé la localisation. Autorise-la dans les réglages de ton navigateur, ou place le repère toi-même sur la carte.'
    case 2:
      return 'Ton téléphone ne trouve pas de signal de position pour le moment. Essaie à l\'extérieur, ou place le repère toi-même sur la carte.'
    case 3:
      return 'La localisation a pris trop de temps (15 secondes). Réessaie, ou place le repère toi-même sur la carte.'
    default:
      return 'La localisation a échoué. Place le repère toi-même sur la carte.'
  }
}

/** La géolocalisation exige HTTPS ; localhost est accepté en développement. */
export function contexteSecurise(): boolean {
  if (typeof window === 'undefined') return true
  return window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname)
}

export function precisionSuffisante(metres: number): boolean {
  return metres <= SEUIL_PRECISION_METRES
}

export function formaterPrecision(metres: number): string {
  return `${Math.round(metres)} m`
}
