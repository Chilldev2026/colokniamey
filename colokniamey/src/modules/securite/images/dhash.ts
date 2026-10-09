// RG50 : empreinte perceptuelle dHash (« difference hash »). L'image est réduite à 9 × 8 pixels en
// niveaux de gris ; chaque bit dit si un pixel est plus clair que son voisin de droite.
// Deux images presque identiques (recadrage léger, recompression) ont des empreintes très proches ;
// la base compare les empreintes avec une distance de Hamming (distance_empreintes()).

export const LARGEUR_DHASH = 9
export const HAUTEUR_DHASH = 8

/** Reçoit 72 niveaux de gris (9 colonnes × 8 lignes, ligne par ligne) et renvoie 16 caractères hexadécimaux. */
export function dhashDepuisGris(gris: ArrayLike<number>): string {
  if (gris.length !== LARGEUR_DHASH * HAUTEUR_DHASH) {
    throw new Error('Il faut 72 niveaux de gris (9 × 8).')
  }
  let hex = ''
  for (let y = 0; y < HAUTEUR_DHASH; y++) {
    let octet = 0
    for (let x = 0; x < LARGEUR_DHASH - 1; x++) {
      const gauche = gris[y * LARGEUR_DHASH + x]!
      const droite = gris[y * LARGEUR_DHASH + x + 1]!
      octet = (octet << 1) | (gauche > droite ? 1 : 0)
    }
    hex += octet.toString(16).padStart(2, '0')
  }
  return hex
}

/** Nombre de bits différents entre deux empreintes hexadécimales de même longueur. */
export function distanceHamming(a: string, b: string): number {
  if (a.length !== b.length) throw new Error('Les empreintes n\'ont pas la même longueur.')
  let distance = 0
  for (let i = 0; i < a.length; i++) {
    let reste = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16)
    while (reste > 0) {
      distance += reste & 1
      reste >>= 1
    }
  }
  return distance
}
