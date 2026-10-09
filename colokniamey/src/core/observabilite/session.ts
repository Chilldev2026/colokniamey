// Identifiant de session aléatoire, gardé dans sessionStorage (RGA18) :
// il ne permet pas d'identifier une personne et disparaît à la fermeture de l'onglet.

const CLE = 'cn_session'

let enMemoire: string | null = null

function generer(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export function idSession(): string {
  if (enMemoire) return enMemoire
  try {
    const existant = sessionStorage.getItem(CLE)
    if (existant) {
      enMemoire = existant
      return existant
    }
    const nouveau = generer()
    sessionStorage.setItem(CLE, nouveau)
    enMemoire = nouveau
    return nouveau
  } catch {
    // Stockage indisponible (navigation privée stricte) : identifiant valable pour cette page seulement
    enMemoire = generer()
    return enMemoire
  }
}
