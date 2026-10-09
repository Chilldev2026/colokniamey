// Déconnexion après inactivité (RGP28, RGA36). Le temps de la dernière action est gardé dans le stockage local ;
// ce n'est pas une donnée sensible : un simple nombre. Supabase n'impose pas de limite d'inactivité
// sur l'offre gratuite, nous l'appliquons donc nous-mêmes (pour les admins, la base la vérifie aussi, A2).

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

/** Temps restant avant l'expiration, ou null sans trace d'activité. Négatif ou nul : le délai est dépassé. */
export function tempsRestant(delaiMs: number, maintenant: number = Date.now()): number | null {
  const derniere = lire()
  return derniere === null ? null : delaiMs - (maintenant - derniere)
}

interface Options {
  /** Délai en millisecondes pour la personne connectée, ou null si aucun contrôle (visiteur). */
  delaiMs: () => number | null
  surExpiration: () => void
  /** Fréquence du contrôle : une minute par défaut ; plus courte quand un avertissement doit être précis. */
  intervalleMs?: number
  /** Durée avant l'expiration à partir de laquelle on avertit (par exemple 2 minutes pour les admins). */
  avertirAvantMs?: number
  /** Reçoit le temps restant en millisecondes pendant l'avertissement, puis null quand il n'a plus lieu d'être. */
  surAvertissement?: (resteMs: number | null) => void
  /** Appelée à chaque action de l'utilisateur (par exemple pour prévenir la base, au plus toutes les 5 minutes). */
  surAction?: () => void
}

const EVENEMENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const

/** Démarre la surveillance. Renvoie une fonction qui l'arrête. */
export function demarrerInactivite({
  delaiMs,
  surExpiration,
  intervalleMs = UNE_MINUTE,
  avertirAvantMs,
  surAvertissement,
  surAction,
}: Options): () => void {
  const verifier = () => {
    const delai = delaiMs()
    if (delai === null) return
    const reste = tempsRestant(delai)
    if (reste === null) return
    if (reste <= 0) {
      surAvertissement?.(null)
      effacerInactivite()
      surExpiration()
      return
    }
    if (avertirAvantMs !== undefined && reste <= avertirAvantMs) surAvertissement?.(reste)
    else surAvertissement?.(null)
  }
  const action = () => {
    noterAction()
    surAction?.()
  }
  const retourOnglet = () => {
    if (document.visibilityState === 'visible') verifier()
  }

  EVENEMENTS.forEach((e) => window.addEventListener(e, action, { passive: true }))
  document.addEventListener('visibilitychange', retourOnglet)
  const minuteur = window.setInterval(verifier, intervalleMs)

  return () => {
    EVENEMENTS.forEach((e) => window.removeEventListener(e, action))
    document.removeEventListener('visibilitychange', retourOnglet)
    window.clearInterval(minuteur)
  }
}
