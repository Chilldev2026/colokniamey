import { describe, expect, it } from 'vitest'
import { lireMarkdown } from '../legal/markdown'
import cgu from '../legal/cgu.md?raw'
import confidentialite from '../legal/confidentialite.md?raw'

describe('lireMarkdown', () => {
  it('produit titres, listes et paragraphes', () => {
    const blocs = lireMarkdown('# Titre\n\nUn texte\nsur deux lignes.\n\n- a\n- b\n')
    expect(blocs).toEqual([
      { type: 'titre', niveau: 1, texte: 'Titre' },
      { type: 'paragraphe', texte: 'Un texte sur deux lignes.' },
      { type: 'liste', elements: ['a', 'b'] },
    ])
  })

  it('ne produit jamais de HTML : une balise reste du texte', () => {
    const [bloc] = lireMarkdown('<script>alert(1)</script>')
    expect(bloc).toEqual({ type: 'paragraphe', texte: '<script>alert(1)</script>' })
  })
})

describe('textes juridiques (RGP12)', () => {
  it('portent un numéro de version et gardent leurs marqueurs', () => {
    for (const texte of [cgu, confidentialite]) {
      expect(texte).toMatch(/Version : /)
      expect(texte).toContain('[INFORMATION MANQUANTE')
    }
  })
})
