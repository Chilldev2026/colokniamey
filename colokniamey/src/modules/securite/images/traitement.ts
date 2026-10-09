// Préparation d'une photo avant tout envoi (RG48, RG49, RG50) :
//  1. taille maximale ;
//  2. type réel par la signature du fichier (JPEG, PNG, WebP) ;
//  3. dimension minimale ;
//  4. analyse de nudité (refus immédiat au-delà du seuil) ;
//  5. empreinte dHash ;
//  6. ré-encodage dans un canvas : seule l'image est recopiée, donc les métadonnées EXIF
//     et la position GPS disparaissent.
// Le « moteur » isole ce qui dépend du navigateur (canvas, décodage) pour pouvoir tester le reste.

import { dhashDepuisGris, HAUTEUR_DHASH, LARGEUR_DHASH } from './dhash'
import { detecterTypeImage, lireSignature } from './signature'
import { probabiliteNudite } from './nsfw'

export class ErreurPhoto extends Error {}

export interface ParametresPhoto {
  /** Taille maximale du fichier choisi, avant ré-encodage (paramètre photo_taille_max_mo). */
  tailleMaxOctets: number
  /** Côté le plus court, en pixels (paramètre photo_dimension_min). */
  dimensionMin: number
  /** Probabilité de nudité au-delà de laquelle la photo est refusée (paramètre nsfw_seuil). */
  seuilNsfw: number
}

export interface ImageDecodee {
  largeur: number
  hauteur: number
  /** 72 niveaux de gris (9 × 8) pour l'empreinte. */
  gris: Uint8Array
  /** Probabilité de nudité, ou null si l'analyse n'est pas disponible. */
  analyserNudite: () => Promise<number | null>
  /** Redessine l'image dans un canvas (côté le plus long limité à coteMax) et l'encode en WebP. */
  encoder: (coteMax: number, qualite: number) => Promise<Blob>
  liberer: () => void
}

export interface MoteurImage {
  decoder: (fichier: Blob) => Promise<ImageDecodee>
}

export interface PhotoTraitee {
  blob: Blob
  type: string
  empreinte: string
  largeur: number
  hauteur: number
}

// Les buckets refusent au-delà de 3 Mio (migration 0350) : on garde une marge
const TAILLE_SORTIE_MAX = 3 * 1024 * 1024 - 1024
const COTES = [1600, 1200, 800]
const QUALITE = 0.85

export async function traiterImage(
  fichier: File,
  params: ParametresPhoto,
  moteur: MoteurImage = moteurNavigateur,
): Promise<PhotoTraitee> {
  if (fichier.size > params.tailleMaxOctets) {
    throw new ErreurPhoto(`Cette photo est trop lourde (${Math.round(params.tailleMaxOctets / 1048576)} Mo au maximum).`)
  }
  if (detecterTypeImage(await lireSignature(fichier)) === null) {
    throw new ErreurPhoto('Ce fichier n\'est pas une photo JPEG, PNG ou WebP.')
  }

  let image: ImageDecodee
  try {
    image = await moteur.decoder(fichier)
  } catch {
    throw new ErreurPhoto('Impossible de lire cette photo. Essaie avec une autre.')
  }

  try {
    if (Math.min(image.largeur, image.hauteur) < params.dimensionMin) {
      throw new ErreurPhoto(`Cette photo est trop petite (${params.dimensionMin} pixels au moins sur le petit côté).`)
    }

    const nudite = await image.analyserNudite()
    if (nudite !== null && nudite >= params.seuilNsfw) {
      // Message volontairement neutre
      throw new ErreurPhoto('Cette photo ne respecte pas les règles de ColokNiamey. Choisis-en une autre.')
    }

    const empreinte = dhashDepuisGris(image.gris)

    for (const cote of COTES) {
      const blob = await image.encoder(cote, QUALITE)
      if (blob.size > TAILLE_SORTIE_MAX) continue
      // Le résultat doit être une vraie image : certains navigateurs ignorent « webp » et renvoient du PNG
      if (detecterTypeImage(await lireSignature(blob)) === null) {
        throw new ErreurPhoto('La préparation de la photo a échoué. Essaie avec une autre.')
      }
      return { blob, type: blob.type, empreinte, largeur: image.largeur, hauteur: image.hauteur }
    }
    throw new ErreurPhoto('Cette photo reste trop lourde après compression. Choisis-en une autre.')
  } finally {
    image.liberer()
  }
}

// --- Moteur du navigateur (canvas) ---

function creerCanvas(largeur: number, hauteur: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(largeur))
  canvas.height = Math.max(1, Math.round(hauteur))
  return canvas
}

function contexte(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas indisponible')
  return ctx
}

export const moteurNavigateur: MoteurImage = {
  async decoder(fichier) {
    // imageOrientation : l'image est redressée selon son EXIF avant que l'EXIF ne soit abandonné
    const bitmap = await createImageBitmap(fichier, { imageOrientation: 'from-image' })

    const petit = creerCanvas(LARGEUR_DHASH, HAUTEUR_DHASH)
    const ctxPetit = contexte(petit)
    ctxPetit.drawImage(bitmap, 0, 0, LARGEUR_DHASH, HAUTEUR_DHASH)
    const pixels = ctxPetit.getImageData(0, 0, LARGEUR_DHASH, HAUTEUR_DHASH).data
    const gris = new Uint8Array(LARGEUR_DHASH * HAUTEUR_DHASH)
    for (let i = 0; i < gris.length; i++) {
      gris[i] = Math.round(0.299 * pixels[i * 4]! + 0.587 * pixels[i * 4 + 1]! + 0.114 * pixels[i * 4 + 2]!)
    }

    function dessiner(coteMax: number): HTMLCanvasElement {
      const echelle = Math.min(1, coteMax / Math.max(bitmap.width, bitmap.height))
      const canvas = creerCanvas(bitmap.width * echelle, bitmap.height * echelle)
      contexte(canvas).drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      return canvas
    }

    return {
      largeur: bitmap.width,
      hauteur: bitmap.height,
      gris,
      analyserNudite: () => probabiliteNudite(dessiner(512)),
      encoder: (coteMax, qualite) =>
        new Promise<Blob>((resolve, reject) => {
          dessiner(coteMax).toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('encodage impossible'))),
            'image/webp',
            qualite,
          )
        }),
      liberer: () => bitmap.close(),
    }
  },
}
