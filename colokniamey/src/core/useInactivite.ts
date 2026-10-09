// Déconnexion après inactivité (RGP28). Le temps de la dernière action est gardé dans le stockage local ;
// ce n'est pas une donnée sensible : un simple nombre. Supabase n'impose pas de limite d'inactivité
// sur l'offre gratuite, nous l'appliquons donc nous-mêmes.

const CLE = 'cn_derniere_action'
const UNE_MINUTE = 60_000

let derniereEcriture = 0

function lire(): number | null {
  try {
    const brut = localStorage.getItem(CLE)
    const valeur = brut === null ? NaN : Number(brut)
    return Number.isFinite(valeur) ? valeur : null
  } catch {
    return null
  }
}

function ecrire(valeur: number): void {
  try {
    localStorage.setItem(CLE, String(valeur))
  } catch {
    // Stockage indisponible : on ne peut pas suivre l'inactivité, la session reste simplement ouverte
  }
}

/** Note une action de l'utilisateur, au plus une écriture par minute. */
export function noterAction(maintenant: number = Date.now()): void {
  if (maintenant - derniereEcriture < UNE_MINUTE) return
  derniereEcriture = maintenant
  ecrire(maintenant)
}

/** À appeler à la connexion : la dernière action est « maintenant », sans limite d'écriture. */
export function reinitialiserInactivite(maintenant: number = Date.now()): void {
  derniereEcriture = maintenant
  ecrire(maintenant)
}

export function effacerInactivite(): void {
  derniereEcriture = 0
  try {
    localStorage.removeItem(CLE)
  } catch {
    // rien à faire
  }
}

/** Vrai si la dernière action est plus ancienne que le délai. Sans trace, on ne déconnecte pas. */
export function inactiviteDepassee(delaiMs: number, maintenant: number = Date.now()): boolean {
  const derniere = lire()
  return derniere !== null && maintenant - derniere > delaiMs
}

interface Options {
  /** Délai en millisecondes pour la personne connectée, ou null si aucun contrôle (visiteur). */
  delaiMs: () => number | null
  surExpiration: () => void
}

const EVENEMENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const

/** Démarre la surveillance. Renvoie une fonction qui l'arrête. */
export function demarrerInactivite({ delaiMs, surExpiration }: Options): () => void {
  const verifier = () => {
    const delai = delaiMs()
    if (delai !== null && inactiviteDepassee(delai)) {
      effacerInactivite()
      surExpiration()
    }
  }
  const action = () => noterAction()
  const retourOnglet = () => {
    if (document.visibilityState === 'visible') verifier()
  }

  EVENEMENTS.forEach((e) => window.addEventListener(e, action, { passive: true }))
  document.addEventListener('visibilitychange', retourOnglet)
  const minuteur = window.setInterval(verifier, UNE_MINUTE)

  return () => {
    EVENEMENTS.forEach((e) => window.removeEventListener(e, action))
    document.removeEventListener('visibilitychange', retourOnglet)
    window.clearInterval(minuteur)
  }
}
