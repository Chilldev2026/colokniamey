// Mini-lecteur Markdown pour les textes juridiques (titres, listes, paragraphes).
// Il produit des blocs de données affichés par un gabarit Vue : aucun v-html (RGP07).

export type Bloc =
  | { type: 'titre'; niveau: 1 | 2 | 3; texte: string }
  | { type: 'liste'; elements: string[] }
  | { type: 'paragraphe'; texte: string }

export function lireMarkdown(source: string): Bloc[] {
  const blocs: Bloc[] = []
  let paragraphe: string[] = []
  let liste: string[] = []

  const viderParagraphe = () => {
    if (paragraphe.length > 0) blocs.push({ type: 'paragraphe', texte: paragraphe.join(' ') })
    paragraphe = []
  }
  const viderListe = () => {
    if (liste.length > 0) blocs.push({ type: 'liste', elements: liste })
    liste = []
  }

  for (const brute of source.split(/\r?\n/)) {
    const ligne = brute.trim()
    const titre = /^(#{1,3})\s+(.+)$/.exec(ligne)
    const element = /^[-*]\s+(.+)$/.exec(ligne)

    if (titre) {
      viderParagraphe()
      viderListe()
      blocs.push({ type: 'titre', niveau: titre[1]!.length as 1 | 2 | 3, texte: titre[2]! })
    } else if (element) {
      viderParagraphe()
      liste.push(element[1]!)
    } else if (ligne === '') {
      viderParagraphe()
      viderListe()
    } else {
      viderListe()
      paragraphe.push(ligne)
    }
  }
  viderParagraphe()
  viderListe()
  return blocs
}
