// RG48 : le type d'un fichier se lit dans ses premiers octets (sa « signature »), jamais dans son extension
// ni dans le type déclaré par le navigateur : un fichier .jpg qui n'est pas une image est refusé.

export type TypeImage = 'image/jpeg' | 'image/png' | 'image/webp'

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function commence(octets: Uint8Array, motif: number[], decalage = 0): boolean {
  return motif.every((v, i) => octets[decalage + i] === v)
}

/** Renvoie le type réel de l'image, ou null si ce n'est ni un JPEG, ni un PNG, ni un WebP. */
export function detecterTypeImage(octets: Uint8Array): TypeImage | null {
  if (commence(octets, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (commence(octets, PNG)) return 'image/png'
  // WebP : « RIFF » + taille sur 4 octets + « WEBP »
  if (commence(octets, [0x52, 0x49, 0x46, 0x46]) && commence(octets, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp'
  }
  return null
}

/** Lit les 12 premiers octets d'un fichier. */
export async function lireSignature(fichier: Blob): Promise<Uint8Array> {
  return new Uint8Array(await fichier.slice(0, 12).arrayBuffer())
}
