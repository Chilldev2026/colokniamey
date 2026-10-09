// Types publics du module référentiel. Les coordonnées sont facultatives (RG25 bis) :
// une université sans position reste listée, mais n'a ni marqueur ni distance.

export interface Ville {
  id: number
  nom: string
  rayonKm: number
  latitude: number
  longitude: number
}

export interface Quartier {
  id: number
  nom: string
  villeId: number
  commune: string | null
  latitude: number | null
  longitude: number | null
}

export interface Universite {
  id: number
  nom: string
  sigle: string | null
  villeId: number
  quartierId: number | null
  adresse: string | null
  latitude: number | null
  longitude: number | null
}

/** Vrai si l'université peut avoir un marqueur sur la carte (RG25 bis). */
export function aUnePosition(u: Universite): u is Universite & { latitude: number; longitude: number } {
  return u.latitude !== null && u.longitude !== null
}
