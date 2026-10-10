// Chiffrement des sauvegardes (RGP13, RGP25) : aller-retour, mauvaise phrase, fichier modifié, absence de clair.
import { describe, expect, it } from 'vitest'
import { chiffrerTampon, dechiffrerTampon } from '../lib/chiffrement.mjs'

const PHRASE = 'une-phrase-secrete-assez-longue'
const CLAIR = Buffer.from('INSERT INTO profils VALUES (\'Aïcha\', \'+22790112233\');\n'.repeat(50))

describe('chiffrement des sauvegardes', () => {
  it('fait l\'aller-retour avec la bonne phrase', () => {
    expect(dechiffrerTampon(chiffrerTampon(CLAIR, PHRASE), PHRASE).equals(CLAIR)).toBe(true)
  })

  it('ne laisse rien de lisible dans le fichier chiffré', () => {
    const chiffre = chiffrerTampon(CLAIR, PHRASE)
    expect(chiffre.includes(Buffer.from('Aïcha'))).toBe(false)
    expect(chiffre.includes(Buffer.from('INSERT'))).toBe(false)
    expect(chiffre.subarray(0, 4).toString()).toBe('CNB1')
  })

  it('refuse une mauvaise phrase', () => {
    expect(() => dechiffrerTampon(chiffrerTampon(CLAIR, PHRASE), 'une-autre-phrase-assez-longue')).toThrow('phrase secrète incorrecte')
  })

  it('détecte un fichier modifié', () => {
    const chiffre = chiffrerTampon(CLAIR, PHRASE)
    chiffre[40] = (chiffre[40] ?? 0) ^ 1
    expect(() => dechiffrerTampon(chiffre, PHRASE)).toThrow('Déchiffrement impossible')
  })

  it('utilise un sel et un vecteur différents à chaque sauvegarde', () => {
    expect(chiffrerTampon(CLAIR, PHRASE).equals(chiffrerTampon(CLAIR, PHRASE))).toBe(false)
  })

  it('refuse une phrase trop courte et un fichier étranger', () => {
    expect(() => chiffrerTampon(CLAIR, 'courte')).toThrow('au moins 16 caractères')
    expect(() => dechiffrerTampon(Buffer.from('pas une sauvegarde du tout, juste du texte quelconque'), PHRASE)).toThrow('pas une sauvegarde')
  })
})
