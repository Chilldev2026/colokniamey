// Calculs géographiques du formulaire de placement sur la carte (RG22, RG25 bis).
// Ils servent au confort (avertir avant l'envoi) : la base refuse un point hors zone de toute façon.

export interface Point {
  latitude: number
  longitude: number
}

export interface ZoneVille extends Point {
  rayonKm: number
}

const RAYON_TERRE_M = 6_371_000

/** Distance en mètres entre deux points (formule de haversine). */
export function distanceMetres(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * RAYON_TERRE_M * Math.asin(Math.sqrt(h))
}

/** RG22 : le point est dans la zone de la ville (centre + rayon_km). */
export function dansLaZone(point: Point, ville: ZoneVille): boolean {
  return distanceMetres(point, ville) <= ville.rayonKm * 1000
}

/** Lit deux champs de saisie. Null si les deux sont vides, une erreur si l'un est invalide. */
export function lireCoordonnees(latitude: string, longitude: string): Point | null | { erreur: string } {
  const lat = latitude.trim().replace(',', '.')
  const lng = longitude.trim().replace(',', '.')
  if (lat === '' && lng === '') return null
  if (lat === '' || lng === '' || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
    return { erreur: 'Entre une latitude et une longitude valides, ou laisse les deux champs vides.' }
  }
  const point = { latitude: Number(lat), longitude: Number(lng) }
  if (Math.abs(point.latitude) > 90) return { erreur: 'La latitude doit être entre -90 et 90.' }
  if (Math.abs(point.longitude) > 180) return { erreur: 'La longitude doit être entre -180 et 180.' }
  return point
}

/** Format attendu par PostGIS pour une colonne geography : longitude d'abord. */
export function versEwkt(point: Point): string {
  return `SRID=4326;POINT(${point.longitude} ${point.latitude})`
}

export function formaterCoordonnee(valeur: number): string {
  return valeur.toFixed(6)
}
