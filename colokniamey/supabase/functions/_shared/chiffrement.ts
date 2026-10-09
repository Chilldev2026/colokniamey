// Chiffrement applicatif des images KYC (RGP03) : AES-256-GCM, Web Crypto, IV aléatoire par fichier.
// Format du fichier stocké : [1 octet de version][12 octets d'IV][données chiffrées + étiquette d'authentification].
// La clé (KYC_CLE, 32 octets en base64) n'existe que dans les secrets des Edge Functions : sans elle,
// un fichier lu directement dans le bucket kyc_prives est illisible.

const VERSION = 1
const TAILLE_IV = 12

export class ErreurChiffrement extends Error {}

/** Lit la clé : exactement 32 octets en base64. */
export async function importerCle(base64: string | undefined): Promise<CryptoKey> {
  if (!base64) throw new ErreurChiffrement('Clé de chiffrement absente.')
  let octets: Uint8Array<ArrayBuffer>
  try {
    octets = Uint8Array.from(atob(base64.trim()), (c) => c.charCodeAt(0))
  } catch {
    throw new ErreurChiffrement('Clé de chiffrement invalide.')
  }
  if (octets.length !== 32) throw new ErreurChiffrement('Clé de chiffrement invalide.')
  return crypto.subtle.importKey('raw', octets, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function chiffrer(cle: CryptoKey, clair: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(TAILLE_IV))
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, clair))
  const sortie = new Uint8Array(1 + TAILLE_IV + chiffre.length)
  sortie[0] = VERSION
  sortie.set(iv, 1)
  sortie.set(chiffre, 1 + TAILLE_IV)
  return sortie
}

export async function dechiffrer(cle: CryptoKey, stocke: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  if (stocke.length < 1 + TAILLE_IV + 16 || stocke[0] !== VERSION) {
    throw new ErreurChiffrement('Fichier chiffré invalide.')
  }
  const iv = stocke.slice(1, 1 + TAILLE_IV)
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cle, stocke.slice(1 + TAILLE_IV)))
  } catch {
    // Mauvaise clé ou fichier modifié : l'étiquette GCM ne correspond pas
    throw new ErreurChiffrement('Déchiffrement impossible.')
  }
}
