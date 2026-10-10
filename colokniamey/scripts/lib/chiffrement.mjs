// Chiffrement des sauvegardes (RGP13, RGP25) : AES-256-GCM, clé dérivée d'une phrase secrète par scrypt.
// Format du fichier : « CNB1 » (4 octets) | sel (16) | IV (12) | données chiffrées | étiquette d'authentification (16).
// La phrase secrète n'est jamais écrite dans un fichier ni dans Git : elle est gardée par l'auteur, hors de Supabase.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const MAGIE = Buffer.from('CNB1')
const TAILLE_SEL = 16
const TAILLE_IV = 12
const TAILLE_ETIQUETTE = 16
export const LONGUEUR_PHRASE_MIN = 16

function cle(phrase, sel) {
  return scryptSync(phrase, sel, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 })
}

function verifierPhrase(phrase) {
  if (typeof phrase !== 'string' || phrase.length < LONGUEUR_PHRASE_MIN) {
    throw new Error(`La phrase secrète doit faire au moins ${LONGUEUR_PHRASE_MIN} caractères.`)
  }
}

/** Chiffre un tampon : renvoie le contenu du fichier chiffré. */
export function chiffrerTampon(clair, phrase) {
  verifierPhrase(phrase)
  const sel = randomBytes(TAILLE_SEL)
  const iv = randomBytes(TAILLE_IV)
  const chiffreur = createCipheriv('aes-256-gcm', cle(phrase, sel), iv)
  const donnees = Buffer.concat([chiffreur.update(clair), chiffreur.final()])
  return Buffer.concat([MAGIE, sel, iv, donnees, chiffreur.getAuthTag()])
}

/** Déchiffre un tampon. Lève une erreur si la phrase est fausse ou si le fichier a été modifié. */
export function dechiffrerTampon(chiffre, phrase) {
  verifierPhrase(phrase)
  const minimum = MAGIE.length + TAILLE_SEL + TAILLE_IV + TAILLE_ETIQUETTE
  if (chiffre.length < minimum || !chiffre.subarray(0, MAGIE.length).equals(MAGIE)) {
    throw new Error('Ce fichier n\'est pas une sauvegarde ColokNiamey chiffrée.')
  }
  const sel = chiffre.subarray(MAGIE.length, MAGIE.length + TAILLE_SEL)
  const iv = chiffre.subarray(MAGIE.length + TAILLE_SEL, MAGIE.length + TAILLE_SEL + TAILLE_IV)
  const etiquette = chiffre.subarray(chiffre.length - TAILLE_ETIQUETTE)
  const donnees = chiffre.subarray(MAGIE.length + TAILLE_SEL + TAILLE_IV, chiffre.length - TAILLE_ETIQUETTE)
  const dechiffreur = createDecipheriv('aes-256-gcm', cle(phrase, sel), iv)
  dechiffreur.setAuthTag(etiquette)
  try {
    return Buffer.concat([dechiffreur.update(donnees), dechiffreur.final()])
  } catch {
    throw new Error('Déchiffrement impossible : phrase secrète incorrecte ou fichier modifié.')
  }
}

export function chiffrerFichier(entree, sortie, phrase) {
  writeFileSync(sortie, chiffrerTampon(readFileSync(entree), phrase))
}

export function dechiffrerFichier(entree, sortie, phrase) {
  writeFileSync(sortie, dechiffrerTampon(readFileSync(entree), phrase))
}
